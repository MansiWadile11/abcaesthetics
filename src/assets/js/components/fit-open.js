/*
File: Fit an opened panel into the viewport

Opening a row halfway down the screen used to leave its answer below the fold,
so the page looked like it had done nothing until you scrolled. Every
collapsible on the site - the treatment lists, the step cards, the standalone
sections, the FAQ - reports here once it has finished expanding, and the page
moves the minimum distance needed to bring the opened row into view.

Minimum distance is the point: jumping every opened row to the top of the
screen is just as disorienting as leaving it off the bottom. If the row is
already fully visible, nothing moves at all.
*/

const MARGIN = 12

// Anything that opens must clear the sticky pill, whose height changes with
// the viewport - measured rather than assumed.
function headerOffset() {
    const shell = document.querySelector(".reference-nav-shell")
    if (!shell) return MARGIN
    const pill = shell.querySelector("#navbar")
    const h = (pill || shell).getBoundingClientRect().height
    return Math.round(h) + MARGIN * 2
}

export function fitIntoView(el) {
    if (!el) return

    const top = headerOffset()
    const bottom = window.innerHeight - MARGIN
    const r = el.getBoundingClientRect()
    let delta = 0

    if (r.top < top) {
        // the row's own heading is under the header
        delta = r.top - top
    } else if (r.bottom > bottom) {
        // Taller than the space it has: put its top under the header and let
        // the rest run off the bottom, rather than scrolling past the heading
        // to chase the end of the answer.
        delta = r.height > bottom - top ? r.top - top : r.bottom - bottom
    }

    if (Math.abs(delta) < 2) return

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    window.scrollBy({ top: delta, behavior: reduced ? "auto" : "smooth" })
}

/*
Run after the panel has actually grown. The CSS animates
grid-template-rows / height, so transitionend on the panel is the honest
signal; the timeout is the fallback for panels that open with no transition
(reduced motion, or a browser that skips a zero-delta transition).
*/
export function fitAfterOpen(item, panel) {
    let done = false
    const go = () => {
        if (done) return
        done = true
        fitIntoView(item)
    }
    if (panel) panel.addEventListener("transitionend", go, { once: true })
    setTimeout(go, 420)
}
