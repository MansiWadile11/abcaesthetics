/**
 * VALIDATION AND SANITISATION - shared by every flow
 * =========================================================================
 *
 * These rules mirror src/assets/js/shared/validate.js in the website project.
 * The website checks first so the visitor gets an instant answer; this checks
 * again because anything in a browser can be bypassed. If you change a rule
 * in one place, change it in the other.
 *
 * Nothing here talks to a flow - it only decides whether a submission is
 * usable, and hands back a cleaned copy of it.
 */


var LIMITS_FIELD = {
    NAME_MIN: 2,
    NAME_MAX: 80,
    EMAIL_MAX: 254,
    PHONE_MIN_DIGITS: 10,
    PHONE_MAX_DIGITS: 15,
    SUBJECT_MAX: 120,
    MESSAGE_MAX: 2000
};

var EMAIL_PATTERN = /^[^\s@,;:<>()[\]\\]+@[^\s@.,;:<>()[\]\\]+(\.[^\s@.,;:<>()[\]\\]+)+$/;

var REQUIRED_MESSAGES = {
    treatment: "Please choose what you are interested in.",
    contact_method: "Please choose how we should contact you.",
    preferred_date: "Please choose a preferred date.",
    preferred_time: "Please choose a preferred time."
};

/**
 * Remove control characters, and the zero-width / bidi-override run used to
 * disguise text.
 *
 * Written as code points rather than one regular expression on purpose. A
 * character class covering these is correct but fragile: one of them is
 * U+2028, which JavaScript treats as a LINE BREAK, so any editor or tool that
 * turns the escape sequences into real characters silently splits the
 * expression in half and the file stops parsing. Code points survive copy,
 * paste and every encoding in between.
 */
var CONTROL_RANGES = [
    [0x00, 0x08], [0x0b, 0x0c], [0x0e, 0x1f], [0x7f, 0x7f],
    [0x200b, 0x200f], [0x2028, 0x2029], [0x202a, 0x202e],
    [0x2066, 0x2069], [0xfeff, 0xfeff]
];

function stripControl(value) {
    var out = "";
    for (var i = 0; i < value.length; i++) {
        var code = value.charCodeAt(i);
        var drop = false;
        for (var r = 0; r < CONTROL_RANGES.length; r++) {
            if (code >= CONTROL_RANGES[r][0] && code <= CONTROL_RANGES[r][1]) {
                drop = true;
                break;
            }
        }
        if (!drop) out += value.charAt(i);
    }
    return out;
}

/**
 * Strip anything that has no business in a form field, collapse runs of
 * whitespace, and cap the length.
 */
function clean(value, max) {
    var s = (value === null || value === undefined) ? "" : String(value);

    // Control characters, and the bidi/zero-width run used to disguise text.
    s = stripControl(s);
    s = s.replace(/\r\n?/g, "\n");
    s = s.replace(/[ \t]+/g, " ");
    s = s.replace(/\n{3,}/g, "\n\n");
    s = s.replace(/^\s+|\s+$/g, "");

    if (max && s.length > max) s = s.substring(0, max).replace(/\s+$/, "");
    return s;
}

function phoneDigits(value) {
    return String(value === null || value === undefined ? "" : value).replace(/\D+/g, "");
}

