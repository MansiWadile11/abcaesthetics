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
  - DUPLICATE two source files would be published at the same url;
  - FRAGMENT  the page exists but the "#part" after it does not. This is the
              quietest of the lot: the browser serves the page and simply
              ignores the hash, so the link looks like it works and just
              lands in the wrong place. Nine of them shipped that way -
              every treatment page's "View all results" - before anything
              checked.
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
const fragments = []
let checked = 0

/* Ids published on each page, read once per page and remembered. */
const idCache = new Map()
function idsFor(url) {
    if (idCache.has(url)) return idCache.get(url)
    const set = new Set()
    const file = published.get(url)
    if (file) {
        for (const m of fs.readFileSync(file, "utf8").matchAll(/\sid="([^"#]+)"/g)) set.add(m[1])
    }
    idCache.set(url, set)
    return set
}

/* Not every fragment is an id. The results gallery takes the category out of
   the hash and applies the matching filter chip instead, so #hair and friends
   are not id attributes anywhere. Those still have to be real: either an id
   on the page, or a hash the gallery declares it handles. Never neither.

   WHICH hashes those are is read from the component's own map rather than
   pattern-matched out of the bundle. Minification does not treat them alike -
   "hair" survives as a quoted string because it is also a value, while
   "regenerative" and "injectables" come through as bare object keys - and a
   regex loose enough to catch a bare key is loose enough to match almost
   anything in 200KB of minified javascript. That cuts both ways: it waves
   through names it should not, and it would have masked a real id going
   missing, because "contact" happens to appear in the bundle too.

   So: names from the source map, then each one confirmed present in the
   build, so a map that never shipped cannot satisfy this either. */
const galleryJs = fs.readFileSync("src/assets/js/components/gallery.js", "utf8")
const declared = (galleryJs.match(/HASH_FILTERS\s*=\s*\{([^}]*)\}/) || [])[1] || ""
const scriptHashes = new Set([...declared.matchAll(/["'`]?([A-Za-z0-9_-]+)["'`]?\s*:/g)].map((m) => m[1]))
const bundles = sync(DIST + "/assets/**/*.js").map((f) => fs.readFileSync(f, "utf8")).join("\n")
const scriptHandles = (frag) => scriptHashes.has(frag) && bundles.includes(frag)

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
            continue
        }

        const frag = raw.includes("#") ? raw.slice(raw.indexOf("#") + 1).split("?")[0] : ""
        if (frag) {
            checked++
            if (!idsFor(target).has(frag) && !scriptHandles(frag)) {
                fragments.push([from, raw, 'nothing on ' + target + ' answers to "#' + frag + '"'])
            }
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
fail("links whose #fragment has no target", fragments)

console.log("\n" + "-".repeat(64))
if (failed) {
    console.log("FAILED   " + failed + " problem(s)")
    process.exit(1)
}
console.log("ALL PASS   every internal link resolves to a published, canonical url")
