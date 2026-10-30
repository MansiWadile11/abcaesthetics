/**
* Swiper Slider
* Enables carousels and sliders
* Requires swiper-bundle.min.js
*/

import Swiper from 'swiper/bundle';

// Testimonial Slider
const testimonialSwiper = new Swiper(".testimonialSwiper", {
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
