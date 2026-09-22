/*
The Apps Script backend, exercised as written.

Covers the list in the brief: valid submission, empty required fields, invalid
email, invalid phone, long message, special characters, honeypot, rapid
repeats, the sheet row, both emails, and the failure paths - including the one
that matters most, that a failure never reports success.

What this cannot prove is that the client's own Google account, sheet sharing
and deployment access level are right. Only a real submission shows that.
*/

import { createHost, readProject } from "./apps-script-host.mjs"

let pass = 0, fail = 0
const failures = []
function check(name, cond, detail) {
    if (cond) { pass++; console.log("  PASS  " + name) }
    else { fail++; failures.push(name + (detail ? " -> " + detail : "")); console.log("  FAIL  " + name + (detail ? "  (" + detail + ")" : "")) }
}

const COLUMNS = [
    "Submission Date & Time", "Name", "Email", "Phone",
    "Subject", "Message", "Source/Page", "Status",
]

const GOOD = {
    name: "Jane Doe",
    email: "jane.doe@example.com",
    phone: "(971) 978-7840",
    treatment: "Aesthetic Injectables",
    contact_method: "Phone call",
    message: "I would like to ask about a consultation.",
    consent: "yes",
    _requireConsent: "yes",
    _required: "name,email,phone,treatment,contact_method,consent",
    _form: "contact",
    _subject: "Contact enquiry",
    _page: "/contact.html",
}

const sub = (over = {}) => ({ ...GOOD, ...over })

// ---------------------------------------------------------------------------

console.log("\n1. A VALID SUBMISSION")
let h = createHost()
let res = h.post(sub())

check("returns ok", res.ok === true, JSON.stringify(res))
check("names the thank-you page", res.redirect === "/thank-you", res.redirect)

check("the tab was created with the agreed columns",
    JSON.stringify(h.header()) === JSON.stringify(COLUMNS), JSON.stringify(h.header()))
check("exactly one enquiry row", h.dataRows().length === 1, "rows=" + h.dataRows().length)

let row = h.dataRows()[0] || []
check("col 1  date & time is readable", /\d{4}/.test(row[0]) && /(AM|PM)/.test(row[0]), row[0])
check("col 2  name", row[1] === "Jane Doe", row[1])
check("col 3  email, lower-cased", row[2] === "jane.doe@example.com", row[2])
check("col 4  phone", row[3] === "(971) 978-7840", row[3])
check("col 5  subject is the chosen treatment", row[4] === "Aesthetic Injectables", row[4])
check("col 6  message", row[5] === GOOD.message, row[5])
check("col 7  source page", row[6] === "/contact.html", row[6])
check("col 8  status is New", row[7] === "New", row[7])
check("the row is exactly 8 columns wide", row.length === 8, String(row.length))
check("a write lock was taken", h.state.lockWaits === 1, String(h.state.lockWaits))

console.log("\n2. THE TWO EMAILS")
check("two emails sent", h.state.inbox.length === 2, "sent=" + h.state.inbox.length)
const admin = h.state.inbox.find((m) => m.to === "webmaster@codevelop.us")
const cust = h.state.inbox.find((m) => m.to === "jane.doe@example.com")

check("the practice is notified at webmaster@codevelop.us", !!admin)
check("subject is '[TEST] New Contact Form Enquiry - Jane Doe' on the test account",
    admin && admin.subject === "[TEST] New Contact Form Enquiry - Jane Doe", admin && admin.subject)
check("Reply-To is the patient", admin && admin.replyTo === "jane.doe@example.com", admin && admin.replyTo)
check("admin email lists every submitted field",
    admin && ["Jane Doe", "971", "Aesthetic Injectables", "/contact.html"].every((s) => admin.htmlBody.includes(s)))
check("admin email carries a plain-text part", admin && admin.body && admin.body.includes("New contact form enquiry"))

