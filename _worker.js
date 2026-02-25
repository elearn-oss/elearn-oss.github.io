/**
 * _worker.js – Cloudflare Worker CORS proxy for elearn.uk.ac.ir
 *
 * This worker solves the CORS problem that prevents the static GitHub Pages
 * frontend (elearn-oss.github.io) from calling the university API directly.
 * The university server does not include Access-Control-Allow-Origin headers,
 * so browser CORS policy blocks every cross-origin request.
 *
 * How it works:
 *   Browser → this worker → elearn.uk.ac.ir (adds CORS headers on the way back)
 *
 * Deployment (Cloudflare Workers):
 *   1. Install Wrangler: npm install -g wrangler
 *   2. Log in:           wrangler login
 *   3. Deploy:           wrangler deploy _worker.js --name elearn-cors-proxy
 *   4. Copy the worker URL (e.g. https://elearn-cors-proxy.<account>.workers.dev/)
 *   5. Open the elearn-oss login page, switch to real mode, paste the URL into
 *      the "CORS proxy" field, and click "ذخیره" (Save).
 *
 * Deployment (Cloudflare Pages):
 *   Place this file at /functions/_worker.js in your Pages project and deploy.
 *
 * Security:
 *   - Only the GitHub Pages origin is allowed (ALLOWED_ORIGIN constant).
 *   - Only requests to elearn.uk.ac.ir are forwarded (TARGET constant).
 *   - Requests from any other origin receive a 403 Forbidden response.
 */

const TARGET = 'https://elearn.uk.ac.ir';
const ALLOWED_ORIGIN = 'https://elearn-oss.github.io';

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept, X-Requested-With, X-ELearn-Referer',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
};

export default {
    async fetch(request) {
        const origin = request.headers.get('Origin') || '';

        // Reject requests that come from an origin other than the allowed one.
        if (origin && origin !== ALLOWED_ORIGIN) {
            return new Response('Forbidden', { status: 403 });
        }

        // Handle CORS preflight.
        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: CORS_HEADERS });
        }

        // Build target URL: replace the worker host with the university host.
        const url = new URL(request.url);
        const targetUrl = TARGET + url.pathname + url.search;

        // Forward the request, fixing headers so the university server sees
        // what it expects (same-origin Referer & Origin, correct Host).
        const forwardHeaders = new Headers(request.headers);
        forwardHeaders.delete('Host');

        // Set Origin to the real server (ASP.NET may validate this)
        forwardHeaders.set('Origin', TARGET);

        // Remove browser fetch-metadata headers from the original cross-site
        // request. Forwarding values like `Sec-Fetch-Site: cross-site` can
        // trigger stricter anti-CSRF checks on the upstream ASP.NET app.
        forwardHeaders.delete('Sec-Fetch-Site');
        forwardHeaders.delete('Sec-Fetch-Mode');
        forwardHeaders.delete('Sec-Fetch-Dest');
        forwardHeaders.delete('Sec-Fetch-User');

        // Rewrite Referer: the browser sends our GitHub Pages / proxy URL,
        // but ASP.NET Page Methods expect the Referer to be from the same
        // domain. If the frontend passed X-ELearn-Referer, use that as
        // the path; otherwise auto-generate from the request URL path.
        var customReferer = forwardHeaders.get('X-ELearn-Referer');
        forwardHeaders.delete('X-ELearn-Referer');
        if (customReferer) {
            // Build the Referer via URL parsing so query values are preserved
            // correctly (e.g. CLid with + or / characters).
            var refererUrl = new URL(customReferer.replace(/^\//, ''), TARGET + '/');
            forwardHeaders.set('Referer', refererUrl.toString());
        } else {
            var aspxMatch = url.pathname.match(/^(\/[^/]*\.aspx)/i);
            if (aspxMatch) {
                forwardHeaders.set('Referer', TARGET + aspxMatch[1]);
            } else {
                forwardHeaders.set('Referer', TARGET + url.pathname);
            }
        }

        let response;
        try {
            response = await fetchWithAspNetRedirectFix(targetUrl, {
                method: request.method,
                headers: forwardHeaders,
                body: (request.method !== 'GET' && request.method !== 'HEAD')
                    ? request.body
                    : undefined,
            });
        } catch (err) {
            return new Response('Proxy error: ' + err.message, { status: 502 });
        }

        // Rebuild the response with CORS headers injected.
        const responseHeaders = new Headers(response.headers);
        Object.entries(CORS_HEADERS).forEach(function ([key, value]) {
            responseHeaders.set(key, value);
        });

        // Sanitize Set-Cookie headers so the browser stores them for the proxy
        // domain instead of the university domain. Remove any 'domain' attribute
        // and ensure SameSite=None so cookies work in a cross-site proxy context.
        try {
            const setCookies = response.headers.getAll('set-cookie');
            if (setCookies && setCookies.length > 0) {
                responseHeaders.delete('set-cookie');
                setCookies.forEach(function (cookie) {
                    var sanitised = cookie
                        .replace(/;\s*domain=[^;,]*/gi, '')
                        .replace(/;\s*samesite=[^;,]*/gi, '');
                    responseHeaders.append('set-cookie', sanitised + '; SameSite=None; Secure');
                });
            }
        } catch (_) { /* getAll not available – leave Set-Cookie as-is */ }

        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders,
        });
    },
};

/**
 * Some ASP.NET PageMethods return redirects like `Location: Index.aspx`.
 * If followed relative to `/STCoursepage.aspx/GetInfo`, the URL becomes
 * `/STCoursepage.aspx/Index.aspx` and can loop forever. We follow redirects
 * manually and normalize these known malformed relative redirects.
 */
async function fetchWithAspNetRedirectFix(initialUrl, init) {
    let currentUrl = initialUrl;
    let method = init.method || 'GET';
    let body = init.body;
    const visited = new Set();

    for (let i = 0; i < 10; i++) {
        if (visited.has(currentUrl)) {
            throw new Error('Too many redirects (loop detected): ' + currentUrl);
        }
        visited.add(currentUrl);

        const response = await fetch(new Request(currentUrl, {
            method: method,
            headers: init.headers,
            body: (method !== 'GET' && method !== 'HEAD') ? body : undefined,
            redirect: 'manual',
        }));

        if (response.status < 300 || response.status > 399) {
            return response;
        }

        const location = response.headers.get('Location');
        if (!location) {
            return response;
        }

        currentUrl = normaliseAspNetRedirect(currentUrl, location);

        // RFC behavior for 302/303 after non-GET: switch to GET with no body.
        if (response.status === 303 || ((response.status === 301 || response.status === 302) && method !== 'GET' && method !== 'HEAD')) {
            method = 'GET';
            body = undefined;
        }
    }

    throw new Error('Too many redirects.');
}

function normaliseAspNetRedirect(fromUrl, location) {
    if (/^https?:\/\//i.test(location)) {
        return location;
    }

    if (location.startsWith('/')) {
        return TARGET + location;
    }

    // Known ASP.NET PageMethod behavior: Location: Index.aspx
    // should map to site root, not /SomePage.aspx/Index.aspx
    if (/^[^/?#]+\.aspx(?:[?#].*)?$/i.test(location)) {
        return TARGET + '/' + location;
    }

    return new URL(location, fromUrl).toString();
}
