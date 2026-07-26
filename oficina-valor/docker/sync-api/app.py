#!/usr/bin/env python3
"""Recebe snapshot CSV da API Oficina de Valor e rebuilda o DuckDB do Nao."""

from __future__ import annotations

import json
import os
import subprocess
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

NAO_PATH = Path(os.environ.get("NAO_PROJECT_PATH", "/nao"))
DATA = NAO_PATH / "data"
PORT = int(os.environ.get("PORT", "8787"))


class Handler(BaseHTTPRequestHandler):
    def _json(self, code: int, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/health":
            self._json(200, {"status": "ok"})
            return
        self._json(404, {"error": "not found"})

    def do_POST(self) -> None:  # noqa: N802
        if self.path != "/sync":
            self._json(404, {"error": "not found"})
            return
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length)
        try:
            payload = json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError:
            self._json(400, {"error": "invalid json"})
            return

        DATA.mkdir(parents=True, exist_ok=True)
        files = payload.get("files") or {}
        written = []
        for name, content in files.items():
            path = DATA / name
            path.write_text(content, encoding="utf-8")
            written.append(name)

        build = NAO_PATH / "scripts" / "build_duckdb.py"
        result = {"written": written, "manifesto": payload.get("manifesto")}
        if build.exists():
            proc = subprocess.run(
                ["python3", str(build)],
                cwd=str(NAO_PATH),
                capture_output=True,
                text=True,
            )
            result["build_ok"] = proc.returncode == 0
            result["build_stdout"] = proc.stdout[-2000:]
            result["build_stderr"] = proc.stderr[-2000:]
        else:
            result["build_ok"] = False
            result["build_stderr"] = "build_duckdb.py não encontrado"

        self._json(200 if result.get("build_ok") else 500, result)

    def log_message(self, fmt: str, *args) -> None:
        return


def main() -> None:
    server = HTTPServer(("0.0.0.0", PORT), Handler)
    print(f"oficina-valor sync-api on :{PORT}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
