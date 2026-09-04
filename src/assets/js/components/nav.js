/*
File: Navigation
Two jobs, both driven off the current URL:

  1. The mobile Treatments group is a collapsible. Nine links sat permanently
     open inside a 70vh sheet, which pushed Contact below the fold.
  2. Whichever treatment page you are on is marked in both menus, so the
     dropdown answers "where am I" instead of only "where can I go".

The panel animates on grid-template-rows, same as the page collapsibles, so
no height is ever measured here.
*/

function pageName(href) {
    if (!href) return ""
    // strip any origin, query, hash and trailing slash, then keep the file name
    const path = href.split("#")[0].split("?")[0].replace(/\/$/, "")
    const last = path.split("/").pop()
    return last || "index.html"
}

function setup() {
    const current = pageName(window.location.pathname) || "index.html"

    // --- 2. mark the current page in both menus -------------------------
    document.querySelectorAll(".nav-dd-link, .nav-sub a").forEach((link) => {
        const target = pageName(link.getAttribute("href"))
        const exact = target === current
        // an article has no menu entry of its own, so it marks the Blog one -
        // otherwise the whole trail reads as "nowhere" while you are reading
        const inSection = target === "blog.html" && current.indexOf("blog-") === 0
        if (!exact && !inSection) return

        link.classList.add("is-active")
        // only the page itself is aria-current="page"; an article is merely
        // inside that section
        if (exact) link.setAttribute("aria-current", "page")

        // the parent item too, so the trail is visible before the menu is
        // opened - but only this link's own dropdown. There are two now, and
        // marking every .nav-dd would light up Treatments on a blog page.
        const dd = link.closest(".nav-dd")
        const parent = dd && dd.querySelector(":scope > .reference-nav-link")
        if (parent) parent.classList.add("is-current")
    })

    document.querySelectorAll("nav .reference-nav-link").forEach((link) => {
        const href = link.getAttribute("href")
        if (!href || link.closest(".nav-dd")) return
        // index.html#home should only light up on the home page itself
        if (pageName(href) === current) link.classList.add("is-current")
    })

    // --- 0. the drawer itself -------------------------------------------
    const drawer = document.getElementById("mobile-menu")
    const burger = document.querySelector("[data-menu-toggle]")

    if (drawer && burger) {
        const close = () => {
            drawer.classList.remove("is-open")
            burger.setAttribute("aria-expanded", "false")
            // wait for the fade before removing it from the flow
            setTimeout(() => {
                if (!drawer.classList.contains("is-open")) drawer.classList.remove("is-mounted")
            }, 300)
        }

        burger.addEventListener("click", () => {
            if (drawer.classList.contains("is-open")) return close()
            drawer.classList.add("is-mounted")
            // mount first, animate on the next frame, or there is nothing to
            // transition from
            requestAnimationFrame(() => {
                drawer.classList.add("is-open")
                burger.setAttribute("aria-expanded", "true")
            })
        })

        // a tap outside, Escape, or following a link all dismiss it
        document.addEventListener("click", (e) => {
            if (!drawer.classList.contains("is-open")) return
            if (drawer.contains(e.target) || burger.contains(e.target)) return
            close()
        })
        document.addEventListener("keydown", (e) => { if (e.key === "Escape") close() })
        drawer.querySelectorAll("a[href]").forEach((a) => a.addEventListener("click", close))
    }

    // --- desktop dropdowns ----------------------------------------------
    // The parent was a plain link, so clicking "About" or "Treatments" left
    // the page instead of opening the menu. Click now toggles; the links
    // inside still navigate, and keyboard users still get focus-within.
    document.querySelectorAll(".nav-dd").forEach((dd) => {
        const parent = dd.querySelector(":scope > .reference-nav-link")
        if (!parent) return

        parent.setAttribute("aria-expanded", "false")

        parent.addEventListener("click", (e) => {
            if (!window.matchMedia("(min-width: 768px)").matches) return
            e.preventDefault()
            const open = dd.classList.toggle("is-open")
            parent.setAttribute("aria-expanded", open ? "true" : "false")
            document.querySelectorAll(".nav-dd").forEach((other) => {
                if (other !== dd) other.classList.remove("is-open")
            })
        })
    })

    document.addEventListener("click", (e) => {
        if (e.target.closest(".nav-dd")) return
        document.querySelectorAll(".nav-dd.is-open").forEach((dd) => {
            dd.classList.remove("is-open")
            const parent = dd.querySelector(":scope > .reference-nav-link")
            if (parent) parent.setAttribute("aria-expanded", "false")
        })
    })

    // --- 1. mobile collapsible ------------------------------------------
    document.querySelectorAll(".nav-group").forEach((group) => {
        const toggle = group.querySelector(":scope > .nav-group-toggle")
        const panel = group.querySelector(":scope > .nav-sub")
        if (!toggle || !panel) return

        // open on arrival if this group holds the current page, so the menu
        // shows you where you are rather than hiding it behind a tap
        if (panel.querySelector("a.is-active")) group.classList.add("is-open")
        toggle.setAttribute("aria-expanded", group.classList.contains("is-open") ? "true" : "false")

        toggle.addEventListener("click", () => {
            const open = group.classList.toggle("is-open")
            toggle.setAttribute("aria-expanded", open ? "true" : "false")
        })
    })
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup)
} else {
    setup()
}
