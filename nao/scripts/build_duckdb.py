#!/usr/bin/env python3
"""Build nao/plataforma.duckdb from CSV snapshots in nao/data/."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
DB = ROOT / "plataforma.duckdb"


def main() -> int:
    try:
        import duckdb
    except ImportError:
        print("Instale duckdb: pip install duckdb", file=sys.stderr)
        return 1

    required = [
        DATA / "itens.csv",
        DATA / "avaliacoes.csv",
        DATA / "empresas.csv",
        DATA / "empresa_resumo.csv",
    ]
    missing = [p for p in required if not p.exists()]
    if missing:
        print("Faltam CSVs:", ", ".join(str(p) for p in missing), file=sys.stderr)
        print("Rode: python nao/scripts/generate_mock_50.py", file=sys.stderr)
        return 1

    if DB.exists():
        DB.unlink()

    con = duckdb.connect(str(DB))
    for table, path in [
        ("itens", DATA / "itens.csv"),
        ("empresas", DATA / "empresas.csv"),
        ("avaliacoes", DATA / "avaliacoes.csv"),
        ("empresa_resumo", DATA / "empresa_resumo.csv"),
    ]:
        con.execute(
            f"""
            CREATE TABLE {table} AS
            SELECT * FROM read_csv_auto('{path.as_posix()}', header=true);
            """
        )

    # Views úteis para o agente
    con.execute(
        """
        CREATE VIEW cobertura_por_empresa AS
        SELECT
          empresa_id,
          empresa_nome,
          setor,
          porte,
          regiao,
          maturidade_ia,
          ROUND(AVG(cobertura_score), 4) AS cobertura_media,
          COUNT(*) AS n_itens
        FROM avaliacoes
        WHERE CAST(pilar AS VARCHAR) != 'sintese'
        GROUP BY 1,2,3,4,5,6
        ORDER BY cobertura_media DESC;
        """
    )
    con.execute(
        """
        CREATE VIEW cobertura_por_setor AS
        SELECT
          setor,
          COUNT(DISTINCT empresa_id) AS n_empresas,
          ROUND(AVG(cobertura_score), 4) AS cobertura_media
        FROM avaliacoes
        WHERE CAST(pilar AS VARCHAR) != 'sintese'
        GROUP BY 1
        ORDER BY cobertura_media DESC;
        """
    )
    con.execute(
        """
        CREATE VIEW cobertura_por_pilar AS
        SELECT
          pilar,
          ROUND(AVG(cobertura_score), 4) AS cobertura_media,
          COUNT(*) AS n_avaliacoes
        FROM avaliacoes
        WHERE CAST(pilar AS VARCHAR) != 'sintese'
        GROUP BY 1
        ORDER BY pilar;
        """
    )

    counts = {
        t: con.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
        for t in ("itens", "empresas", "avaliacoes", "empresa_resumo")
    }
    con.close()
    print(f"OK {DB}")
    for k, v in counts.items():
        print(f"  {k}={v}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
