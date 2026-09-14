import { sync } from "glob";
import { defineConfig } from "vite";
import path, { resolve } from "path";
import tailwindcss from '@tailwindcss/vite';
import handlebars from "vite-plugin-handlebars";

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
        server: { open: true, },
        plugins: [
            tailwindcss(),
            handlebars({
                partialDirectory: resolve("./src/partials"),
            }),
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