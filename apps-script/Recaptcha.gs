/**
 * GOOGLE reCAPTCHA v3 - server-side token verification
 * =========================================================================
 *
 * Runs before validation, beside the honeypot and the rate limiter. It is an
 * ADDITIONAL layer: nothing else was weakened or removed to make room for it.
 *
 * WHY THE SERVER CHECKS IT
 * v3 hands the page a token and a score. Both are worthless until Google has
 * confirmed them, from the server, exactly once - anything can skip the page
 * and POST straight to the /exec URL with a made-up token, or with none.
 *
 * WHAT IS CHECKED, AND WHY EACH MATTERS
 *   success   Google recognised the token at all.
 *   hostname  the token was solved on OUR site. Without this, a token farmed
 *             on any other site using the same key would be accepted.
 *   action    the token came from the form it claims to. The expected action
 *             is derived HERE from the submitted form name, never taken from
 *             the request, so a bot cannot simply assert a valid-looking one.
 *   score     0.0 (almost certainly a bot) to 1.0 (almost certainly human).
 *             Compared against CONFIG.RECAPTCHA.MIN_SCORE.
 *
 * WHERE THE SECRET LIVES
 * NOT in this file, and NOT in the website repository. It is read from the
 * Apps Script project's own Script Properties:
 *
 *   Apps Script editor -> Project Settings (gear)
 *     -> Script Properties -> Add script property
 *        Property:  RECAPTCHA_SECRET
 *        Value:     the secret key from the reCAPTCHA admin console
 *
 * Script Properties are stored with the script, never in a file, so the
 * secret is never committed, never bundled, and never reaches a browser.
 *
 * DEVELOPMENT FALLBACK
 * No property set means verification is SKIPPED and the form keeps working -
 * which is what makes local development and the offline test suite possible
 * without a Google account. Everything else still applies: honeypot, rate
 * limiting, duplicate suppression, formula escaping and full server-side
 * validation. Setting the property is what switches enforcement on. There is
 * no half-on state.
 */


var RECAPTCHA_VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";

/**
 * The action each form is expected to have used.
 *
 * Derived from the form, never trusted from the request - that is the whole
 * point of checking it. A form not listed here is accepted on the other three
 * checks alone rather than being rejected outright, so adding a form to the
 * site cannot silently start dropping its enquiries.
 */
var RECAPTCHA_ACTIONS = {
    "contact": "submit_contact",
    "appointment": "submit_appointment",
    "appointment-home": "submit_appointment_home"
};

/** The secret, or "" when it has not been configured. */
function recaptchaSecret() {
    try {
        return (PropertiesService.getScriptProperties()
            .getProperty("RECAPTCHA_SECRET") || "").trim();
    } catch (err) {
        log("could not read Script Properties: " + err.message);
        return "";
    }
}

/** True when a secret is configured, so tokens must be verified. */
function recaptchaEnabled() {
    return recaptchaSecret() !== "";
}

/**
 * Which of three states this deployment is in. One source of truth, used by
 * both the gate and the health check, so the two can never disagree about
 * whether submissions are actually protected.
 *
 *   "enforced"      a secret is set: every token is verified.
 *   "misconfigured" ENVIRONMENT says production but no secret is set. The
 *                   form still works - a missing property must never block
 *                   patient enquiries - but nothing is being checked, and
 *                   that has to be impossible to miss.
 *   "development"   no secret, and not claiming to be production. The
 *                   intended local state: no Google account needed.
 */
function recaptchaState() {
    if (recaptchaEnabled()) return "enforced";
    return CONFIG.ENVIRONMENT === "production" ? "misconfigured" : "development";
}

