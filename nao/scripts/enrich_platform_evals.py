#!/usr/bin/env python3
"""Enrich mock-empresas with per-item comentarios + industrial platforms.

Heuristic scoring from public product positioning (not a formal POC).
Writes web/src/data/mock-empresas.json and nao/data CSVs.
"""
from __future__ import annotations

import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WEB_JSON = ROOT / "web" / "src" / "data" / "mock-empresas.json"
ITEMS_JSON = ROOT / "web" / "src" / "items.json"
NAO_DATA = ROOT / "nao" / "data"

SCORE = {"Tem": 1.0, "Parcial": 0.5, "Não tem": 0.0, "—": 0.0}

# Short product context used in comentarios
VENDOR_CTX: dict[str, dict] = {
    "e01": {
        "short": "MuleSoft Agent Fabric",
        "fonte": "https://www.mulesoft.com/ai/agent-fabric",
        "pillars": {
            "1": "forte em conectores Anypoint e control plane multi-agente (MCP/A2A)",
            "2": "registry/broker/governance maduros para orquestração multi-vendor",
            "3": "governança e políticas no fabric; HITL via fluxos MuleSoft/Salesforce",
            "4": "observabilidade via Visualizer; evals mais dependentes do ecossistema",
            "5": "RBAC e governança enterprise Salesforce/MuleSoft",
            "6": "runtime e scale no Anypoint; custo/ops típicos de iPaaS enterprise",
            "7": "indústria via conectores MES/ERP; menos nativo OT que vendors industriais",
            "sintese": "plataforma de control plane / interoperabilidade de agentes",
        },
    },
    "e02": {
        "short": "Runflow",
        "fonte": "https://docs.runflow.ai/",
        "pillars": {
            "1": "SDK com connectors/RAG/memory; cobertura industrial depende de build",
            "2": "workflows flow()/supervisor fortes; menos registry enterprise",
            "3": "HITL/Kanban documentado; políticas avançadas limitadas",
            "4": "observability no SDK; evals formais menos maduros",
            "5": "segurança típica de app TS; sem suite GRC industrial",
            "6": "leve e developer-first; ops enterprise a cargo do time",
            "7": "não é stack OT/MES nativa",
            "sintese": "SDK multi-agente TypeScript",
        },
    },
    "e03": {
        "short": "Volland (memória agentic)",
        "fonte": "https://github.com/Volland/Volland",
        "pillars": {
            "1": "foco em memória/graph RAG; não é iPaaS industrial",
            "2": "orquestração limitada ao stack de memória",
            "3": "soberania/edge como diferencial; governança agentic incompleta",
            "4": "pouca evidência de evals/observabilidade enterprise",
            "5": "ênfase em soberania; controles enterprise ainda emergentes",
            "6": "edge-friendly; não plataforma SaaS industrial completa",
            "7": "sem evidência de MES/CMMS/OT nativos",
            "sintese": "stack de memória agentic / LadybugDB — não 'Volland OS' industrial",
        },
    },
    "e04": {
        "short": "Salesforce Agentforce",
        "fonte": "https://www.salesforce.com/agentforce/",
        "pillars": {
            "1": "contexto CRM/Data Cloud forte; OT/MES via integração",
            "2": "lifecycle de agentes nativo Atlas/Agentforce",
            "3": "guardrails e trust layer Salesforce",
            "4": "analytics CRM; evals agentic em evolução",
            "5": "security/compliance enterprise maduros",
            "6": "SaaS global; custo/licenciamento Salesforce",
            "7": "forte em serviços/CRM; chão de fábrica via parceiros",
            "sintese": "plataforma de agentes centrada em CRM/customer 360",
        },
    },
    "e05": {
        "short": "AWS Bedrock AgentCore",
        "fonte": "https://aws.amazon.com/bedrock/agentcore/",
        "pillars": {
            "1": "integração AWS ampla; conectores industriais via partners/IoT",
            "2": "AgentCore para runtime/orquestração de agentes",
            "3": "IAM/Guardrails Bedrock; HITL via Step Functions/apps",
            "4": "CloudWatch/X-Ray; evals Bedrock em evolução",
            "5": "IAM, KMS, compliance AWS",
            "6": "escala cloud nativa; FinOps necessário",
            "7": "OT via IoT SiteWise/partners — não MES nativo",
            "sintese": "runtime/cloud de agentes na AWS",
        },
    },
    "e06": {
        "short": "Vertex AI Agent Builder",
        "fonte": "https://cloud.google.com/products/agent-builder",
        "pillars": {
            "1": "Search/Agent Builder + conectores GCP; industrial via partners",
            "2": "Agent Development Kit / Agent Engine",
            "3": "safety filters e VPC-SC",
            "4": "Vertex Evaluation / monitoring",
            "5": "IAM e controles GCP",
            "6": "escala GCP; custo por uso",
            "7": "manufacturing solutions existem; OT profundo via SI",
            "sintese": "builder/runtime de agentes no Google Cloud",
        },
    },
    "e07": {
        "short": "Copilot Studio + Azure AI",
        "fonte": "https://www.microsoft.com/microsoft-copilot/microsoft-copilot-studio",
        "pillars": {
            "1": "conectores Power Platform + Azure; forte ERP/CRM Microsoft",
            "2": "Copilot Studio / Azure AI Foundry para agentes",
            "3": "Purview, DLP, enterprise auth",
            "4": "analytics Power Platform; evals agentic em evolução",
            "5": "Entra ID, Purview, compliance Microsoft",
            "6": "ecossistema M365/Azure maduro",
            "7": "Factory/Manufacturing Copilot + parceiros OT",
            "sintese": "suite Microsoft de copilots/agentes empresariais",
        },
    },
    "e08": {
        "short": "IBM watsonx Orchestrate",
        "fonte": "https://www.ibm.com/products/watsonx-orchestrate",
        "pillars": {
            "1": "conectores IBM/enterprise; Maximo ajuda no industrial",
            "2": "orquestração de assistentes/agentes watsonx",
            "3": "governança watson.governance",
            "4": "monitoramento IBM; evals formais variáveis",
            "5": "segurança enterprise IBM",
            "6": "cloud/hybrid IBM",
            "7": " fortaleza com Maximo/asset; MES depende do stack",
            "sintese": "orquestração de agentes/assistentes IBM watsonx",
        },
    },
    "e09": {
        "short": "ServiceNow AI Agents",
        "fonte": "https://www.servicenow.com/products/ai-agents.html",
        "pillars": {
            "1": "CMDB/ITSM como contexto; OT via integrações",
            "2": "Now Assist / AI Agents no workflow Now Platform",
            "3": "workflow approvals nativos",
            "4": "Performance Analytics; evals agentic emergentes",
            "5": "controles enterprise ServiceNow",
            "6": "SaaS maduro para IT/ESM",
            "7": "forte em operações de serviço; chão de fábrica indireto",
            "sintese": "agentes sobre workflow/ITSM ServiceNow",
        },
    },
    "e10": {
        "short": "UiPath Agentic Automation",
        "fonte": "https://www.uipath.com/platform/agentic-automation",
        "pillars": {
            "1": "UI/API automation ampla; conectores industriais parciais",
            "2": "orquestração RPA + agentes",
            "3": "Action Center HITL maduro",
            "4": "Insights/Process Mining; evals agentic em evolução",
            "5": "controles de automação enterprise",
            "6": "robots/orquestrador com custo operacional",
            "7": "automação de processos; OT nativo limitado",
            "sintese": "RPA + agentic automation UiPath",
        },
    },
    "e11": {
        "short": "LangGraph",
        "fonte": "https://www.langchain.com/langgraph",
        "pillars": {
            "1": "você monta conectores; sem catálogo industrial pronto",
            "2": "grafos/estado excelentes para orquestração custom",
            "3": "guardrails/HITL a implementar",
            "4": "LangSmith ajuda; resto é build",
            "5": "segurança é responsabilidade do deployer",
            "6": "flexível; ops/SRE a cargo do time",
            "7": "sem domínio industrial embutido",
            "sintese": "framework open de grafos de agentes (LangChain)",
        },
    },
    "e12": {
        "short": "CrewAI",
        "fonte": "https://www.crewai.com/",
        "pillars": {
            "1": "tools/crews; industrial = custom",
            "2": "multi-agent crews/flows",
            "3": "governança enterprise ainda em construção",
            "4": "observability via plataforma CrewAI; incompleta vs enterprise",
            "5": "controles básicos / cloud Crew",
            "6": "rápido para protótipo; escala enterprise variável",
            "7": "sem stack OT nativa",
            "sintese": "framework multi-agente crews",
        },
    },
    "e13": {
        "short": "Juna Agentic Factory OS",
        "fonte": "https://www.juna.ai/",
        "pillars": {
            "1": "proposição centrada em factory/contexto industrial",
            "2": "orquestração de agentes de fábrica",
            "3": "governança industrial declarada; maturidade a validar em POC",
            "4": "ops de fábrica; evals formais a confirmar",
            "5": "controles industriais — validar em ambiente real",
            "6": "OS de fábrica; footprint a avaliar",
            "7": "alinhamento forte a chão de fábrica vs suites genéricas",
            "sintese": "OS agentic focado em fábrica",
        },
    },
    "e14": {
        "short": "Siemens Intelligence Center X",
        "fonte": "https://news.siemens.com/en-gb/siemens-intelligence-center-x/",
        "pillars": {
            "1": "Graph Studio + ontologias industriais + RapidMiner/AI Studio; dados OT/IT Siemens",
            "2": "orquestra pessoas e agentes com Mendix; Industrial Copilot/Eigen no ecossistema",
            "3": "auditabilidade e policy controls declarados para produção",
            "4": "lifecycle intelligence; evals industriais ainda a amadurecer no mercado",
            "5": "governança Siemens/Xcelerator para hybrid workforce",
            "6": "deploy layered/standalone/agentic; footprint Siemens enterprise",
            "7": "forte nativo industrial (TIA, Insights Hub, Operations Copilot)",
            "sintese": "orquestração industrial de agentes + low-code (Mendix/Graph/AI Studio)",
        },
    },
    "e15": {
        "short": "Cognite Data Fusion + Atlas AI",
        "fonte": "https://www.cognite.com/en/product/atlas",
        "pillars": {
            "1": "Industrial Knowledge Graph + contextualização CDF — referência de domínio",
            "2": "Atlas AI low-code agent builder + templates industriais",
            "3": "herança de ACL/CDF; confirmação de tools; alinhamento EU AI Act declarado",
            "4": "eval harness Atlas; monitoramento operacional CDF",
            "5": "security/sovereignty clusters Cognite",
            "6": "DataOps industrial maduro; agentes sobre CDF",
            "7": "asset-heavy (O&G, energy, manufacturing) com 3D/séries temporais",
            "sintese": "DataOps industrial + workbench de agentes Atlas AI",
        },
    },
    "e16": {
        "short": "AVEVA PI / Connect + AI",
        "fonte": "https://www.aveva.com/",
        "pillars": {
            "1": "PI System/historians e Connect fortes; agentes GenAI emergentes",
            "2": "orquestração agentic menos madura que Cognite/Siemens ICX",
            "3": "governança industrial tradicional; HITL agentic parcial",
            "4": "analytics/ops PI; evals de agentes limitados",
            "5": "controles OT/enterprise AVEVA",
            "6": "instalado em escala global OT",
            "7": "excelente em dados de processo/ops; agent fabric ainda parcial",
            "sintese": "stack OT/dados industriais AVEVA com AI em expansão",
        },
    },
    "e17": {
        "short": "Palantir AIP (Foundry)",
        "fonte": "https://www.palantir.com/platforms/aip/",
        "pillars": {
            "1": "ontologia Foundry + pipelines; conectores enterprise/OT via integração",
            "2": "AIP Agents / Workshop para ações e orquestração",
            "3": "controle de ações, aprovações e audit trails fortes",
            "4": "observabilidade de pipelines/ações; evals custom",
            "5": "segurança/gov Foundry enterprise",
            "6": "plataforma pesada; ROI em programas transformacionais",
            "7": "casos manufacturing/defense/energy; não MES clássico out-of-box",
            "sintese": "plataforma ontológica + AIP para agentes/ações enterprise",
        },
    },
    "e18": {
        "short": "AspenTech Industrial AI",
        "fonte": "https://www.aspentech.com/",
        "pillars": {
            "1": "modelos de processo/inmation; contexto de planta de processo",
            "2": "assistentes/otimização; agent fabric genérico limitado",
            "3": "governança de modelos de engenharia; HITL típico de APC",
            "4": "performance de processo; evals LLM parciais",
            "5": "controles industriais Aspen",
            "6": "instalado em process industries",
            "7": "forte em processo contínuo; discrete/MES variável",
            "sintese": "AI/otimização para indústrias de processo",
        },
    },
    "e19": {
        "short": "Rockwell FactoryTalk + AI",
        "fonte": "https://www.rockwellautomation.com/",
        "pillars": {
            "1": "FactoryTalk Hub/dados de automação; integração OT nativa Rockwell",
            "2": "copilots/AI em evolução no portfolio; menos control plane multi-vendor",
            "3": "segurança de automação industrial; agent governance parcial",
            "4": "FactoryTalk Analytics; evals agentic emergentes",
            "5": "controles OT Rockwell",
            "6": "footprint em discrete manufacturing",
            "7": "MES/automação Rockwell fortes; agentes ainda não são o core",
            "sintese": "automação/MES Rockwell com camada AI em expansão",
        },
    },
    "e20": {
        "short": "GE Vernova Proficy",
        "fonte": "https://www.gevernova.com/software/proficy",
        "pillars": {
            "1": "Proficy/Manufacturing Data Fabric; historiadores e contexto de planta",
            "2": "AI/analytics GE Vernova; orquestração agentic genérica parcial",
            "3": "ops industriais; guardrails agentic limitados vs AIP/ICX",
            "4": "monitoring industrial; evals LLM parciais",
            "5": "segurança industrial GE Vernova",
            "6": "software industrial instalado",
            "7": "forte em manufacturing ops/HMI/MES",
            "sintese": "suite manufacturing ops Proficy + AI industrial",
        },
    },
}

