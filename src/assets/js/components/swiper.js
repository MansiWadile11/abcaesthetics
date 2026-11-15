/**
* Swiper Slider
* Enables the two carousels that have markup: testimonials and the
* before/after comparison on the service pages.
*
* Modular, not swiper/bundle. The bundle is 150 KB of the build and ships
* every module - zoom, pagination, scrollbar, virtual, thumbs, every effect -
* for two carousels that need three. The stylesheet import in
* assets/css/style.css is split the same way.
*
* A11y is NOT optional here. It injects the .swiper-notification live region
* and the role/aria-label on each slide and aria-live on each wrapper that
* the bundle gave us for free; dropping it silently removes the carousels'
* screen-reader support. swiper/css/a11y is what keeps that notification
* visually hidden.
*
* Any carousel added later must list its own modules in `modules`, or its
* navigation and autoplay will quietly do nothing.
*
* AUTOPLAY NEEDS A STOP BUTTON. Both carousels move on their own for longer
* than five seconds, which WCAG 2.2.2 (Pause, Stop, Hide) requires the visitor
* to be able to stop. addAutoplayToggle below builds that control into the
* prev/next cluster each carousel already has, so no page markup changes and
* the control sits exactly where the other carousel controls are. It is a real
* <button>, so it is keyboard reachable in document order with no tabindex.
*
* Reduced motion wins over autoplay: a visitor who asks for less movement gets
* a carousel that is parked on load, with the button offering to start it. The
* media query is watched, not just read, so changing the OS setting takes
* effect without a reload - the same pattern as count.js and reveal.js.
*/

import Swiper from 'swiper';
import { Navigation, Autoplay, A11y } from 'swiper/modules';

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")

/* Inline SVG rather than an `iconify` class: these icons are referenced only
   from this module, and the icon CSS is generated from markup, so a class
   named here alone would resolve to nothing. */
const ICON_PAUSE = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true" focusable="false"><rect x="6" y="5" width="4" height="14" rx="1"></rect><rect x="14" y="5" width="4" height="14" rx="1"></rect></svg>'
const ICON_PLAY = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true" focusable="false"><path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.3-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14z"></path></svg>'

/**
 * Add a pause/resume button to each navigation cluster belonging to `swiper`.
 *
 * `noun` goes into the accessible name, so the testimonial control says
 * "reviews" and the results control says "results" rather than both saying
 * "slides". `gate` is an optional media query: while it does not match, the
 * carousel stays parked because its controls are not on screen at that width.
 */
function addAutoplayToggle(swiper, { arrowSelector, toggleClass, noun, gate }) {
    // The clusters are the arrows' parents - one per width on the home page,
    // two per service page now that the mobile cluster exists. Deduplicated,
    // because prev and next share a parent.
    const clusters = [...new Set([...document.querySelectorAll(arrowSelector)]
        .map((a) => a.parentElement).filter(Boolean))]
    if (!clusters.length || !swiper || !swiper.autoplay) return

    // The visitor's own choice, once they make one. Null means "not yet asked".
    let wanted = null
    const allowed = () => !reducedMotion.matches && (!gate || gate.matches)
    const shouldRun = () => (wanted === null ? allowed() : wanted && allowed())

    const buttons = clusters.map((cluster) => {
        const b = document.createElement("button")
        b.type = "button"
        b.className = toggleClass + " swiper-autoplay-toggle reference-testimonial-nav"
        cluster.appendChild(b)
        b.addEventListener("click", () => {
            wanted = !(swiper.autoplay.running && !swiper.autoplay.paused)
            apply()
        })
        return b
    })

    function apply() {
        const run = shouldRun()
        try { run ? swiper.autoplay.start() : swiper.autoplay.stop() } catch (e) { /* carousel gone */ }
        for (const b of buttons) {
            b.innerHTML = run ? ICON_PAUSE : ICON_PLAY
            const label = (run ? "Pause" : "Play") + " " + noun + " slideshow"
            b.setAttribute("aria-label", label)
            b.setAttribute("title", label)
        }
    }

    // Honour a change of OS preference, and of width when a gate is in play.
    const onChange = () => apply()
    reducedMotion.addEventListener ? reducedMotion.addEventListener("change", onChange) : reducedMotion.addListener(onChange)
    if (gate) gate.addEventListener ? gate.addEventListener("change", onChange) : gate.addListener(onChange)

    apply()
}

