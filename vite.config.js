import fs from "node:fs";
import { sync } from "glob";
import { defineConfig } from "vite";
import path, { resolve } from "path";
import tailwindcss from '@tailwindcss/vite';
import handlebars from "vite-plugin-handlebars";

/**
 * Serves /thank-you (no extension) in dev, matching the rewrite in
 * vercel.json, so the redirect target is tested locally rather than
 * discovered after a deploy.
 *
 * Two rules keep this narrow, and both matter:
 *
 *   - a path ending in "/" is a DIRECTORY and is left alone. /blog/ and
 *     /blog/<slug>/ resolve to their own index.html, and rewriting them to
 *     "/blog.html" makes Vite fall back to the home page - which looks for
 *     all the world like the blog was replaced by the home page;
 *   - the .html file must actually exist. Anything else falls through to
 *     Vite's own handling and a real 404, rather than being silently
 *     answered with the wrong page.
 */
function cleanUrls() {
    return {
        name: "clean-urls",
        apply: "serve",
        configureServer(server) {
            const root = resolve("./src");
            server.middlewares.use((req, _res, next) => {
                const [pathname, query = ""] = req.url.split("?");
                if (
                    pathname !== "/" &&
                    !pathname.endsWith("/") &&
                    !path.extname(pathname) &&
                    !pathname.startsWith("/@") &&
                    !pathname.startsWith("/api/") &&
                    !pathname.includes("..")
                ) {
                    const file = path.join(root, pathname + ".html");
                    if (file.startsWith(root) && fs.existsSync(file)) {
                        req.url = pathname + ".html" + (query ? "?" + query : "");
                    }
                }
                next();
            });
        },
    };
}

export default defineConfig(({ mode }) => {
    const list = [];

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