check("the patient gets a confirmation", !!cust)
check("its Reply-To is the practice", cust && cust.replyTo === "abcaestheticsllc@gmail.com", cust && cust.replyTo)
check("it thanks them by name", cust && cust.htmlBody.includes("Thank you, Jane Doe"))
check("it says the team will get back to them",
    cust && /get back to you/i.test(cust.htmlBody) && /review/i.test(cust.htmlBody))
check("it is branded as the practice", cust && cust.name === "ABC Aesthetics & Wellness", cust && cust.name)
check("it carries a plain-text part", cust && cust.body && cust.body.includes("Thank you, Jane Doe"))

console.log("\n3. EMPTY AND INVALID INPUT")
const cases = [
    ["everything empty", {}, ["name", "email", "phone", "subject"]],
    ["invalid email", sub({ email: "jane@@nope" }), ["email"]],
    ["email with no domain dot", sub({ email: "jane@nope" }), ["email"]],
    ["phone too short", sub({ phone: "12345" }), ["phone"]],
    ["phone too long", sub({ phone: "1234567890123456789" }), ["phone"]],
    ["treatment left unselected", sub({ treatment: "" }), ["subject"]],
    ["consent not ticked", sub({ consent: "" }), ["consent"]],
    ["name with no letters", sub({ name: "12345" }), ["name"]],
    ["appointment missing date and time",
        sub({ preferred_date: "", preferred_time: "", _required: "name,email,phone,treatment,preferred_date,preferred_time,consent" }),
        ["preferred_date", "preferred_time"]],
]

for (const [label, payload, expect] of cases) {
    const before = h.dataRows().length
    const r = h.post(payload)
    const keys = Object.keys(r.errors || {})
    check(label + " -> refused", r.ok === false && r.code === "invalid", JSON.stringify(r).slice(0, 90))
    check(label + " -> flags " + expect.join(","), expect.every((k) => keys.includes(k)), keys.join(",") || "none")
    check(label + " -> nothing written", h.dataRows().length === before)
    check(label + " -> no redirect offered", !r.redirect)
}

console.log("\n4. LONG MESSAGE AND SPECIAL CHARACTERS")
h = createHost()
h.post(sub({ message: "A".repeat(5000) }))
check("a 5000-character message is capped at 2000",
    (h.dataRows()[0][5] || "").length === 2000, String((h.dataRows()[0][5] || "").length))

h = createHost()
const NUL = String.fromCharCode(0), ZWSP = String.fromCharCode(0x200b)
h.post(sub({ name: "Zoë  O'Brien" + NUL + ZWSP,
    message: "Cost? <script>alert(1)</script> & \"quotes\" — dash" }))
row = h.dataRows()[0]
check("accented and apostrophed names are kept", row[1] === "Zoë O'Brien", JSON.stringify(row[1]))
check("control characters are stripped", row[1].indexOf(NUL) === -1 && row[1].indexOf(ZWSP) === -1, JSON.stringify(row[1]))
check("angle brackets survive in the sheet as text", row[5].includes("<script>"), row[5])
check("the email escapes them instead of embedding markup",
    h.state.inbox[0].htmlBody.includes("&lt;script&gt;") &&
    !h.state.inbox[0].htmlBody.includes("<script>alert"))

console.log("\n5. SPREADSHEET FORMULA INJECTION")
h = createHost()
// NB: no URL in the name here - a name containing one is dropped as spam
// (section 6), which would hide whether the formula guard works.
h.post(sub({ name: "=SUM(A1:A9)", message: "+1+1", email: "calc@example.com" }))
row = h.dataRows()[0]
check("a formula in the name is neutralised", row[1].startsWith("'="), JSON.stringify(row[1]))
check("a leading + is neutralised", row[5].startsWith("'+"), JSON.stringify(row[5]))
h.post(sub({ name: "Jane Doe", message: "-5 degrees", email: "minus@example.com" }))
check("a leading - is neutralised", h.dataRows()[1][5].startsWith("'-"), JSON.stringify(h.dataRows()[1][5]))
check("ordinary text is left alone", h.dataRows()[1][1] === "Jane Doe", h.dataRows()[1][1])

