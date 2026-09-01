/*
File: FAQ Accordion
Preline already gives one-at-a-time opening inside an .hs-accordion-group, but
it also lets you collapse the open item by clicking it again — which leaves the
list with nothing expanded. The reference design always keeps exactly one panel
open, so swallow the click when the target is already the open one.
*/

document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-faq-accordion]").forEach((group) => {
        group.addEventListener(
            "click",
            (e) => {
                const toggle = e.target.closest(".hs-accordion-toggle")
                if (!toggle || !group.contains(toggle)) return

                const item = toggle.closest(".hs-accordion")
                if (item && item.classList.contains("active")) {
                    // Already open — keep it open instead of letting Preline collapse it.
                    e.preventDefault()
                    e.stopPropagation()
                }
            },
            true, // capture, so this runs before Preline's own handler
        )
    })
})
