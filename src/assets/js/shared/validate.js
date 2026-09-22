/*
File: Enquiry validation and sanitisation

This module is deliberately free of any Node or browser API so the SAME file
can be imported by the serverless function and by the page script. The rules
therefore cannot drift apart: whatever the browser accepts is exactly what the
server accepts, and a visitor can never be shown "looks fine" by one and
"invalid" by the other.

Nothing here trusts the client. The browser copy exists to give fast, polite
feedback; the server copy is the one that decides.
*/

export const LIMITS = {
    name: { min: 2, max: 80 },
    email: { max: 254 },
    phone: { minDigits: 10, maxDigits: 15 },
    subject: { max: 120 },
    message: { max: 2000 },
}

// Deliberately permissive - the point is to reject the obviously-not-an-address,
// not to adjudicate RFC 5322. Anything stricter starts rejecting real people.
const EMAIL = /^[^\s@,;:<>()[\]\u005c]+@[^\s@.,;:<>()[\]\u005c]+(\.[^\s@.,;:<>()[\]\u005c]+)+$/

// Control characters, and the bidi/zero-width run used to disguise text.
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u200b-\u200f\u2028\u2029\u202a-\u202e\u2066-\u2069\ufeff]/g

/**
 * Strip anything that has no business in a form field, collapse runs of
 * whitespace, and cap the length. Returns a plain, safe string.
 *
 * This is not HTML escaping - escaping happens at the point of rendering
 * (see mailer.js), because what is safe depends on where the value lands.
 */
export function clean(value, max) {
    let s = value == null ? "" : String(value)
    s = s.replace(CONTROL, "")
    s = s.replace(/\r\n?/g, "\n")
    s = s.replace(/[ \t]+/g, " ")
    s = s.replace(/\n{3,}/g, "\n\n")
    s = s.trim()
    if (max && s.length > max) s = s.slice(0, max).trim()
    return s
}

/** Digits only - what actually matters about a phone number. */
export function phoneDigits(value) {
    return String(value == null ? "" : value).replace(/\D+/g, "")
}

// Wording for the fields the forms mark required beyond the core four.
const REQUIRED_MESSAGES = {
    treatment: "Please choose what you are interested in.",
    contact_method: "Please choose how we should contact you.",
    preferred_date: "Please choose a preferred date.",
    preferred_time: "Please choose a preferred time.",
}

/**
 * Validate a raw submission.
 *
 * Returns { ok, errors, value } where errors is keyed by field name so the
 * page can put each message beside its own input, and value is the cleaned
 * data that should actually be stored.
 */
export function validate(raw = {}) {
    const errors = {}
    const v = {}

    v.name = clean(raw.name, LIMITS.name.max)
    if (!v.name) errors.name = "Please tell us your name."
    else if (v.name.length < LIMITS.name.min) errors.name = "Please enter your full name."
    else if (!/\p{L}/u.test(v.name)) errors.name = "Please enter your name using letters."

    v.email = clean(raw.email, LIMITS.email.max).toLowerCase()
    if (!v.email) errors.email = "Please enter an email address."
    else if (!EMAIL.test(v.email)) errors.email = "That email address does not look right."

    const digits = phoneDigits(raw.phone)
    v.phone = clean(raw.phone, 40)
    if (!digits) errors.phone = "Please enter a phone number."
    else if (digits.length < LIMITS.phone.minDigits) errors.phone = "That phone number looks too short."
    else if (digits.length > LIMITS.phone.maxDigits) errors.phone = "That phone number looks too long."
    v.phoneDigits = digits

    // The subject is the treatment the visitor picked.
    //
    // The form's own title is a fallback ONLY for a form that has no treatment
    // selector at all. Letting it stand in for an empty one would mean a
    // required "Treatment of Interest" silently passed validation, which is
    // exactly the bug this shape avoids: the key is present but empty when the
    // field exists and was left alone, and absent when there is no such field.
    const hasTreatmentField = Object.prototype.hasOwnProperty.call(raw, "treatment")
    const explicit = clean(raw.subject, LIMITS.subject.max)

    if (explicit) v.subject = explicit
    else if (hasTreatmentField) v.subject = clean(raw.treatment, LIMITS.subject.max)
    else v.subject = clean(raw._subject, LIMITS.subject.max)

    if (!v.subject) errors.subject = "Please choose what you are interested in."

    v.message = clean(raw.message, LIMITS.message.max)
    if (raw.message && v.message.length > LIMITS.message.max) {
        errors.message = "Please keep your message under " + LIMITS.message.max + " characters."
    }

    // Only enforced when the form asks for it - the server must not invent a
    // requirement the visitor was never shown.
    if (raw._requireConsent === "yes" || raw._requireConsent === true) {
        if (!raw.consent) errors.consent = "Please tick the box so we may contact you."
    }
    v.consent = raw.consent ? "Yes" : "No"

    // Everything else the form itself marked required.
    //
    // Taking over submission means the browser no longer enforces `required`,
    // so any field not named above would quietly become optional - the
    // appointment form's date and time, for instance. The page sends the list
    // it actually rendered, and it is checked here too, so the two sides agree
    // about a form this module has never been told the shape of.
    //
    // This is a correctness check, not a security one: the four fields that
    // matter are enforced unconditionally above, whatever the client claims.
    for (const key of String(raw._required || "").split(",").map((s) => s.trim()).filter(Boolean)) {
        if (errors[key] || key === "consent") continue
        if (key === "treatment" && (errors.subject || v.subject)) continue
        if (!String(raw[key] == null ? "" : raw[key]).trim()) {
            errors[key] = REQUIRED_MESSAGES[key] || "Please fill this in."
        }
    }

    // Carried through, not validated - these are chosen from fixed lists.
    v.treatment = clean(raw.treatment, LIMITS.subject.max)
    v.contactMethod = clean(raw.contact_method, 40)
    v.preferredDate = clean(raw.preferred_date, 40)
    v.preferredTime = clean(raw.preferred_time, 40)
    v.form = clean(raw._form, 60) || "contact"
    v.formTitle = clean(raw._subject, LIMITS.subject.max) || "Website enquiry"
    v.page = clean(raw._page, 200) || "/"

    return { ok: Object.keys(errors).length === 0, errors, value: v }
}

/** A stable identity for a submission, used to spot the same one arriving twice. */
export function fingerprint(v) {
    return [v.email, v.form, v.subject, v.message].join("\u0001").toLowerCase()
}