console.log("\n6. HONEYPOT AND SPAM")
h = createHost()
let r = h.post(sub({ _honey: "buy pills", email: "bot@spam.test" }))
check("a filled honeypot looks successful to the bot", r.ok === true && r.dropped === true, JSON.stringify(r))
check("...but nothing is written", h.dataRows().length === 0)
check("...and no email is sent", h.state.inbox.length === 0)

r = h.post(sub({ name: "Cheap pills http://spam.test", email: "links@spam.test" }))
check("a URL in the name is dropped", r.dropped === true)
check("...and nothing is written", h.dataRows().length === 0)

console.log("\n7. DUPLICATES AND RAPID REPEATS")
h = createHost()
const first = h.post(sub({ email: "dupe@example.com" }))
const second = h.post(sub({ email: "dupe@example.com" }))
check("the first is accepted", first.ok === true && !first.duplicate)
check("an identical repeat reports success", second.ok === true && second.duplicate === true, JSON.stringify(second))
check("...but only one row exists", h.dataRows().length === 1, "rows=" + h.dataRows().length)
check("...and only one pair of emails went out", h.state.inbox.length === 2, "sent=" + h.state.inbox.length)

// With the cache wiped, the sheet scan alone must still catch it.
h.clearCache()
h.post(sub({ email: "dupe@example.com" }))
check("caught by the sheet even with the cache gone", h.dataRows().length === 1, "rows=" + h.dataRows().length)

console.log("\n8. RATE LIMITING")
h = createHost()
let blocked = null
for (let i = 0; i < 8; i++) {
    // Same address, different message each time, so dedupe is not what stops it.
    const out = h.post(sub({ email: "flood@example.com", message: "enquiry number " + i }))
    if (out.code === "rate_limited") { blocked = out; break }
}
check("a burst from one address is eventually refused", !!blocked, "never refused")
check("the refusal is not a fake success", blocked && blocked.ok === false)
check("the refusal offers the phone number", blocked && /971-978-7840/.test(blocked.error), blocked && blocked.error)
check("no redirect on a refusal", blocked && !blocked.redirect)

console.log("\n9. FAILURE PATHS")
h = createHost({ failSheet: true })
r = h.post(sub({ email: "sheetdown@example.com" }))
check("sheet unreachable -> reported as a failure", r.ok === false, JSON.stringify(r))
check("sheet unreachable -> NO redirect", !r.redirect, JSON.stringify(r))
check("sheet unreachable -> visitor told to phone", /971-978-7840/.test(r.error), r.error)
check("sheet unreachable -> nothing technical leaked",
    !/simulated|stack|Error:|SpreadsheetApp/i.test(r.error), r.error)
check("sheet unreachable -> no email promising a reply", h.state.inbox.length === 0, "sent=" + h.state.inbox.length)

// Mail failing AFTER the row is written must not lose the enquiry.
h = createHost()
h.state.failMail = true
r = h.post(sub({ email: "mailfail@example.com" }))
check("email failure still reports success", r.ok === true, JSON.stringify(r))
check("...because the enquiry is safely in the sheet", h.dataRows().length === 1)
check("...and the failure is logged for the practice",
    h.state.logs.some((l) => /FLOW 2 .admin email. failed/.test(l)), h.state.logs.join(" | ").slice(0, 120))

console.log("\n9b. THE THREE FLOWS ARE INDEPENDENT")

// Each flow reports its own outcome.
h = createHost()
r = h.post(sub({ email: "flows@example.com" }))
check("the response reports each flow separately",
    r.flows && r.flows.sheet === true && r.flows.adminEmail === true && r.flows.autoReply === true,
    JSON.stringify(r.flows))

