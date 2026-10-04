/**
 * ABC Aesthetics & Wellness - contact form backend
 * CONFIG - the only file you have to edit.
 * =========================================================================
 *
 * The backend is split into three independent flows:
 *
 *   Flow 1  Google Sheet      Flow1_Sheet.gs
 *   Flow 2  Admin email       Flow2_AdminEmail.gs
 *   Flow 3  Customer reply    Flow3_AutoReply.gs
 *
 * Each can be switched off, tested and changed on its own, and each fails on
 * its own without taking the others down. Main.gs runs them in order.
 */


var CONFIG = {

    // -----------------------------------------------------------------
    // WHICH ACCOUNT IS THIS?
    //
    // Everything below belongs to ONE Google account: the sheet it writes
    // to, and the address both emails are sent from. Moving to the
    // practice's Workspace account means re-creating this script there and
    // pasting the NEW Web App URL into the website - see the migration
    // checklist in SETUP-ENQUIRY-FORM.md.
    //
    // While this says "test", every notification to the practice is
    // subject-prefixed [TEST] so a development enquiry can never be
    // mistaken for a real patient. Change it to "production" as the last
    // step of the migration.
    // -----------------------------------------------------------------

    ENVIRONMENT: "test",          // "test" | "production"

    /** For your own reference - which Google account owns this script. */
    OWNER_ACCOUNT: "",


    // -----------------------------------------------------------------
    // FLOW 1 - the Google Sheet
    // -----------------------------------------------------------------

    /**
     * Copy from the sheet's URL - the long string between /d/ and /edit:
     *   docs.google.com/spreadsheets/d/THIS_PART_HERE/edit
     *
     * Leave as "" if you created this script from Extensions -> Apps Script
     * INSIDE the sheet; it then uses that sheet automatically.
     */
    SHEET_ID: "",

    /** The tab. Created with its headings automatically if it is missing. */
    SHEET_NAME: "Enquiries",

    /** The practice's timezone, so "Submission Date & Time" reads locally. */
    TIMEZONE: "America/Los_Angeles",


    // -----------------------------------------------------------------
    // FLOW 2 - the email to the practice
    // -----------------------------------------------------------------

    /**
     * Who is notified of every new enquiry.
     *
     * This MUST be an address the practice controls. It previously held the
     * developer's address (webmaster@codevelop.us), which meant every patient
     * enquiry went to the agency and no copy reached the clinic at all. That
     * is not an acceptable production setting for medical enquiries.
     *
     * The address below is the one the client supplied as the practice's
     * email when they asked for it to replace the old Gmail across the site.
     * CONFIRM IT IS MONITORED before going live - nobody has yet stated in
     * writing that this specific mailbox is where enquiry notifications
     * should land, only that it is the practice's address.
     */
    ADMIN_EMAIL: "info@abcaestheticsllc.com",

    /**
     * How the two emails are sent.
     *
     *   "gmail"     Google's own MailApp. No setup, but sends FROM the Google
     *               account that authorised the script, and gives you no way
     *               to see whether anything was delivered.
     *
     *   "postmark" | "resend" | "sendgrid" | "brevo" | "mailgun"
     *               Sends through that provider's API, so mail goes out as
     *               your own domain with delivery and bounce tracking.
     *
     * For anything other than "gmail" you must ALSO:
     *   1. set MAIL_FROM below to an address verified with that provider, and
     *   2. put the API key in Project Settings -> Script Properties under the
     *      name MAIL_API_KEY. It does NOT belong in this file.
     *
     * With a provider set but no key, sending falls back to Gmail and says so
     * in the log - an enquiry from the wrong address beats one that vanishes.
     */
    MAIL_PROVIDER: "gmail",

    /** Required for every provider except "gmail". Must be verified there. */
    MAIL_FROM: "",

    /** Mailgun only - the sending domain, e.g. "mg.abcaestheticsllc.com". */
    MAIL_DOMAIN: "",

    /** Postmark only - leave as "outbound" unless you made another stream. */
    MAIL_STREAM: "outbound",


    // -----------------------------------------------------------------
    // FLOW 3 - the confirmation sent to the patient
    // -----------------------------------------------------------------

    /** Patients are told to use these to reach the practice directly. */
    PRACTICE_EMAIL: "info@abcaestheticsllc.com",
    PRACTICE_PHONE: "971-978-7840",

    /** Optional. Adds a button to the patient's confirmation. "" omits it. */
    WEBSITE_URL: "https://abcaestheticsllc.com",


    // -----------------------------------------------------------------
    // Shared
    // -----------------------------------------------------------------

    /** Used in both emails and in the sheet's own formatting. */
    WEBSITE_NAME: "ABC Aesthetics & Wellness",

    /**
     * Turn individual flows off without deleting anything.
     *
     * Flows 2 and 3 are skipped when flow 1 is ON but FAILED - there is no
     * point promising a reply to an enquiry nobody can look up. Switching
     * flow 1 off deliberately does not stop the emails.
     */
    FLOWS: {
        SAVE_TO_SHEET: true,
        NOTIFY_ADMIN: true,
        AUTO_REPLY: true
    },

    /**
     * Google reCAPTCHA v3.
     *
     * The SECRET key is NOT here - it lives in Script Properties as
     * RECAPTCHA_SECRET (see Recaptcha.gs). Only the tuning lives here.
     *
     * MIN_SCORE is the one number worth revisiting once real traffic has been
     * seen. reCAPTCHA scores 0.0 (bot) to 1.0 (human); 0.5 is Google's own
     * suggested starting point. Raise it if spam still arrives, LOWER it if
     * genuine patients are being turned away - and err towards lower, because
     * a rejected patient enquiry costs the practice far more than a spam row.
     * Every rejection is written to the Apps Script log with its score, so
     * there is evidence to tune against rather than guesswork.
     */
    RECAPTCHA: {
        MIN_SCORE: 0.5,

        /**
         * Hostnames a token may legitimately have been solved on. Leave the
         * array empty to skip the check. localhost is here so the form can be
         * exercised locally with a real key if that is ever wanted.
         */
        ALLOWED_HOSTNAMES: [
            "abcaestheticsllc.com",
            "www.abcaestheticsllc.com",
            "localhost"
        ]
    },

    /**
     * Optional. If set, only submissions from these origins are accepted.
     * Leave empty while the domain is still moving around.
     *   e.g. ["https://abcaestheticsllc.com", "https://abcaesthetics-zeta.vercel.app"]
     */
    ALLOWED_ORIGINS: []
};


