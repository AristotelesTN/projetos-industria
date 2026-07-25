#!/usr/bin/env python3
"""Aplica pack JSON exportado pelo app (Sincronizar Nao) na pasta nao/data."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "nao" / "data"


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print(
            "Uso: python nao/scripts/apply_sync_payload.py ~/Downloads/nao-sync-YYYY-MM-DD.json",
            file=sys.stderr,
        )
        return 1
    path = Path(argv[1]).expanduser()
    if not path.exists():
        print(f"Arquivo não encontrado: {path}", file=sys.stderr)
        return 1

    pack = json.loads(path.read_text(encoding="utf-8"))
    files = pack.get("files") or {}
    DATA.mkdir(parents=True, exist_ok=True)
    for name, content in files.items():
        safe = Path(name).name
        if not safe.endswith(".csv"):
            continue
        (DATA / safe).write_text(content, encoding="utf-8")
        print(f"wrote {DATA / safe}")

    build = subprocess.run(
        [sys.executable, str(ROOT / "nao" / "scripts" / "build_duckdb.py")],
        cwd=ROOT,
    )
    if build.returncode != 0:
        return build.returncode

    restart = subprocess.run(
        ["docker", "compose", "-f", "docker-compose.nao.yml", "restart"],
        cwd=ROOT,
    )
    meta = pack.get("meta") or {}
    print(
        f"OK sync — empresas={meta.get('nEmpresas')} avaliacoes={meta.get('nAvaliacoes')}"
        + (" · container reiniciado" if restart.returncode == 0 else " · reinicie o Docker manualmente")
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
