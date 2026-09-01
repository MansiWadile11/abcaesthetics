// Core
import lightGallery from 'lightgallery';
import 'lightgallery/css/lightgallery-bundle.css';

// Plugins (optional)
import lgZoom from 'lightgallery/plugins/zoom';
import lgVideo from 'lightgallery/plugins/video';
import lgThumbnail from 'lightgallery/plugins/thumbnail';
import lgFullscreen from 'lightgallery/plugins/fullscreen';


// LightGallery  CSS (optional)
import 'lightgallery/css/lg-zoom.css';
import 'lightgallery/css/lg-video.css';
import 'lightgallery/css/lg-thumbnail.css';
import 'lightgallery/css/lg-fullscreen.css';


export default (() => {
    const gallery = document.querySelectorAll('[data-toggle="gallery"]')

    if (gallery.length) {
        for (let i = 0; i < gallery.length; i++) {
            /* eslint-disable no-undef */
            const thumbnails = gallery[i].dataset.thumbnails ? true : false,
                video = gallery[i].dataset.video ? true : false,
                defaultPlugins = [lgZoom, lgFullscreen],
                videoPlugin = video ? [lgVideo] : [],
                thumbnailPlugin = thumbnails ? [lgThumbnail] : [],
                plugins = [...defaultPlugins, ...videoPlugin, ...thumbnailPlugin]

            lightGallery(gallery[i], {
                selector: 'a',
                plugins: plugins,
                download: false,
                autoplayVideoOnSlide: true,
                zoomFromOrigin: false,
                youtubePlayerParams: {
                    modestbranding: 1,
                    showinfo: 0,
                    rel: 0,
                },
                vimeoPlayerParams: {
                    byline: 0,
                    portrait: 0,
                    color: '6366f1',
                },
            })
            /* eslint-enable no-undef */
        }
    }

    const button = document.querySelectorAll('[data-toggle="video"]')
    if (button.length) {
        for (let i = 0; i < button.length; i++) {
            /* eslint-disable no-undef */
            lightGallery(button[i], {
                selector: 'this',
                plugins: [lgVideo],
                download: false,
                youtubePlayerParams: {
                    modestbranding: 1,
                    showinfo: 0,
                    rel: 0,
                },
                vimeoPlayerParams: {
                    byline: 0,
                    portrait: 0,
                    color: '6366f1',
                },
            })
            /* eslint-enable no-undef */
        }
    }
})()