// Testimonial Slider
const testimonialSwiper = new Swiper(".testimonialSwiper", {
    modules: [Navigation, Autoplay, A11y],
    slidesPerView: 1,
    spaceBetween: 20,
    loop: true,
    speed: 600,
    navigation: {
        nextEl: ".testimonial-next",
        prevEl: ".testimonial-prev",
    },
    // The A11y module relabels whichever prev/next pair it binds with its
    // own generic defaults, discarding the aria-label in the markup. These
    // restore the authored wording so every arrow on all ten routes that
    // carry reviews announces the same thing at every width.
    a11y: {
        prevSlideMessage: "Previous review",
        nextSlideMessage: "Next review",
    },
    autoplay: {
        delay: 4000,
        disableOnInteraction: false,
        // Stop while the pointer rests on the reviews, so hovering to read one
        // does not have it slide away mid-sentence.
        pauseOnMouseEnter: true,
    },
    breakpoints: {
        320: {
            slidesPerView: 1,
            spaceBetween: 16,
        },
        375: {
            slidesPerView: 1.2,
            spaceBetween: 16,
        },
        576: {
            slidesPerView: 1.2,
            spaceBetween: 20,
        },
        768: {
            slidesPerView: 1.2,
            spaceBetween: 20,
        },
        1024: {
            slidesPerView: 2,
            spaceBetween: 20,
        },
    },
});

// Support multiple navigation buttons
document.querySelectorAll(".testimonial-next").forEach(button => {
    button.addEventListener("click", () => {
        testimonialSwiper.slideNext();
    });
});
document.querySelectorAll(".testimonial-prev").forEach(button => {
    button.addEventListener("click", () => {
        testimonialSwiper.slidePrev();
    });
});

/* Every cluster that holds a testimonial arrow gets a stop button, so the
   control is present at both widths on the home page and on all nine service
   pages, desktop cluster and mobile cluster alike. */
addAutoplayToggle(testimonialSwiper, {
    arrowSelector: ".testimonial-prev, .testimonial-next",
    toggleClass: "reviews-autoplay",
    noun: "reviews",
})

// Results carousel (service pages).
// Autoplay figures are taken from the reference's own Swiper config: it steps
// one slide every 3s over 300ms and keeps going after you interact with it.
const compareSwiper = new Swiper(".compareSwiper", {
    modules: [Navigation, Autoplay, A11y],
    slidesPerView: 1.15,
    spaceBetween: 20,
    // NOT loop. Swiper refuses to build the duplicate slides that loop needs
    // when the slide count is too small for slidesPerView - these pages carry
    // three or four - so loop:true silently produced a carousel that would
    // not advance at all, by autoplay or by the arrows. rewind runs to the
    // last slide and returns to the first, and works at any slide count.
    rewind: true,
    // Quicker than the reference's 3000/300: the slide rests for less time
    // and the glide itself is a touch longer, so it reads as moving rather
    // than snapping between stops.
    speed: 450,
    grabCursor: true,
    autoplay: {
        delay: 1800,
        disableOnInteraction: false,
        pauseOnMouseEnter: true,
    },
    navigation: {
        nextEl: ".compare-next",
        prevEl: ".compare-prev",
    },
    a11y: {
        prevSlideMessage: "Previous result",
        nextSlideMessage: "Next result",
    },
    breakpoints: {
        640: { slidesPerView: 1.8, spaceBetween: 20 },
        // fractional so a part-slide peeks in and signals there is more
        1024: { slidesPerView: 2.4, spaceBetween: 24 },
    },
});

/* This carousel's cluster is `hidden sm:flex`, so below 640px there is nothing
   on screen to stop it with. The gate parks it at those widths instead of
   letting it move with no reachable control; swiping still works. */
addAutoplayToggle(compareSwiper, {
    arrowSelector: ".compare-prev, .compare-next",
    toggleClass: "results-autoplay",
    noun: "results",
    gate: window.matchMedia("(min-width: 640px)"),
})