# Per-vendor coverage overrides for signature items (rest derived from pillar defaults)
PILLAR_DEFAULTS: dict[str, dict[str, str]] = {
    # id -> {pilar: default cobertura for Expectativa/Avançado}
    "e14": {  # Siemens ICX — industrial orchestration leader
        "1": "Tem",
        "2": "Tem",
        "3": "Tem",
        "4": "Parcial",
        "5": "Tem",
        "6": "Parcial",
        "7": "Tem",
    },
    "e15": {  # Cognite — data/context king
        "1": "Tem",
        "2": "Tem",
        "3": "Parcial",
        "4": "Parcial",
        "5": "Tem",
        "6": "Tem",
        "7": "Tem",
    },
    "e16": {
        "1": "Tem",
        "2": "Parcial",
        "3": "Parcial",
        "4": "Parcial",
        "5": "Parcial",
        "6": "Tem",
        "7": "Tem",
    },
    "e17": {
        "1": "Tem",
        "2": "Tem",
        "3": "Tem",
        "4": "Parcial",
        "5": "Tem",
        "6": "Parcial",
        "7": "Parcial",
    },
    "e18": {
        "1": "Parcial",
        "2": "Parcial",
        "3": "Parcial",
        "4": "Parcial",
        "5": "Parcial",
        "6": "Parcial",
        "7": "Tem",
    },
    "e19": {
        "1": "Parcial",
        "2": "Parcial",
        "3": "Parcial",
        "4": "Parcial",
        "5": "Parcial",
        "6": "Parcial",
        "7": "Tem",
    },
    "e20": {
        "1": "Parcial",
        "2": "Parcial",
        "3": "Parcial",
        "4": "Parcial",
        "5": "Parcial",
        "6": "Parcial",
        "7": "Tem",
    },
}

