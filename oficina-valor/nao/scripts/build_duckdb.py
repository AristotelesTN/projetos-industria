#!/usr/bin/env python3
"""Build oficina_valor.duckdb from CSV snapshots in nao/data/."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
DB = ROOT / "oficina_valor.duckdb"

TABLES = [
    "projetos",
    "beneficios",
    "baselines",
    "medicoes",
    "validacoes",
    "custos_realizados",
    "gates",
    "roi_projeto",
    "curva_s_mensal",
    "portfolio_resumo",
    "fila_homologacao",
]


def main() -> int:
    try:
        import duckdb
    except ImportError:
        print("Instale duckdb: pip install duckdb", file=sys.stderr)
        return 1

    DATA.mkdir(parents=True, exist_ok=True)
    if DB.exists():
        DB.unlink()

    con = duckdb.connect(str(DB))
    loaded = []
    for table in TABLES:
        path = DATA / f"{table}.csv"
        if not path.exists() or path.stat().st_size == 0:
            con.execute(
                f"CREATE TABLE {table} AS SELECT * FROM (SELECT 1 AS _empty) WHERE 1=0"
            )
            continue
        con.execute(
            f"""
            CREATE TABLE {table} AS
            SELECT * FROM read_csv_auto('{path.as_posix()}', header=true, ignore_errors=true);
            """
        )
        loaded.append(table)

    con.execute(
        """
        CREATE OR REPLACE VIEW ganhos_por_categoria AS
        SELECT b.categoria, SUM(TRY_CAST(m.valor_realizado AS DOUBLE)) AS total
        FROM medicoes m
        JOIN beneficios b ON CAST(m.beneficio_id AS VARCHAR) = CAST(b.id AS VARCHAR)
        WHERE CAST(m.status AS VARCHAR) = 'validada'
        GROUP BY b.categoria
        """
    )
    con.execute(
        """
        CREATE OR REPLACE VIEW brr_por_projeto AS
        SELECT nome, TRY_CAST(brr AS DOUBLE) AS brr, TRY_CAST(roi AS DOUBLE) AS roi
        FROM roi_projeto
        """
    )
    con.execute(
        """
        CREATE OR REPLACE VIEW variancia_curva_s AS
        SELECT periodo,
               TRY_CAST(planejado_acumulado AS DOUBLE) AS planejado,
               TRY_CAST(realizado_acumulado AS DOUBLE) AS realizado,
               TRY_CAST(variancia_pct AS DOUBLE) AS variancia_pct
        FROM curva_s_mensal
        ORDER BY periodo
        """
    )

    con.close()
    print(f"OK: {DB} tables={loaded}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
