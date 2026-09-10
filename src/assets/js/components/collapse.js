/*
File: Collapsibles
Turns marked blocks into accordions below the desktop breakpoint and leaves
them fully open above it. The open/closed state is a single class - the
animation itself is CSS (grid-template-rows), so nothing here measures
heights or fights a resize.
*/

const MOBILE = "(max-width: 1023px)"

// The toggle is normally a direct child, but a section that must keep its
// heading wraps the button in the <h2>. Two explicit levels, never deeper -
// a nested .cl-item's toggle sits further down and must not be caught here.
const TOGGLE = ":scope > .cl-toggle, :scope > h2 > .cl-toggle, :scope > h3 > .cl-toggle"

function setup() {
    // grouped accordions, plus standalone sections that fold on their own
    const items = Array.from(document.querySelectorAll("[data-collapse] .cl-item, .cl-item[data-collapse-solo]"))
    if (!items.length) return

    const mq = window.matchMedia(MOBILE)

    const apply = () => {
        items.forEach((item) => {
            const toggle = item.querySelector(TOGGLE)
            const panel = item.querySelector(":scope > .cl-panel")
            if (!toggle || !panel) return

            if (mq.matches) {
                toggle.setAttribute("aria-expanded", item.classList.contains("is-open") ? "true" : "false")
                if (!panel.id) panel.id = "cl-" + Math.random().toString(36).slice(2, 9)
                toggle.setAttribute("aria-controls", panel.id)
            } else {
                // desktop shows everything, so the control must not read as a control
                item.classList.remove("is-open")
                toggle.removeAttribute("aria-expanded")
            }
        })
    }

    items.forEach((item) => {
        const toggle = item.querySelector(TOGGLE)
        if (!toggle) return
        toggle.addEventListener("click", () => {
            if (!mq.matches) return
            const open = item.classList.toggle("is-open")
            toggle.setAttribute("aria-expanded", open ? "true" : "false")
        })
    })

    // Open the first row so a group never reads as empty - except where the
    // markup asks for everything shut, which is what the treatment lists want.
    document.querySelectorAll("[data-collapse]").forEach((group) => {
        if (group.getAttribute("data-collapse") === "closed") return
        const first = group.querySelector(".cl-item")
        if (first) first.classList.add("is-open")
    })

    // A standalone section is not a list of choices, it is one section that
    // happens to fold. Starting it shut made its content read as missing
    // rather than collapsed - the Benefits list on a phone showed a heading
    // and nothing else. It opens, and the toggle is there to shut it.
    document.querySelectorAll(".cl-item[data-collapse-solo]").forEach((item) => {
        item.classList.add("is-open")
    })

    apply()
    mq.addEventListener("change", apply)
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup)
} else {
    setup()
}