# item-level overrides (cobertura)
ITEM_OVERRIDES: dict[str, dict[str, str]] = {
    "e14": {
        "1.A1": "Tem",
        "1.A2": "Tem",
        "1.A5": "Tem",
        "2.A1": "Tem",
        "3.A1": "Tem",
        "4.A2": "Parcial",
        "5.A1": "Tem",
        "6.A3": "Parcial",
        "7.A1": "Tem",
        "7.1": "Tem",
    },
    "e15": {
        "1.1": "Parcial",  # connectors via CDF/extractors, not classic iPaaS catalog
        "1.A1": "Tem",
        "1.A2": "Tem",
        "1.A3": "Tem",
        "1.A4": "Tem",
        "1.A5": "Tem",
        "2.A3": "Tem",
        "4.1": "Parcial",
        "7.A2": "Tem",
    },
    "e16": {
        "1.A1": "Parcial",
        "1.A2": "Parcial",
        "2.1": "Parcial",
        "2.A1": "Não tem",
        "7.1": "Tem",
        "7.A1": "Tem",
    },
    "e17": {
        "1.A1": "Tem",
        "1.A2": "Parcial",
        "2.A1": "Tem",
        "3.1": "Tem",
        "3.A1": "Tem",
        "5.A1": "Tem",
        "7.A1": "Parcial",
    },
    "e18": {
        "1.A2": "Tem",
        "2.A1": "Não tem",
        "7.2": "Tem",
        "7.A3": "Tem",
    },
    "e19": {
        "1.2": "Tem",
        "2.A1": "Não tem",
        "7.1": "Tem",
        "7.3": "Tem",
    },
    "e20": {
        "1.2": "Tem",
        "1.3": "Tem",
        "2.A1": "Não tem",
        "7.1": "Tem",
        "7.A1": "Tem",
    },
}

