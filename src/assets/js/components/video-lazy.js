/*
File: Lazy background video

Decorative card videos carry a src in `data-src` rather than `src`, so the
browser has nothing to fetch until this attaches it. `preload="none"` alone
would not have done it: a <video> with `autoplay` must load in order to
autoplay, so the attribute was ignored and the file downloaded on every visit.

Two rules:

  - below MIN_WIDTH the src is never attached, so phones transfer none of it.
    The card keeps its poster, which is a frame of the same clip;
  - at or above MIN_WIDTH the src is attached as the card nears the viewport,
    then played. The card sits well below the fold, so by the time anyone sees
    it the video is playing and the result is what `autoplay` gave before.

Degrades to "attach immediately" where IntersectionObserver is missing, and
stays on the poster for a visitor who prefers reduced motion.
*/

const MIN_WIDTH = 768
const ROOT_MARGIN = "200px 0px"

function attach(video) {
    const src = video.dataset.src
    if (!src || video.src) return
    video.src = src
    // play() rejects if the tab is backgrounded or autoplay is refused. The
    // poster stays up in that case, which is the same thing the viewer saw a
    // moment earlier, so there is nothing to handle.
    const played = video.play()
    if (played && typeof played.catch === "function") played.catch(() => {})
}

function setup() {
    const videos = Array.from(document.querySelectorAll("[data-lazy-video]"))
    if (!videos.length) return

    const narrow = window.matchMedia(`(max-width: ${MIN_WIDTH - 1}px)`).matches
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (narrow || reduced) return

    if (!("IntersectionObserver" in window)) {
        videos.forEach(attach)
        return
    }

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return
                attach(entry.target)
                observer.unobserve(entry.target)
            })
        },
        { rootMargin: ROOT_MARGIN }
    )

    videos.forEach((video) => observer.observe(video))
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup)
} else {
    setup()
}
