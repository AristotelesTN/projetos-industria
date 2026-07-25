from __future__ import annotations

import json
import os
import subprocess
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

NAO_ROOT = Path(os.environ.get("NAO_PROJECT_PATH", "/nao"))
DATA = NAO_ROOT / "data"
BUILD_SCRIPT = NAO_ROOT / "scripts" / "build_duckdb.py"
PORT = int(os.environ.get("PORT", "8787"))


class Handler(BaseHTTPRequestHandler):
    def _cors(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _json(self, code: int, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self._cors()
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path in ("/health", "/api/health"):
            self._json(
                200,
                {
                    "ok": True,
                    "naoRoot": str(NAO_ROOT),
                    "hasDuckdb": (NAO_ROOT / "plataforma.duckdb").exists(),
                },
            )
            return
        self._json(404, {"ok": False, "message": "not found"})

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        if path != "/api/nao-sync":
            self._json(404, {"ok": False, "message": "not found"})
            return

        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length) if length else b"{}"
        try:
            body = json.loads(raw.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            self._json(400, {"ok": False, "message": "JSON inválido"})
            return

        if body.get("probe"):
            self._json(200, {"ok": True, "writeTarget": "disk"})
            return

        files = body.get("files") or {}
        if not files:
            self._json(400, {"ok": False, "message": "Sem arquivos no pack"})
            return

        DATA.mkdir(parents=True, exist_ok=True)
        written = []
        for name, content in files.items():
            safe = Path(name).name
            if not safe.endswith(".csv"):
                continue
            target = DATA / safe
            target.write_text(content, encoding="utf-8")
            written.append(safe)

        if not BUILD_SCRIPT.exists():
            self._json(500, {"ok": False, "message": f"Script ausente: {BUILD_SCRIPT}"})
            return

        build = subprocess.run(
            [sys.executable, str(BUILD_SCRIPT)],
            capture_output=True,
            text=True,
        )
        if build.returncode != 0:
            self._json(
                500,
                {
                    "ok": False,
                    "message": (build.stderr or build.stdout or "Falha no DuckDB")[:800],
                },
            )
            return

        meta = body.get("meta") or {}
        self._json(
            200,
            {
                "ok": True,
                "message": (
                    f"Sincronizado no volume Nao: {meta.get('nEmpresas', '?')} empresas, "
                    f"{meta.get('nAvaliacoes', '?')} avaliações "
                    f"({', '.join(written)}). Recarregue o chat em :5005 se necessário."
                ),
            },
        )

    def log_message(self, fmt: str, *args) -> None:
        sys.stderr.write("[sync-api] " + (fmt % args) + "\n")


def main() -> None:
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"sync-api on :{PORT} → {NAO_ROOT}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