// Flow 1 off: the emails still go out. Turning a flow off is a decision, not
// a failure, so it must not stop the others.
h = createHost()
h.sandbox.CONFIG.FLOWS.SAVE_TO_SHEET = false
r = h.post(sub({ email: "nosheet@example.com" }))
check("flow 1 off -> still succeeds", r.ok === true, JSON.stringify(r))
check("flow 1 off -> nothing written", h.dataRows().length === 0, "rows=" + h.dataRows().length)
check("flow 1 off -> both emails still sent", h.state.inbox.length === 2, "sent=" + h.state.inbox.length)

// Flow 2 off: the sheet and the patient reply are unaffected.
h = createHost()
h.sandbox.CONFIG.FLOWS.NOTIFY_ADMIN = false
r = h.post(sub({ email: "noadmin@example.com" }))
check("flow 2 off -> still succeeds", r.ok === true)
check("flow 2 off -> row still written", h.dataRows().length === 1)
check("flow 2 off -> only the patient is emailed",
    h.state.inbox.length === 1 && h.state.inbox[0].to === "noadmin@example.com",
    JSON.stringify(h.state.inbox.map((m) => m.to)))

// Flow 3 off: the practice is still told.
h = createHost()
h.sandbox.CONFIG.FLOWS.AUTO_REPLY = false
r = h.post(sub({ email: "noreply@example.com" }))
check("flow 3 off -> still succeeds", r.ok === true)
check("flow 3 off -> row still written", h.dataRows().length === 1)
check("flow 3 off -> only the practice is emailed",
    h.state.inbox.length === 1 && h.state.inbox[0].to === "webmaster@codevelop.us",
    JSON.stringify(h.state.inbox.map((m) => m.to)))

// Flow 1 FAILING (as opposed to switched off) must stop the emails.
h = createHost({ failSheet: true })
r = h.post(sub({ email: "sheetbroken@example.com" }))
check("flow 1 failing -> the whole submission fails", r.ok === false, JSON.stringify(r))
check("flow 1 failing -> no email promises a reply", h.state.inbox.length === 0, "sent=" + h.state.inbox.length)

// A failed submission must not poison the visitor's retry as a duplicate.
h = createHost({ failSheet: true })
h.post(sub({ email: "retry@example.com" }))
h.state.failSheet = false
r = h.post(sub({ email: "retry@example.com" }))
check("a retry after a failure is accepted, not seen as a duplicate",
    r.ok === true && !r.duplicate, JSON.stringify(r))
check("...and the retry is written", h.dataRows().length === 1, "rows=" + h.dataRows().length)

// The health check reports which flows are enabled.
h = createHost()
h.sandbox.CONFIG.FLOWS.AUTO_REPLY = false
const hc = h.get()
check("doGet reports the flow switches",
    hc.flows && hc.flows.sheet === true && hc.flows.autoReply === false, JSON.stringify(hc.flows))

// Each flow's message can be built and inspected on its own.
h = createHost()
const probe = { name: "Jane Doe", email: "jane@example.com", phone: "971-978-7840",
    subject: "Injectables", message: "hello", contactMethod: "Email",
    preferredDate: "", preferredTime: "", consent: "Yes", form: "contact", page: "/contact.html" }
const builtAdmin = h.sandbox.buildAdminEmail(probe, "Sep 22, 2026 at 10:00 AM")
const builtReply = h.sandbox.buildAutoReply(probe)
check("flow 2's email can be built without sending",
    builtAdmin.to === "webmaster@codevelop.us" && /New Contact Form Enquiry/.test(builtAdmin.subject),
    builtAdmin.subject)
check("flow 3's email can be built without sending",
    builtReply.to === "jane@example.com" && /We have your enquiry/.test(builtReply.subject),
    builtReply.subject)
check("building them sends nothing", h.state.inbox.length === 0, "sent=" + h.state.inbox.length)

console.log("\n10. THE HEALTH CHECK")
h = createHost()
h.post(sub())
const health = h.get()
check("doGet reports healthy", health.ok === true, JSON.stringify(health))
check("it names the tab", health.sheet === "Enquiries", health.sheet)
check("it counts enquiries, not the header", health.rows === 1, String(health.rows))

