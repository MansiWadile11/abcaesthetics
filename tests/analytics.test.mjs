/*
Analytics is off where it must be off, and on where it must be on.

The Google Analytics tag ID is decided once, in vite.config.js, and reaches
every page through the {{#if gaId}} gate in partials/analytics.html. Two
mistakes are possible there and neither is visible in a browser:

  - A PREVIEW BUILD THAT REPORTS HOME. If the off switch silently fails, every
    review deployment feeds the practice's live property - page views on pages
    named after treatments, mixed into the real reporting, from people who are
    not patients. That is the expensive direction, so the cases that must
    produce NO script are tested hardest.
  - A PRODUCTION BUILD THAT REPORTS NOWHERE. If the default stops being
    returned for an unset variable, the live site loses analytics entirely and
    nothing breaks visibly to say so.

Vercel's dashboard will not save a variable with an empty value, which is why
"DISABLED" exists alongside the empty string. Both are tested, because local
work uses the empty one and Preview uses the word.

The partial is rendered through the same Handlebars the build uses (hoisted
from vite-plugin-handlebars), so this exercises the real gate rather than a
description of it.
*/

import fs from "node:fs"
import Handlebars from "handlebars"
import { resolveGaId } from "../vite.config.js"

// Written out in full, deliberately. This is the practice's live tag, carried
// over from the old WordPress site; if someone changes the default in
// vite.config.js, this suite fails rather than the reporting going quiet.
const LIVE_TAG = "GT-5TCZ3J3C"

const PARTIAL = "src/partials/analytics.html"
const source = fs.readFileSync(PARTIAL, "utf8")
const render = Handlebars.compile(source)

let pass = 0
const problems = []

function check(name, ok, detail) {
    if (ok) { pass++; return }
    problems.push(name + (detail === undefined ? "" : "  -> " + detail))
}

// What the partial emits, with its explanatory comments stripped so that the
// word "googletagmanager" inside a comment cannot pass for a real script tag.
function emitted(gaId) {
    return render({ gaId }).replace(/<!--[\s\S]*?-->/g, "").trim()
}

// input -> the gaId it resolves to. undefined means "set nowhere".
const CASES = [
    ["unset",                 undefined,      LIVE_TAG],
    ["empty string",          "",             ""],
    ["spaces only",           "   ",          ""],
    ["tab and newline only",  "\t\n",         ""],
    ["DISABLED",              "DISABLED",     ""],
    ["disabled, lower case",  "disabled",     ""],
    ["Disabled, mixed case",  "Disabled",     ""],
    ["DISABLED, padded",      "  DISABLED  ", ""],
    ["a valid G- id",         "G-ABC123XYZ",  "G-ABC123XYZ"],
    ["a valid G- id, padded", " G-ABC123XYZ ", "G-ABC123XYZ"],
    ["the live GT- id",       LIVE_TAG,       LIVE_TAG],
    ["a GTM- container",      "GTM-ABC1234",  "GTM-ABC1234"],
]

for (const [label, input, expected] of CASES) {
    const gaId = resolveGaId(input)
    check("resolves: " + label, gaId === expected,
        "got " + JSON.stringify(gaId) + ", wanted " + JSON.stringify(expected))

    const html = emitted(gaId)
    const loadsGoogle = html.includes("googletagmanager.com")

    if (expected === "") {
        // The whole point. Nothing at all: no script element, no request to
        // Google, no cookie, and no stray gtag() call for forms.js to find.
        check("off: " + label + " emits no script tag", !/<script/i.test(html), html.slice(0, 80))
        check("off: " + label + " contacts Google not at all", !loadsGoogle)
        check("off: " + label + " defines no gtag", !/gtag\(/.test(html))
        check("off: " + label + " emits nothing whatsoever", html === "", JSON.stringify(html.slice(0, 80)))
    } else {
        check("on: " + label + " loads the tag", loadsGoogle)
        check("on: " + label + " requests the right id",
            html.includes("gtag/js?id=" + expected), (html.match(/gtag\/js\?id=[^"]*/) || [])[0])
        check("on: " + label + " configures the right id",
            html.includes("gtag('config', '" + expected + "'"))
        // These two are off by default in this build and on by default in
        // GA4. On a site whose page names are treatments, that difference is
        // the point - see the reasoning in the partial.
        check("on: " + label + " keeps google signals off",
            html.includes("allow_google_signals: false"))
        check("on: " + label + " keeps ad personalisation off",
            html.includes("allow_ad_personalization_signals: false"))
    }

    // Belt and braces: the off switch must never be mistaken for an id and
    // written into the page.
    check("never leaks the word DISABLED", !/DISABLED/i.test(html))
}

// The gate itself. Without it the partial would emit a script with an empty
// id for every build, and every case above would pass for the wrong reason.
check("the partial still gates on gaId", /\{\{#if gaId\}\}/.test(source))
check("the partial hard-codes no tag id", !/G[T]?M?-[A-Z0-9]{6,}/.test(source.replace(/<!--[\s\S]*?-->/g, "")))

// The default is a constant of this project, not a preference.
check("unset still means the practice's live tag", resolveGaId(undefined) === LIVE_TAG, resolveGaId(undefined))

console.log("\nANALYTICS TAG RESOLUTION  (" + CASES.length + " variable states)")
for (const p of problems) console.log("  FAIL  " + p)

console.log("\n" + "-".repeat(64))
if (problems.length) {
    console.log("FAILED   " + problems.length + " problem(s), " + pass + " passed")
    process.exit(1)
}
console.log("ALL PASS   " + pass + " checks: unset reports to " + LIVE_TAG +
    ", empty and DISABLED emit nothing, valid ids pass through")
