import fs from "node:fs";
import { sync } from "glob";
import { defineConfig, loadEnv } from "vite";
import path, { resolve } from "path";
import tailwindcss from '@tailwindcss/vite';
import handlebars from "vite-plugin-handlebars";

/**
 * Makes dev serve the same URLs production does.
 *
 * vercel.json sets cleanUrls + trailingSlash, so every page lives at a path
 * like /about/ - the shape the old WordPress site used, which is what lets
 * ten pages keep the exact URL they already rank for. Without this middleware
 * those URLs only exist once deployed, and every local check would be testing
 * a set of addresses the real site does not have.
 *
 * Resolution order for "/about/":
 *
 *   1. src/about/index.html  - a real directory, which is how /blog/ and
 *      /blog/<slug>/ are stored. Tried FIRST, because a directory must never
 *      be answered by a same-named .html file;
 *   2. src/about.html        - the ordinary page.
 *
 * "/about" (no slash) resolves too, so a stale link still lands somewhere
 * sensible while developing. In production Vercel answers that one with a
 * 308 to /about/ instead.
 *
 * Anything that matches neither falls through to Vite and a real 404, rather
 * than being silently answered with the wrong page.
 */
function cleanUrls() {
    return {
        name: "clean-urls",
        apply: "serve",
        configureServer(server) {
            const root = resolve("./src");

            const serve = (candidate) => {
                const file = path.join(root, candidate);
                return file.startsWith(root) && fs.existsSync(file) ? candidate : null;
            };

            server.middlewares.use((req, _res, next) => {
                const [pathname, query = ""] = req.url.split("?");
                const suffix = query ? "?" + query : "";

                if (
                    pathname !== "/" &&
                    !path.extname(pathname) &&
                    !pathname.startsWith("/@") &&
                    !pathname.startsWith("/api/") &&
                    !pathname.includes("..")
                ) {
                    const bare = pathname.replace(/\/$/, "");
                    const hit = serve(bare + "/index.html") || serve(bare + ".html");
                    if (hit) req.url = hit + suffix;
                }
                next();
            });
        },
    };
}

const PRODUCTION_HOST = "https://abcaestheticsllc.com";

/**
 * Keep sitemap.xml and robots.txt on the same host as the canonical tags.
 *
 * Files in public/ are copied verbatim - Vite does no templating on them - so
 * the host in those two is written out as the production default. That is
 * right for a production build and wrong for every other one: a preview built
 * with VITE_SITE_URL pointing at the Vercel address would otherwise ship a
 * sitemap advertising the live domain, inviting Google to index a review
 * deployment, while its own canonical tags said something different.
 *
 * So the host is rewritten here from the SAME siteUrl the canonicals use.
 * When the two already agree - the normal case - this does nothing.
 */
function siteUrlInStaticFiles(siteUrl) {
    return {
        name: "site-url-in-static-files",
        apply: "build",
        closeBundle() {
            if (siteUrl === PRODUCTION_HOST) return;

            for (const name of ["sitemap.xml", "robots.txt"]) {
                const file = path.resolve("dist", name);
                if (!fs.existsSync(file)) continue;
                const before = fs.readFileSync(file, "utf8");
                const after = before.split(PRODUCTION_HOST).join(siteUrl);
                if (after !== before) {
                    fs.writeFileSync(file, after);
                    console.log(`  ${name} host -> ${siteUrl}`);
                }
            }
        },
    };
}

// The tag carried over from the old WordPress site, so the practice keeps one
// continuous history rather than starting an empty property on the day the new
// site goes live.
//
// Only the ID is carried over. The old snippet also set a Site Kit developer ID
// and installed a WordPress-specific event shim, neither of which means
// anything outside WordPress.
const DEFAULT_GA_ID = "GT-5TCZ3J3C";

