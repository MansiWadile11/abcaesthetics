/*
File: Count-up
Numbers marked with data-count animate to their value the first time they
scroll into view, once. Years count from a recent-feeling floor rather than
from zero, so 2016 does not spin through two millennia.
*/

const DURATION = 1100

function run(el) {
    const target = Number(el.dataset.count)
    if (!Number.isFinite(target)) return

    // a year reads better counting over the last decade or so than from 0
    const from = target > 1900 ? target - 12 : 0
    const start = performance.now()

    const tick = (now) => {
        const t = Math.min((now - start) / DURATION, 1)
        // ease-out, so it settles rather than stopping dead
        const eased = 1 - Math.pow(1 - t, 3)
        el.textContent = String(Math.round(from + (target - from) * eased))
        if (t < 1) requestAnimationFrame(tick)
        else el.textContent = String(target)
    }

    requestAnimationFrame(tick)
}

function setup() {
    const nodes = Array.from(document.querySelectorAll("[data-count]"))
    if (!nodes.length) return

    // reduced motion, or no observer: leave the final value in place
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
        !("IntersectionObserver" in window)) return

    const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return
            io.unobserve(entry.target)
            run(entry.target)
        })
    }, { threshold: 0.4 })

    nodes.forEach((n) => io.observe(n))
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup)
} else {
    setup()
}
