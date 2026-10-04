/*
reCAPTCHA v3 in the browser.

WHAT THIS PROVES, AND WHAT IT CANNOT
Google publishes test keys for reCAPTCHA v2 but NOT for v3, so a real
Google-issued v3 token cannot be obtained without the practice's production
site key. What is verified here is everything on our side of that boundary:

  - the script is injected only when a key is configured
  - grecaptcha.ready / execute are called, with the right action per form
  - the token that comes back travels in the request body
  - a failure to load Google never blocks a patient enquiry

window.grecaptcha is replaced with a recording stub so those paths run. The
backend is the real Code.gs on a local port; no email leaves the machine and
the production sheet is untouched.
*/
import http from "node:http"
import { spawn, spawnSync } from "node:child_process"
import { chromium } from "playwright"
import { createHost } from "./apps-script-host.mjs"

const API = 8805, VP = 5185
const KEY = "test-site-key-local-only"
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let pass = 0, fail = 0
const failures = []
const check = (n, ok, d = "") => {
    if (ok) pass++
    else { fail++; failures.push(n + (d ? " -> " + d : "")) }
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${n}${d && !ok ? "  (" + d + ")" : ""}`)
}

let host = createHost()
let lastBody = null

const api = http.createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*")
    let b = ""
    req.on("data", (c) => { b += c })
    req.on("end", () => {
        lastBody = b
        let p = {}
        try { p = JSON.parse(b) } catch { /* surfaced by the assertions */ }
        res.writeHead(200, { "Content-Type": "application/json" })
        res.end(JSON.stringify(host.post(p)))
    })
})
await new Promise((r) => api.listen(API, "127.0.0.1", r))

function startVite(siteKey) {
    return spawn(process.platform === "win32" ? "npx.cmd" : "npx",
        ["vite", "--port", String(VP), "--strictPort"], {
            env: {
                ...process.env,
                VITE_RECAPTCHA_SITE_KEY: siteKey,
                VITE_APPS_SCRIPT_URL: `http://127.0.0.1:${API}/exec`,
                BROWSER: "none",
            },
            stdio: "ignore",
            shell: process.platform === "win32",
        })
}

async function waitUp() {
    for (let i = 0; i < 60; i++) {
        try { if ((await fetch(`http://localhost:${VP}/contact/`)).ok) return true } catch { /* not yet */ }
        await sleep(500)
    }
    return false
}

function stopVite(v) {
    if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(v.pid), "/T", "/F"], { stdio: "ignore" })
    else v.kill()
}

/**
 * Replace the Google script with a stub that records what we ask it for.
 *
 * The real api.js is blocked at the network layer first. Without that it
 * loads, overwrites window.grecaptcha with Google's own object, and - because
 * the key here is not a real one - fails to initialise, so nothing is
 * recorded and the stub is never reached. Blocking it keeps the test about
 * OUR code path, which is the part that can actually be verified offline.
 */
async function stubGrecaptcha(page) {
    await page.route("**://www.google.com/recaptcha/**", (route) => route.abort())
    await page.route("**://www.gstatic.com/recaptcha/**", (route) => route.abort())
    await page.addInitScript(() => {
        // sessionStorage, not a variable: the form redirects to /thank-you/
        // on success, and a plain window property dies with the document.
        window.grecaptcha = {
            ready: (cb) => cb(),
            execute: (key, opts) => {
                try {
                    const log = JSON.parse(sessionStorage.getItem("__rc") || "[]")
                    log.push({ key, action: opts && opts.action })
                    sessionStorage.setItem("__rc", JSON.stringify(log))
                } catch { /* storage unavailable - the token assertion still covers it */ }
                return Promise.resolve("stub-token-" + (opts && opts.action))
            },
        }
    })
}

async function fill(f, over = {}) {
    await f.locator("[name=name]").fill(over.name || "Recaptcha UI Test")
    await f.locator("[name=email]").fill(over.email || "recaptcha.ui@example.com")
    await f.locator("[name=phone]").fill("9719787840")

    for (const sel of ["[name=treatment]", "[name=contact_method]"]) {
        const el = f.locator(sel).first()
        if (await el.count()) await el.selectOption({ index: 1 })
    }
    for (const [sel, v] of [["[name=preferred_date]", "2026-11-20"], ["[name=preferred_time]", "10:30"]]) {
        const el = f.locator(sel).first()
        if (await el.count()) await el.fill(v)
    }
    const m = f.locator("[name=message]").first()
    if (await m.count()) await m.fill("Local reCAPTCHA UI check. Not a patient enquiry.")
    const c = f.locator("[name=consent]").first()
    if (await c.count()) await c.check()
}

const FORMS = [
    { page: "/contact/", name: "contact", action: "submit_contact" },
    { page: "/book-appointment/", name: "appointment", action: "submit_appointment" },
    { page: "/", name: "appointment-home", action: "submit_appointment_home" },
]

// ==========================================================================
console.log("\nreCAPTCHA v3 - BROWSER\n")

let vite = startVite(KEY)
if (!(await waitUp())) {
    console.error("vite did not start")
    stopVite(vite); api.close(); process.exit(1)
}

const browser = await chromium.launch()

