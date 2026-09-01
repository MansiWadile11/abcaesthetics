/*
File: Scroll Reveal
The design reference fades content up as it enters the viewport (WOW.js
`fadeInUp`, ~32 elements per page). This does the same with an
IntersectionObserver — no library, and it degrades to "everything visible"
if the API is missing or the visitor prefers reduced motion.

Targets are picked automatically: the direct children of each section's
container. Siblings within one group are staggered so a row of cards
arrives in sequence rather than all at once.
*/

const SELECTOR = [
    "section > .container > *",
    "section > .container-medium > *",
].join(", ")

const STAGGER_MS = 90
const MAX_STAGGER = 4

function setup() {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduced || !("IntersectionObserver" in window)) return

    const nodes = Array.from(document.querySelectorAll(SELECTOR)).filter((el) => {
        // Skip anything already on screen at load — revealing it would flash.
        if (el.dataset.reveal) return false
        return true
    })
    if (!nodes.length) return

    nodes.forEach((el) => {
        el.dataset.reveal = ""
    })

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return
                const el = entry.target

                // Stagger against the element's position among its siblings.
                const siblings = Array.from(el.parentElement.children)
                const index = Math.min(siblings.indexOf(el), MAX_STAGGER)
                el.style.transitionDelay = `${index * STAGGER_MS}ms`

                el.setAttribute("data-reveal", "in")
                observer.unobserve(el)
            })
        },
        { rootMargin: "0px 0px -8% 0px", threshold: 0.06 }
    )

    nodes.forEach((el) => observer.observe(el))

    // Anything already in view when the page loads should not animate in.
    requestAnimationFrame(() => {
        nodes.forEach((el) => {
            const r = el.getBoundingClientRect()
            if (r.top < window.innerHeight * 0.9) {
                el.style.transitionDelay = "0ms"
                el.setAttribute("data-reveal", "in")
                observer.unobserve(el)
            }
        })
    })
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup)
} else {
    setup()
}
