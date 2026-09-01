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
