#!/usr/bin/env python3
"""Gera base mockada: 50 empresas × checklist de plataforma IA industrial."""

from __future__ import annotations

import csv
import json
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
ITEMS_JSON = ROOT.parent / "web" / "src" / "items.json"

SETORES = [
    "Automotivo",
    "Alimentos e bebidas",
    "Mineração",
    "Óleo e gás",
    "Química",
    "Papel e celulose",
    "Farmacêutico",
    "Metalurgia",
    "Energia",
    "Logística",
    "Máquinas e equipamentos",
    "Agronegócio",
]

REGIONES = [
    "Sudeste",
    "Sul",
    "Nordeste",
    "Centro-Oeste",
    "Norte",
]

PORTES = ["Média", "Grande", "Enterprise"]

PREFIXOS = [
    "Atlas", "Nexus", "Forge", "Pinnacle", "Vertex", "Horizon", "Summit",
    "Aether", "Pulse", "Prime", "Delta", "Omega", "Nova", "Apex", "Core",
    "Lumen", "Strata", "Quantum", "Helix", "Orbit", "Titan", "Vanguard",
    "Meridian", "Cascade", "Beacon", "Cobalt", "Ember", "Flint", "Granite",
    "Harbor", "Ivory", "Jade", "Krypton", "Lattice", "Magnet", "Nickel",
    "Oxide", "Prism", "Quartz", "Relay", "Sierra", "Torque", "Ultraviolet",
    "Vector", "Willow", "Xylon", "Yellowstone", "Zenith", "Anchor", "Bridge",
]

SUFIXOS = [
    "Indústria", "Tech", "Systems", "Digital", "Automation", "Solutions",
    "Brasil", "Engenharia", "Operações", "AI",
]

COBERTURAS = ["—", "Não tem", "Parcial", "Tem"]
SCORE = {"—": 0.0, "Não tem": 0.0, "Parcial": 0.5, "Tem": 1.0}
ROADMAPS = ["—", "Backlog", "Em curso", "Feito"]
DECISOES = ["—", "Comprar", "Construir", "Híbrido", "Adiar"]


def build_empresas(rng: random.Random) -> list[dict]:
    used = set()
    empresas = []
    for i in range(1, 51):
        while True:
            name = f"{rng.choice(PREFIXOS)} {rng.choice(SUFIXOS)}"
            if name not in used:
                used.add(name)
                break
        maturidade = rng.choices(
            ["inicial", "emergente", "avançada", "líder"],
            weights=[0.28, 0.34, 0.26, 0.12],
        )[0]
        # profile drives coverage distribution
        if maturidade == "inicial":
            weights = [0.15, 0.45, 0.30, 0.10]
        elif maturidade == "emergente":
            weights = [0.08, 0.28, 0.42, 0.22]
        elif maturidade == "avançada":
            weights = [0.04, 0.15, 0.35, 0.46]
        else:
            weights = [0.02, 0.08, 0.25, 0.65]

        empresas.append(
            {
                "empresa_id": f"e{i:02d}",
                "nome": name,
                "setor": rng.choice(SETORES),
                "porte": rng.choices(PORTES, weights=[0.35, 0.40, 0.25])[0],
                "regiao": rng.choice(REGIONES),
                "uf": rng.choice(
                    ["SP", "RJ", "MG", "RS", "PR", "SC", "BA", "PE", "GO", "AM", "PA", "CE"]
                ),
                "funcionarios": rng.choice([800, 1200, 2500, 4800, 9000, 15000, 28000]),
                "faturamento_mi_brl": round(rng.uniform(120, 18000), 1),
                "maturidade_ia": maturidade,
                "ano_avaliacao": 2026,
                "cobertura_weights": weights,
            }
        )
    return empresas


def pick_cobertura(rng: random.Random, weights: list[float], tipo: str) -> str:
    w = list(weights)
    # Inventário / síntese: mais respostas textuais, menos "Tem"
    if tipo == "Inventario":
        w = [0.25, 0.20, 0.30, 0.25]
    return rng.choices(COBERTURAS, weights=w, k=1)[0]


def pick_roadmap(rng: random.Random, cob: str) -> str:
    if cob == "Tem":
        return rng.choices(ROADMAPS, weights=[0.1, 0.15, 0.25, 0.5], k=1)[0]
    if cob == "Parcial":
        return rng.choices(ROADMAPS, weights=[0.15, 0.4, 0.35, 0.1], k=1)[0]
    if cob == "Não tem":
        return rng.choices(ROADMAPS, weights=[0.35, 0.45, 0.15, 0.05], k=1)[0]
    return "—"