NEW_EMPRESAS = [
    {
        "id": "e14",
        "nome": "Siemens Intelligence Center X",
        "setor": "Industrial AI / OT-IT orchestration",
        "porte": "Enterprise",
        "regiao": "Global",
        "uf": "DE",
        "funcionarios": 300000,
        "faturamentoMiBrl": 400000.0,
        "maturidade": "líder",
        "ano": 2026,
        "fonte_url": VENDOR_CTX["e14"]["fonte"],
        "notas": "Intelligence Center X: Mendix + Graph Studio + AI Studio; orquestra pessoas e agentes industriais.",
    },
    {
        "id": "e15",
        "nome": "Cognite Data Fusion + Atlas AI",
        "setor": "Industrial DataOps / Agents",
        "porte": "Enterprise",
        "regiao": "Global",
        "uf": "NO",
        "funcionarios": 2000,
        "faturamentoMiBrl": 2500.0,
        "maturidade": "líder",
        "ano": 2026,
        "fonte_url": VENDOR_CTX["e15"]["fonte"],
        "notas": "CDF knowledge graph + Atlas AI low-code industrial agents.",
    },
    {
        "id": "e16",
        "nome": "AVEVA PI / Connect + AI",
        "setor": "Industrial software / OT data",
        "porte": "Enterprise",
        "regiao": "Global",
        "uf": "GB",
        "funcionarios": 6500,
        "faturamentoMiBrl": 8000.0,
        "maturidade": "avançada",
        "ano": 2026,
        "fonte_url": VENDOR_CTX["e16"]["fonte"],
        "notas": "Historiadores PI e Connect; camada GenAI/agentes ainda emergente vs ICX/Cognite.",
    },
    {
        "id": "e17",
        "nome": "Palantir AIP (Foundry)",
        "setor": "Ontology / Decision platform",
        "porte": "Enterprise",
        "regiao": "Global",
        "uf": "US",
        "funcionarios": 4000,
        "faturamentoMiBrl": 15000.0,
        "maturidade": "líder",
        "ano": 2026,
        "fonte_url": VENDOR_CTX["e17"]["fonte"],
        "notas": "Foundry ontology + AIP agents/ações com forte governança de decisões.",
    },
    {
        "id": "e18",
        "nome": "AspenTech Industrial AI",
        "setor": "Process industries / APC",
        "porte": "Enterprise",
        "regiao": "Global",
        "uf": "US",
        "funcionarios": 4000,
        "faturamentoMiBrl": 6000.0,
        "maturidade": "avançada",
        "ano": 2026,
        "fonte_url": VENDOR_CTX["e18"]["fonte"],
        "notas": "Modelos de processo e otimização; agent fabric genérico limitado.",
    },
    {
        "id": "e19",
        "nome": "Rockwell FactoryTalk + AI",
        "setor": "Discrete automation / MES",
        "porte": "Enterprise",
        "regiao": "Global",
        "uf": "US",
        "funcionarios": 26000,
        "faturamentoMiBrl": 45000.0,
        "maturidade": "avançada",
        "ano": 2026,
        "fonte_url": VENDOR_CTX["e19"]["fonte"],
        "notas": "FactoryTalk/automação; AI/copilots em expansão, control plane agentic parcial.",
    },
    {
        "id": "e20",
        "nome": "GE Vernova Proficy",
        "setor": "Manufacturing ops / HMI-MES",
        "porte": "Enterprise",
        "regiao": "Global",
        "uf": "US",
        "funcionarios": 75000,
        "faturamentoMiBrl": 80000.0,
        "maturidade": "avançada",
        "ano": 2026,
        "fonte_url": VENDOR_CTX["e20"]["fonte"],
        "notas": "Proficy manufacturing software + AI industrial; orquestração agentic genérica parcial.",
    },
]

