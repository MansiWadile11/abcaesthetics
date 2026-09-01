/*
File: Floating actions + sticky navbar state
The back-to-top button only earns its place once the page has scrolled, and the
navbar only needs its shadow once content is passing underneath it. Both are
driven off one scroll listener, and the work is a class toggle.
*/

const SHOW_AFTER = 400

function setup() {
    const top = document.getElementById("back-to-top")
    const shell = document.querySelector(".reference-nav-shell")
    if (!top && !shell) return

    let ticking = false

    const apply = () => {
        const y = window.scrollY || document.documentElement.scrollTop
        if (top) top.classList.toggle("is-visible", y > SHOW_AFTER)
        if (shell) shell.classList.toggle("is-stuck", y > 10)
        ticking = false
    }

    window.addEventListener("scroll", () => {
        if (ticking) return
        ticking = true
        requestAnimationFrame(apply)
    }, { passive: true })

    if (top) {
        top.addEventListener("click", () => {
            const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
            window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" })
        })
    }

    apply()
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup)
} else {
    setup()
}