function validate(raw) {
    var errors = {};
    var v = {};

    v.name = clean(raw.name, LIMITS_FIELD.NAME_MAX);
    if (!v.name) errors.name = "Please tell us your name.";
    else if (v.name.length < LIMITS_FIELD.NAME_MIN) errors.name = "Please enter your full name.";
    else if (!/[A-Za-zÀ-ɏЀ-ӿ]/.test(v.name)) errors.name = "Please enter your name using letters.";

    v.email = clean(raw.email, LIMITS_FIELD.EMAIL_MAX).toLowerCase();
    if (!v.email) errors.email = "Please enter an email address.";
    else if (!EMAIL_PATTERN.test(v.email)) errors.email = "That email address does not look right.";

    var digits = phoneDigits(raw.phone);
    v.phone = clean(raw.phone, 40);
    if (!digits) errors.phone = "Please enter a phone number.";
    else if (digits.length < LIMITS_FIELD.PHONE_MIN_DIGITS) errors.phone = "That phone number looks too short.";
    else if (digits.length > LIMITS_FIELD.PHONE_MAX_DIGITS) errors.phone = "That phone number looks too long.";

    // The subject is the treatment the visitor picked. The form's own title is
    // a fallback ONLY where there is no treatment selector at all - otherwise
    // a required "Treatment of Interest" would pass while left unselected.
    var hasTreatmentField = Object.prototype.hasOwnProperty.call(raw, "treatment");
    var explicit = clean(raw.subject, LIMITS_FIELD.SUBJECT_MAX);

    if (explicit) v.subject = explicit;
    else if (hasTreatmentField) v.subject = clean(raw.treatment, LIMITS_FIELD.SUBJECT_MAX);
    else v.subject = clean(raw._subject, LIMITS_FIELD.SUBJECT_MAX);

    if (!v.subject) errors.subject = "Please choose what you are interested in.";

    v.message = clean(raw.message, LIMITS_FIELD.MESSAGE_MAX);

    if (raw._requireConsent === "yes" || raw._requireConsent === true) {
        if (!raw.consent) errors.consent = "Please tick the box so we may contact you.";
    }
    v.consent = raw.consent ? "Yes" : "No";

    // Everything else the form itself marked required. The website sends the
    // list it rendered, so a field this file has never heard of - the
    // appointment date, say - is still enforced rather than silently optional.
    var required = String(raw._required || "").split(",");
    for (var i = 0; i < required.length; i++) {
        var key = required[i].replace(/^\s+|\s+$/g, "");
        if (!key || errors[key] || key === "consent") continue;
        if (key === "treatment" && (errors.subject || v.subject)) continue;
        var got = raw[key] === null || raw[key] === undefined ? "" : String(raw[key]);
        if (!got.replace(/^\s+|\s+$/g, "")) {
            errors[key] = REQUIRED_MESSAGES[key] || "Please fill this in.";
        }
    }

    // Carried through for the sheet and the emails, not validated - these come
    // from fixed menus rather than free text.
    v.treatment = clean(raw.treatment, LIMITS_FIELD.SUBJECT_MAX);
    v.contactMethod = clean(raw.contact_method, 40);
    v.preferredDate = clean(raw.preferred_date, 40);
    v.preferredTime = clean(raw.preferred_time, 40);
    v.form = clean(raw._form, 60) || "contact";
    v.page = clean(raw._page, 200) || "/";

    var ok = true;
    for (var k in errors) { if (errors.hasOwnProperty(k)) { ok = false; break; } }

    return { ok: ok, errors: errors, value: v };
}

/**
 * Grounds to silently drop a submission.
 *
 * Only signals with effectively no chance of a false positive belong here. A
 * dropped enquiry is invisible to whoever sent it: they see the thank-you page
 * and are told the practice will call, and then nobody does. For a medical
 * practice that is far worse than a spam email, so the bar is high.
 *
 * Note what is deliberately NOT here: how fast the form was filled in. Browser
 * autofill completes one in milliseconds.
 */
function spamSignal(raw) {
    if (String(raw._honey || "").replace(/^\s+|\s+$/g, "")) return "honeypot";
    if (/https?:\/\//i.test(String(raw.name || "") + " " + String(raw.subject || ""))) return "links-in-name";
    return null;
}

/**
 * Stop a submitted value being read as a spreadsheet formula.
 *
 * A message beginning "=" or "+" would otherwise be evaluated by Sheets, which
 * at best mangles the enquiry and at worst is used to pull data out of the
 * sheet. A leading apostrophe makes Sheets treat the cell as literal text; it
 * is not displayed.
 */


function sanitizeForSheet(value) {
    var s = (value === null || value === undefined) ? "" : String(value);
    if (/^[=+\-@\t\r]/.test(s)) return "'" + s;
    return s;
}