# Advanced items slightly harder unless overridden
ADVANCED_DOWNGRADE = {
    "Tem": "Parcial",
    "Parcial": "Não tem",
    "Não tem": "Não tem",
}


def roadmap_for(cob: str) -> str:
    return {"Tem": "Feito", "Parcial": "Em curso", "Não tem": "Backlog", "—": "—"}.get(
        cob, "—"
    )


def decisao_for(cob: str, vendor_id: str) -> str:
    buildish = vendor_id in {"e02", "e03", "e11", "e12"}
    if cob == "Tem":
        return "Construir" if buildish else "Comprar"
    if cob == "Parcial":
        return "Híbrido"
    if cob == "Não tem":
        return "Construir" if buildish else "Adiar"
    return "—"


def comentario_for(
    vendor_id: str, item: dict, cob: str, roadmap: str, decisao: str
) -> str:
    ctx = VENDOR_CTX.get(vendor_id, {})
    short = ctx.get("short", vendor_id)
    pilar = str(item["pilar"])
    pillar_note = ctx.get("pillars", {}).get(pilar, "posicionamento público limitado")
    texto = item["texto"]
    if item["tipo"] == "Inventario" or pilar == "sintese":
        fonte = ctx.get("fonte", "")
        return (
            f"{short}: item de inventário organizacional — preenchimento depende do cliente. "
            f"Contexto do produto: {pillar_note}. "
            f"Fonte pública: {fonte}"
        ).strip()

    if cob == "Tem":
        why = (
            f"Cobertura Tem porque há evidência/posicionamento público de capacidade alinhada a "
            f"«{texto}». No pilar, {pillar_note}."
        )
    elif cob == "Parcial":
        why = (
            f"Cobertura Parcial: há peças úteis para «{texto}», mas falta profundidade nativa, "
            f"madureza agentic ou exige integração/customização. No pilar, {pillar_note}."
        )
    elif cob == "Não tem":
        why = (
            f"Cobertura Não tem: não há evidência clara de suporte nativo a «{texto}» "
            f"(gap típico do posicionamento atual). No pilar, {pillar_note}."
        )
    else:
        why = f"Sem nota de cobertura para «{texto}»."

    return (
        f"{why} Roadmap «{roadmap}» e decisão «{decisao}» refletem se a lacuna deve ser "
        f"comprada, construída ou hibridizada com {short}. "
        f"Avaliação heurística com base em materiais públicos — validar em POC."
    )


