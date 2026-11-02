/*
File: Accordion

The FAQ accordion, reimplemented. It replaces Preline's HSAccordion plugin,
which was the only part of Preline the site used - and which cost 21 installed
packages and ~19 MB, because preline declares apexcharts, jQuery, datatables,
dropzone, nouislider, vanilla-calendar-pro and floating-ui as hard
dependencies. None of them ever reached the bundle; they were only ever an
install cost, and this file is what removes it.

THE MARKUP IS UNCHANGED. Every class Preline looked for is still the contract
here, so the 59 accordions across 11 pages keep their existing HTML:

    .hs-accordion-group[data-hs-accordion-always-open]   many may be open
    .hs-accordion-group                                  only one may be open
      .hs-accordion(.active)                             one row; .active = open
        button.hs-accordion-toggle                       the control
        .hs-accordion-content(.hidden)                   the panel

Two things depend on that contract from outside this file and must keep
working: the `hs-accordion-active:` Tailwind variant (76 usages, chiefly the
chevron's rotate-135), whose definition now lives in css/_accordion.css; and
faq-fit.js, which reads `.active` on the item one frame after a click to
decide whether to scroll the opened row into view. That is why `.active` is
added synchronously here, before any animation starts.

Delegation rather than a listener per toggle: Preline attached one listener
per instance on window load, so a click before load did nothing. One
document-level listener is cheaper, needs no init pass, and works from first
paint. The only init work is seeding aria-expanded.

aria-expanded is new. The markup never carried it, so Preline's
`if (toggle.ariaExpanded)` guard never fired and the state was invisible to
screen readers. Setting it costs nothing and changes no pixel.
*/

const ITEM = ".hs-accordion"
const GROUP = ".hs-accordion-group"
const TOGGLE = ".hs-accordion-toggle"
const CONTENT = ".hs-accordion-content"

// Wait for the panel's own height transition, or run straight away when there
// is none - a zero-duration transition never fires transitionend, and under
// prefers-reduced-motion there may be no transition at all. The target check
// matters because the listener is on the panel: without it a transition on
// anything inside the panel would end the animation early.
function afterTransition(el, done) {
    const cs = window.getComputedStyle(el)
    const runs = cs.transitionProperty !== "none" && parseFloat(cs.transitionDuration) > 0

    if (!runs) {
        done()
        return
    }

    const handler = (e) => {
        if (e.target !== el) return
        el.removeEventListener("transitionend", handler)
        done()
    }
    el.addEventListener("transitionend", handler)
}

function open(item, toggle, content) {
    if (item.classList.contains("active")) return

    // Synchronous, so faq-fit.js sees the state on the next frame.
    item.classList.add("active")
    if (toggle) toggle.setAttribute("aria-expanded", "true")

    // The panel is display:none while closed, so it has to be laid out before
    // its full height can be measured. Height goes 0 -> scrollHeight to give
    // the CSS transition something to animate between, and is handed back to
    // the stylesheet once it arrives so the panel can resize with its content.
    content.style.display = "block"
    content.style.height = "0"
    void content.offsetHeight                      // force the 0 to take effect
    content.style.height = content.scrollHeight + "px"

    afterTransition(content, () => {
        content.style.display = "block"
        content.style.height = ""
    })
}

function close(item, toggle, content) {
    if (!item.classList.contains("active")) return

    item.classList.remove("active")
    if (toggle) toggle.setAttribute("aria-expanded", "false")

    // The reverse: pin the measured height, then animate it to zero. The
    // panel is only hidden once the animation has finished, otherwise it
    // would vanish instead of collapsing.
    content.style.height = content.scrollHeight + "px"
    void content.offsetHeight
    content.style.height = "0"

    afterTransition(content, () => {
        content.style.display = "none"
        content.style.height = ""
    })
}

function parts(item) {
    return {
        toggle: item.querySelector(TOGGLE),
        content: item.querySelector(CONTENT),
    }
}

document.addEventListener("click", (e) => {
    const toggle = e.target.closest(TOGGLE)
    if (!toggle) return

    const item = toggle.closest(ITEM)
    if (!item) return

    const content = item.querySelector(CONTENT)
    if (!content) return

    if (item.classList.contains("active")) {
        close(item, toggle, content)
        return
    }

    // In a plain group only one row may be open, so whichever is open closes
    // first. A group marked data-hs-accordion-always-open skips that and lets
    // them stack - nine of the eleven pages rely on it.
    const group = item.closest(GROUP)
    if (group && !group.hasAttribute("data-hs-accordion-always-open")) {
        const openItem = group.querySelector(":scope > " + ITEM + ".active")
        if (openItem && openItem !== item) {
            const p = parts(openItem)
            if (p.content) close(openItem, p.toggle, p.content)
        }
    }

    open(item, toggle, content)
})

// Seed aria-expanded from the markup's own starting state. Runs immediately
// when the module executes and the DOM is already parsed - app.js is a
// deferred module, so it is - and falls back to DOMContentLoaded otherwise.
function seed() {
    document.querySelectorAll(ITEM).forEach((item) => {
        const { toggle, content } = parts(item)
        if (!toggle || !content) return
        toggle.setAttribute("aria-expanded", item.classList.contains("active") ? "true" : "false")
    })
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", seed)
else seed()
