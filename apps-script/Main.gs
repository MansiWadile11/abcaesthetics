/**
 * MAIN - the entry point, and the only place the three flows meet.
 * =========================================================================
 *
 * Everything before the flows is about deciding whether this submission is
 * real. Everything after is about reporting honestly what happened.
 *
 *   check the request  ->  spam  ->  validate  ->  rate limit  ->  duplicate
 *        ->  FLOW 1 sheet  ->  FLOW 2 admin email  ->  FLOW 3 auto-reply
 *
 * The flows never throw. Each hands back {ok, skipped, detail}, and the rule
 * about which failures the visitor hears about lives here, in one place.
 */


function doPost(e) {
    try {
        if (!originAllowed(e)) {
            return respond({ ok: false, code: "blocked", error: "Request blocked." });
        }

        var raw = readBody(e);
        if (!raw) {
            return respond({
                ok: false, code: "bad_request",
                error: friendly("We could not read that submission.")
            });
        }

        // Bots are told exactly what a person is told, so nothing is learned
        // about which check noticed them.
        var spam = spamSignal(raw);
        if (spam) {
            log("dropped as spam: " + spam);
            return respond({ ok: true, redirect: "/thank-you/", dropped: true });
        }

        var result = validate(raw);
        if (!result.ok) {
            return respond({
                ok: false, code: "invalid", errors: result.errors,
                error: "Please check the highlighted fields."
            });
        }

        var v = result.value;

        if (rateLimit(v)) {
            return respond({
                ok: false, code: "rate_limited",
                error: friendly("That is a few too many submissions in a row. Please wait a moment and try again")
            });
        }

        // Already sent moments ago. Report success: the enquiry IS with the
        // practice, and an error here would only prompt a third attempt.
        if (isDuplicate(v)) {
            log("duplicate ignored for " + v.email);
            return respond({ ok: true, redirect: "/thank-you/", duplicate: true });
        }

        return runFlows(v);

    } catch (err) {
        // Nothing technical ever reaches the visitor.
        log("UNHANDLED: " + (err && err.stack ? err.stack : err));
        return respond({
            ok: false, code: "server_error",
            error: friendly("Sorry - something went wrong at our end. Please try again")
        });
    }
}


/**
 * Run the three flows in order and decide what the visitor is told.
 *
 * THE RULE, in one sentence: the visitor is redirected only if the enquiry
 * was STORED, because a thank-you page is a promise that somebody will call
 * back, and nobody can call back about a row that does not exist.
 *
 * So flow 1 failing is the visitor's problem - they are told, and they keep
 * their typing. Flows 2 and 3 failing are the practice's problem - they go to
 * the log, and the visitor is not troubled with them.
 */
function runFlows(v) {
    var submittedAt = stamp(new Date());
    var flows = {};

    // --- FLOW 1 -------------------------------------------------------
    flows.sheet = flowSaveToSheet(v, submittedAt);

    if (!flows.sheet.ok) {
        // Not stored. Say so, send nothing, and offer the phone number.
        return respond({
            ok: false, code: "not_saved",
            error: friendly("Sorry - we could not save that just now. Please try again")
        });
    }

    // Only remember it as "seen" once it is genuinely recorded, or a failed
    // attempt would make the visitor's retry look like a duplicate.
    remember(v);

    // --- FLOW 2 -------------------------------------------------------
    flows.adminEmail = flowNotifyAdmin(v, submittedAt);

    // --- FLOW 3 -------------------------------------------------------
    flows.autoReply = flowSendAutoReply(v);

    var problems = [];
    for (var key in flows) {
        if (flows.hasOwnProperty(key) && !flows[key].ok) {
            problems.push(key + ": " + flows[key].detail);
        }
    }
    if (problems.length) log("completed with problems -> " + problems.join(" | "));

    return respond({
        ok: true,
        redirect: "/thank-you/",
        // Per-flow outcome, for the log and for testing. It carries no detail
        // a visitor could act on and nothing about why anything failed.
        flows: {
            sheet: flows.sheet.ok,
            adminEmail: flows.adminEmail.ok,
            autoReply: flows.autoReply.ok
        }
    });
}


/**
 * Opening the Web App URL in a browser lands here. It is a health check, so
 * the deployment can be confirmed before the website is wired up.
 */
function doGet() {
    var status = {
        ok: true,
        service: CONFIG.WEBSITE_NAME + " enquiry endpoint",
        // So you can tell at a glance which account a Web App URL belongs to.
        environment: CONFIG.ENVIRONMENT,
        owner: CONFIG.OWNER_ACCOUNT || "(not recorded)",
        // The layout the DEPLOYED code is using. Editing a file is not the
        // same as deploying it, and this is the quickest way to tell which
        // version the live URL is actually serving.
        columns: COLUMNS,
        flows: {
            sheet: CONFIG.FLOWS.SAVE_TO_SHEET !== false,
            adminEmail: CONFIG.FLOWS.NOTIFY_ADMIN !== false,
            autoReply: CONFIG.FLOWS.AUTO_REPLY !== false
        }
    };

    try {
        var sheet = getSheet();
        status.sheet = sheet.getName();
        status.rows = Math.max(0, sheet.getLastRow() - 1);
    } catch (err) {
        status.ok = false;
        status.error = err.message;
    }

    return respond(status);
}


// ===========================================================================
// REQUEST HANDLING
// ===========================================================================

function readBody(e) {
    if (!e) return null;

    // text/plain carrying JSON - what the website sends. A JSON content-type
    // would make the browser send a CORS preflight, which Apps Script cannot
    // answer, so the request would fail before arriving.
    if (e.postData && e.postData.contents) {
        try {
            var parsed = JSON.parse(e.postData.contents);
            if (parsed && typeof parsed === "object") return parsed;
        } catch (err) {
            // fall through to form-encoded below
        }
    }

    // A plain form post, so the endpoint still works without JavaScript.
    if (e.parameter && Object.keys(e.parameter).length) return e.parameter;

    return null;
}

function originAllowed(e) {
    if (!CONFIG.ALLOWED_ORIGINS || !CONFIG.ALLOWED_ORIGINS.length) return true;

    // Apps Script does not expose the Origin header, so the website sends it.
    var origin = e && e.parameter && e.parameter._origin;
    if (!origin && e && e.postData && e.postData.contents) {
        try { origin = JSON.parse(e.postData.contents)._origin; } catch (err) { origin = ""; }
    }
    if (!origin) return true;

    return CONFIG.ALLOWED_ORIGINS.indexOf(String(origin)) !== -1;
}

function respond(payload) {
    return ContentService
        .createTextOutput(JSON.stringify(payload))
        .setMimeType(ContentService.MimeType.JSON);
}

function friendly(message) {
    return message + ", or call " + CONFIG.PRACTICE_PHONE + ".";
}

/**
 * "[TEST] " while CONFIG.ENVIRONMENT is anything but "production".
 *
 * A development enquiry landing in the practice's inbox looking exactly like
 * a real one is how someone ends up phoning a patient who does not exist - or
 * worse, ignoring a real enquiry because they assumed it was a test.
 */
function subjectPrefix() {
    return CONFIG.ENVIRONMENT === "production" ? "" : "[TEST] ";
}

function log(message) {
    try { console.log("[enquiry] " + message); } catch (err) { /* older runtime */ }
}


// ===========================================================================
// Shared HTML helpers, used by both email flows.
// ===========================================================================

function escapeHtml(value) {
    return String(value === null || value === undefined ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function toHtmlLines(value) {
    return escapeHtml(value).split("\n").join("<br>");
}
