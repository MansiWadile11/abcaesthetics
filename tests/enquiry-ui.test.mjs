/*
Browser test of the enquiry flow, desktop and mobile.

The page talks to the REAL apps-script/Code.gs, served over HTTP by a local
stand-in for Google's Web App runtime (tests/apps-script-host.mjs). So a
redirect here means the whole chain actually ran: validation, the sheet write,
both emails, then the navigation.

It starts its own Vite dev server on a spare port with the Apps Script URL
pointed at that local endpoint, so it does not disturb one you already have
running and needs no .env file.

Just run it:  npm run test:ui
*/

import http from "node:http"
import { spawn, spawnSync } from "node:child_process"
import { chromium } from "playwright"
import { createHost } from "./apps-script-host.mjs"

const API_PORT = 8795
const VITE_PORT = 5176
const BASE = "http://localhost:" + VITE_PORT
const ENDPOINT = "http://127.0.0.1:" + API_PORT + "/exec"

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let pass = 0, fail = 0
const failures = []
function check(name, cond, detail) {
    if (cond) { pass++; console.log("  PASS  " + name) }
    else { fail++; failures.push(name + (detail ? " -> " + detail : "")); console.log("  FAIL  " + name + (detail ? "  (" + detail + ")" : "")) }
}

const FORMS = [
    { page: "/contact.html", name: "contact" },
    { page: "/appointment.html", name: "appointment" },
    { page: "/index.html", name: "appointment-home" },
]

// ---------------------------------------------------------------------------
// A local stand-in for the deployed Web App
// ---------------------------------------------------------------------------

let host = createHost()
let mode = "live"          // "live" | "error" | "offline" | "slow" | "html"
let calls = 0

function apiServer() {
    return http.createServer((req, res) => {
        // Apps Script answers cross-origin requests with a wildcard; the
        // request itself is a "simple" one, so there is no preflight.
        res.setHeader("Access-Control-Allow-Origin", "*")

        let body = ""
        req.on("data", (c) => { body += c })
        req.on("end", async () => {
            calls++

            if (mode === "slow") await sleep(1200)

            if (mode === "html") {
                // What a wrongly-deployed script actually returns: a sign-in page.
                res.writeHead(200, { "Content-Type": "text/html" })
                res.end("<html><body>Sign in to continue</body></html>")
                return
            }

            if (mode === "error") {
                res.writeHead(200, { "Content-Type": "application/json" })
                res.end(JSON.stringify({
                    ok: false, code: "server_error",
                    error: "Sorry - something went wrong at our end. Please try again, or call 971-978-7840.",
                }))
                return
            }

            let payload = {}
            try { payload = JSON.parse(body) } catch { payload = {} }

            const out = host.post(payload)
            res.writeHead(200, { "Content-Type": "application/json" })
            res.end(JSON.stringify(out))
        })
    })
}

function listen(srv, port) {
    return new Promise((r) => srv.listen(port, "127.0.0.1", r))
}

async function waitForVite(url, tries = 60) {
    for (let i = 0; i < tries; i++) {
        try {
            const res = await fetch(url)
            if (res.ok) return true
        } catch { /* not up yet */ }
        await sleep(500)
    }
    return false
}

async function portInUse(port) {
    try {
        await fetch("http://localhost:" + port + "/", { signal: AbortSignal.timeout(1500) })
        return true
    } catch {
        return false
    }
}

/**
 * Kill the dev server AND everything it started.
 *
 * On Windows `spawn` with shell:true runs cmd.exe, which then runs npx, which
 * then runs node. child.kill() reaps only the cmd.exe wrapper and leaves the
 * actual Vite server listening - a page that looks like the site but whose
 * backend (the stand-in on API_PORT) died with the test, so every submission
 * fails with a connection error. taskkill /T takes the whole tree.
 */
function stopVite(child) {
    if (!child || child.killed || child.exitCode !== null) return
    if (process.platform === "win32") {
        try {
            spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" })
            return
        } catch { /* fall through to the portable path */ }
    }
    try { child.kill("SIGTERM") } catch { /* already gone */ }
}

// ---------------------------------------------------------------------------

