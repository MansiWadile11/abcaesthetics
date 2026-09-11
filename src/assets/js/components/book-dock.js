/*
File: Booking dock

Shows the docked Book Appointment button on a phone once the hero's own
button has scrolled away, and hides it again over any section that already
offers the same action - the appointment form, the closing CTA bar, a service
page's own CTA block, and the footer. Two buttons for the same thing on one
screen is worse than none.

Everything here is a class toggle; the movement is CSS. The breakpoint is CSS
too - the dock is display:none above 767 - so this can run at any width
without having to watch for a resize.
*/

const COVERS = [
    "#appointment",          // the home page booking form
    "form[data-form]",       // the contact and appointment pages are the form
    ".sd2-cta",              // a service page's closing consultation block
    ".reference-cta-wrap",   // the CTA bar above the footer
    ".ty-card",              // the thank-you page: they have just booked
    "footer.reference-footer",
].join(", ")

// Roughly the point where the hero's own button has gone. Measured against
// the viewport rather than a fixed pixel count, so a short phone and a tall
// one both get it at the same moment in the scroll.
const SHOW_AFTER = 0.55

function setup() {
    const dock = document.querySelector("[data-book-dock]")
    if (!dock) return

    const covers = Array.from(document.querySelectorAll(COVERS))
    let queued = false

    const apply = () => {
        queued = false
        const scrolled = window.scrollY > window.innerHeight * SHOW_AFTER
        const covered = covers.some((el) => {
            const r = el.getBoundingClientRect()
            return r.top < window.innerHeight && r.bottom > 0
        })
        const up = scrolled && !covered
        dock.classList.toggle("is-up", up)
        document.documentElement.classList.toggle("dock-up", up)
    }

    const onScroll = () => {
        if (queued) return
        queued = true
        requestAnimationFrame(apply)
    }

    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    apply()
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup)
} else {
    setup()
}