console.log("\n11. A FORM WITH NO TREATMENT SELECTOR")
h = createHost()
const noTreatment = sub({ _required: "name,email,phone,consent" })
delete noTreatment.treatment
r = h.post(noTreatment)
check("falls back to the form's title", r.ok === true, JSON.stringify(r))
check("...and records it as the subject", h.dataRows()[0][4] === "Contact enquiry", h.dataRows()[0][4])

console.log("\n12. THE EDITOR TEST FUNCTIONS (Setup.gs)")
h = createHost()
h.sandbox.testFlow1_Sheet()
check("testFlow1_Sheet writes a row", h.dataRows().length === 1, "rows=" + h.dataRows().length)
check("testFlow1_Sheet sends no email", h.state.inbox.length === 0, "sent=" + h.state.inbox.length)

h = createHost()
h.sandbox.testFlow2_AdminEmail()
check("testFlow2_AdminEmail emails the practice",
    h.state.inbox.length === 1 && h.state.inbox[0].to === "webmaster@codevelop.us",
    JSON.stringify(h.state.inbox.map((m) => m.to)))
check("testFlow2_AdminEmail writes nothing", h.dataRows().length === 0)

h = createHost()
h.sandbox.testFlow3_AutoReply()
check("testFlow3_AutoReply sends the patient confirmation to the admin",
    h.state.inbox.length === 1 && /We have your enquiry/.test(h.state.inbox[0].subject),
    h.state.inbox.length ? h.state.inbox[0].subject : "none")
check("testFlow3_AutoReply writes nothing", h.dataRows().length === 0)

h = createHost()
h.sandbox.setup()
check("setup() runs all three flows", h.dataRows().length === 1 && h.state.inbox.length === 2,
    "rows=" + h.dataRows().length + " sent=" + h.state.inbox.length)
check("setup() reports each flow by name",
    h.state.logs.some((l) => /Flow 1/.test(l)) &&
    h.state.logs.some((l) => /Flow 2/.test(l)) &&
    h.state.logs.some((l) => /Flow 3/.test(l)))

h = createHost()
h.sandbox.testValidationOnly()
check("testValidationOnly touches nothing",
    h.dataRows().length === 0 && h.state.inbox.length === 0)

console.log("\n13. TEST ACCOUNT vs PRODUCTION ACCOUNT")
h = createHost()
check("the test account is the default", h.sandbox.CONFIG.ENVIRONMENT === "test", h.sandbox.CONFIG.ENVIRONMENT)
h.post(sub({ email: "envtest@example.com" }))
check("a test enquiry is marked [TEST] to the practice",
    h.state.inbox.find((m) => m.to === "webmaster@codevelop.us").subject.startsWith("[TEST] "),
    h.state.inbox.find((m) => m.to === "webmaster@codevelop.us").subject)
check("but the PATIENT never sees the word TEST",
    !/TEST/.test(h.state.inbox.find((m) => m.to === "envtest@example.com").subject) &&
    !/TEST/.test(h.state.inbox.find((m) => m.to === "envtest@example.com").htmlBody),
    h.state.inbox.find((m) => m.to === "envtest@example.com").subject)
check("the sheet row is not polluted with a marker",
    h.dataRows()[0][1] === "Jane Doe" && h.dataRows()[0][4] === "Aesthetic Injectables",
    JSON.stringify(h.dataRows()[0].slice(1, 5)))

h = createHost()
h.sandbox.CONFIG.ENVIRONMENT = "production"
h.post(sub({ email: "prod@example.com" }))
check("on production the prefix is gone",
    h.state.inbox.find((m) => m.to === "webmaster@codevelop.us").subject === "New Contact Form Enquiry - Jane Doe",
    h.state.inbox.find((m) => m.to === "webmaster@codevelop.us").subject)

// The health check is how you tell two Web App URLs apart after migrating.
h = createHost()
h.sandbox.CONFIG.OWNER_ACCOUNT = "dev@example.com"
const env = h.get()
check("the health check names the environment", env.environment === "test", env.environment)
check("the health check names the owning account", env.owner === "dev@example.com", env.owner)

