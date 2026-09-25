/*
Every page has its own title and description, and they survive the build.

Duplicate or over-long meta is the kind of defect that never shows up in a
browser. The page looks perfect; it just loses the search result. Before this
suite existed, all 27 pages shipped the same description - Google treats a
description repeated site-wide as no description at all and writes its own
snippet instead.

Three failures are caught here that nothing else would:

  - DOUBLE-ESCAPED AMPERSANDS. Handlebars escapes partial parameters on
    output, so "&amp;" typed in a page renders as "&amp;amp;" and the browser
    tab reads "Results &amp; Before / After". This shipped for months.
  - DUPLICATES. Two pages competing on the same title.
  - LENGTH. Past ~60 characters a title is truncated in the result, and a
    description under ~70 tends to be discarded in favour of page text.

Checked against dist/, so what is tested is what actually ships.
*/

import fs from "node:fs"
import { sync } from "glob"

const files = sync("dist/**/*.html").map((f) => f.replace(/\\/g, "/"))

// Reached by being sent there, so they are deliberately out of the index.
const NOINDEX = ["dist/thank-you.html", "dist/404-error.html"]

let pass = 0
const problems = []

function check(name, ok, detail) {
    if (ok) { pass++; return }
    problems.push(name + (detail ? "  -> " + detail : ""))
}

const titles = new Map()
const descriptions = new Map()

// Length has to be measured on what a person SEES. "&amp;" is five characters
// in the markup and one on the screen, so measuring the raw attribute makes
// any title containing an ampersand or an apostrophe look far longer than the
// search result it produces.
function decode(s) {
    return s
        .replace(/&#x27;|&apos;/gi, "'")
        .replace(/&quot;/gi, '"')
        .replace(/&#x2F;/gi, "/")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
        .replace(/&amp;/gi, "&")      // last, so &amp;lt; does not become <
}

for (const f of files) {
    const html = fs.readFileSync(f, "utf8")
    const page = f.slice("dist/".length)

    const title = (html.match(/<title>([\s\S]*?)<\/title>/) || [])[1]
    const desc = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1]
    const robots = (html.match(/<meta name="robots" content="([^"]*)"/) || [])[1]

    check(page + ": has a title", !!title)
    check(page + ": has a description", !!desc)
    if (!title || !desc) continue

    const shownTitle = decode(title)
    const shownDesc = decode(desc)

    check(page + ": title is not the placeholder", !/^(Home|Not Found|Privacy-policy|Terms-conditions|Thank-you)$/.test(shownTitle), title)
    check(page + ": title length", shownTitle.length <= 60, shownTitle.length + " chars")
    check(page + ": description length", shownDesc.length >= 70 && shownDesc.length <= 170, shownDesc.length + " chars")

    // "&amp;amp;" - escaped twice on the way out
    check(page + ": title not double-escaped", !/&amp;(amp|lt|gt|quot|#\d+);/.test(title), title)
    check(page + ": description not double-escaped", !/&amp;(amp|lt|gt|quot|#\d+);/.test(desc), desc)

    // A bare "&" is invalid in HTML and breaks some parsers/crawlers.
    check(page + ": title has no bare ampersand", !/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);)/i.test(title), title)

    const want = NOINDEX.includes(f) ? "noindex" : "index"
    check(page + ": robots is " + want, (robots || "index, follow").startsWith(want), robots)

    if (titles.has(title)) problems.push("DUPLICATE TITLE: " + page + " and " + titles.get(title) + "  -> " + title)
    else { titles.set(title, page); pass++ }

    if (descriptions.has(desc)) problems.push("DUPLICATE DESCRIPTION: " + page + " and " + descriptions.get(desc))
    else { descriptions.set(desc, page); pass++ }
}

console.log("\nMETA TITLES & DESCRIPTIONS  (" + files.length + " pages)")
for (const p of problems) console.log("  FAIL  " + p)

console.log("\n" + "-".repeat(64))
if (problems.length) {
    console.log("FAILED   " + problems.length + " problem(s), " + pass + " passed")
    process.exit(1)
}
console.log("ALL PASS   " + pass + " checks: every page has a unique, correctly-sized title and description")
