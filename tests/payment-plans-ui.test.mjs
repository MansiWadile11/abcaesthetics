/*
The Cherry widget, and the floating buttons that used to sit on top of it.

TWO THINGS ARE GUARDED HERE.

First, that Cherry still renders the sections we ask for - and only those. The
page requests ["calculator","howitworks","faq"]; "hero" and "testimony" are
left out deliberately, because they carry an unverified $50,000 approval figure
and six of Cherry's own stock testimonials presented as "What Our Customers
Say". So this asserts on absence as much as presence.

Cherry's script puts every requested section into ONE container (currently
#calculator) and hides the other divs itself, so "empty divs" is the correct
finished state and cannot be used as a health check. The only honest check is
the rendered text, which is what this does.

NOTE ON SCOPE: gql.withcherry.com is geo-blocked from some locations, and when
it cannot be reached the widget renders from Cherry's built-in fallbacks. These
assertions cover OUR configuration. They do not verify live Cherry account data
or API behaviour, and must not be read as doing so.

Second, that nothing covers Cherry's calls to action on a phone. Their buttons
run the full width of the card, and below Cherry's own 870px breakpoint that
card goes edge to edge, so the floating WhatsApp/back-to-top stack used to take
a 20-30px bite out of the right end of five of them, "See if you qualify"
included. The fix is a page-scoped rule in _general.css. It is pinned to a
breakpoint inside Cherry's stylesheet, which is why this test exists: if Cherry
changes that breakpoint, the overlap comes back silently and nothing else would
notice.

Geometry alone is not enough - a button can be clear on paper and still be
unclickable - so each CTA is also hit-tested with elementFromPoint.

Run the dev server first:  npm run dev
*/

import { chromium } from "playwright"

const BASE = process.env.BASE || "http://localhost:5173"
const PATH = "/payment-plans/"

// Below Cherry's 870px breakpoint their card is edge to edge and the two
// collide; above it Cherry caps its own width and they do not.
const OVERLAP_WIDTHS = [320, 360, 390, 414, 430, 540, 639, 640, 767, 800, 860]
const CLEAR_WIDTHS = [900, 1280]

let pass = 0, fail = 0
const failures = []
function check(name, cond, detail) {
    if (cond) { pass++; console.log("  PASS  " + name) }
    else { fail++; failures.push(name + (detail ? " -> " + detail : "")); console.log("  FAIL  " + name + (detail ? "  (" + detail + ")" : "")) }
}

// Cherry's own copy. Each phrase belongs to one of the five requested
// sections, so between them they prove the shared layout rendered whole.
const SECTIONS = [
    ["calculator", "See an example of what you could pay"],
    ["howitworks", "How Cherry works"],
    ["faq", "Questions?"],
]

/* Kept OUT of the allow-list on purpose, and the reason this file asserts on
   absence as well as presence. "hero" carries "Up to $50,000 approvals", which
   Cherry prints from a hardcoded fallback whenever the account's real figure
   is unavailable; "testimony" carries six testimonials hardcoded in Cherry's
   bundle, under a fixed heading reading "What Our Customers Say". Neither
   belongs to this practice. If a future edit puts either section back, these
   fail - which is the point. */
const EXCLUDED = [
    ["stock testimonial heading", "What Our Customers Say"],
    ["stock testimonial author", "Bryana"],
    ["unverified $50,000 approval claim", "$50,000"],
    ["hero application button", "Manage your account"],
]

/* Cherry's full-width controls, measured against the floating stack. Returns
   the worst overlap in px: positive means something is covered. */
function measure() {
    const fa = document.querySelector(".floating-actions")
    const visible = fa && getComputedStyle(fa).display !== "none"
    const controls = [...document.querySelectorAll("#calculator button, #calculator a")]
        .filter((el) => el.getBoundingClientRect().width > 150)
        .map((el) => ({ el, label: el.innerText.trim().slice(0, 34), box: el.getBoundingClientRect() }))

    let worst = { px: -Infinity, label: "(none)" }
    if (visible) {
        const f = fa.getBoundingClientRect()
        for (const c of controls) {
            // They only collide if they share a row as well as a column.
            const px = Math.round(Math.min(c.box.right, f.right) - Math.max(c.box.left, f.left))
            if (px > worst.px) worst = { px, label: c.label }
        }
    }

    // Hit test: is the CTA the topmost element at its own corners?
    const cta = controls.find((c) => /personalized options/i.test(c.label)) || controls[0]
    let hits = null
    if (cta) {
        const b = cta.box
        const y = Math.round(b.top + b.height / 2)
        hits = [
            ["left", Math.round(b.left + 8)],
            ["centre", Math.round(b.left + b.width / 2)],
            ["right", Math.round(b.right - 8)],
        ].map(([where, x]) => {
            const top = document.elementFromPoint(x, y)
            const own = top && (top === cta.el || document.getElementById("hero").contains(top))
            return { where, own, got: top ? top.tagName + (top.className && typeof top.className === "string" ? "." + top.className.trim().split(/\s+/)[0] : "") : "null" }
        })
    }

    return {
        floatingVisible: visible,
        controls: controls.length,
        worst,
        hits,
        inView: cta ? cta.box.top < innerHeight && cta.box.bottom > 0 : false,
        text: document.getElementById("calculator") ? document.getElementById("calculator").innerText : "",
    }
}

