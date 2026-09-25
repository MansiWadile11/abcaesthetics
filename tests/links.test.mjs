/*
Every internal link resolves, and resolves to a FINAL url.

This exists because the URL migration moved fourteen pages and rewrote every
reference to them. A stale href does not fail a build, does not fail a render,
and does not fail any other suite here - it just quietly 404s, or takes a
redirect hop it should not need, for as long as nobody clicks it.

Checked against dist/, not src/, so what is tested is what actually ships.

Three separate failures are possible and they are not the same problem:

  - BROKEN    the target does not exist in the build at all;
  - STALE     the target exists but is not the canonical url - a ".html"
              path, or a missing trailing slash. Vercel would answer these
              with a 308 rather than a 404, so they are survivable, but an
              internal link should never spend a redirect;
  - DUPLICATE two source files would be published at the same url.
*/

import fs from "node:fs"
import path from "node:path"
import { sync } from "glob"

const DIST = "dist"

// ---------------------------------------------------------------------------
// what the build actually publishes, as urls
// ---------------------------------------------------------------------------
const files = sync(DIST + "/**/*.html").map((f) => f.replace(/\\/g, "/"))

function urlFor(file) {
    const rel = file.slice(DIST.length)                 // "/blog/skinpen/index.html"
    if (rel === "/index.html") return "/"
    if (rel.endsWith("/index.html")) return rel.slice(0, -"index.html".length)
    return rel.replace(/\.html$/, "") + "/"
}

const published = new Map()
const duplicates = []

for (const f of files) {
    const url = urlFor(f)
    if (published.has(url)) duplicates.push([url, published.get(url), f])
    published.set(url, f)
}

// ---------------------------------------------------------------------------
// every internal href in the build
// ---------------------------------------------------------------------------
const broken = []
const stale = []
let checked = 0

for (const f of files) {
    const html = fs.readFileSync(f, "utf8")
    const from = urlFor(f)

    for (const m of html.matchAll(/href="([^"]+)"/g)) {
        const raw = m[1]
        if (/^(https?:|mailto:|tel:|#|data:)/.test(raw)) continue

        const target = raw.split("#")[0].split("?")[0]
        if (!target) continue                            // pure "#fragment"
        if (!target.startsWith("/")) continue            // no relative links in this build
        if (/\.(css|js|png|jpe?g|webp|svg|ico|xml|txt|pdf)$/i.test(target)) continue

        checked++

        // A canonical page url is "/" or "/something/".
        if (!target.endsWith("/")) {
            stale.push([from, raw, "not a trailing-slash url"])
            continue
        }
        if (!published.has(target)) {
            broken.push([from, raw, "no page is published at this url"])
        }
    }

    // assets must exist on disk too
    for (const m of html.matchAll(/(?:src|href)="(\/(?:assets|images)\/[^"]+)"/g)) {
        const asset = m[1].split("?")[0]
        checked++
        if (!fs.existsSync(path.join(DIST, asset))) {
            broken.push([from, asset, "asset missing from the build"])
        }
    }
}

// ---------------------------------------------------------------------------
let failed = 0
const fail = (label, rows) => {
    if (!rows.length) return
    failed += rows.length
    console.log("\n  FAIL  " + label)
    for (const r of rows.slice(0, 25)) console.log("        " + r.join("   <-   "))
    if (rows.length > 25) console.log("        ...and " + (rows.length - 25) + " more")
}

console.log("\nINTERNAL LINKS  (" + published.size + " published urls, " + checked + " references)")

fail("broken links", broken)
fail("links that are not the final url", stale)
fail("two files publish to the same url", duplicates)

console.log("\n" + "-".repeat(64))
if (failed) {
    console.log("FAILED   " + failed + " problem(s)")
    process.exit(1)
}
console.log("ALL PASS   every internal link resolves to a published, canonical url")
