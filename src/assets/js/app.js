/*
ABC Aesthetics Medspa
Medical aesthetics and wellness - Lake Oswego, Oregon
https://abcaestheticsllc.com

File: App js - imports every behaviour module, then the two bits of
navigation state that are small enough not to earn a file of their own.
*/

// CSS is loaded by a render-blocking <link> in the head partial, not from
// here - importing it via JS delayed styling until the module executed and
// caused a flash of unstyled content on every page load.

// The FAQ accordion is ours now - see components/accordion.js. It replaces
// Preline's HSAccordion, which was the only plugin of the 24 this site ever
// used and which dragged 21 packages (~19 MB) into every install, apexcharts
// and jQuery among them, none of which reached the bundle. The markup and
// class names are unchanged; the Tailwind variant moved to css/_accordion.css.
//
// Nothing now sets window.HSAccordion or window.$hsAccordionCollection, and
// adding markup for any other Preline component would mean writing that
// component rather than importing it.
import './components/accordion';

import './components/animation';
import './components/swiper';
import './components/services-accordion';
import './components/reveal';
import './components/collapse';
import './components/section-nav';
import './components/nav';
import './components/floating';
import './components/count';
import './components/gallery';
import './components/forms';
import './components/faq-fit';
import './components/book-dock';

var stickyNav = document.querySelector(".nav-sticky")

if (stickyNav) {
    window.addEventListener("scroll", function () {
        var scTop = window.pageYOffset || document.documentElement.scrollTop

        if (scTop >= 100) {
            stickyNav.classList.add("nav-sticky-on")
        } else {
            stickyNav.classList.remove("nav-sticky-on")
        }
    })
}

// (The navbar scroll-shadow listener was removed: the navbar now sits in the
// document flow and scrolls away, so there is no scrolled state to style.)


document.addEventListener("DOMContentLoaded", () => {
    const currentPath = window.location.pathname.replace(/\/$/, "")

    document.querySelectorAll("#navbar a[href]").forEach((link) => {
        const href = link.getAttribute("href")?.replace(/\/$/, "")
        if (!href || href.includes("#")) return // anchors are handled by the scroll-spy

        if (currentPath === href || currentPath.endsWith(href)) {
            link.classList.add("active")
        }
    })
})


document.addEventListener("DOMContentLoaded", () => {
    const currentPath = window.location.pathname.replace(/\/$/, "")

    document.querySelectorAll("#offcanvasSidebar ul a[href]").forEach((link) => {
        const href = link.getAttribute("href")?.replace(/\/$/, "")
        if (!href) return

        if (currentPath === href || currentPath.endsWith(href)) {
            link.classList.add("active")
        }
    })
})