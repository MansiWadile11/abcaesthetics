/**
 * SETUP AND PER-FLOW TESTS
 * =========================================================================
 *
 * Run these from the function dropdown at the top of the Apps Script editor,
 * then read the output under "Execution log".
 *
 *   setup()                 do this ONCE after pasting the code.
 *                           Creates the tab, runs all three flows, and
 *                           triggers Google's permission prompt while you
 *                           are watching rather than on a patient's first
 *                           attempt.
 *
 *   testFlow1_Sheet()       writes one test row, touches no email
 *   testFlow2_AdminEmail()  emails the practice only, writes nothing
 *   testFlow3_AutoReply()   emails ADMIN_EMAIL a copy of the patient's
 *                           confirmation, writes nothing
 *   testAllFlows()          all three, reporting each separately
 *
 * Because each flow is separate, when something is wrong these tell you
 * WHICH ONE - rather than "the form does not work".
 */


/** A realistic enquiry, used by every test below. */
function sampleEnquiry() {
    return {
        name: "Setup Test",
        email: CONFIG.ADMIN_EMAIL,
        phone: "971-978-7840",
        subject: "Setup verification",
        message: "Created by a test function in Setup.gs. Safe to delete.",
        treatment: "Setup verification",
        contactMethod: "Email",
        preferredDate: "",
        preferredTime: "",
        consent: "Yes",
        form: "setup",
        page: "/setup"
    };
}

function report(label, result) {
    var state = result.skipped ? "SKIPPED" : (result.ok ? "OK" : "FAILED");
    Logger.log("  " + label + ": " + state + "  (" + result.detail + ")");
    return result.ok;
}


// ---------------------------------------------------------------------------

function setup() {
    Logger.log("=== SETUP ===");

    var sheet = getSheet();
    Logger.log("Spreadsheet : " + getSpreadsheet().getName());
    Logger.log("Tab         : " + sheet.getName());
    Logger.log("Columns     : " + COLUMNS.join(" | "));
    Logger.log("");

    testAllFlows();

    Logger.log("");
    Logger.log("If all three say OK: delete the test row, then");
    Logger.log("Deploy -> New deployment -> Web app -> Who has access: Anyone.");
}


function testAllFlows() {
    var v = sampleEnquiry();
    var at = stamp(new Date());

    Logger.log("=== ALL THREE FLOWS ===");
    var a = report("Flow 1  Google Sheet ", flowSaveToSheet(v, at));
    var b = report("Flow 2  Admin email  ", flowNotifyAdmin(v, at));
    var c = report("Flow 3  Auto-reply   ", flowSendAutoReply(v));

    Logger.log("");
    Logger.log(a && b && c
        ? "All three flows completed."
        : "At least one flow failed - see above for which.");
}


function testFlow1_Sheet() {
    Logger.log("=== FLOW 1 - GOOGLE SHEET ===");
    var before = getSheet().getLastRow();

    report("Flow 1", flowSaveToSheet(sampleEnquiry(), stamp(new Date())));

    var after = getSheet().getLastRow();
    Logger.log("Rows: " + before + " -> " + after);
    Logger.log(after > before
        ? "A test row was added. Check the sheet, then delete it."
        : "No row was added. Check CONFIG.SHEET_ID and that the sheet is shared.");
}


function testFlow2_AdminEmail() {
    Logger.log("=== FLOW 2 - EMAIL TO THE PRACTICE ===");
    Logger.log("Sending to: " + CONFIG.ADMIN_EMAIL);

    report("Flow 2", flowNotifyAdmin(sampleEnquiry(), stamp(new Date())));

    Logger.log("Nothing was written to the sheet by this test.");
    Logger.log("Check " + CONFIG.ADMIN_EMAIL + " for 'New Contact Form Enquiry - Setup Test',");
    Logger.log("and confirm that pressing Reply addresses the patient, not Google.");
}


function testFlow3_AutoReply() {
    Logger.log("=== FLOW 3 - CONFIRMATION TO THE PATIENT ===");

    // Addressed to ADMIN_EMAIL on purpose: this is what a patient receives,
    // and it should be read before a real patient ever sees it.
    var v = sampleEnquiry();
    v.email = CONFIG.ADMIN_EMAIL;

    report("Flow 3", flowSendAutoReply(v));

    Logger.log("Nothing was written to the sheet by this test.");
    Logger.log("Check " + CONFIG.ADMIN_EMAIL + " for 'We have your enquiry - " + CONFIG.WEBSITE_NAME + "'.");
    Logger.log("That message is exactly what a patient receives.");
}


/**
 * Shows what the website will be sent back, without touching the sheet or
 * sending anything. Useful when the form reports an error and you want to
 * see the reason the backend actually gave.
 */
