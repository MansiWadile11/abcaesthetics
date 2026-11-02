/**
* Swiper Slider
* Enables the two carousels that have markup: testimonials and the
* before/after comparison on the service pages.
*
* Modular, not swiper/bundle. The bundle is 150 KB of the build and ships
* every module - zoom, pagination, scrollbar, virtual, thumbs, every effect -
* for two carousels that need three. The stylesheet import in
* assets/css/style.css is split the same way.
*
* A11y is NOT optional here. It injects the .swiper-notification live region
* and the role/aria-label on each slide and aria-live on each wrapper that
* the bundle gave us for free; dropping it silently removes the carousels'
* screen-reader support. swiper/css/a11y is what keeps that notification
* visually hidden.
*
* Any carousel added later must list its own modules in `modules`, or its
* navigation and autoplay will quietly do nothing.
*/

import Swiper from 'swiper';
import { Navigation, Autoplay, A11y } from 'swiper/modules';

// Testimonial Slider
const testimonialSwiper = new Swiper(".testimonialSwiper", {
    modules: [Navigation, Autoplay, A11y],
    slidesPerView: 1,
    spaceBetween: 20,
    loop: true,
    speed: 600,
    navigation: {
        nextEl: ".testimonial-next",
        prevEl: ".testimonial-prev",
    },
    autoplay: {
        delay: 4000,
        disableOnInteraction: false,
    },
    breakpoints: {
        320: {
            slidesPerView: 1,
            spaceBetween: 16,
        },
        375: {
            slidesPerView: 1.2,
            spaceBetween: 16,
        },
        576: {
            slidesPerView: 1.2,
            spaceBetween: 20,
        },
        768: {
            slidesPerView: 1.2,
            spaceBetween: 20,
        },
        1024: {
            slidesPerView: 2,
            spaceBetween: 20,
        },
    },
});

// Support multiple navigation buttons
document.querySelectorAll(".testimonial-next").forEach(button => {
    button.addEventListener("click", () => {
        testimonialSwiper.slideNext();
    });
});
document.querySelectorAll(".testimonial-prev").forEach(button => {
    button.addEventListener("click", () => {
        testimonialSwiper.slidePrev();
    });
});
// Results carousel (service pages).
// Autoplay figures are taken from the reference's own Swiper config: it steps
// one slide every 3s over 300ms and keeps going after you interact with it.
new Swiper(".compareSwiper", {
    modules: [Navigation, Autoplay, A11y],
    slidesPerView: 1.15,
    spaceBetween: 20,
    // NOT loop. Swiper refuses to build the duplicate slides that loop needs
    // when the slide count is too small for slidesPerView - these pages carry
    // three or four - so loop:true silently produced a carousel that would
    // not advance at all, by autoplay or by the arrows. rewind runs to the
    // last slide and returns to the first, and works at any slide count.
    rewind: true,
    // Quicker than the reference's 3000/300: the slide rests for less time
    // and the glide itself is a touch longer, so it reads as moving rather
    // than snapping between stops.
    speed: 450,
    grabCursor: true,
    autoplay: {
        delay: 1800,
        disableOnInteraction: false,
        pauseOnMouseEnter: true,
    },
    navigation: {
        nextEl: ".compare-next",
        prevEl: ".compare-prev",
    },
    breakpoints: {
        640: { slidesPerView: 1.8, spaceBetween: 20 },
        // fractional so a part-slide peeks in and signals there is more
        1024: { slidesPerView: 2.4, spaceBetween: 24 },
    },
});
