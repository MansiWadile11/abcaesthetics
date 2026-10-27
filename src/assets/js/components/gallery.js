/*
File: Results gallery
Filter chips plus a lightbox. The tile is a uniform crop so the grid stays
even; the lightbox shows the whole photograph, so a before/after is never
seen cropped.
*/

function setup() {
    const grid = document.getElementById("gallery")
    const box = document.getElementById("lightbox")
    if (!grid || !box) return

    const tiles = Array.from(grid.querySelectorAll(".gal-tile"))
    const chips = Array.from(document.querySelectorAll(".gal-chip"))
    const empty = document.querySelector(".gal-empty")
    // The image element is created on first open, not up front: an <img>
    // carrying no src reports as a broken image for as long as it sits in the
    // document, whether or not anyone can see it.
    const fig = box.querySelector(".gal-figure")
    let img = null
    const ensureImg = () => {
        if (img) return img
        img = document.createElement("img")
        fig.insertBefore(img, fig.firstChild)
        return img
    }
    const titleEl = box.querySelector(".gal-fig-title")
    const capEl = box.querySelector(".gal-fig-caption")

    let shown = tiles.slice()
    let index = 0

    // ---- filtering -----------------------------------------------------
    const filter = (cat) => {
        shown = []
        tiles.forEach((t) => {
            const on = cat === "all" || t.dataset.cat === cat
            t.hidden = !on
            if (on) shown.push(t)
        })
        if (empty) empty.hidden = shown.length > 0
        chips.forEach((c) => c.classList.toggle("is-active", c.dataset.filter === cat))
    }

    chips.forEach((c) => c.addEventListener("click", () => filter(c.dataset.filter)))

    /* Arriving from a treatment page.

       Every treatment page ends with "View all results" pointing at
       /results/ with its own category in the hash. The hashes were written
       before these chips existed and do not all match them, so the mapping
       is spelled out rather than guessed at:

         #hair          -> hair    (1 photograph)
         #regenerative  -> regen   (1)
         #skin-energy   -> skin    (3)
         #injectables   -> null    - the injectables page covers
                                     neuromodulators, fillers AND lips, and
                                     filtering to any one of the three would
                                     hide the other two. It lands on the
                                     unfiltered grid, which is what "view all
                                     results" says anyway.

       /results/#wellness is deliberately absent: those five treatments have
       no published photographs, so there is nothing here to filter to. That
       hash is a real section id further down the page and the browser
       handles it without us.

       Anything else in the hash is left alone. Other pages anchor into
       sections by id and this must not interfere with them. */
    const HASH_FILTERS = { hair: "hair", regenerative: "regen", "skin-energy": "skin", injectables: null }

    const fromHash = () => {
        /* decodeURIComponent throws URIError on a malformed escape, and a
           bare "%" is enough to do it - /results/#100% would be sufficient.
           This runs during setup, before the lightbox is wired below, so an
           exception here does not just skip the filter: it takes the whole
           gallery with it and every photograph stops opening. Decode when we
           can, fall back to the raw hash when we cannot. */
        let key = location.hash.replace(/^#/, "")
        try { key = decodeURIComponent(key) } catch { /* malformed - use it as it came */ }
        key = key.toLowerCase()
        if (!(key in HASH_FILTERS)) return
        // null means "no single chip fits" - which still has to say "all"
        // out loud rather than fall through. This also runs on hashchange,
        // and moving between two hashes on this page does not reload it, so
        // leaving the filter untouched would show the previous category's
        // photographs under the new heading.
        filter(HASH_FILTERS[key] || "all")
        // scroll-margin-top on section[id] keeps this clear of the sticky header
        const target = grid.closest("section[id]") || grid
        target.scrollIntoView({ block: "start" })
    }

    fromHash()
    window.addEventListener("hashchange", fromHash)

    // ---- lightbox ------------------------------------------------------
    const show = (i) => {
        if (!shown.length) return
        index = (i + shown.length) % shown.length
        const t = shown[index]
        const el = ensureImg()
        el.src = t.dataset.full
        el.alt = t.querySelector("img").alt
        titleEl.innerHTML = t.dataset.title
        capEl.innerHTML = t.dataset.caption
        box.hidden = false
        document.body.style.overflow = "hidden"
    }

    const close = () => {
        box.hidden = true
        if (img) img.removeAttribute("src")
        document.body.style.overflow = ""
    }

    tiles.forEach((t) => t.addEventListener("click", () => show(shown.indexOf(t))))
    box.querySelector(".gal-close").addEventListener("click", close)
    box.querySelector(".gal-next").addEventListener("click", () => show(index + 1))
    box.querySelector(".gal-prev").addEventListener("click", () => show(index - 1))
    box.addEventListener("click", (e) => { if (e.target === box) close() })

    document.addEventListener("keydown", (e) => {
        if (box.hidden) return
        if (e.key === "Escape") close()
        else if (e.key === "ArrowRight") show(index + 1)
        else if (e.key === "ArrowLeft") show(index - 1)
    })
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup)
} else {
    setup()
}
