/*
"View all results" actually arrives somewhere.

Every treatment page ends with that link, and every one of them carries a
category in the hash. All nine were broken: /results/ had no matching id, so
the browser served the page, ignored the hash and left the visitor at the top
of the banner. Nothing failed - not the build, not the link checker, not a
render - because a hash with no target is not an error, it is a no-op. That is
what makes this worth a test.

Two different mechanisms answer those hashes and both are checked here:

  #wellness     a real section id. Those five treatments have no published
                photographs, so there is nothing to filter to - the honest
                destination is the panel that says so.

  #hair         read by gallery.js, which applies the matching filter chip.
  #regenerative The hashes predate the chips and do not all match them, so the
  #skin-energy  mapping is explicit in that file. #injectables is deliberately
  #injectables  unfiltered: it spans neuromodulators, fillers and lips, and
                any single chip would hide two thirds of its own results.

The header is sticky, so landing is not the same as being readable: each one
is also checked to sit below the header rather than under it.

Run the dev server first:  npm run dev
Then:                      BASE=http://localhost:5173 node tests/results-anchors.test.mjs
*/

import { chromium } from "playwright"

const BASE = process.env.BASE || "http://localhost:5173"

let pass = 0, fail = 0
const failures = []
function check(name, cond, detail) {
    if (cond) { pass++; console.log("  PASS  " + name) }
    else { fail++; failures.push(name + (detail ? " -> " + detail : "")); console.log("  FAIL  " + name + (detail ? "  (" + detail + ")" : "")) }
}

/* Every "View all results" link in the build, and what it should do.
   filter: the chip expected to end up active, or null for the whole grid.
   section: the element the page should have scrolled to. */
const ARRIVALS = [
    { from: "/hair-restoration/", hash: "hair", filter: "hair", section: "results-gallery" },
    { from: "/regenerative-aesthetics/", hash: "regenerative", filter: "regen", section: "results-gallery" },
    { from: "/skin-energy/", hash: "skin-energy", filter: "skin", section: "results-gallery" },
    { from: "/injectables/", hash: "injectables", filter: null, section: "results-gallery" },
    { from: "/hormone-metabolic-wellness/", hash: "wellness", filter: null, section: "wellness" },
    { from: "/womens-wellness/", hash: "wellness", filter: null, section: "wellness" },
    { from: "/mens-wellness/", hash: "wellness", filter: null, section: "wellness" },
    { from: "/sexual-wellness/", hash: "wellness", filter: null, section: "wellness" },
    { from: "/wellness-products/", hash: "wellness", filter: null, section: "wellness" },
]

async function main() {
    const browser = await chromium.launch()

    // ---- the links still say what this test thinks they say ---------------
    console.log("THE LINKS ON THE TREATMENT PAGES")
    {
        const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
        for (const a of ARRIVALS) {
            await page.goto(BASE + a.from, { waitUntil: "domcontentloaded" })
            const href = await page.evaluate(() => {
                const el = document.querySelector('a[href^="/results/#"]')
                return el ? el.getAttribute("href") : null
            })
            check(a.from + ' links to "/results/#' + a.hash + '"', href === "/results/#" + a.hash, "found " + href)
        }
        await page.close()
    }

    // ---- arriving there --------------------------------------------------
    for (const width of [390, 1280]) {
        console.log("\nARRIVING AT /results/  (" + width + "px)")
        const page = await browser.newPage({ viewport: { width, height: 844 } })
        const errors = []
        page.on("pageerror", (e) => errors.push(String(e).split("\n")[0]))

        for (const a of ARRIVALS) {
            // seen once per hash - five pages share #wellness
            if (a.hash === "wellness" && a.from !== "/hormone-metabolic-wellness/") continue

            await page.goto(BASE + "/results/#" + a.hash, { waitUntil: "domcontentloaded" })
            await page.waitForTimeout(700)

            const r = await page.evaluate((expected) => {
                const sec = document.getElementById(expected.section)
                const header = document.querySelector(".reference-nav-shell")
                const active = document.querySelector(".gal-chip.is-active")
                const tiles = [...document.querySelectorAll(".gal-tile")]
                const visible = tiles.filter((t) => !t.hidden)
                return {
                    sectionExists: !!sec,
                    secTop: sec ? Math.round(sec.getBoundingClientRect().top) : null,
                    headerBottom: Math.round(header.getBoundingClientRect().bottom),
                    scrolled: Math.round(window.scrollY),
                    activeFilter: active ? active.dataset.filter : null,
                    visibleTiles: visible.length,
                    totalTiles: tiles.length,
                    offScreenCats: [...new Set(visible.map((t) => t.dataset.cat))].sort(),
                    scrollMargin: sec ? getComputedStyle(sec).scrollMarginTop : null,
                }
            }, a)

            const tag = "#" + a.hash + "  "
            check(tag + 'target "' + a.section + '" exists', r.sectionExists)
            check(tag + "page actually scrolled (y=" + r.scrolled + ")", r.scrolled > 0)
            // the whole point: the heading is readable, not tucked under the header
            check(tag + "lands below the sticky header (top=" + r.secTop + ", header ends " + r.headerBottom + ")",
                r.sectionExists && r.secTop >= r.headerBottom - 2)
            check(tag + "carries a scroll offset (" + r.scrollMargin + ")", r.scrollMargin === "104px")

            if (a.filter) {
                check(tag + 'filter chip "' + a.filter + '" is active', r.activeFilter === a.filter, "active=" + r.activeFilter)
                check(tag + "shows only that category (" + r.offScreenCats.join(",") + ")",
                    r.offScreenCats.length === 1 && r.offScreenCats[0] === a.filter)
                check(tag + "and shows at least one photograph", r.visibleTiles > 0)
            } else if (a.section === "results-gallery") {
                check(tag + "leaves the grid unfiltered (" + r.visibleTiles + "/" + r.totalTiles + ")",
                    r.visibleTiles === r.totalTiles)
            }
        }

        check(width + "px  no page errors while following the anchors", errors.length === 0, errors.slice(0, 2).join(" | "))
        await page.close()
    }

    // ---- a hash we do not handle must not break the gallery ---------------
    console.log("\nAN UNRELATED HASH IS LEFT ALONE")
    {
        const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
        await page.goto(BASE + "/results/#something-else", { waitUntil: "domcontentloaded" })
        await page.waitForTimeout(600)
        const r = await page.evaluate(() => {
            const tiles = [...document.querySelectorAll(".gal-tile")]
            return {
                visible: tiles.filter((t) => !t.hidden).length,
                total: tiles.length,
                active: document.querySelector(".gal-chip.is-active")?.dataset.filter,
                scrolled: Math.round(window.scrollY),
            }
        })
        check("unknown hash leaves every tile showing", r.visible === r.total, r.visible + "/" + r.total)
        check('unknown hash leaves "all results" selected', r.active === "all", "active=" + r.active)
        check("unknown hash does not scroll the page", r.scrolled === 0, "y=" + r.scrolled)
        await page.close()
    }

    await browser.close()

    console.log("\n" + "-".repeat(64))
    console.log(fail === 0 ? "ALL PASS" : "FAILURES", "  " + pass + " passed, " + fail + " failed")
    if (fail) console.log("\n" + failures.map((f) => "  - " + f).join("\n"))
    process.exit(fail ? 1 : 0)
}

main()