// Nothing account-specific may be hard-coded outside Config.gs.
const project = readProject()
const configOnly = project.slice(project.indexOf("//# Config.gs"), project.indexOf("//# Validation.gs"))
const elsewhere = project.replace(configOnly, "")
check("no spreadsheet id is hard-coded outside Config.gs",
    !/[01][A-Za-z0-9_-]{25,}/.test(elsewhere))
// example.com is reserved for documentation (RFC 2606) and can never be a
// real mailbox, so sample data in Setup.gs is not an account leak.
const strayEmails = elsewhere
    .replace(/CONFIG[.][A-Z_]+/g, "")
    .match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}/g) || []
const realStrays = strayEmails.filter((a) => !/@example[.](com|org|net)$/i.test(a))
check("no real email address is hard-coded outside Config.gs",
    realStrays.length === 0, realStrays.join(", "))

console.log("\n14. MAIL PROVIDERS")

// Default: Google MailApp, no HTTP at all.
h = createHost()
h.post(sub({ email: "gmailpath@example.com" }))
check("default provider uses Gmail, makes no HTTP call",
    h.state.inbox.length === 2 && h.state.http.length === 0,
    "inbox=" + h.state.inbox.length + " http=" + h.state.http.length)

// Configured for a provider but with NO key -> must fall back, not vanish.
h = createHost()
h.sandbox.CONFIG.MAIL_PROVIDER = "postmark"
h.sandbox.CONFIG.MAIL_FROM = "ABC Aesthetics <noreply@abcaestheticsllc.com>"
h.post(sub({ email: "nokey@example.com" }))
check("provider set but no key -> falls back to Gmail", h.state.inbox.length === 2, "inbox=" + h.state.inbox.length)
check("...makes no HTTP call", h.state.http.length === 0)
check("...and says so in the log",
    h.state.logs.some((l) => /no API key is set/.test(l)), h.state.logs.slice(-1)[0])

// Each provider: right endpoint, right auth header, both body parts.
const PROVIDERS = [
    ["postmark", "api.postmarkapp.com", "X-Postmark-Server-Token"],
    ["resend", "api.resend.com", "Authorization"],
    ["sendgrid", "api.sendgrid.com", "Authorization"],
    ["brevo", "api.brevo.com", "api-key"],
    ["mailgun", "api.mailgun.net", "Authorization"],
]

for (const [name, host, authHeader] of PROVIDERS) {
    h = createHost()
    h.sandbox.CONFIG.MAIL_PROVIDER = name
    h.sandbox.CONFIG.MAIL_FROM = "ABC Aesthetics <noreply@abcaestheticsllc.com>"
    h.sandbox.CONFIG.MAIL_DOMAIN = "mg.abcaestheticsllc.com"
    h.state.props.MAIL_API_KEY = "test-key-123"
    h.post(sub({ email: "patient@example.com" }))

    check(name + ": two API calls, no Gmail",
        h.state.http.length === 2 && h.state.inbox.length === 0,
        "http=" + h.state.http.length + " gmail=" + h.state.inbox.length)
    check(name + ": correct endpoint",
        h.state.http.every((r) => r.url.includes(host)), h.state.http.map((r) => r.url).join(" "))
    check(name + ": carries the API key",
        h.state.http.every((r) => JSON.stringify(r.options.headers || {}).includes("test-key-123") ||
            JSON.stringify(r.options.headers || {}).includes(Buffer.from("api:test-key-123").toString("base64"))),
        JSON.stringify(h.state.http[0].options.headers))
    check(name + ": uses the " + authHeader + " header",
        h.state.http.every((r) => Object.keys(r.options.headers || {}).includes(authHeader)),
        Object.keys(h.state.http[0].options.headers || {}).join(","))

    const sent = h.state.http.map((r) => typeof r.options.payload === "string"
        ? r.options.payload : JSON.stringify(r.options.payload)).join(" ")
    check(name + ": sends from the verified address", sent.includes("noreply@abcaestheticsllc.com"), "")
    check(name + ": reaches both recipients",
        sent.includes("webmaster@codevelop.us") && sent.includes("patient@example.com"), "")
    check(name + ": includes an HTML part", /Thank you, Jane Doe|New contact form enquiry/.test(sent), "")
    check(name + ": includes a plain-text part",
        sent.includes("Reply to this email") || sent.includes("we have your enquiry"), "")
    check(name + ": the API key is never in the body", !sent.includes("test-key-123"), "")
}

