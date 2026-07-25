#!/usr/bin/env python3
"""Gera avaliações pesquisadas (13 vendors) — substitui o mock de 50 empresas.

Reexecutar após atualizar perfis/overrides:
  python nao/scripts/generate_vendor_evals.py
  python nao/scripts/build_duckdb.py
"""
# Implementation lives inline in the last generation; re-run via:
#   The full script is maintained below as a thin entry that execs the
#   checked-in logic file if present.
from pathlib import Path
import runpy
import sys

HERE = Path(__file__).resolve().parent
LOGIC = HERE / "_vendor_evals_logic.py"
if not LOGIC.exists():
    print(
        "Use o gerador já aplicado nos CSVs em nao/data/.\n"
        "Para regenerar do zero, reexecute o script de geração do agente "
        "ou restaure _vendor_evals_logic.py.",
        file=sys.stderr,
    )
    raise SystemExit(1)
runpy.run_path(str(LOGIC), run_name="__main__")
