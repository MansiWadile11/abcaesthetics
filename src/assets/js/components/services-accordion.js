/*
File: Services Accordion
Nine service panels sit in one row. Exactly one is expanded; the rest collapse
to vertical spines. Clicking a spine expands it and squeezes the open one back
down. The widths live in a --svc-cols custom property on the grid so the
transition is a single interpolation of grid-template-columns.
*/

import { fitAfterOpen } from "./fit-open"

// 5.8 was tuned for five panels; with nine, eight spines take enough of
// the row that the open panel fell below the width its content needs.
const OPEN_FR = 11

function setupAccordion(grid) {
    const panels = Array.from(grid.querySelectorAll(".svc-panel"))
    if (!panels.length) return

    const columnsFor = (openIndex) =>
        panels.map((_, i) => (i === openIndex ? `${OPEN_FR}fr` : "1fr")).join(" ")

    const open = (index, fit) => {
        panels.forEach((panel, i) => {
            const isOpen = i === index
            panel.classList.toggle("is-open", isOpen)

            const trigger = panel.querySelector(".svc-trigger")
            if (trigger) {
                trigger.setAttribute("aria-expanded", String(isOpen))
                // A collapsed spine is the control; the open panel isn't reachable
                // by keyboard since activating it would be a no-op.
                trigger.tabIndex = isOpen ? -1 : 0
            }
        })
        grid.style.setProperty("--svc-cols", columnsFor(index))

        // Stacked below 1280, opening one panel collapses the one above it,
        // so the page shifts up under the tap and the panel just opened can
        // land off the top of the screen.
        if (fit) fitAfterOpen(panels[index], panels[index])
    }

    panels.forEach((panel, i) => {
        const trigger = panel.querySelector(".svc-trigger")
        if (!trigger) return

        trigger.addEventListener("click", () => open(i, true))

        trigger.addEventListener("keydown", (e) => {
            let next = null
            if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (i + 1) % panels.length
            else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (i - 1 + panels.length) % panels.length
            else if (e.key === "Home") next = 0
            else if (e.key === "End") next = panels.length - 1
            if (next === null) return

            e.preventDefault()
            open(next, true)
            // Focus follows selection, but the newly open panel's trigger is
            // untabbable — move focus to the spine that took its place.
            const target = panels[next === 0 ? 1 : 0].querySelector(".svc-trigger")
            if (target) target.focus()
        })
    })

    // Sync state to whichever panel is marked open in the markup.
    const initial = panels.findIndex((p) => p.classList.contains("is-open"))
    open(initial === -1 ? 0 : initial)
}

document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-services-accordion]").forEach(setupAccordion)
})
