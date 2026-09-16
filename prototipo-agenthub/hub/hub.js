/* Telas da IA que não existem no bundle Figma. */
(function () {
  const NATIVE = new Set(["/", "/agents", "/registry", "/catalog", "/playground", "/pipelines", "/costs", "/governance", "/leaderboard", "/changelog", "/settings"]);
  const AREAS = ["Manutenção", "Qualidade", "Produção", "Engenharia", "Energia", "Supply Chain", "Segurança", "Corporativo"];

  const MARKET = [
    { id: "m1", name: "Agente de Triagem/Supervisor", desc: "Classifica chamados e encaminha para o especialista.", owner: "Murilo Silva", type: "Agente", area: "Manutenção", version: "2.4.1", rating: 4.8, uses: 1580, status: "Aprovado", compat: "Bedrock · MCP", deps: "Skill Triagem, Tool SAP PM" },
    { id: "m2", name: "Skill de criticidade MRO", desc: "Calcula criticidade de material a partir de falha e estoque.", owner: "PCM Vivix", type: "Skill", area: "Manutenção", version: "1.3.0", rating: 4.6, uses: 890, status: "Aprovado", compat: "Claude · GPT", deps: "Snowflake MRO" },
    { id: "m3", name: "MCP SAP PM", desc: "Ordens, notas e histórico de equipamento.", owner: "Integrações", type: "MCP Server", area: "Manutenção", version: "1.1.2", rating: 4.5, uses: 640, status: "Aprovado", compat: "MCP 2025-03", deps: "VPN SAP" },
    { id: "m4", name: "Tool consulta Snowflake", desc: "Query governada em tabelas de processo e qualidade.", owner: "Dados", type: "Tool", area: "Qualidade", version: "3.0.0", rating: 4.7, uses: 1120, status: "Aprovado", compat: "Warehouse PRD", deps: "Role ANALYTICS_RO" },
    { id: "m5", name: "Pipeline ordem automática", desc: "Evento SAP → agente → Snowflake → aprovação → ordem.", owner: "Aristóteles N.", type: "Pipeline", area: "Manutenção", version: "0.9.2", rating: 4.4, uses: 210, status: "Em governança", compat: "Pipelines v1", deps: "MCP SAP PM, Skill criticidade" },
    { id: "m6", name: "Template agente de qualidade", desc: "Ponto de partida para tonalidade, bolha e defeito.", owner: "Qualidade", type: "Template", area: "Qualidade", version: "1.0.4", rating: 4.3, uses: 76, status: "Aprovado", compat: "AgentHub", deps: "Nenhuma" },
    { id: "m7", name: "Agente de energia por forno", desc: "Anomalia de kWh/t e recomendação de setpoint.", owner: "Energia", type: "Agente", area: "Energia", version: "1.2.0", rating: 4.2, uses: 154, status: "Aprovado", compat: "Bedrock", deps: "IoT MQTT" },
    { id: "m8", name: "Skill aprovação humana", desc: "Pausa o fluxo e pede gate do responsável.", owner: "Governança", type: "Skill", area: "Corporativo", version: "2.0.1", rating: 4.9, uses: 980, status: "Aprovado", compat: "Pipelines", deps: "Política G-12" }
  ];

  const CAPS = [
    { name: "MCP SAP PM", type: "MCP Server", owner: "Integrações", env: "PRD", version: "1.1.2", status: "Governado" },
    { name: "MCP Snowflake", type: "MCP Server", owner: "Dados", env: "PRD", version: "2.0.0", status: "Governado" },
    { name: "create_order", type: "Tool", owner: "SAP", env: "HML", version: "0.8.0", status: "Em revisão" },
    { name: "query_mro", type: "Tool", owner: "Dados", env: "PRD", version: "3.0.0", status: "Governado" },
    { name: "Criticidade MRO", type: "Skill", owner: "PCM", env: "PRD", version: "1.3.0", status: "Governado" },
    { name: "Triagem de chamado", type: "Skill", owner: "Manutenção", env: "PRD", version: "2.1.0", status: "Governado" },
    { name: "Conector e-mail corporativo", type: "Integração", owner: "TI", env: "PRD", version: "1.0.0", status: "Governado" },
    { name: "Base BOM float", type: "Conhecimento", owner: "Engenharia", env: "PRD", version: "2026.08", status: "Governado" },
    { name: "Prompt supervisor PCM", type: "Prompt", owner: "Aristóteles N.", env: "PRD", version: "1.6", status: "Governado" }
  ];

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  function pathNow() {
    return location.pathname.replace(/\/+$/, "") || "/";
  }

  function isNative(p) {
    if (NATIVE.has(p)) return true;
    if (/^\/agents\/[^/]+$/.test(p)) return true;
    if (/^\/pipelines\/[^/]+$/.test(p)) return true;
    return false;
  }

  function go(href) {
    const router = window.__reactRouterDataRouter;
    if (router) router.navigate(href);
    else location.assign(href);
  }

  function toast(msg) {
    const t = document.createElement("div");
    t.textContent = msg;
    t.style.cssText = "position:fixed;bottom:20px;right:20px;background:#005751;color:#fff;padding:10px 14px;border-radius:4px;z-index:9999;font-size:13px";
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2200);
  }

  function pageMeta(p) {
    const map = {
      "/activity": ["Início", "Minha Atividade", "O que pediu, o que rodou e o que espera você."],
      "/favorites": ["Início", "Favoritos", "Agentes, pipelines e assets que você fixou."],
      "/recent": ["Início", "Recentes", "Últimos itens abertos neste workspace."],
      "/create-agent": ["Agentes", "Criar Agente", "Defina o recorte, a área e o ponto de partida."],
      "/agent-templates": ["Agentes", "Templates de Agentes", "Comece de um recorte já usado na planta."],
      "/create-pipeline": ["Pipelines", "Criar Pipeline", "Monte o fluxo: agentes, skills, tools, MCP, decisões e aprovações."],
      "/pipeline-runs": ["Pipelines", "Execuções", "Corridas das esteiras — sucesso, espera e erro."],
      "/pipeline-schedules": ["Pipelines", "Agendamentos", "Gatilhos por hora, evento SAP ou fila."],
      "/pipeline-templates": ["Pipelines", "Templates de Pipelines", "Esteiras aprovadas para copiar ao workspace."],
      "/capabilities": ["Capacidades", "Catálogo de Capacidades", "Inventário técnico e governado dos componentes da plataforma."],
      "/capabilities/tools": ["Capacidades", "Tools", "Ferramentas invocáveis pelos agentes, com dono e ambiente."],
      "/capabilities/skills": ["Capacidades", "Skills", "Capacidades reutilizáveis, versionadas e com política."],
      "/capabilities/integrations": ["Capacidades", "Integrações", "Conexões de sistema — não é vitrine, é inventário."],
      "/capabilities/knowledge": ["Capacidades", "Conhecimento", "Bases e documentos ligados a um agente ou pipeline."],
      "/capabilities/prompts": ["Capacidades", "Prompts", "Instruções versionadas, com owner e ambiente."],
      "/marketplace": ["Marketplace", "Explorar", "Descoberta e reúso de ativos aprovados — diferente do catálogo técnico."],
      "/marketplace/agents": ["Marketplace", "Agentes", "Agentes publicados para o workspace."],
      "/marketplace/skills": ["Marketplace", "Skills", "Skills aprovadas para instalar."],
      "/marketplace/tools": ["Marketplace", "Tools", "Tools publicadas para conectar."],
      "/marketplace/mcp": ["Marketplace", "MCP Servers", "Servidores MCP prontos para o workspace."],
      "/marketplace/templates": ["Marketplace", "Templates", "Pontos de partida de agente e pipeline."],
      "/marketplace/pipelines": ["Marketplace", "Pipelines", "Esteiras publicadas como template."],
      "/marketplace/areas": ["Marketplace", "Soluções por Área", "Pacotes por domínio da planta."],
      "/ops": ["Operações", "Central de Operações", "O que está rodando, o que espera e o que quebrou."],
      "/ops/runs": ["Operações", "Execuções", "Todas as corridas de agente e pipeline."],
      "/ops/observability": ["Operações", "Observabilidade", "Latência, erro e saturação — sem orquestrar deploy."],
      "/ops/logs": ["Operações", "Logs & Traces", "Trilha de uma execução, passo a passo."],
      "/ops/incidents": ["Operações", "Incidentes", "Abertos a partir de saúde e governança."],
      "/ops/approvals": ["Operações", "Aprovações", "Gates humanos. Nada executa enquanto espera."],
      "/ops/agents-health": ["Operações", "Saúde dos Agentes", "Erro, latência e satisfação por agente."],
      "/ops/pipelines-health": ["Operações", "Saúde dos Pipelines", "Esteiras presas, etapas sem agente, falha de tool."],
      "/results": ["Resultados", "Performance", "Como a frota performa no período."],
      "/results/roi": ["Resultados", "ROI", "Retorno das esteiras e agentes em operação."],
      "/results/adoption": ["Resultados", "Adoção", "Quem usa, em qual área, com qual frequência."],
      "/results/value": ["Resultados", "Valor Gerado", "Valor reconhecido — não só custo evitado."],
      "/governance/policies": ["Administração", "Políticas & Guardrails", "O que a plataforma bloqueia antes de promover."],
      "/admin/users": ["Administração", "Usuários & Times", "Quem entra em qual time e workspace."],
      "/admin/permissions": ["Administração", "Permissões", "Papéis de operação, edição e governança."],
      "/admin/environments": ["Administração", "Ambientes", "DEV, HML e PRD — promoção passa por gate."]
    };
    return map[p] || ["AgentHub", "Página", ""];
  }

  function marketFilter(p) {
    if (p.endsWith("/agents")) return (i) => i.type === "Agente";
    if (p.endsWith("/skills")) return (i) => i.type === "Skill";
    if (p.endsWith("/tools")) return (i) => i.type === "Tool";
    if (p.endsWith("/mcp")) return (i) => i.type === "MCP Server";
    if (p.endsWith("/templates")) return (i) => i.type === "Template";
    if (p.endsWith("/pipelines")) return (i) => i.type === "Pipeline";
    return () => true;
  }

  function capFilter(p) {
    if (p.endsWith("/tools")) return (i) => i.type === "Tool";
    if (p.endsWith("/skills")) return (i) => i.type === "Skill";
    if (p.endsWith("/integrations")) return (i) => i.type === "Integração";
    if (p.endsWith("/knowledge")) return (i) => i.type === "Conhecimento";
    if (p.endsWith("/prompts")) return (i) => i.type === "Prompt";
    return () => true;
  }

  function marketActions(item) {
    if (item.type === "Skill") return ["Instalar Skill", "Usar como template"];
    if (item.type === "Tool") return ["Conectar Tool", "Adicionar ao workspace"];
    if (item.type === "Agente") return ["Adicionar ao workspace", "Criar agente a partir do ativo"];
    if (item.type === "Pipeline" || item.type === "Template") return ["Usar como template", "Criar pipeline a partir do template"];
    return ["Adicionar ao workspace"];
  }

  function renderMarket(p, area) {
    const rows = MARKET.filter(marketFilter(p)).filter((i) => !area || i.area === area);
    return `
      <div class="vx-note">Marketplace é descoberta e reúso. O inventário técnico fica em Capacidades.</div>
      <div class="vx-filters" data-areas>
        <button class="${!area ? "is-on" : ""}" data-area="">Todas as áreas</button>
        ${AREAS.map((a) => `<button class="${area === a ? "is-on" : ""}" data-area="${esc(a)}">${esc(a)}</button>`).join("")}
      </div>
      <div class="vx-cards">${rows.map((i) => `
        <article class="vx-card">
          <div class="vx-meta"><span class="vx-tag vx-tag-teal">${esc(i.type)}</span><span class="vx-tag">${esc(i.area)}</span><span class="vx-tag ${i.status === "Aprovado" ? "vx-tag-ok" : "vx-tag-warn"}">${esc(i.status)}</span></div>
          <h3>${esc(i.name)}</h3>
          <p>${esc(i.desc)}</p>
          <p>Owner ${esc(i.owner)} · v${esc(i.version)} · ★ ${i.rating} · ${i.uses} usos</p>
          <p>Compatível: ${esc(i.compat)} · Depende de: ${esc(i.deps)}</p>
          <div class="vx-actions">${marketActions(i).map((a) => `<button data-toast="${esc(a)} · ${esc(i.name)}">${esc(a)}</button>`).join("")}</div>
        </article>`).join("")}</div>`;
  }

  function renderCaps(p) {
    const rows = CAPS.filter(capFilter(p));
    return `
      <div class="vx-note">Catálogo de Capacidades é o inventário governado. Não substitui o Marketplace.</div>
      <div class="vx-table-wrap"><table class="vx-table">
        <thead><tr><th>Nome</th><th>Tipo</th><th>Owner</th><th>Ambiente</th><th>Versão</th><th>Status</th></tr></thead>
        <tbody>${rows.map((i) => `<tr><td>${esc(i.name)}</td><td>${esc(i.type)}</td><td>${esc(i.owner)}</td><td>${esc(i.env)}</td><td>${esc(i.version)}</td><td>${esc(i.status)}</td></tr>`).join("")}</tbody>
      </table></div>`;
  }

  function renderCreatePipeline() {
    return `
      <div class="vx-note">Pipeline combina Agentes → Skills → Tools → MCP → APIs → decisões → aprovações → ações. O desenho é no canvas de nós.</div>
      <div class="vx-flow-ex">
        <b>Evento SAP</b><i>→</i><b>Agente de Manutenção</b><i>→</i><b>Snowflake</b><i>→</i><b>Criticidade</b><i>→</i><b>Aprovação humana</b><i>→</i><b>Ordem no SAP</b>
      </div>
      <form class="vx-form" data-form="pipeline">
        <label>Nome<input name="name" required placeholder="Ex.: Ordem automática a partir de evento SAP"></label>
        <label>Área<select name="area">${AREAS.map((a) => `<option>${esc(a)}</option>`).join("")}</select></label>
        <label>Gatilho inicial
          <select name="trigger"><option>Evento SAP</option><option>Agenda</option><option>Manual</option><option>Webhook</option></select>
        </label>
        <button class="vx-btn vx-btn-primary" type="submit">Abrir no canvas</button>
      </form>`;
  }

  function renderCreateAgent() {
    return `
      <form class="vx-form" data-form="agent">
        <label>Nome<input name="name" required placeholder="Ex.: Agente de criticidade MRO"></label>
        <label>Área<select name="area">${AREAS.map((a) => `<option>${esc(a)}</option>`).join("")}</select></label>
        <label>Template
          <select name="tpl"><option value="">Em branco</option><option>Supervisor de triagem</option><option>Qualidade de defeito</option><option>Energia por forno</option></select>
        </label>
        <button class="vx-btn vx-btn-primary" type="submit">Criar no catálogo</button>
      </form>`;
  }

  function simpleList(rows) {
    return `<div class="vx-table-wrap"><table class="vx-table"><thead><tr>${rows.head.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
      <tbody>${rows.body.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  }

  function bodyFor(p, area) {
    if (p.startsWith("/marketplace")) return renderMarket(p, area);
    if (p.startsWith("/capabilities")) return renderCaps(p);
    if (p === "/create-pipeline") return renderCreatePipeline();
    if (p === "/create-agent") return renderCreateAgent();
    if (p === "/activity") return simpleList({
      head: ["Quando", "Tipo", "Item", "Estado"],
      body: [
        ["Hoje 09:14", "Pipeline", "Triagem de chamados", "Concluído"],
        ["Hoje 08:02", "Agente", "SQL Agent", "Esperando você"],
        ["Ontem", "Aprovação", "Ordem SAP 450221", "Pendente"]
      ]
    });
    if (p === "/favorites") return simpleList({
      head: ["Ativo", "Tipo", "Área"],
      body: [["Agente de Triagem/Supervisor", "Agente", "Manutenção"], ["Pipeline ordem automática", "Pipeline", "Manutenção"]]
    });
    if (p === "/recent") return simpleList({
      head: ["Item", "Aberto"],
      body: [["Triagem de chamados", "há 12 min"], ["Catálogo de Agentes", "há 1 h"], ["Governança", "ontem"]]
    });
    if (p === "/agent-templates") {
      return `<div class="vx-cards">${["Supervisor de triagem", "Qualidade de defeito", "Energia por forno", "Descoberta de BOM"].map((n) => `
        <article class="vx-card"><h3>${n}</h3><p>Template interno, já com skill e tool sugeridos.</p>
        <div class="vx-actions"><button data-go="/create-agent">Usar template</button></div></article>`).join("")}</div>`;
    }
    if (p === "/pipeline-templates") {
      return `<div class="vx-cards"><article class="vx-card"><h3>Evento SAP → ordem</h3>
        <p>Evento SAP → Agente de Manutenção → Snowflake → criticidade → aprovação → ordem.</p>
        <div class="vx-actions"><button data-go="/create-pipeline">Usar template</button></div></article></div>`;
    }
    if (p === "/pipeline-runs" || p === "/ops/runs") return simpleList({
      head: ["Corrida", "Alvo", "Início", "Estado"],
      body: [["run-3812", "Triagem de chamados", "09:14", "OK"], ["run-3811", "SQL Agent", "08:02", "Esperando"], ["run-3800", "Descoberta de BOM", "ontem", "Erro de tool"]]
    });
    if (p === "/pipeline-schedules") return simpleList({
      head: ["Pipeline", "Gatilho", "Próxima"],
      body: [["Triagem de chamados", "Manual", "—"], ["Descoberta de BOM", "Diário 06:00", "Amanhã 06:00"]]
    });
    if (p === "/marketplace/areas") {
      return `<div class="vx-cards">${AREAS.map((a) => {
        const n = MARKET.filter((i) => i.area === a).length;
        return `<article class="vx-card"><h3>${a}</h3><p>${n} ativo${n === 1 ? "" : "s"} publicados.</p>
          <div class="vx-actions"><button data-go="/marketplace">${n ? "Ver área" : "Vazio"}</button></div></article>`;
      }).join("")}</div>`;
    }
    if (p.startsWith("/ops") || p.startsWith("/results") || p.startsWith("/admin") || p.startsWith("/governance")) {
      return `
        <div class="vx-kpi">
          <article><span>Em execução</span><strong>4</strong></article>
          <article><span>Esperando você</span><strong>2</strong></article>
          <article><span>Incidentes abertos</span><strong>1</strong></article>
          <article><span>Gates no mês</span><strong>18</strong></article>
        </div>
        ${simpleList({
          head: ["Registro", "Alvo", "Estado"],
          body: [
            ["Aprovação G-12", "Pipeline ordem automática", "Esperando"],
            ["Erro tool Snowflake", "SQL Agent", "Aberto"],
            ["Promoção HML→PRD", "Skill criticidade", "Bloqueada"]
          ]
        })}`;
    }
    return `<p class="vx-lead">Conteúdo deste recorte entra na próxima iteração do protótipo.</p>`;
  }

  function render(slot, area) {
    const p = pathNow();
    const [kicker, title, lead] = pageMeta(p);
    slot.innerHTML = `<div class="vx-hub" data-path="${esc(p)}">
      <div class="vx-hub-kicker">${esc(kicker)}</div>
      <h1>${esc(title)}</h1>
      <p class="vx-lead">${esc(lead)}</p>
      ${bodyFor(p, area)}
    </div>`;
  }

  function bind(slot) {
    if (slot.dataset.hubBound === "1") return;
    slot.dataset.hubBound = "1";
    slot.addEventListener("click", (e) => {
      const areaBtn = e.target.closest("[data-area]");
      if (areaBtn) {
        render(slot, areaBtn.getAttribute("data-area") || "");
        return;
      }
      const goBtn = e.target.closest("[data-go]");
      if (goBtn) {
        go(goBtn.getAttribute("data-go"));
        return;
      }
      const t = e.target.closest("[data-toast]");
      if (t) toast(t.getAttribute("data-toast"));
    });
    slot.addEventListener("submit", (e) => {
      const form = e.target.closest("[data-form]");
      if (!form) return;
      e.preventDefault();
      const fd = new FormData(form);
      if (form.dataset.form === "pipeline") {
        const id = "pl-" + Math.random().toString(36).slice(2, 8);
        const KEY = "vivix-agenthub-pipelines-v1";
        let data = [];
        try { data = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (_) {}
        data.unshift({
          id,
          name: String(fd.get("name") || "Novo pipeline"),
          desc: "Gatilho: " + fd.get("trigger") + " · " + fd.get("area"),
          status: "rascunho",
          runs: 0,
          stages: [{ id: "s1", name: "Etapa 1", agentId: "", brief: "Evento SAP → agente → tool → decisão → aprovação → ação.", done: "Encerra o pipeline.", error: "Para e avisa." }]
        });
        localStorage.setItem(KEY, JSON.stringify(data));
        go("/pipelines/" + id);
      } else {
        go("/registry");
        toast("Agente enviado ao catálogo (protótipo).");
      }
    });
  }

  let writing = false;
  function mount() {
    const p = pathNow();
    if (isNative(p)) return;
    const slot = document.querySelector(".vx-pipe-root");
    if (!slot || writing) return;
    if (slot.dataset.hubPath === p && slot.querySelector(".vx-hub")) {
      bind(slot);
      return;
    }
    writing = true;
    slot.dataset.hubPath = p;
    render(slot, "");
    bind(slot);
    queueMicrotask(() => {
      writing = false;
    });
  }

  function onRoute() {
    requestAnimationFrame(() => requestAnimationFrame(mount));
  }

  function start() {
    const sub = () => {
      const router = window.__reactRouterDataRouter;
      if (router?.subscribe) router.subscribe(onRoute);
      else setTimeout(sub, 250);
    };
    sub();
    window.addEventListener("popstate", onRoute);
    onRoute();
    let tries = 0;
    const boot = setInterval(() => {
      if (isNative(pathNow()) || document.querySelector(".vx-hub") || ++tries > 20) {
        clearInterval(boot);
        return;
      }
      mount();
    }, 200);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