// The word that switches analytics off where an empty value cannot be used.
//
// An empty string has always been the off switch and still is - that is what a
// local .env uses. But Vercel's dashboard refuses to save a variable with no
// value, so the one environment that most needs analytics off had no way to
// ask for it. This is that way: set VITE_GA_ID=DISABLED on the Preview
// environment and the analytics partial emits nothing at all.
//
// Matched case-insensitively on purpose. A dashboard value typed "disabled"
// would otherwise be treated as a measurement ID and quietly turn analytics
// ON - the one failure direction that matters here, because it would put
// review traffic into the practice's live property. No real Google tag can
// collide with the word: they are all G-, GT-, UA-, AW- or GTM- prefixed.
const GA_DISABLED = "DISABLED";

/**
 * Resolves what the analytics partial receives, from the raw variable.
 *
 *   undefined (set nowhere)   ->  DEFAULT_GA_ID, the practice's live tag
 *   "DISABLED", any casing    ->  "", so the partial emits nothing
 *   "" or whitespace          ->  "", the same
 *   anything else             ->  itself, trimmed
 *
 * Exported for tests/analytics.test.mjs. Vite reads the default export only,
 * so this is invisible to the build.
 */
export function resolveGaId(configured) {
    if (configured === undefined) return DEFAULT_GA_ID;

    const value = configured.trim();
    return value.toUpperCase() === GA_DISABLED ? "" : value;
}

export default defineConfig(({ mode }) => {
    const list = [];

    // Reads .env files for local work. On Vercel the variable arrives in
    // process.env instead, so both are checked - loadEnv alone would miss a
    // value set only in the Vercel dashboard.
    //
    // ?? and not ||, because an empty string has to reach resolveGaId AS an
    // empty string and mean "off", rather than falling through to the default.
    const env = loadEnv(mode, process.cwd(), "");
    const gaId = resolveGaId(env.VITE_GA_ID ?? process.env.VITE_GA_ID);

    // The absolute host that canonical, og:url and og:image are built from.
    // Social scrapers and rel=canonical both reject relative paths, so these
    // have to be absolute somewhere - here, once, rather than typed into 27
    // pages. Set VITE_SITE_URL to the Vercel address while reviewing there,
    // or leave it for the live domain. A trailing slash would double up with
    // the page path, so it is stripped.
    const siteUrl = (env.VITE_SITE_URL || process.env.VITE_SITE_URL ||
        "https://abcaestheticsllc.com").trim().replace(/\/+$/, "");

    // The practice's Jane booking page. Every "Book an appointment" button on
    // every page points here, so the address lives in ONE place: if the
    // practice ever moves booking provider, this line changes and all 41 CTAs
    // follow. VITE_JANE_URL overrides it per environment.
    const janeUrl = (env.VITE_JANE_URL || process.env.VITE_JANE_URL ||
        "https://abcaestheticsllc.janeapp.com").trim().replace(/\/+$/, "");


    // The Insights section lives at src/blog/<slug>/index.html so it is
    // served as /blog/<slug>/ - so the glob has to reach past one level.
    // Partials are not pages and must stay out of the input list.
    if (mode === "production") {
        sync("src/**/*.html", { ignore: "src/partials/**" }).forEach((file) => { list.push(file); });
    }

    return {
        root: "src",
        base: "/",
        publicDir: "../public",
        server: { open: true },
        plugins: [
            tailwindcss(),
            handlebars({
                partialDirectory: resolve("./src/partials"),

                // Available to every page and partial. The analytics partial
                // emits nothing at all when gaId is empty, so an unset
                // variable simply means "no analytics on this build".
                context: { gaId, siteUrl, janeUrl },
            }),
            cleanUrls(),
            siteUrlInStaticFiles(siteUrl),
        ],
        build: {
            outDir: "../dist",
            emptyOutDir: true,
            rollupOptions: {
                input: [...list],

                // No output.* overrides here on purpose: Vite's defaults put a
                // content hash in every bundled filename, and vercel.json caches
                // /assets/* as immutable for a year on the strength of it. The
                // two go together. Pinning these names back to app.js/app.css
                // would leave that header promising a year of immutability for a
                // URL whose contents change on every deploy - every visitor and
                // every edge node would hold a stale bundle. Change one and the
                // other has to change with it.
                //
                // The <link> and <script> in partials/head-css.html point at the
                // unhashed source paths; Vite rewrites both to the hashed names
                // at build time, so nothing in the markup needs to know.
            }
        },
    };
});
