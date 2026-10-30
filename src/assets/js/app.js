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

// Preline, accordion only.
//
// The whole library is 275 KB of the bundle and the site uses exactly one of
// its 24 plugins: the FAQ accordion (hs-accordion*, on 11 pages). Preline
// declares no "sideEffects" field, so importing the package entry pulls every
// plugin in - and with them vanilla-calendar-pro and @floating-ui, which only
// the datepicker and dropdown need. Importing the one plugin directly drops
// all of it. The plugin self-initialises on window load and sets
// window.HSAccordion itself, so there is nothing to call here.
//
// Two consequences, deliberate: this is a deep path into Preline's source,
// which resolves because 4.0.1 ships no "exports" map - hence the exact
// version pin in package.json, and a build-time error rather than a silent
// failure if that ever changes. And window.HSOverlay / HSSelect /
// HSStaticMethods no longer exist, so adding markup for any OTHER Preline
// component means importing its plugin here too.
import "preline/src/plugins/accordion";

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