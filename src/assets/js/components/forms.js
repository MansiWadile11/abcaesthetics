/*
File: Forms
The contact and appointment forms post here, and on a confirmed success the
browser goes to the thank-you page.

WHERE SUBMISSIONS GO
--------------------
To a Google Apps Script Web App (apps-script/Code.gs), which writes the
enquiry to a Google Sheet, emails the practice, and sends the patient a
confirmation. There is no server of our own anywhere in the path, so the
website can move hosts without touching any of it.

Set the URL in ONE place: src/assets/js/site-config.js.

TWO THINGS ABOUT TALKING TO APPS SCRIPT
---------------------------------------
1. The body is sent as text/plain, not application/json, even though it IS
   JSON. A JSON content-type makes the browser send a CORS preflight, and
   Apps Script cannot answer one - the request would fail before arriving.
   text/plain is a "simple request" and goes straight through; Code.gs parses
   the body itself.

2. Apps Script answers HTTP 200 to everything, including its own errors, so
   the status code says nothing. Success is decided by `ok` in the body, and
   that is what gates the redirect.

VALIDATION
----------
The rules come from ../shared/validate.js so the browser can answer instantly.
Apps Script validates again with a matching copy, because anything in a
browser can be bypassed. If you change a rule, change it in both.
*/

import { validate } from "../shared/validate.js"
import { APPS_SCRIPT_URL, THANK_YOU_PATH, PRACTICE_PHONE, PRACTICE_EMAIL } from "../site-config.js"

// Fields the visitor can actually correct, in the order they appear, so focus
// lands on the first thing that is wrong rather than the first rule that fired.
const FIELD_ORDER = ["name", "email", "phone", "subject", "treatment", "contact_method",
    "preferred_date", "preferred_time", "message", "consent"]

const NOT_CONNECTED =
    "Online enquiries are not connected yet. Please call " + PRACTICE_PHONE +
    " or email " + PRACTICE_EMAIL + " and we will get straight back to you."

const GENERIC_FAILURE =
    "Sorry — that did not send. Please check your connection and try again, or call " +
    PRACTICE_PHONE + "."

function statusEl(form) {
    return form.querySelector("[data-form-status]")
}

function setStatus(form, kind, text) {
    const el = statusEl(form)
    if (!el) return
    el.textContent = text
    el.dataset.state = kind || ""
}

/** The input a given error belongs to. "subject" is collected as "treatment". */
function inputFor(form, key) {
    return form.querySelector(`[name="${key}"]`) ||
        (key === "subject" ? form.querySelector('[name="treatment"]') : null)
}

function clearErrors(form) {
    form.querySelectorAll(".field-error").forEach((el) => el.remove())
    form.querySelectorAll("[aria-invalid]").forEach((el) => {
        el.removeAttribute("aria-invalid")
        el.classList.remove("is-invalid")
    })
}

function showErrors(form, errors) {
    clearErrors(form)
    let first = null

    FIELD_ORDER.forEach((key) => {
        if (!errors[key]) return
        const input = inputFor(form, key)
        if (!input) return

        input.setAttribute("aria-invalid", "true")
        input.classList.add("is-invalid")

        const msg = document.createElement("p")
        msg.className = "field-error"
        msg.textContent = errors[key]

        // Beside the control it belongs to. The consent row is a flex line
        // holding the box and its label, so the message is marked to take a
        // full line of its own rather than becoming a third item beside them.
        const row = input.type === "checkbox" ? input.closest("div") : input.parentElement
        if (input.type === "checkbox") msg.classList.add("field-error-row")
        ;(row || input.parentElement).appendChild(msg)

        if (!first) first = input
    })

    // Anything with no field of its own still has to be said somewhere.
    const orphan = Object.keys(errors).find((k) => !FIELD_ORDER.includes(k))
    if (orphan) setStatus(form, "error", errors[orphan])
    else setStatus(form, "error", "Please check the highlighted fields.")

    if (first) {
        first.focus({ preventScroll: true })
        first.scrollIntoView({ block: "center", behavior: "smooth" })
    }
}

function collect(form) {
    const data = new FormData(form)
    const raw = {}
    data.forEach((value, key) => { raw[key] = typeof value === "string" ? value : "" })

    raw._form = form.dataset.form || ""
    raw._subject = form.dataset.formTitle || "Website enquiry"
    raw._page = location.pathname + location.search
    raw._origin = location.origin

    // Only ask the backend to enforce consent where the form actually shows it.
    const consent = form.querySelector('[name="consent"]')
    if (consent && consent.required) raw._requireConsent = "yes"
    raw.consent = consent ? (consent.checked ? "yes" : "") : ""

    // Which fields THIS form marks required. Taking over submission turns off
    // the browser's own enforcement, so the list travels with the submission
    // and both sides check it - otherwise a required field nobody named in
    // validate.js (the appointment date, say) silently becomes optional.
    raw._required = Array.from(form.querySelectorAll("[required][name]"))
        .map((el) => el.name)
        .filter((n, i, all) => n && all.indexOf(n) === i)
        .join(",")

    return raw
}

