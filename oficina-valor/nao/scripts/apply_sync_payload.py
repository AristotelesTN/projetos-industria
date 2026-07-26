#!/usr/bin/env python3
"""Aplica pack JSON baixado da API (GET /nao/snapshot ou sync offline)."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"


def main() -> int:
    if len(sys.argv) < 2:
        print("Uso: apply_sync_payload.py <pack.json>", file=sys.stderr)
        return 1
    pack = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    files = pack.get("files") or {}
    DATA.mkdir(parents=True, exist_ok=True)
    for name, content in files.items():
        (DATA / name).write_text(content, encoding="utf-8")
        print("wrote", name)
    return subprocess.call(["python3", str(ROOT / "scripts" / "build_duckdb.py")])


if __name__ == "__main__":
    raise SystemExit(main())