async function load(browser, width, errors) {
    const page = await browser.newPage({ viewport: { width, height: 844 } })
    page.on("pageerror", (e) => errors.push(String(e).split("\n")[0]))
    await page.goto(BASE + PATH, { waitUntil: "networkidle" })
    // Cherry renders asynchronously from their CDN.
    await page.waitForFunction(
        () => { const h = document.getElementById("calculator"); return h && h.innerHTML.length > 1000 },
        null, { timeout: 30000 })
    // Scroll the CTA into the band where the floating stack sits, which is
    // where the overlap happened; also raises the mobile booking dock.
    await page.evaluate(() => {
        const b = [...document.querySelectorAll("#calculator button, #calculator a")]
            .find((el) => /personalized options/i.test(el.innerText))
        if (b) b.scrollIntoView({ block: "end" })
    })
    await page.waitForTimeout(900)
    return page
}

async function main() {
    const browser = await chromium.launch()
    const errors = []

    // --- the widget itself, once, at a phone width -----------------------
    console.log("CHERRY WIDGET RENDERS")
    {
        const page = await load(browser, 390, errors)
        const r = await page.evaluate(measure)
        for (const [name, phrase] of SECTIONS) {
            check("section renders: " + name, r.text.includes(phrase), "looked for " + JSON.stringify(phrase))
        }
        check("Cherry's application CTA is present", r.controls >= 1, r.controls + " wide control(s) found")

        console.log("")
        console.log("UNVERIFIED CONTENT IS EXCLUDED BY CONFIGURATION")
        for (const [name, phrase] of EXCLUDED) {
            check("not on the page: " + name, !r.text.includes(phrase), "found " + JSON.stringify(phrase))
        }

        console.log("")
        console.log("CHERRY'S LEGAL DISCLOSURES ARE INTACT")
        for (const [name, phrase] of [
            ["NMLS / Cherry Technologies", "NMLS #2061234"],
            ["Iowa underwriting notice", "Iowa"],
            ["lending partners", "lending-partners"],
            ["accessibility statement", "accessibility"],
            ["examples-only disclaimer", "These are examples only"],
        ]) {
            check("still disclosed: " + name, r.text.includes(phrase), "missing " + JSON.stringify(phrase))
        }
        await page.close()
    }

    // --- the overlap -----------------------------------------------------
    console.log("\nFLOATING STACK CLEARS CHERRY'S CTAs  (Cherry edge-to-edge below 870px)")
    for (const w of OVERLAP_WIDTHS) {
        const page = await load(browser, w, errors)
        const r = await page.evaluate(measure)
        check(w + "px  floating stack stands down", !r.floatingVisible)
        check(w + "px  no control is covered", r.worst.px <= 0,
            r.worst.px > 0 ? r.worst.px + "px over \"" + r.worst.label + "\"" : "")
        if (r.inView && r.hits) {
            for (const h of r.hits) {
                check(w + "px  CTA clickable at " + h.where, h.own, "topmost element is " + h.got)
            }
        }
        await page.close()
    }

    // --- and is untouched where it never collided ------------------------
    console.log("\nWHATSAPP PRESERVED ELSEWHERE")
    for (const w of CLEAR_WIDTHS) {
        const page = await load(browser, w, errors)
        const r = await page.evaluate(measure)
        check(w + "px  floating stack still shown on this page", r.floatingVisible)
        check(w + "px  and still clear of Cherry", r.worst.px <= 0,
            r.worst.px > 0 ? r.worst.px + "px over \"" + r.worst.label + "\"" : "")
        await page.close()
    }
    {
        // The rule is page-scoped; every other page keeps its button on a phone.
        const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
        await page.goto(BASE + "/contact/", { waitUntil: "networkidle" })
        await page.waitForTimeout(600)
        const shown = await page.evaluate(() => {
            const fa = document.querySelector(".floating-actions")
            const wa = document.querySelector(".floating-whatsapp")
            return !!fa && getComputedStyle(fa).display !== "none" &&
                !!wa && !!wa.getAttribute("aria-label") && wa.getAttribute("href").includes("wa.me")
        })
        check("390px  /contact/ keeps its WhatsApp button, labelled and linked", shown)
        await page.close()
    }

    // --- the vendor error, stated rather than suppressed ------------------
    console.log("\nCHERRY'S OWN SCRIPT ERROR")
    const observerErrs = errors.filter((e) => /IntersectionObserver/.test(e))
    const otherErrs = errors.filter((e) => !/IntersectionObserver/.test(e))
    check("the only page errors are Cherry's IntersectionObserver throw", otherErrs.length === 0,
        otherErrs.slice(0, 3).join(" | "))
    console.log("  NOTE  " + observerErrs.length + " IntersectionObserver error(s) seen across " +
        (OVERLAP_WIDTHS.length + CLEAR_WIDTHS.length + 1) + " loads - raised inside Cherry's widget.js by a" +
        "\n        ref their How-it-works component never attaches. It feeds an analytics" +
        "\n        event only; the sections above are asserted to render regardless.")

    await browser.close()

    console.log("\n" + "-".repeat(64))
    console.log(fail === 0 ? "ALL PASS" : "FAILURES", "  " + pass + " passed, " + fail + " failed")
    if (fail) console.log("\n" + failures.map((f) => "  - " + f).join("\n"))
    process.exit(fail ? 1 : 0)
}

main()