async function main() {
    // A server left over from an interrupted run would be serving pages that
    // point at an endpoint which no longer exists. Refuse rather than test
    // against it, and say how to clear it.
    if (await portInUse(VITE_PORT)) {
        console.error(
            "Port " + VITE_PORT + " is already in use - most likely a dev server left\n" +
            "behind by an interrupted test run. It serves the site but its backend is\n" +
            "gone, so every submission fails with a connection error.\n\n" +
            (process.platform === "win32"
                ? "Close it with:  npm run test:clean\n"
                : "Close it with:  lsof -ti:" + VITE_PORT + " | xargs kill\n")
        )
        process.exit(1)
    }

    const api = apiServer()
    await listen(api, API_PORT)

    const vite = spawn(
        process.platform === "win32" ? "npx.cmd" : "npx",
        ["vite", "--port", String(VITE_PORT), "--strictPort"],
        {
            env: { ...process.env, VITE_APPS_SCRIPT_URL: ENDPOINT, BROWSER: "none" },
            stdio: "ignore",
            shell: process.platform === "win32",
        }
    )

    // However this process ends - finished, thrown, or Ctrl-C - the dev server
    // goes with it. Leaving one running is what produced this guard.
    const cleanup = () => { stopVite(vite); try { api.close() } catch { /* already closed */ } }
    process.on("exit", cleanup)
    process.on("SIGINT", () => { cleanup(); process.exit(130) })
    process.on("SIGTERM", () => { cleanup(); process.exit(143) })
    process.on("uncaughtException", (e) => { console.error(e); cleanup(); process.exit(1) })

    const up = await waitForVite(BASE + "/contact.html")
    if (!up) {
        console.error("Could not start Vite on port " + VITE_PORT)
        cleanup()
        process.exit(1)
    }

    const browser = await chromium.launch()

    async function open(page, path) {
        await page.goto(BASE + path, { waitUntil: "domcontentloaded" })
        await page.evaluate(() => document.querySelectorAll("[data-reveal]").forEach((e) => e.setAttribute("data-reveal", "in")))
        await sleep(350)
    }

    async function fill(form, over = {}) {
        const v = { name: "Jane Doe", email: "jane.doe@example.com", phone: "(971) 978-7840", ...over }
        const set = async (sel, value) => {
            const el = form.locator(sel).first()
            if (await el.count()) await el.fill(value)
        }
        await set('[name="name"]', v.name)
        await set('[name="email"]', v.email)
        await set('[name="phone"]', v.phone)

        for (const [sel, how] of [['[name="treatment"]', "select"], ['[name="contact_method"]', "select"]]) {
            const el = form.locator(sel).first()
            if (await el.count()) await el.selectOption({ index: 1 })
            void how
        }
        const date = form.locator('[name="preferred_date"]').first()
        if (await date.count()) await date.fill("2026-10-15")
        const time = form.locator('[name="preferred_time"]').first()
        if (await time.count()) await time.fill("10:30")
        const msg = form.locator('[name="message"]').first()
        if (await msg.count()) await msg.fill(v.message || "I would like to ask about a consultation.")
        const consent = form.locator('[name="consent"]').first()
        if (await consent.count()) await consent.check()
    }

    for (const width of [1440, 390]) {
        const label = width === 1440 ? "desktop" : "mobile"
        console.log("\n=== " + label.toUpperCase() + " (" + width + "px) ===")

        const ctx = await browser.newContext({ viewport: { width, height: width === 1440 ? 950 : 844 } })
        const page = await ctx.newPage()
        const pageErrors = []
        page.on("pageerror", (e) => pageErrors.push(String(e)))

        host = createHost()
        mode = "live"
        calls = 0

        console.log("\n1. EMPTY REQUIRED FIELDS")
        await open(page, "/contact.html")
        let form = page.locator('form[data-form="contact"]')
        await form.locator("[type=submit]").click()
        await sleep(400)
        check(label + ": inline errors appear", await form.locator(".field-error").count() >= 3,
            "count=" + await form.locator(".field-error").count())
        check(label + ": the page does not navigate", page.url().includes("contact"), page.url())
        check(label + ": nothing was sent to the backend", calls === 0, "calls=" + calls)
        check(label + ": the first bad field takes focus",
            await page.evaluate(() => document.activeElement && document.activeElement.name) === "name")

        console.log("\n2. EVERY REQUIRED FIELD IS ENFORCED")
        const flaggedContact = await form.evaluate((f) =>
            Array.from(f.querySelectorAll("[aria-invalid=true][name]")).map((e) => e.name))
        check(label + ": treatment of interest", flaggedContact.includes("treatment"), flaggedContact.join(","))
        check(label + ": preferred contact method", flaggedContact.includes("contact_method"), flaggedContact.join(","))
        check(label + ": consent", flaggedContact.includes("consent"), flaggedContact.join(","))

        await open(page, "/appointment.html")
        const appt = page.locator('form[data-form="appointment"]')
        await appt.locator("[type=submit]").click()
        await sleep(400)
        const flaggedAppt = await appt.evaluate((f) =>
            Array.from(f.querySelectorAll("[aria-invalid=true][name]")).map((e) => e.name))
        check(label + ": appointment date", flaggedAppt.includes("preferred_date"), flaggedAppt.join(","))
        check(label + ": appointment time", flaggedAppt.includes("preferred_time"), flaggedAppt.join(","))

        console.log("\n3. INVALID EMAIL AND PHONE")
        await open(page, "/contact.html")
        form = page.locator('form[data-form="contact"]')
        await fill(form, { email: "jane@@example", phone: "12345" })
        await form.locator("[type=submit]").click()
        await sleep(400)
        const emailErr = await form.locator('[name="email"]').evaluate((el) => {
            const p = el.parentElement.querySelector(".field-error"); return p ? p.textContent : ""
        })
        const phoneErr = await form.locator('[name="phone"]').evaluate((el) => {
            const p = el.parentElement.querySelector(".field-error"); return p ? p.textContent : ""
        })
        check(label + ": bad email is explained", /does not look right/i.test(emailErr), emailErr)
        check(label + ": short phone is explained", /too short/i.test(phoneErr), phoneErr)
        check(label + ": still on the form", page.url().includes("contact"))

        console.log("\n4. AN ERROR CLEARS AS IT IS CORRECTED")
        await form.locator('[name="email"]').fill("jane.doe@example.com")
        await sleep(250)
        check(label + ": the message disappears on typing", await form.locator('[name="email"]').evaluate(
            (el) => !el.parentElement.querySelector(".field-error") && !el.hasAttribute("aria-invalid")))

        console.log("\n5. BACKEND ERROR -> NO REDIRECT")
        mode = "error"
        await open(page, "/contact.html")
        form = page.locator('form[data-form="contact"]')
        await fill(form)
        await form.locator("[type=submit]").click()
        await sleep(900)
        check(label + ": stays on the contact page", page.url().includes("contact"), page.url())
        check(label + ": shows a friendly error", /went wrong|did not send/i.test(
            await form.locator("[data-form-status]").textContent() || ""),
            await form.locator("[data-form-status]").textContent())
        check(label + ": the button works again", await form.locator("[type=submit]").isEnabled())
        check(label + ": the typing survives", await form.locator('[name="name"]').inputValue() === "Jane Doe")

        console.log("\n6. NETWORK FAILURE -> NO REDIRECT")
        mode = "offline"
        await page.route("**/exec", (route) => route.abort("failed"))
        await open(page, "/contact.html")
        form = page.locator('form[data-form="contact"]')
        await fill(form)
        await form.locator("[type=submit]").click()
        await sleep(900)
        check(label + ": stays on the contact page", page.url().includes("contact"), page.url())
        check(label + ": explains it in plain words", /did not send|connection/i.test(
            await form.locator("[data-form-status]").textContent() || ""),
            await form.locator("[data-form-status]").textContent())
        check(label + ": nothing technical is shown", !/fetch|TypeError|NetworkError/i.test(
            await form.locator("[data-form-status]").textContent() || ""))
        await page.unroute("**/exec")

        console.log("\n7. A WRONGLY DEPLOYED SCRIPT (returns HTML, not JSON)")
        mode = "html"
        await open(page, "/contact.html")
        form = page.locator('form[data-form="contact"]')
        await fill(form)
        await form.locator("[type=submit]").click()
        await sleep(900)
        check(label + ": treated as a failure, not a success", page.url().includes("contact"), page.url())
        check(label + ": the visitor gets a usable message", /did not send|call 971/i.test(
            await form.locator("[data-form-status]").textContent() || ""),
            await form.locator("[data-form-status]").textContent())

        console.log("\n8. LOADING STATE")
        mode = "slow"
        await open(page, "/contact.html")
        form = page.locator('form[data-form="contact"]')
        await fill(form)
        const btn = form.locator("[type=submit]")
        const originalLabel = (await btn.textContent() || "").trim()
        await btn.click()
        await sleep(400)
        check(label + ": the button is disabled while sending", await btn.isDisabled())
        check(label + ": it reads 'Sending...'", /Sending/i.test(await btn.textContent() || ""), await btn.textContent())
        check(label + ": it is marked busy for screen readers", await btn.getAttribute("aria-busy") === "true")
        check(label + ": the original wording was '" + originalLabel + "'", originalLabel.length > 0)
        await page.waitForURL(/thank-you/, { timeout: 9000 }).catch(() => {})

        console.log("\n9. RAPID REPEAT CLICKS SEND ONCE")
        mode = "slow"
        calls = 0
        await open(page, "/contact.html")
        form = page.locator('form[data-form="contact"]')
        await fill(form, { email: "rapid." + label + "@example.com" })
        await form.locator("[type=submit]").click({ force: true })
        await form.locator("[type=submit]").click({ force: true }).catch(() => {})
        await form.locator("[type=submit]").click({ force: true }).catch(() => {})
        await sleep(1800)
        check(label + ": three clicks produced one request", calls === 1, "calls=" + calls)

        console.log("\n10. THE REAL THING, END TO END")
        mode = "live"
        host = createHost()
        for (const f of FORMS) {
            await open(page, f.page)
            const target = page.locator(`form[data-form="${f.name}"]`)
            if (!(await target.count())) { check(label + ": " + f.name + " found", false, "missing on " + f.page); continue }
            await fill(target, { email: f.name + "." + label + "@example.com" })
            await target.locator("[type=submit]").click()
            await page.waitForURL(/thank-you/, { timeout: 12000 }).catch(() => {})
            check(label + ": " + f.name + " lands on /thank-you", /\/thank-you/.test(page.url()), page.url())
        }

        check(label + ": three rows reached the sheet", host.dataRows().length === 3, "rows=" + host.dataRows().length)
        check(label + ": six emails went out (practice + patient each)", host.state.inbox.length === 6,
            "sent=" + host.state.inbox.length)
        check(label + ": the sheet has the agreed columns",
            JSON.stringify(host.header()) === JSON.stringify([
                "Submission Date & Time", "Name", "Email", "Phone",
                "Treatment of Interest", "Preferred Contact Method",
                "Message", "Source/Page", "Status"]),
            JSON.stringify(host.header()))
        check(label + ": every row is marked New",
            host.dataRows().every((r) => r[8] === "New"), JSON.stringify(host.dataRows().map((r) => r[8])))
        check(label + ": the source page is recorded per form",
            new Set(host.dataRows().map((r) => r[7])).size === 3,
            JSON.stringify(host.dataRows().map((r) => r[7])))

        console.log("\n11. THE THANK-YOU PAGE")
        await page.goto(BASE + "/thank-you", { waitUntil: "domcontentloaded" })
        check(label + ": /thank-you resolves without the extension", await page.locator(".ty-title").count() === 1, page.url())
        check(label + ": it confirms and thanks", /thank you/i.test(await page.locator(".ty-title").textContent() || ""))
        check(label + ": it says the team will be in touch",
            /be in touch|get back/i.test(await page.locator(".ty-lead").textContent() || ""))
        check(label + ": it offers a way home", await page.locator('.ty-actions a[href="/index.html"]').count() === 1)
        check(label + ": it carries the phone number", /971-978-7840/.test(await page.locator(".ty-urgent").textContent() || ""))
        check(label + ": it does not scroll sideways", await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth + 1))

        console.log("\n12. NO CONSOLE ERRORS")
        check(label + ": no page errors during the whole run", pageErrors.length === 0, pageErrors.slice(0, 2).join(" | "))

        await ctx.close()
    }

    console.log("\n" + "-".repeat(64))
    console.log(fail === 0 ? "ALL PASS" : "FAILURES", "  " + pass + " passed, " + fail + " failed")
    if (fail) console.log("\n" + failures.map((f) => "  - " + f).join("\n"))

    await browser.close()
    stopVite(vite)
    api.close()
    process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