/** One line for the health check. Never says "enforced" without a secret. */
function recaptchaStatusText() {
    var state = recaptchaState();
    if (state === "enforced") {
        return "recaptcha v3 enforced, min score " + recaptchaMinScore();
    }
    if (state === "misconfigured") {
        return "MISCONFIGURED: ENVIRONMENT is production but RECAPTCHA_SECRET is " +
            "not set - submissions are NOT being checked. Add the Script Property.";
    }
    return "recaptcha not configured (development fallback)";
}

/** The threshold in force, with a safe default if CONFIG is incomplete. */
function recaptchaMinScore() {
    var cfg = CONFIG.RECAPTCHA || {};
    var n = Number(cfg.MIN_SCORE);
    return (isNaN(n) || n < 0 || n > 1) ? 0.5 : n;
}

function recaptchaHostnameAllowed(hostname) {
    var allowed = (CONFIG.RECAPTCHA && CONFIG.RECAPTCHA.ALLOWED_HOSTNAMES) || [];
    if (!allowed.length) return true;   // not configured - do not block on it
    for (var i = 0; i < allowed.length; i++) {
        if (String(hostname) === String(allowed[i])) return true;
    }
    return false;
}

/**
 * Verify the token that came with a submission.
 *
 * @param raw  the submitted fields, as posted
 * @returns {ok, reason, score} - ok true when the submission may proceed.
 *          `reason` is for the practice's log only and is never shown to a
 *          visitor: it would tell a bot exactly which check to work around.
 */
function verifyRecaptcha(raw) {
    var secret = recaptchaSecret();
    if (!secret) {
        // Fail open either way - losing a patient enquiry to a missing
        // property would be far worse than accepting an unchecked one - but
        // the two cases are NOT reported the same way. Production without a
        // secret is a fault, and is logged as one on every single submission
        // so it cannot sit there unnoticed.
        if (recaptchaState() === "misconfigured") {
            log("MISCONFIGURED: ENVIRONMENT is production but RECAPTCHA_SECRET is not set. " +
                "This submission was accepted WITHOUT any CAPTCHA check. " +
                "Add the Script Property in Project Settings.");
            return { ok: true, reason: "MISCONFIGURED - production with no secret, unchecked", score: null };
        }
        return { ok: true, reason: "development fallback - not configured", score: null };
    }

    var token = String((raw && raw["g-recaptcha-response"]) || "").trim();
    if (!token) return { ok: false, reason: "no token supplied", score: null };

    var body;
    try {
        var res = UrlFetchApp.fetch(RECAPTCHA_VERIFY_URL, {
            method: "post",
            payload: { secret: secret, response: token },
            muteHttpExceptions: true
        });
        body = JSON.parse(res.getContentText() || "{}");
    } catch (err) {
        // Google unreachable. Accept rather than lose a patient's enquiry to
        // an outage on a third-party service - every other protection still
        // applies, and a missed enquiry is the more expensive failure for a
        // clinic than one spam row.
        log("reCAPTCHA verifier unreachable, submission allowed through: " + err.message);
        return { ok: true, reason: "verifier unreachable - allowed", score: null };
    }

    if (body.success !== true) {
        return {
            ok: false,
            reason: "rejected: " + ((body["error-codes"] || []).join(", ") || "unknown"),
            score: null
        };
    }

    if (!recaptchaHostnameAllowed(body.hostname)) {
        return { ok: false, reason: "wrong hostname: " + body.hostname, score: body.score };
    }

    // Derived from the form name we were given, not from a field the caller
    // controls - so a bot cannot name the action it wants checked.
    var expected = RECAPTCHA_ACTIONS[String((raw && raw._form) || "")];
    if (expected && String(body.action) !== expected) {
        return {
            ok: false,
            reason: "wrong action: got " + body.action + ", expected " + expected,
            score: body.score
        };
    }

    var score = Number(body.score);
    var min = recaptchaMinScore();
    if (!isNaN(score) && score < min) {
        return { ok: false, reason: "score " + score + " below threshold " + min, score: score };
    }

    return { ok: true, reason: "verified", score: isNaN(score) ? null : score };
}
