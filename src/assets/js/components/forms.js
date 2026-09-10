/*
File: Forms
The appointment and contact forms post here, and on a successful send the
browser goes to the thank-you page.

WHERE SUBMISSIONS GO
--------------------
ENDPOINT below is the one thing to fill in. It is deliberately empty until the
practice picks a provider, because these forms carry patient enquiries - a
free-text "how can we help" box included - and choosing who receives and
stores that is a clinical/compliance decision, not a styling one. Until it is
set, the form validates, refuses to pretend it sent anything, and tells the
visitor to call instead.

Anything that accepts a POST of form fields and answers 2xx will work, e.g.

  Formspree      https://formspree.io/f/<your-form-id>
                 emails the practice and keeps submissions in a dashboard
  FormSubmit     https://formsubmit.co/<the practice's email>
                 emails the practice, no account, no stored archive
  Your own       /api/enquiry on Vercel, writing to a database you control -
                 the only option where the data never leaves your own stack

Set it once here; all three forms use it.
*/

const ENDPOINT = ""
const THANK_YOU = "thank-you.html"
const PHONE = "971-978-7840"

function setStatus(form, kind, text) {
    const el = form.querySelector("[data-form-status]")
    if (!el) return
    el.textContent = text
    el.dataset.state = kind
}

async function send(form) {
    const data = new FormData(form)

    // the honeypot is invisible, so anything in it came from a bot. Accept the
    // submission as far as the bot can tell and drop it.
    if ((data.get("_honey") || "").toString().trim()) return true
    data.delete("_honey")

    // context the practice needs in the notification but should not have to type
    data.append("_form", form.dataset.form || "")
    data.append("_subject", form.dataset.formTitle || "Website enquiry")
    data.append("_page", location.pathname)

    const res = await fetch(ENDPOINT, {
        method: "POST",
        body: data,
        headers: { Accept: "application/json" },
    })
    if (!res.ok) throw new Error("HTTP " + res.status)
    return true
}

function setup() {
    document.querySelectorAll("form[data-form]").forEach((form) => {
        form.setAttribute("novalidate", "")

        form.addEventListener("submit", async (e) => {
            e.preventDefault()

            // native validation still does the checking; this only takes over
            // the reporting so the messages appear in one place
            if (!form.checkValidity()) {
                form.reportValidity()
                return
            }

            if (!ENDPOINT) {
                setStatus(form, "warn",
                    "Online booking is not connected yet. Please call " + PHONE +
                    " or email abcaestheticsllc@gmail.com and we will get straight back to you.")
                return
            }

            const btn = form.querySelector("[type=submit]")
            const label = btn && btn.textContent
            if (btn) {
                btn.disabled = true
                btn.textContent = "Sending…"
            }
            setStatus(form, "", "")

            try {
                await send(form)
                const ref = encodeURIComponent(form.dataset.form || "")
                location.assign(THANK_YOU + (ref ? "?ref=" + ref : ""))
            } catch (err) {
                setStatus(form, "error",
                    "Sorry — that did not send. Please try again, or call " + PHONE + ".")
                if (btn) {
                    btn.disabled = false
                    btn.textContent = label
                }
            }
        })
    })
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup)
} else {
    setup()
}