def pick_decisao(rng: random.Random, cob: str, maturidade: str) -> str:
    if cob == "Tem":
        return rng.choices(DECISOES, weights=[0.2, 0.45, 0.1, 0.2, 0.05], k=1)[0]
    if cob == "Parcial":
        return rng.choices(DECISOES, weights=[0.1, 0.2, 0.25, 0.35, 0.1], k=1)[0]
    if cob == "Não tem":
        if maturidade in ("avançada", "líder"):
            return rng.choices(DECISOES, weights=[0.1, 0.15, 0.45, 0.2, 0.1], k=1)[0]
        return rng.choices(DECISOES, weights=[0.15, 0.25, 0.25, 0.15, 0.2], k=1)[0]
    return "—"


def invent_resposta(rng: random.Random, item: dict, empresa: dict) -> str:
    if item.get("pilar") != "sintese" and item.get("tipo") != "Inventario":
        return ""
    snippets = [
        f"Em {empresa['setor'].lower()}, ainda em discovery.",
        f"Time de {rng.randint(2, 18)} pessoas dedicado.",
        f"POC com {rng.choice(['AWS', 'Azure', 'GCP', 'on-prem'])} em andamento.",
        f"Prioridade {rng.choice(['alta', 'média', 'baixa'])} no roadmap 2026.",
        f"Dependência de parceiro {rng.choice(['SI', 'ISV', 'consultoria'])}.",
    ]
    return rng.choice(snippets)


def main() -> int:
    rng = random.Random(42)  # reprodutível
    items = json.loads(ITEMS_JSON.read_text(encoding="utf-8"))
    empresas = build_empresas(rng)
    DATA.mkdir(parents=True, exist_ok=True)

    with (DATA / "empresas.csv").open("w", newline="", encoding="utf-8") as f:
        fields = [
            "empresa_id",
            "nome",
            "setor",
            "porte",
            "regiao",
            "uf",
            "funcionarios",
            "faturamento_mi_brl",
            "maturidade_ia",
            "ano_avaliacao",
        ]
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for e in empresas:
            w.writerow({k: e[k] for k in fields})

    with (DATA / "avaliacoes.csv").open("w", newline="", encoding="utf-8") as f:
        fields = [
            "item_id",
            "pilar",
            "tipo",
            "texto",
            "empresa_id",
            "empresa_nome",
            "setor",
            "porte",
            "regiao",
            "maturidade_ia",
            "cobertura",
            "cobertura_score",
            "roadmap",
            "decisao",
            "resposta",
        ]
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for e in empresas:
            for item in items:
                cob = pick_cobertura(rng, e["cobertura_weights"], item["tipo"])
                w.writerow(
                    {
                        "item_id": item["id"],
                        "pilar": item["pilar"],
                        "tipo": item["tipo"],
                        "texto": item["texto"],
                        "empresa_id": e["empresa_id"],
                        "empresa_nome": e["nome"],
                        "setor": e["setor"],
                        "porte": e["porte"],
                        "regiao": e["regiao"],
                        "maturidade_ia": e["maturidade_ia"],
                        "cobertura": cob,
                        "cobertura_score": SCORE[cob],
                        "roadmap": pick_roadmap(rng, cob),
                        "decisao": pick_decisao(rng, cob, e["maturidade_ia"]),
                        "resposta": invent_resposta(rng, item, e),
                    }
                )

    # Compat: também gerar resumo por empresa
    with (DATA / "empresa_resumo.csv").open("w", newline="", encoding="utf-8") as f:
        fields = [
            "empresa_id",
            "nome",
            "setor",
            "porte",
            "regiao",
            "maturidade_ia",
            "cobertura_media",
            "itens_tem",
            "itens_parcial",
            "itens_nao_tem",
            "gaps",
            "decisao_comprar",
            "decisao_construir",
            "decisao_hibrido",
        ]
        # compute from what we wrote
        from collections import defaultdict

        stats: dict[str, dict] = defaultdict(
            lambda: {
                "scores": [],
                "tem": 0,
                "parcial": 0,
                "nao": 0,
                "comprar": 0,
                "construir": 0,
                "hibrido": 0,
            }
        )
        with (DATA / "avaliacoes.csv").open(encoding="utf-8") as af:
            for row in csv.DictReader(af):
                if row["pilar"] == "sintese":
                    continue
                s = stats[row["empresa_id"]]
                s["scores"].append(float(row["cobertura_score"]))
                if row["cobertura"] == "Tem":
                    s["tem"] += 1
                elif row["cobertura"] == "Parcial":
                    s["parcial"] += 1
                elif row["cobertura"] == "Não tem":
                    s["nao"] += 1
                if row["decisao"] == "Comprar":
                    s["comprar"] += 1
                elif row["decisao"] == "Construir":
                    s["construir"] += 1
                elif row["decisao"] == "Híbrido":
                    s["hibrido"] += 1

        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        by_id = {e["empresa_id"]: e for e in empresas}
        for eid, s in sorted(stats.items()):
            e = by_id[eid]
            avg = sum(s["scores"]) / len(s["scores"]) if s["scores"] else 0
            w.writerow(
                {
                    "empresa_id": eid,
                    "nome": e["nome"],
                    "setor": e["setor"],
                    "porte": e["porte"],
                    "regiao": e["regiao"],
                    "maturidade_ia": e["maturidade_ia"],
                    "cobertura_media": round(avg, 4),
                    "itens_tem": s["tem"],
                    "itens_parcial": s["parcial"],
                    "itens_nao_tem": s["nao"],
                    "gaps": s["nao"],
                    "decisao_comprar": s["comprar"],
                    "decisao_construir": s["construir"],
                    "decisao_hibrido": s["hibrido"],
                }
            )

    n_av = 50 * len(items)
    print(f"OK empresas=50 itens={len(items)} avaliacoes={n_av}")
    print(f"Arquivos em {DATA}")
    export_web_json(empresas, items)
    return 0