def summarize(rows: list[dict]) -> dict:
    platform = [r for r in rows if r["pilar"] != "sintese"]
    tem = sum(1 for r in platform if r["cobertura"] == "Tem")
    parcial = sum(1 for r in platform if r["cobertura"] == "Parcial")
    nao = sum(1 for r in platform if r["cobertura"] == "Não tem")
    media = sum(r["score"] for r in platform) / len(platform) if platform else 0.0
    return {
        "coberturaMedia": round(media, 4),
        "itensTem": tem,
        "itensParcial": parcial,
        "itensNaoTem": nao,
        "decisaoComprar": sum(1 for r in platform if r["decisao"] == "Comprar"),
        "decisaoConstruir": sum(1 for r in platform if r["decisao"] == "Construir"),
        "decisaoHibrido": sum(1 for r in platform if r["decisao"] == "Híbrido"),
    }


def coverage_for_new(vendor_id: str, item: dict) -> str:
    if item["pilar"] == "sintese" or item["tipo"] == "Inventario":
        return "—"
    overrides = ITEM_OVERRIDES.get(vendor_id, {})
    if item["id"] in overrides:
        return overrides[item["id"]]
    pilar = str(item["pilar"])
    cob = PILLAR_DEFAULTS[vendor_id][pilar]
    if item["tipo"] == "Avançado" and item["id"] not in overrides:
        # soften advanced unless pillar is Tem and we want some advanced Tem
        if cob == "Tem" and item["id"].endswith(("A1", "A2")):
            return "Tem"
        return ADVANCED_DOWNGRADE.get(cob, cob)
    return cob


