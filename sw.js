importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.0.0/workbox-sw.js');

if (workbox) { 
    // force dev build until https://github.com/GoogleChrome/workbox/issues/2686 gets fixed
    workbox.setConfig({ debug: true });
    // caching strategy
    workbox.precaching.precacheAndRoute([
        { url: 'index.html'                    , revision: '1.0.6.0' },
        { url: 'pid/v1.0.6/pid_tuner.js'       , revision: '1.0.6.0' },
        { url: 'pid/v1.0.6/pid_tuner_wasm.wasm', revision: '1.0.6'   }
    ]);
    workbox.routing.registerRoute(
        /\.(?:js|css|html|json|ico|png|gif|svg)$/,
        new workbox.strategies.StaleWhileRevalidate()
    );
    workbox.routing.registerRoute(
        new RegExp('https:\/\/cdn\.jsdelivr\.net.*min\.(css|js)'),
        new workbox.strategies.CacheFirst()
    );
    workbox.routing.registerRoute(
        new RegExp('https:\/\/cdnjs\.cloudflare\.com.*min\.(css|js)'),
        new workbox.strategies.CacheFirst()
    );
}