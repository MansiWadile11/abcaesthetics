/*
Every URL serves the page it is supposed to.

This exists because of a real regression: a clean-URL rewrite added for
/thank-you also caught /blog/ and /blog/<slug>/, rewrote them to a .html file
that does not exist, and Vite answered with the home page instead. Nothing
errored - the blog simply became the home page, and the page-level harnesses
did not notice because a home page passes every generic check.

A wrong-but-valid page is the failure mode a status code cannot catch, so this
asserts on the CONTENT of each route.

Run the dev server first:  npm run dev
*/

const BASE = process.env.BASE || "http://localhost:5173"

let pass = 0, fail = 0
const failures = []
function check(name, cond, detail) {
    if (cond) { pass++; console.log("  PASS  " + name) }
    else { fail++; failures.push(name + (detail ? " -> " + detail : "")); console.log("  FAIL  " + name + (detail ? "  (" + detail + ")" : "")) }
}

// path -> a phrase that appears ONLY on the page that path should serve
const ROUTES = [
    ["/", "Personalized aesthetics"],
    ["/index.html", "Personalized aesthetics"],

    // The Insights section. Directory URLs, one level deep and two.
    ["/blog/", "Wellness Insights |"],
    ["/blog/index.html", "Wellness Insights |"],
    ["/blog/skinpen/", "SkinPen"],
    ["/blog/prp-prf/", "PRP and PRF"],
    ["/blog/injectables/", "Botox"],
    ["/blog/skin-energy/", "SkinTyte"],
    ["/blog/hair-restoration/", "hair"],
    ["/blog/hormone-wellness/", "hormone"],

    // --- the ten URLs carried over from the old WordPress site ----------
    // These are the whole point of the migration: each one is the address
    // the old site ranked for, answered by the new page, with no redirect.
    // If any of these stops resolving, the SEO value of the rebuild is gone
    // and nothing else here would notice.
    ["/about/", "About"],
    ["/contact/", "Get in touch"],
    ["/services/", "Treatments |"],
    ["/book-appointment/", "Appointment"],
    ["/injectables/", "Aesthetic Injectables"],
    ["/hair-restoration/", "Hair Restoration"],
    ["/privacy-policy/", "Privacy"],
    ["/terms-of-service/", "Terms"],
    ["/accessibility-statement/", "Accessibility"],

    // --- pages that kept a new slug -------------------------------------
    ["/results/", "Results"],
    ["/skin-energy/", "Energy-Based"],
    ["/hormone-metabolic-wellness/", "Metabolic"],
    ["/regenerative-aesthetics/", "Regenerative"],
    ["/sexual-wellness/", "Sexual Wellness"],
    ["/womens-wellness/", "Wellness"],
    ["/mens-wellness/", "Wellness"],
    ["/wellness-products/", "Wellness Products"],

    // The form's redirect target.
    ["/thank-you/", "we have your request"],
    ["/thank-you.html", "we have your request"],
]

async function main() {
    console.log("\nROUTES  (" + BASE + ")\n")

    for (const [path, needle] of ROUTES) {
        let res, body = ""
        try {
            res = await fetch(BASE + path)
            body = await res.text()
        } catch (err) {
            check(path, false, "request failed: " + err.message)
            continue
        }

        const title = (body.match(/<title>([^<]*)<\/title>/) || [])[1] || "(no title)"
        const ok = res.ok && (title.toLowerCase().includes(needle.toLowerCase()) ||
            body.toLowerCase().includes(needle.toLowerCase()))

        // The specific trap: a page quietly answered with the home page.
        const isHome = /<title>\s*Home\s*\|/.test(body)
        const shouldBeHome = path === "/" || path === "/index.html"

        check(path + "  serves its own page", ok, res.status + "  title=" + title)
        if (!shouldBeHome) {
            check(path + "  is not the home page in disguise", !isHome, "title=" + title)
        }
    }

    console.log("\n" + "-".repeat(64))
    console.log(fail === 0 ? "ALL PASS" : "FAILURES", "  " + pass + " passed, " + fail + " failed")
    if (fail) console.log("\n" + failures.map((f) => "  - " + f).join("\n"))
    process.exit(fail ? 1 : 0)
}

main()