// A provider rejecting the message is a flow failure, not a lost enquiry.
h = createHost()
h.sandbox.CONFIG.MAIL_PROVIDER = "resend"
h.sandbox.CONFIG.MAIL_FROM = "ABC <noreply@abcaestheticsllc.com>"
h.state.props.MAIL_API_KEY = "bad-key"
h.state.httpReply = { code: 401, body: JSON.stringify({ message: "invalid api key" }) }
r = h.post(sub({ email: "rejected@example.com" }))
check("a provider rejection still stores the enquiry", r.ok === true && h.dataRows().length === 1,
    JSON.stringify(r))
check("...and is logged against the right flow",
    h.state.logs.some((l) => /FLOW 2 .admin email. failed/.test(l)) &&
    h.state.logs.some((l) => /FLOW 3 .auto-reply. failed/.test(l)),
    h.state.logs.join(" | ").slice(0, 140))
check("...without leaking the key into the message",
    !h.state.logs.join(" ").includes("bad-key"), "")

// An unknown provider name must be loud, not silent.
h = createHost()
h.sandbox.CONFIG.MAIL_PROVIDER = "not-a-provider"
h.sandbox.CONFIG.MAIL_FROM = "ABC <noreply@abcaestheticsllc.com>"
h.state.props.MAIL_API_KEY = "k"
r = h.post(sub({ email: "unknown@example.com" }))
check("an unknown provider fails the email flows, not the enquiry",
    r.ok === true && h.dataRows().length === 1)
check("...and names the valid options",
    h.state.logs.some((l) => /Unknown MAIL_PROVIDER/.test(l) && /postmark/.test(l)),
    h.state.logs.filter((l) => /Unknown/.test(l))[0])

// Mailgun without its domain must say exactly what is missing.
h = createHost()
h.sandbox.CONFIG.MAIL_PROVIDER = "mailgun"
h.sandbox.CONFIG.MAIL_FROM = "ABC <noreply@abcaestheticsllc.com>"
h.sandbox.CONFIG.MAIL_DOMAIN = ""
h.state.props.MAIL_API_KEY = "k"
h.post(sub({ email: "nodomain@example.com" }))
check("Mailgun without MAIL_DOMAIN explains itself",
    h.state.logs.some((l) => /MAIL_DOMAIN/.test(l)), h.state.logs.filter((l) => /Mailgun/.test(l))[0])

// Address splitting, which every adapter depends on.
h = createHost()
check("splits \"Name <addr>\"",
    h.sandbox.splitAddress("ABC Aesthetics <hi@example.com>").email === "hi@example.com" &&
    h.sandbox.splitAddress("ABC Aesthetics <hi@example.com>").name === "ABC Aesthetics", "")
check("handles a bare address",
    h.sandbox.splitAddress("hi@example.com").email === "hi@example.com" &&
    h.sandbox.splitAddress("hi@example.com").name === "", "")

// The key must live in Script Properties, never in the source.
check("no API key is hard-coded in any .gs file",
    !/MAIL_API_KEY\s*[:=]\s*["'][^"']+["']/.test(readProject()), "")

// ---------------------------------------------------------------------------
console.log("\n" + "-".repeat(64))
console.log(fail === 0 ? "ALL PASS" : "FAILURES", "  " + pass + " passed, " + fail + " failed")
if (fail) console.log("\n" + failures.map((f) => "  - " + f).join("\n"))
process.exit(fail ? 1 : 0)
