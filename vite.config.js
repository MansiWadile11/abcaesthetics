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

export default defineConfig(({ mode }) => {
    const list = [];

    // The tag carried over from the old WordPress site, so the practice keeps
    // one continuous history rather than starting an empty property on the
    // day the new site goes live.
    //
    // Only the ID is carried over. The old snippet also set a Site Kit
    // developer ID and installed a WordPress-specific event shim, neither of
    // which means anything outside WordPress.
    const DEFAULT_GA_ID = "GT-5TCZ3J3C";

    // Reads .env files for local work. On Vercel the variable arrives in
    // process.env instead, so both are checked - loadEnv alone would miss a
    // value set only in the Vercel dashboard.
    //
    // Unset falls back to the tag above. Set-but-EMPTY is the off switch, so
    // preview deployments can be excluded from the practice's reporting by
    // adding VITE_GA_ID with no value to the Preview environment. That is why
    // this tests for undefined rather than using || - an empty string has to
    // mean "off", not "use the default".
    const env = loadEnv(mode, process.cwd(), "");
    const configured = env.VITE_GA_ID ?? process.env.VITE_GA_ID;
    const gaId = (configured === undefined ? DEFAULT_GA_ID : configured).trim();

    // The absolute host that canonical, og:url and og:image are built from.
    // Social scrapers and rel=canonical both reject relative paths, so these
    // have to be absolute somewhere - here, once, rather than typed into 27
    // pages. Set VITE_SITE_URL to the Vercel address while reviewing there,
    // or leave it for the live domain. A trailing slash would double up with
    // the page path, so it is stripped.
    const siteUrl = (env.VITE_SITE_URL || process.env.VITE_SITE_URL ||
        "https://abcaestheticsllc.com").trim().replace(/\/+$/, "");

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
                context: { gaId, siteUrl },
            }),
            cleanUrls(),
        ],
        resolve: {
            alias: {
                "@/*": path.resolve("./*"),
                "@css": path.resolve("./src/assets/css/"),
            },
        },
        build: {
            outDir: "../dist",
            emptyOutDir: true,
            rollupOptions: {
                input: [...list],

                // Optional: Keeps original file names (no hashing) in dist
                output: {
                    entryFileNames: 'assets/[name].js',
                    chunkFileNames: 'assets/[name].js',
                    assetFileNames: 'assets/[name][extname]',
                },
            }
        },
    };
});