for (const width of [1440, 390]) {
    const label = width === 1440 ? "desktop" : "mobile"
    console.log(`\n=== ${label.toUpperCase()} (${width}px) ===`)

    const ctx = await browser.newContext({ viewport: { width, height: width === 1440 ? 950 : 844 } })
    const page = await ctx.newPage()
    const errors = []
    page.on("pageerror", (e) => errors.push(String(e)))
    await stubGrecaptcha(page)

    // --- script loading ---------------------------------------------------
    await page.goto(`http://localhost:${VP}/contact/`, { waitUntil: "domcontentloaded" })
    await sleep(600)

    const tag = await page.locator("script[data-recaptcha]").getAttribute("src").catch(() => null)
    check(`${label}: script injected when a key is configured`, !!tag)
    check(`${label}: it is the official endpoint, with render=<key>`,
        !!tag && tag.startsWith("https://www.google.com/recaptcha/api.js?render=") && tag.includes(KEY), tag || "")
    check(`${label}: no widget element added to the form (v3 is invisible)`,
        await page.locator('form[data-form="contact"] .g-recaptcha').count() === 0)

    // --- a token per form, with the right action --------------------------
    for (const f of FORMS) {
        host = createHost()
        await page.goto(`http://localhost:${VP}${f.page}`, { waitUntil: "domcontentloaded" })
        await page.evaluate(() => { try { sessionStorage.removeItem("__rc") } catch { /* ignore */ } })
        await page.evaluate(() => document.querySelectorAll("[data-reveal]").forEach((e) => e.setAttribute("data-reveal", "in")))
        await sleep(500)

        const form = page.locator(`form[data-form="${f.name}"]`)
        if (!(await form.count())) { check(`${label}: ${f.name} form present`, false, "missing"); continue }

        await fill(form, { email: `${f.name}.${label}@example.com` })
        await form.locator("[type=submit]").click()
        await page.waitForURL(/thank-you/, { timeout: 12000 }).catch(() => {})

        const asked = await page.evaluate(() => {
            try { return JSON.parse(sessionStorage.getItem("__rc") || "[]") } catch { return [] }
        }).catch(() => [])
        const sent = lastBody ? JSON.parse(lastBody) : {}

        check(`${label}: ${f.name} - execute() called with action "${f.action}"`,
            asked.some((a) => a.action === f.action), JSON.stringify(asked))
        check(`${label}: ${f.name} - the site key is passed to execute()`,
            asked.some((a) => a.key === KEY))
        check(`${label}: ${f.name} - token travels as g-recaptcha-response`,
            sent["g-recaptcha-response"] === `stub-token-${f.action}`,
            JSON.stringify(sent["g-recaptcha-response"]))
        check(`${label}: ${f.name} - reaches /thank-you/`, /thank-you/.test(page.url()), page.url())
        check(`${label}: ${f.name} - enquiry recorded once`,
            host.dataRows().length === 1, "rows=" + host.dataRows().length)
    }

    // --- Google fails to load: must not block the enquiry -----------------
    host = createHost()
    const broken = await ctx.newPage()
    await broken.route("**://www.google.com/recaptcha/**", (route) => route.abort())
    await broken.addInitScript(() => { window.grecaptcha = undefined })
    await broken.goto(`http://localhost:${VP}/contact/`, { waitUntil: "domcontentloaded" })
    await sleep(500)

    const bf = broken.locator('form[data-form="contact"]')
    await fill(bf, { email: `noscript.${label}@example.com` })
    await bf.locator("[type=submit]").click()
    await broken.waitForURL(/thank-you/, { timeout: 12000 }).catch(() => {})

    const bsent = lastBody ? JSON.parse(lastBody) : {}
    check(`${label}: Google script missing -> enquiry still sent`, /thank-you/.test(broken.url()), broken.url())
    check(`${label}: Google script missing -> empty token, backend decides`,
        bsent["g-recaptcha-response"] === "", JSON.stringify(bsent["g-recaptcha-response"]))
    await broken.close()

    check(`${label}: no console errors during the run`, errors.length === 0, errors.slice(0, 2).join(" | "))
    await ctx.close()
}

// --- with NO key: nothing is loaded at all ---------------------------------
console.log("\n=== NOT CONFIGURED (no site key) ===")
await browser.close()
stopVite(vite)
await sleep(1500)

vite = startVite("")
if (!(await waitUp())) {
    console.error("vite did not restart")
    stopVite(vite); api.close(); process.exit(1)
}

const b2 = await chromium.launch()
const p2 = await (await b2.newContext({ viewport: { width: 1440, height: 950 } })).newPage()
await p2.goto(`http://localhost:${VP}/contact/`, { waitUntil: "domcontentloaded" })
await sleep(600)

check("no key: no script is injected", await p2.locator("script[data-recaptcha]").count() === 0)
check("no key: nothing from google.com/recaptcha appears in the page",
    !(await p2.content()).includes("google.com/recaptcha"))

host = createHost()
const f2 = p2.locator('form[data-form="contact"]')
await fill(f2, { email: "nokey@example.com" })
await f2.locator("[type=submit]").click()
await p2.waitForURL(/thank-you/, { timeout: 12000 }).catch(() => {})

check("no key: the form still works end to end", /thank-you/.test(p2.url()), p2.url())
check("no key: row still written", host.dataRows().length === 1)
await b2.close()
stopVite(vite)

console.log("\n" + "-".repeat(64))
console.log(fail === 0 ? "ALL PASS" : "FAILURES", `  ${pass} passed, ${fail} failed`)
if (fail) console.log("\n" + failures.map((f) => "  - " + f).join("\n"))
api.close()
process.exit(fail ? 1 : 0)