def export_web_json(empresas: list[dict], items: list[dict]) -> None:
    """Espelha a base mock em web/src/data/mock-empresas.json para o app."""
    import json
    from collections import defaultdict
    from datetime import date

    web_out = ROOT.parent / "web" / "src" / "data"
    web_out.mkdir(parents=True, exist_ok=True)

    resumos = {
        r["empresa_id"]: r
        for r in csv.DictReader((DATA / "empresa_resumo.csv").open(encoding="utf-8"))
    }
    merged = []
    for e in empresas:
        r = resumos[e["empresa_id"]]
        merged.append(
            {
                "id": e["empresa_id"],
                "nome": e["nome"],
                "setor": e["setor"],
                "porte": e["porte"],
                "regiao": e["regiao"],
                "uf": e["uf"],
                "funcionarios": int(e["funcionarios"]),
                "faturamentoMiBrl": float(e["faturamento_mi_brl"]),
                "maturidade": e["maturidade_ia"],
                "ano": int(e["ano_avaliacao"]),
                "coberturaMedia": float(r["cobertura_media"]),
                "itensTem": int(r["itens_tem"]),
                "itensParcial": int(r["itens_parcial"]),
                "itensNaoTem": int(r["itens_nao_tem"]),
                "decisaoComprar": int(r["decisao_comprar"]),
                "decisaoConstruir": int(r["decisao_construir"]),
                "decisaoHibrido": int(r["decisao_hibrido"]),
            }
        )

    by_emp: dict[str, list] = defaultdict(list)
    for row in csv.DictReader((DATA / "avaliacoes.csv").open(encoding="utf-8")):
        pilar = row["pilar"]
        if pilar != "sintese":
            try:
                pilar = int(float(pilar))
            except ValueError:
                pass
        by_emp[row["empresa_id"]].append(
            {
                "itemId": row["item_id"],
                "pilar": pilar,
                "tipo": row["tipo"],
                "texto": row["texto"],
                "cobertura": row["cobertura"],
                "score": float(row["cobertura_score"]),
                "roadmap": row["roadmap"],
                "decisao": row["decisao"],
                "resposta": row["resposta"] or "",
            }
        )

    payload = {
        "generatedAt": date.today().isoformat(),
        "empresas": merged,
        "avaliacoes": {k: by_emp[k] for k in sorted(by_emp)},
    }
    path = web_out / "mock-empresas.json"
    path.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"Web JSON → {path} ({path.stat().st_size} bytes)")


if __name__ == "__main__":
    raise SystemExit(main())