function testValidationOnly() {
    Logger.log("=== VALIDATION (no flows run) ===");

    var cases = [
        ["a good submission", {
            name: "Jane Doe", email: "jane@example.com", phone: "971-978-7840",
            treatment: "Aesthetic Injectables", consent: "yes", _requireConsent: "yes"
        }],
        ["everything empty", {}],
        ["a bad email", { name: "Jane Doe", email: "not-an-email", phone: "9719787840", treatment: "X" }],
        ["a short phone", { name: "Jane Doe", email: "jane@example.com", phone: "123", treatment: "X" }]
    ];

    for (var i = 0; i < cases.length; i++) {
        var out = validate(cases[i][1]);
        Logger.log(cases[i][0] + " -> " + (out.ok ? "accepted" : "rejected: " + JSON.stringify(out.errors)));
    }
}

// ===========================================================================
// MAIL PROVIDER
// ===========================================================================

/**
 * Store the API key.
 *
 * Paste the key between the quotes, choose this function from the dropdown,
 * press Run ONCE, then DELETE the key from this line and save again. The key
 * is stored in Script Properties, which is not part of the source - so these
 * files stay safe to paste, share or commit.
 *
 * You can also do it without code: Project Settings (gear icon) -> Script
 * Properties -> Add script property -> name MAIL_API_KEY.
 */
function setMailApiKey() {
    var key = "";   // <-- paste here, Run, then clear it again

    if (!key) {
        var existing = mailApiKey();
        Logger.log(existing
            ? "A key is already stored (" + existing.substring(0, 4) + "..., " + existing.length + " chars)."
            : "No key stored. Paste one into this function and Run it again.");
        return;
    }

    PropertiesService.getScriptProperties().setProperty(MAIL_KEY_PROPERTY, key);
    Logger.log("Stored. Now clear the key from this function and save.");
    Logger.log("Next: set MAIL_PROVIDER and MAIL_FROM in Config.gs, then run testMailProvider().");
}


/** Remove the stored key. */
function clearMailApiKey() {
    PropertiesService.getScriptProperties().deleteProperty(MAIL_KEY_PROPERTY);
    Logger.log("Key removed. Sending falls back to Gmail.");
}


/**
 * Check the provider setup without sending anything.
 *
 * Reports what would be sent, to which URL, and whether the pieces are in
 * place - so a misconfiguration is caught here rather than by a patient.
 */
function checkMailProvider() {
    var provider = String(CONFIG.MAIL_PROVIDER || "gmail").toLowerCase();
    Logger.log("=== MAIL PROVIDER CHECK ===");
    Logger.log("MAIL_PROVIDER : " + provider);

    if (provider === "gmail") {
        Logger.log("Using Google's MailApp. Mail will come FROM the account that authorised");
        Logger.log("this script, and there is no delivery tracking.");
        Logger.log("To change: set MAIL_PROVIDER and MAIL_FROM in Config.gs and store a key.");
        return;
    }

    var key = mailApiKey();
    Logger.log("API key      : " + (key ? "stored (" + key.length + " chars)" : "MISSING - run setMailApiKey()"));
    Logger.log("MAIL_FROM    : " + (CONFIG.MAIL_FROM || "MISSING - required for " + provider));

    if (!key || !CONFIG.MAIL_FROM) {
        Logger.log("");
        Logger.log("Not ready. Sending would fall back to Gmail.");
        return;
    }

    try {
        var request = buildMailRequest(provider, {
            to: CONFIG.ADMIN_EMAIL, subject: "check", replyTo: "",
            htmlBody: "<p>check</p>", body: "check"
        }, key);
        Logger.log("Endpoint     : " + request.url);
        Logger.log("");
        Logger.log("Configuration looks complete. Run testMailProvider() to send one real email.");
    } catch (err) {
        Logger.log("PROBLEM      : " + err.message);
    }
}


/** Send one real email through the configured provider. */
function testMailProvider() {
    Logger.log("=== SENDING A TEST EMAIL ===");
    Logger.log("Provider: " + CONFIG.MAIL_PROVIDER + "   To: " + CONFIG.ADMIN_EMAIL);

    try {
        sendMail({
            to: CONFIG.ADMIN_EMAIL,
            subject: subjectPrefix() + "Mail provider test - " + CONFIG.WEBSITE_NAME,
            replyTo: CONFIG.PRACTICE_EMAIL,
            name: CONFIG.WEBSITE_NAME,
            htmlBody: "<p>If you are reading this, the mail provider is working.</p>" +
                "<p>Check the <strong>From</strong> address is your own domain, not a Gmail address.</p>",
            body: "If you are reading this, the mail provider is working.\n\n" +
                "Check the From address is your own domain, not a Gmail address.\n"
        });
        Logger.log("Sent. Check " + CONFIG.ADMIN_EMAIL + " - and check who it came FROM.");
        Logger.log("It should also appear in the provider's dashboard.");
    } catch (err) {
        Logger.log("FAILED: " + err.message);
        Logger.log("Common causes: sender address not verified with the provider,");
        Logger.log("wrong API key, or the domain's DNS records are not live yet.");
    }
}
