/*
Template Name: Dermato - Coworking Space Website Tailwind CSS 4 Template
Version: 1.0.0
Author: Unifato
Website: https://unifato.com/
Email: unifato.themes@gmail.com
File: App js
*/

// CSS is loaded by a render-blocking <link> in the head partial, not from
// here - importing it via JS delayed styling until the module executed and
// caused a flash of unstyled content on every page load.

// Preline Plugin File Import
import "preline";

import './components/gallary';
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