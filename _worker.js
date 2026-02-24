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
    'Access-Control-Allow-Headers': 'Content-Type, Accept, X-Requested-With',
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

        // Forward the request, dropping Host and Origin headers to avoid conflicts.
        const forwardHeaders = new Headers(request.headers);
        forwardHeaders.delete('Host');
        forwardHeaders.delete('Origin');

        const proxyRequest = new Request(targetUrl, {
            method: request.method,
            headers: forwardHeaders,
            body: (request.method !== 'GET' && request.method !== 'HEAD')
                ? request.body
                : undefined,
            redirect: 'follow',
        });

        let response;
        try {
            response = await fetch(proxyRequest);
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
