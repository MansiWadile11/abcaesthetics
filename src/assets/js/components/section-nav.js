/*
File: Section Nav
The navbar and footer are one-pager style: their links point at sections on the
home page (index.html#service, …). Two jobs here:

  1. When the target section is on the page you're already looking at, rewrite
     the href to a bare hash so the browser does a smooth in-page scroll instead
     of re-navigating (which it would do when the URL is "/" rather than
     "/index.html").
  2. Highlight the nav link whose section is currently in view.
*/

const inPageLinks = () =>
    Array.from(document.querySelectorAll('a[href*="#"]')).filter((a) => {
        const href = a.getAttribute("href") || ""
        const hash = href.slice(href.indexOf("#"))
        return hash.length > 1 && document.querySelector(hash)
    })

function localiseLinks() {
    inPageLinks().forEach((a) => {
        const href = a.getAttribute("href")
        a.setAttribute("href", href.slice(href.indexOf("#")))
    })
}

function setupScrollSpy() {
    const items = Array.from(document.querySelectorAll("#navbar a[href^='#']"))
        // Skip the logo: it also points at #home and would shadow the Home link.
        .filter((a) => a.textContent.trim())
        .map((a) => ({ a, el: document.querySelector(a.getAttribute("href")) }))
        .filter((i) => i.el)
    if (!items.length) return

    // Document order, so "the last target above the trigger line" is meaningful.
    items.sort((x, y) => x.el.getBoundingClientRect().top + window.scrollY - (y.el.getBoundingClientRect().top + window.scrollY))

    let current = null
    const update = () => {
        const line = window.innerHeight * 0.3
        let active = items[0]
        items.forEach((i) => {
            if (i.el.getBoundingClientRect().top <= line) active = i
        })
        // At the very bottom nothing further can cross the line, so pin the last
        // target — otherwise footer anchors could never become active.
        const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4
        if (atBottom) active = items[items.length - 1]

        if (active.a === current) return
        if (current) current.classList.remove("active")
        active.a.classList.add("active")
        current = active.a
    }

    let ticking = false
    const onScroll = () => {
        if (ticking) return
        ticking = true
        requestAnimationFrame(() => {
            update()
            ticking = false
        })
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    update()
}

document.addEventListener("DOMContentLoaded", () => {
    localiseLinks()
    setupScrollSpy()
})
