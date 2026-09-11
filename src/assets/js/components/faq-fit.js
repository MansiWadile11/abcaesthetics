/*
File: FAQ fit

The FAQ list is Preline's accordion, so there is no open() of ours to hang
this on - the class arrives on the item after Preline handles the click. One
delegated listener reads the state on the next frame and, if that click opened
a row, asks for the same fit every other collapsible on the site gets.
*/

import { fitAfterOpen } from "./fit-open"

document.addEventListener("click", (e) => {
    const toggle = e.target.closest(".hs-accordion-toggle")
    if (!toggle) return

    const item = toggle.closest(".hs-accordion")
    if (!item) return

    requestAnimationFrame(() => {
        if (!item.classList.contains("active")) return
        fitAfterOpen(item, item.querySelector(".hs-accordion-content"))
    })
})