def build_rows_for_new(vendor_id: str, items: list[dict]) -> list[dict]:
    rows = []
    for item in items:
        cob = coverage_for_new(vendor_id, item)
        rm = roadmap_for(cob)
        dec = decisao_for(cob, vendor_id)
        if cob == "—":
            rm, dec = "—", "—"
        resposta = ""
        if item["pilar"] == "sintese":
            resposta = f"Fonte: {VENDOR_CTX[vendor_id]['fonte']}"
        rows.append(
            {
                "itemId": item["id"],
                "pilar": item["pilar"],
                "tipo": item["tipo"],
                "texto": item["texto"],
                "cobertura": cob,
                "score": SCORE.get(cob, 0.0),
                "roadmap": rm,
                "decisao": dec,
                "resposta": resposta,
                "comentario": comentario_for(vendor_id, item, cob, rm, dec),
            }
        )
    return rows


def enrich_existing_row(vendor_id: str, row: dict, items_by_id: dict) -> dict:
    item = items_by_id.get(
        row["itemId"],
        {
            "id": row["itemId"],
            "pilar": row["pilar"],
            "tipo": row["tipo"],
            "texto": row["texto"],
        },
    )
    cob = row["cobertura"]
    rm = row["roadmap"]
    dec = row["decisao"]
    out = dict(row)
    out["comentario"] = comentario_for(vendor_id, item, cob, rm, dec)
    if not out.get("resposta") and str(row["pilar"]) == "sintese":
        fonte = VENDOR_CTX.get(vendor_id, {}).get("fonte")
        if fonte:
            out["resposta"] = f"Fonte: {fonte}"
    return out


