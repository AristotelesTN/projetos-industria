#!/usr/bin/env python3
"""Serve the local snapshot of the Figma Make prototype with SPA fallback."""

from __future__ import annotations

import argparse
import mimetypes
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parent
BANNER = "/__figma__/api/community_published_banner_details"
BUNDLE = "95a4aacb-da10-4846-adf1-01ab2fc134aa"
JSON_INDEX = ROOT / "_json" / BUNDLE / "_index.json"
CMS_INDEX = ROOT / "_json" / BUNDLE / "_cms" / "_index.json"


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt: str, *args) -> None:
        print("[%s] %s" % (self.log_date_time_string(), fmt % args), flush=True)

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def _route_path(self) -> str:
        return unquote(urlparse(self.path).path)

    def translate_path(self, path: str) -> str:
        routed = unquote(urlparse(path).path)
        if routed.rstrip("/") == BANNER:
            return str(ROOT / BANNER.lstrip("/"))
        candidate = (ROOT / routed.lstrip("/")).resolve()
        try:
            candidate.relative_to(ROOT)
        except ValueError:
            return str(ROOT / "index.html")
        if routed.endswith("logo_vivix.f408970e.png"):
            return str(ROOT / "assets" / "vivix-wordmark.svg")
        if candidate.is_file():
            return str(candidate)
        if routed.startswith("/_json/"):
            if "/_cms" in routed:
                return str(CMS_INDEX)
            return str(JSON_INDEX)
        if routed not in ("/", "") and "." not in Path(routed).name:
            return str(ROOT / "index.html")
        return super().translate_path(path)

    def guess_type(self, path):
        p = str(path)
        if p.rstrip("/").endswith("community_published_banner_details"):
            return "application/json"
        if p.endswith(".json") or "/_json/" in p.replace("\\", "/"):
            return "application/json"
        return super().guess_type(path)


def main() -> None:
    mimetypes.add_type("application/javascript", ".js")
    mimetypes.add_type("image/png", ".png")
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=4177)
    args = parser.parse_args()
    httpd = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"VIVIX AgentHub → http://{args.host}:{args.port}/", flush=True)
    print("Ctrl+C para parar.", flush=True)
    httpd.serve_forever()


if __name__ == "__main__":
    main()