// ===========================================================================
// The sheet's columns, in order. Changing this array changes the sheet.
// ===========================================================================

var COLUMNS = [
    "Submission Date & Time",
    "Name",
    "Email",
    "Phone",
    "Treatment of Interest",
    "Preferred Contact Method",
    "Message",
    "Source/Page",
    "Status"
];

/**
 * Where each field sits, by name rather than by counting.
 *
 * The duplicate scan reads rows back out of the sheet, so inserting a column
 * used to silently break it - it would compare a phone number against a
 * message and never find a match again. Naming the positions means adding a
 * column is one edit in COLUMNS and one here.
 */
var COL = {
    SUBMITTED: 0,
    NAME: 1,
    EMAIL: 2,
    PHONE: 3,
    TREATMENT: 4,
    CONTACT_METHOD: 5,
    MESSAGE: 6,
    PAGE: 7,
    STATUS: 8
};

var STATUS_NEW = "New";


// ===========================================================================
// Abuse limits. Apps Script cannot see the caller's IP, so these key on the
// email address and on overall volume, which is what a form flood looks like.
// ===========================================================================

var LIMITS = {
    PER_EMAIL: 5,          // submissions per email address...
    PER_EMAIL_WINDOW: 600, // ...within this many seconds
    GLOBAL: 40,            // submissions overall within the same window
    DUPLICATE_WINDOW: 300  // an identical enquiry inside this window is ignored
};


// ===========================================================================
// Brand colours, used by both email flows.
// ===========================================================================

var BRAND = {
    green: "#315b49",
    ink: "#3a332c",
    cocoa: "#3a2a1c",
    page: "#fbeadd",
    gold: "#f1e1c6",
    line: "#e6d7c6",
    muted: "#7a6a5c"
};
