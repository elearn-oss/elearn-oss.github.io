#!/usr/bin/env python3
"""
server.py – Static file server + reverse proxy for elearn_oss_main.

Serves the static HTML/CSS/JS files AND proxies all .aspx / .ashx
requests to https://elearn.uk.ac.ir/, transparently rewriting session
cookies so the browser-side authentication works without CORS issues.

Usage:
    python3 server.py          # http://localhost:8080
    python3 server.py 9000     # custom port

Demo mode (no proxy needed):
    python3 -m http.server 8080
    (mock.js intercepts all API calls with built-in demo data)
"""

import http.server
import urllib.request
import urllib.error
import os
import re
import ssl
import sys

# ── Configuration ────────────────────────────────────────────────────────────
BACKEND  = 'https://elearn.uk.ac.ir'
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

try:
    PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    if not (1 <= PORT <= 65535):
        raise ValueError
except ValueError:
    sys.exit('خطا: شماره پورت باید یک عدد صحیح بین ۱ تا ۶۵۵۳۵ باشد.')

# URL path patterns to forward to the real backend
PROXY_SUFFIXES = ('.aspx', '.ashx')

# ── Helpers ──────────────────────────────────────────────────────────────────

def _should_proxy(path):
    """Return True if the request path should be forwarded to the backend.

    Matches paths where .aspx or .ashx appears as a component, e.g.:
      /Index.aspx/get_login         → True
      /STClasslist.aspx/GetSTClasses → True
      /UploadHandler.ashx            → True
      /js/mock.js                    → False
    """
    clean = path.lower().split('?')[0]
    # Match .aspx/ (method call pattern) or path ending with .aspx/.ashx
    return any((s + '/') in clean or clean.endswith(s) for s in PROXY_SUFFIXES)


def _strip_cookie_domain(cookie_header):
    """
    Remove Domain= and Secure attributes from a Set-Cookie header so the
    cookie is accepted by the browser for localhost instead of for
    elearn.uk.ac.ir.
    """
    cookie = re.sub(r';\s*[Dd]omain=[^;,]*', '', cookie_header)
    cookie = re.sub(r';\s*[Ss]ecure(?=\s*[;,]|\s*$)', '', cookie)
    return cookie.strip().strip(';')


# ── Request handler ──────────────────────────────────────────────────────────

class Handler(http.server.SimpleHTTPRequestHandler):
    """Serves static files for everything except .aspx/.ashx paths."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    # Silence noisy 200/304 log lines (keep errors).
    # Python's BaseHTTPRequestHandler.log_request() calls log_message with
    # (format, requestline, code, size) so args[1] is the HTTP status code.
    def log_message(self, fmt, *args):
        if args and len(args) >= 2 and str(args[1]) not in ('200', '304'):
            super().log_message(fmt, *args)

    # ── CORS helper ─────────────────────────────────────────────────────────
    def _cors(self):
        origin = self.headers.get('Origin', '*')
        self.send_header('Access-Control-Allow-Origin', origin or '*')
        self.send_header('Access-Control-Allow-Credentials', 'true')
        self.send_header('Access-Control-Allow-Headers',
                         'Content-Type, Cookie, Accept, Accept-Language')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')

    # ── Proxy logic ─────────────────────────────────────────────────────────
    def _proxy(self, method, body=None):
        target = BACKEND + self.path
        fwd_headers = {}
        for h in ('Content-Type', 'Cookie', 'Accept',
                  'Accept-Language', 'Referer'):
            v = self.headers.get(h)
            if v:
                fwd_headers[h] = v

        ctx = ssl.create_default_context()
        try:
            req = urllib.request.Request(
                target, data=body, headers=fwd_headers, method=method)

            with urllib.request.urlopen(req, context=ctx, timeout=30) as resp:
                self.send_response(resp.status)
                for k, v in resp.headers.items():
                    kl = k.lower()
                    if kl == 'set-cookie':
                        self.send_header(k, _strip_cookie_domain(v))
                    elif kl in ('content-type', 'content-length',
                                'cache-control', 'pragma'):
                        self.send_header(k, v)
                self._cors()
                self.end_headers()
                self.wfile.write(resp.read())

        except urllib.error.HTTPError as e:
            self.send_response(e.code)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self._cors()
            self.end_headers()
            try:
                self.wfile.write(e.read())
            except Exception:
                pass

        except Exception as e:
            msg = ('Proxy error: ' + str(e)).encode('utf-8')
            self.send_response(502)
            self.send_header('Content-Type', 'text/plain; charset=utf-8')
            self.send_header('Content-Length', str(len(msg)))
            self._cors()
            self.end_headers()
            self.wfile.write(msg)

    # ── HTTP verb handlers ───────────────────────────────────────────────────
    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        if _should_proxy(self.path):
            self._proxy('GET')
        else:
            super().do_GET()

    def do_POST(self):
        if _should_proxy(self.path):
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length) if length else b''
            self._proxy('POST', body)
        else:
            self.send_response(405)
            self.end_headers()


# ── Entry point ──────────────────────────────────────────────────────────────

if __name__ == '__main__':
    os.chdir(BASE_DIR)
    httpd = http.server.HTTPServer(('', PORT), Handler)
    print()
    print('  ┌─────────────────────────────────────────────────────┐')
    print('  │           سامانه ایلرن – elearn_oss_main            │')
    print('  ├─────────────────────────────────────────────────────┤')
    print('  │  آدرس:  http://localhost:{:<5}                      │'.format(PORT))
    print('  │  پروکسی: {}  │'.format(BACKEND))
    print('  └─────────────────────────────────────────────────────┘')
    print()
    print('  • برای اتصال به سایت دانشگاه:  حالت «سایت دانشگاه» را')
    print('    در صفحه ورود انتخاب کنید و با حساب دانشگاهی وارد شوید.')
    print()
    print('  • برای حالت دمو (بدون اینترنت):  حالت «دمو» را انتخاب کنید.')
    print('    حساب‌های دمو:  student1/student1  ·  teacher1/teacher1')
    print()
    print('  Ctrl+C برای توقف')
    print()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\nسرور متوقف شد.')