def write_csvs(dataset: dict, empresas_meta: list[dict]) -> None:
    NAO_DATA.mkdir(parents=True, exist_ok=True)
    meta_by_id = {e["id"]: e for e in empresas_meta}

    with (NAO_DATA / "empresas.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(
            [
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
                "fonte_url",
                "notas",
            ]
        )
        for e in dataset["empresas"]:
            m = meta_by_id.get(e["id"], {})
            w.writerow(
                [
                    e["id"],
                    e["nome"],
                    e["setor"],
                    e["porte"],
                    e["regiao"],
                    e["uf"],
                    e["funcionarios"],
                    e["faturamentoMiBrl"],
                    e["maturidade"],
                    e["ano"],
                    m.get("fonte_url", VENDOR_CTX.get(e["id"], {}).get("fonte", "")),
                    m.get("notas", ""),
                ]
            )

    with (NAO_DATA / "avaliacoes.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(
            [
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
                "comentario",
            ]
        )
        emp = {e["id"]: e for e in dataset["empresas"]}
        for eid, rows in dataset["avaliacoes"].items():
            e = emp[eid]
            for a in rows:
                w.writerow(
                    [
                        a["itemId"],
                        a["pilar"],
                        a["tipo"],
                        a["texto"],
                        eid,
                        e["nome"],
                        e["setor"],
                        e["porte"],
                        e["regiao"],
                        e["maturidade"],
                        a["cobertura"],
                        a["score"],
                        a["roadmap"],
                        a["decisao"],
                        a.get("resposta", ""),
                        a.get("comentario", ""),
                    ]
                )

    with (NAO_DATA / "empresa_resumo.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(
            [
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
        )
        for e in dataset["empresas"]:
            w.writerow(
                [
                    e["id"],
                    e["nome"],
                    e["setor"],
                    e["porte"],
                    e["regiao"],
                    e["maturidade"],
                    e["coberturaMedia"],
                    e["itensTem"],
                    e["itensParcial"],
                    e["itensNaoTem"],
                    e["itensNaoTem"],
                    e["decisaoComprar"],
                    e["decisaoConstruir"],
                    e["decisaoHibrido"],
                ]
            )


def main() -> None:
    items = json.loads(ITEMS_JSON.read_text(encoding="utf-8"))
    items_by_id = {i["id"]: i for i in items}
    data = json.loads(WEB_JSON.read_text(encoding="utf-8"))

    # Enrich existing
    for eid, rows in list(data["avaliacoes"].items()):
        data["avaliacoes"][eid] = [
            enrich_existing_row(eid, r, items_by_id) for r in rows
        ]

    # Meta for CSV (existing + new)
    empresas_meta = []
    for e in data["empresas"]:
        empresas_meta.append(
            {
                "id": e["id"],
                "fonte_url": VENDOR_CTX.get(e["id"], {}).get("fonte", ""),
                "notas": "",
            }
        )

    existing_ids = {e["id"] for e in data["empresas"]}
    for neo in NEW_EMPRESAS:
        if neo["id"] in existing_ids:
            continue
        rows = build_rows_for_new(neo["id"], items)
        stats = summarize(rows)
        empresa = {
            "id": neo["id"],
            "nome": neo["nome"],
            "setor": neo["setor"],
            "porte": neo["porte"],
            "regiao": neo["regiao"],
            "uf": neo["uf"],
            "funcionarios": neo["funcionarios"],
            "faturamentoMiBrl": neo["faturamentoMiBrl"],
            "maturidade": neo["maturidade"],
            "ano": neo["ano"],
            **stats,
        }
        data["empresas"].append(empresa)
        data["avaliacoes"][neo["id"]] = rows
        empresas_meta.append(
            {
                "id": neo["id"],
                "fonte_url": neo["fonte_url"],
                "notas": neo["notas"],
            }
        )

    data["empresas"].sort(key=lambda e: e["id"])
    data["generatedAt"] = "2026-07-25"

    WEB_JSON.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    write_csvs(data, empresas_meta)

    print(f"empresas={len(data['empresas'])}")
    for e in data["empresas"]:
        print(
            f"  {e['id']} {e['nome'][:42]:42} {e['coberturaMedia']*100:5.1f}% "
            f"T{e['itensTem']}/P{e['itensParcial']}/N{e['itensNaoTem']}"
        )
    # sanity: comentarios present
    sample = data["avaliacoes"]["e14"][0]
    print("sample comentario e14", sample["itemId"], sample["comentario"][:120], "...")


if __name__ == "__main__":
    main()