async function attempt(raw) {
    const res = await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        // See the note at the top - this must NOT be application/json.
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(raw),
        redirect: "follow",
    })

    let body = null
    try {
        body = JSON.parse(await res.text())
    } catch {
        // Not JSON. Either Apps Script served a sign-in or error page (a
        // deployment set to the wrong access level), or the redirect it hands
        // the browser expired before we followed it.
        throw Object.assign(new Error(GENERIC_FAILURE), { unreadable: true })
    }

    // Apps Script answers 200 to everything, so `ok` in the body is the truth.
    if (!body || body.ok !== true) {
        throw Object.assign(new Error((body && body.error) || GENERIC_FAILURE), {
            code: body && body.code,
            errors: body && body.errors,
            fromServer: true,
        })
    }

    return body
}

/**
 * Send, and try once more if the ANSWER went missing.
 *
 * Apps Script runs the script and then redirects the browser to a one-time
 * URL carrying the result. That second request intermittently fails - which
 * means the enquiry was recorded and both emails went out, but the visitor is
 * told it did not send. They then submit again, or give up, and the practice
 * looks unresponsive for something it actually received.
 *
 * Retrying is safe precisely because the backend suppresses duplicates: an
 * identical submission inside five minutes is not written twice and answers
 * {ok:true, duplicate:true}. So the retry either gets the lost answer back or
 * completes a send that genuinely had not happened.
 *
 * Only a missing answer is retried. A real reply saying the data is invalid,
 * or that the rate limit was hit, is a decision - repeating it would be wrong.
 */
async function send(raw) {
    try {
        return await attempt(raw)
    } catch (err) {
        if (err.fromServer && !err.unreadable) throw err

        await new Promise((r) => setTimeout(r, 1500))
        return attempt(raw)
    }
}

function setBusy(form, busy) {
    const btn = form.querySelector("[type=submit]")
    if (!btn) return

    if (busy) {
        // Each form keeps its own wording ("Submit", "Book an appointment");
        // only the busy state is shared.
        if (btn.dataset.label == null) btn.dataset.label = btn.textContent.trim()
        btn.disabled = true
        btn.setAttribute("aria-busy", "true")
        btn.textContent = "Sending…"
    } else {
        btn.disabled = false
        btn.removeAttribute("aria-busy")
        if (btn.dataset.label != null) btn.textContent = btn.dataset.label
    }
    form.classList.toggle("is-sending", !!busy)
}

function setup() {
    const forms = document.querySelectorAll("form[data-form]")
    if (!forms.length) return

    forms.forEach((form) => {
        // The browser's own bubbles are replaced, not removed: the messages
        // shown instead are the same ones Apps Script would send back.
        form.setAttribute("novalidate", "")

        // Clear an error as soon as the visitor starts fixing it.
        form.addEventListener("input", (e) => {
            const el = e.target
            if (!el || !el.classList || !el.classList.contains("is-invalid")) return
            el.classList.remove("is-invalid")
            el.removeAttribute("aria-invalid")
            const row = el.type === "checkbox" ? el.closest("div") : el.parentElement
            const msg = row && row.querySelector(".field-error")
            if (msg) msg.remove()
        }, true)

        form.addEventListener("submit", async (e) => {
            e.preventDefault()

            // One in flight at a time. A double-click, a second Enter press or
            // an impatient tap must not produce a second enquiry.
            if (form.dataset.sending === "1") return

            const raw = collect(form)
            const { ok, errors } = validate(raw)
            if (!ok) {
                showErrors(form, errors)
                return
            }

            // Nothing configured yet: say so rather than pretending to send.
            if (!APPS_SCRIPT_URL) {
                setStatus(form, "warn", NOT_CONNECTED)
                return
            }

            clearErrors(form)
            form.dataset.sending = "1"
            setBusy(form, true)
            setStatus(form, "", "")

            try {
                const result = await send(raw)

                // Redirect ONLY once Apps Script has confirmed it has the enquiry.
                const ref = encodeURIComponent(raw._form || "")
                const target = (result.redirect || THANK_YOU_PATH) + (ref ? "?ref=" + ref : "")

                // Count the enquiry, not the button press: this line is only
                // reached after the backend has confirmed the row was stored,
                // so the number in GA matches the number in the sheet.
                //
                // Only which form was used travels - "contact" or
                // "appointment". Never the name, email, phone, treatment or
                // message. Those are a patient's own details, they are not
                // ours to hand to an analytics vendor, and Google's own terms
                // forbid sending them.
                //
                // No-op when analytics is switched off, because gtag is then
                // never defined.
                if (typeof window.gtag === "function") {
                    window.gtag("event", "generate_lead", { form_name: raw._form || "enquiry" })
                }

                setStatus(form, "ok", "Sent — taking you to the confirmation…")
                location.assign(target)
                return
            } catch (err) {
                if (err.errors) {
                    // Apps Script disagreed with us about the data; it wins.
                    showErrors(form, err.errors)
                } else {
                    // Only wording that came from our own backend is shown. A
                    // thrown fetch error says things like "Failed to fetch",
                    // which tells a patient nothing and offers no way out.
                    setStatus(form, "error",
                        err.fromServer && !err.unreadable ? err.message : GENERIC_FAILURE)
                    const el = statusEl(form)
                    if (el) el.scrollIntoView({ block: "center", behavior: "smooth" })
                }
            } finally {
                // The form stays usable unless the page is already navigating.
                form.dataset.sending = "0"
                setBusy(form, false)
            }
        })
    })
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup)
} else {
    setup()
}
