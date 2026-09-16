/* Pipelines AgentHub — lista + canvas de nós com drag-and-drop. */
(function () {
  const KEY = "vivix-agenthub-pipelines-v1";
  const GRID = 18;
  const NODE_W = 200;
  const NODE_H = 88;
  const AGENTS = [
    { id: "triagem", name: "Agente de Triagem/Supervisor" },
    { id: "defeito", name: "Validação de Código de Defeito" },
    { id: "sql", name: "SQL Agent" },
    { id: "bom", name: "Descoberta automatizada de BOM" },
    { id: "bolhas", name: "Agente de Bolhas" },
    { id: "alocacao", name: "Validação de Alocação de Equipamento" }
  ];

  const BLOCKS = [
    { type: "agent", label: "Agente", hint: "Decide o próximo passo" },
    { type: "skill", label: "Skill", hint: "Criticidade, triagem…" },
    { type: "tool", label: "Tool", hint: "create_order, query…" },
    { type: "mcp", label: "MCP", hint: "SAP, Snowflake…" },
    { type: "decision", label: "Decisão", hint: "Se / senão" },
    { type: "approval", label: "Aprovação", hint: "Gate humano" },
    { type: "action", label: "Ação", hint: "Ordem, e-mail, alerta" }
  ];

  const seed = () => [
    {
      id: "triagem-chamados",
      name: "Triagem de chamados",
      desc: "Classifica o chamado e sugere código de defeito.",
      status: "ativo",
      runs: 128,
      stages: [
        { id: "s1", name: "Classificar chamado", agentId: "triagem", brief: "Leia a descrição e classifique área, urgência e tipo.", done: "Segue para validação do código.", error: "Para e avisa o supervisor." },
        { id: "s2", name: "Sugerir código de defeito", agentId: "defeito", brief: "Proponha o código mais provável e a confiança.", done: "Encerra o pipeline.", error: "Devolve para a triagem." }
      ]
    },
    {
      id: "pedido-qualidade",
      name: "Validação de pedido",
      desc: "Confere endereço e forma de pagamento antes de liberar.",
      status: "rascunho",
      runs: 0,
      stages: [
        { id: "s1", name: "Etapa 1", agentId: "", brief: "Confira se o pedido tem endereço completo e pagamento válido.", done: "Encerra o pipeline.", error: "Para a execução e avisa." }
      ]
    },
    {
      id: "bom-discovery",
      name: "Descoberta de BOM",
      desc: "Extrai estrutura de materiais e valida alocação.",
      status: "ativo",
      runs: 34,
      stages: [
        { id: "s1", name: "Extrair BOM", agentId: "bom", brief: "Descubra a lista de materiais a partir da ordem.", done: "Segue para alocação.", error: "Para e avisa." },
        { id: "s2", name: "Validar alocação", agentId: "alocacao", brief: "Confira se cada item está no nível certo do equipamento.", done: "Encerra o pipeline.", error: "Devolve para extração." }
      ]
    }
  ];

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    const data = seed();
    save(data);
    return data;
  }

  function save(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  function uid(prefix) {
    return prefix + "-" + Math.random().toString(36).slice(2, 8);
  }

  function agentName(id) {
    return AGENTS.find((a) => a.id === id)?.name || "";
  }

  function blockMeta(type) {
    return BLOCKS.find((b) => b.type === type) || { type, label: type, hint: "" };
  }

  function snap(n) {
    return Math.round(n / GRID) * GRID;
  }

  function iconBranch() {
    return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 3v12"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>';
  }

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function route() {
    const parts = location.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
    const reserved = { new: 1, runs: 1, schedules: 1, templates: 1, execucoes: 1, agendamentos: 1 };
    if (parts[0] !== "pipelines") return { view: "other" };
    if (!parts[1]) return { view: "list" };
    if (reserved[parts[1]]) return { view: "other" };
    return { view: "edit", id: decodeURIComponent(parts[1]), tab: new URLSearchParams(location.search).get("tab") || "etapas" };
  }

  function go(path) {
    if (location.pathname + location.search === path) return;
    const router = window.__reactRouterDataRouter;
    if (router) {
      router.navigate(path);
      return;
    }
    history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }

  let state = { data: load(), selected: null, query: "" };
  let drag = null;

  function currentPipe() {
    const r = route();
    return state.data.find((p) => p.id === r.id) || null;
  }

  function ensureGraph(pipe) {
    if (!pipe) return pipe;
    if (pipe.nodes && pipe.nodes.length) {
      pipe.edges = pipe.edges || [];
      return pipe;
    }
    const stages = pipe.stages || [];
    const nodes = [
      { id: "n-start", type: "start", name: "Início", x: 48, y: 180, brief: "", agentId: "", done: "", error: "" }
    ];
    stages.forEach((s, i) => {
      nodes.push({
        id: s.id || uid("n"),
        type: "agent",
        name: s.name || "Etapa " + (i + 1),
        x: 280 + i * 240,
        y: 156,
        agentId: s.agentId || "",
        brief: s.brief || "",
        done: s.done || "Segue para o próximo bloco.",
        error: s.error || "Para e avisa."
      });
    });
    nodes.push({
      id: "n-end",
      type: "end",
      name: "Fim",
      x: 280 + stages.length * 240,
      y: 180,
      brief: "",
      agentId: "",
      done: "",
      error: ""
    });
    const edges = [];
    for (let i = 0; i < nodes.length - 1; i++) {
      edges.push({ id: uid("e"), from: nodes[i].id, to: nodes[i + 1].id, port: "out" });
    }
    pipe.nodes = nodes;
    pipe.edges = edges;
    return pipe;
  }

  function syncStages(pipe) {
    pipe.stages = (pipe.nodes || [])
      .filter((n) => n.type !== "start" && n.type !== "end")
      .map((n) => ({
        id: n.id,
        name: n.name,
        agentId: n.agentId || "",
        brief: n.brief || "",
        done: n.done || "",
        error: n.error || ""
      }));
  }

  function chip(status) {
    if (status === "ativo") return '<span class="vx-chip vx-chip-ok">Ativo</span>';
    if (status === "alerta") return '<span class="vx-chip vx-chip-warn">Atenção</span>';
    return '<span class="vx-chip vx-chip-draft">Rascunho</span>';
  }

  function missingCount(pipe) {
    return (pipe.nodes || []).filter((n) => n.type !== "start" && n.type !== "end" && !n.name).length;
  }

  function renderList(root) {
    const q = state.query.trim().toLowerCase();
    const rows = state.data.filter((p) => !q || (p.name + " " + p.desc).toLowerCase().includes(q));
    root.innerHTML = `
      <div class="vx-pl vx-pl-list">
        <div class="vx-pl-head">
          <div>
            <h1>Pipelines</h1>
            <p>Monte o fluxo no canvas: agentes, skills, tools, MCP, decisões, aprovações e ações.</p>
          </div>
          <button class="vx-btn vx-btn-primary" data-act="new">${iconBranch()} Novo pipeline</button>
        </div>
        <div class="vx-pl-toolbar">
          <input class="vx-pl-search" data-act="search" type="search" placeholder="Buscar pipelines…" value="${esc(state.query)}">
        </div>
        <div class="vx-pl-grid">
          ${rows.length ? rows.map((p) => {
            const n = (p.nodes && p.nodes.length) ? p.nodes.filter((x) => x.type !== "start" && x.type !== "end").length : (p.stages || []).length;
            return `
            <button class="vx-pl-card" data-act="open" data-id="${esc(p.id)}">
              <div class="vx-pl-card-icon">${iconBranch()}</div>
              <div class="vx-pl-card-body">
                <h2>${esc(p.name)}</h2>
                <p>${esc(p.desc)}</p>
                <p style="margin-top:6px">${n} bloco${n === 1 ? "" : "s"} · ${p.runs} execução${p.runs === 1 ? "" : "ões"}</p>
              </div>
              <div class="vx-pl-card-meta">${chip(p.status)}</div>
            </button>`;
          }).join("") : `<div class="vx-pl-empty">Nenhum pipeline neste filtro. Crie o primeiro para desenhar o fluxo.</div>`}
        </div>
      </div>`;
  }

  function nodeSubtitle(n) {
    if (n.type === "start") return "Gatilho do fluxo";
    if (n.type === "end") return "Encerra a execução";
    if (n.type === "agent") return agentName(n.agentId) || "Escolher agente";
    return blockMeta(n.type).hint;
  }

  function portXY(node, port) {
    const y = node.type === "start" || node.type === "end" ? node.y + 20 : node.y + NODE_H / 2;
    if (port === "in") return { x: node.x, y };
    if (port === "err") return { x: node.x + NODE_W, y: node.y + NODE_H - 18 };
    return { x: node.x + (node.type === "start" || node.type === "end" ? 96 : NODE_W), y };
  }

  function wirePath(a, b) {
    const dx = Math.max(48, (b.x - a.x) / 2);
    return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
  }

  function renderWires(pipe, preview) {
    const parts = (pipe.edges || []).map((e) => {
      const from = pipe.nodes.find((n) => n.id === e.from);
      const to = pipe.nodes.find((n) => n.id === e.to);
      if (!from || !to) return "";
      const a = portXY(from, e.port || "out");
      const b = portXY(to, "in");
      return `<path class="vx-wire ${e.port === "err" ? "is-err" : ""}" d="${wirePath(a, b)}" data-eid="${esc(e.id)}"></path>`;
    });
    if (preview) parts.push(`<path class="vx-wire is-preview" d="${wirePath(preview.a, preview.b)}"></path>`);
    return parts.join("");
  }

  function renderNode(n, selected) {
    const on = n.id === selected ? " is-on" : "";
    const warn = n.type === "agent" && !n.agentId ? " is-warn" : "";
    if (n.type === "start" || n.type === "end") {
      return `<div class="vx-node vx-node-pill${on}" data-nid="${esc(n.id)}" style="left:${n.x}px;top:${n.y}px">
        <span class="vx-pill ${n.type === "start" ? "vx-pill-start" : "vx-pill-end"}">${esc(n.name)}</span>
        ${n.type === "start" ? `<button type="button" class="vx-port vx-port-out" data-port="out" data-nid="${esc(n.id)}" aria-label="Ligar saída"></button>` : `<button type="button" class="vx-port vx-port-in" data-port="in" data-nid="${esc(n.id)}" aria-label="Ligar entrada"></button>`}
      </div>`;
    }
    const kicker = blockMeta(n.type).label;
    return `<div class="vx-node vx-node-card${on}${warn}" data-nid="${esc(n.id)}" style="left:${n.x}px;top:${n.y}px">
      <button type="button" class="vx-port vx-port-in" data-port="in" data-nid="${esc(n.id)}" aria-label="Entrada"></button>
      <button type="button" class="vx-stage" data-act="select" data-id="${esc(n.id)}">
        <div class="vx-stage-kicker">${esc(kicker)}</div>
        <h5>${esc(n.name)}</h5>
        <p>${esc(nodeSubtitle(n))}</p>
      </button>
      <button type="button" class="vx-port vx-port-out" data-port="out" data-nid="${esc(n.id)}" aria-label="Saída"></button>
      ${n.type === "decision" ? `<button type="button" class="vx-port vx-port-err" data-port="err" data-nid="${esc(n.id)}" aria-label="Saída de erro"></button>` : ""}
    </div>`;
  }

  function inspectorHtml(pipe) {
    const node = pipe.nodes.find((n) => n.id === state.selected);
    if (!node) {
      return `<h3>Roteiro</h3><p class="vx-muted">Arraste um bloco da esquerda para o canvas, ou clique num bloco para editar.</p>
        <p class="vx-muted">Ligue as bolinhas para conectar. Arraste o bloco para reposicionar.</p>`;
    }
    if (node.type === "start" || node.type === "end") {
      return `<h3>${node.type === "start" ? "Início" : "Fim"}</h3>
        <p class="vx-muted">${node.type === "start" ? "Gatilho do pipeline. Conecte a saída ao primeiro bloco." : "Término do fluxo. Conecte a entrada a partir do último bloco."}</p>`;
    }
    const meta = blockMeta(node.type);
    return `
      <h3>${esc(meta.label)}</h3>
      <p style="font-size:12.5px;color:var(--vx-muted);margin:0 0 14px">${esc(meta.hint)}</p>
      <div class="vx-field">
        <label>Nome do bloco</label>
        <input data-field="name" value="${esc(node.name)}">
      </div>
      ${node.type === "agent" ? `
      <div class="vx-field">
        <label>Quem executa</label>
        <select data-field="agentId">
          <option value="">Escolher agente…</option>
          ${AGENTS.map((a) => `<option value="${a.id}" ${a.id === node.agentId ? "selected" : ""}>${esc(a.name)}</option>`).join("")}
        </select>
      </div>` : ""}
      <div class="vx-field">
        <label>O que acontece aqui</label>
        <textarea data-field="brief">${esc(node.brief)}</textarea>
      </div>
      <h4>Como este bloco pode terminar</h4>
      <div class="vx-outcome">
        <strong>Concluído</strong>
        <span>${esc(node.done || "Segue pela ligação de saída")}</span>
      </div>
      <div class="vx-field">
        <label>Se der erro</label>
        <input data-field="error" value="${esc(node.error || "Para a execução e avisa")}">
      </div>
      ${node.type === "agent" && !node.agentId ? `<div class="vx-warn">Escolha o agente. Sem agente, o bloco não roda.</div>` : ""}
      <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
        <button class="vx-btn vx-btn-ghost" data-act="remove-node">Remover bloco</button>
      </div>
    `;
  }

  function renderEditor(root, pipe, tab) {
    const hadGraph = !!(pipe.nodes && pipe.nodes.length);
    ensureGraph(pipe);
    if (!hadGraph) save(state.data);
    if (!state.selected || !pipe.nodes.some((n) => n.id === state.selected)) {
      state.selected = pipe.nodes.find((n) => n.type !== "start" && n.type !== "end")?.id || pipe.nodes[0]?.id || null;
    }
    const missing = (pipe.nodes || []).filter((n) => n.type === "agent" && !n.agentId).length;
    const runs = `
      <div class="vx-runs">
        <h3 style="margin:0 0 12px;font-size:16px">Execuções</h3>
        ${pipe.runs === 0 ? `<div class="vx-pl-empty">Nenhuma execução ainda. Use Executar para simular uma corrida.</div>` : `
          <div class="vx-run-row"><span>Hoje, 09:14</span><span>Concluído · 1,8s</span><span class="vx-chip vx-chip-ok">OK</span></div>
          <div class="vx-run-row"><span>Ontem, 16:02</span><span>Bloco com erro</span><span class="vx-chip vx-chip-warn">Erro</span></div>
        `}
      </div>`;
    const extra = tab === "execucoes" ? runs : tab === "gatilhos" ? `
      <div class="vx-runs">
        <h3 style="margin:0 0 8px;font-size:16px">Gatilhos</h3>
        <p style="color:var(--vx-muted);font-size:13.5px">Manual neste protótipo. Depois: webhook, agenda e evento de agente.</p>
      </div>` : tab === "api" ? `
      <div class="vx-runs">
        <h3 style="margin:0 0 8px;font-size:16px">API</h3>
        <p style="color:var(--vx-muted);font-size:13.5px">POST /pipelines/${esc(pipe.id)}/run — fora do clique no v1 do protótipo.</p>
      </div>` : "";

    root.innerHTML = `
      <div class="vx-pl vx-ed">
        <div class="vx-ed-top">
          <button class="vx-btn vx-btn-ghost" data-act="back">←</button>
          <input class="vx-ed-name" data-field="pipe-name" value="${esc(pipe.name)}">
          <div class="vx-ed-tabs">
            <button class="vx-ed-tab ${tab === "etapas" ? "is-on" : ""}" data-act="tab" data-tab="etapas">Etapas</button>
            <button class="vx-ed-tab ${tab === "execucoes" ? "is-on" : ""}" data-act="tab" data-tab="execucoes">Execuções</button>
            <button class="vx-ed-tab ${tab === "gatilhos" ? "is-on" : ""}" data-act="tab" data-tab="gatilhos">Gatilhos</button>
            <button class="vx-ed-tab ${tab === "api" ? "is-on" : ""}" data-act="tab" data-tab="api">API</button>
          </div>
          ${missing ? `<span class="vx-chip vx-chip-warn">Falta configurar ${missing} bloco${missing > 1 ? "s" : ""}</span>` : ""}
          <button class="vx-btn" data-act="save">Salvar</button>
          <button class="vx-btn vx-btn-dark" data-act="run">Executar</button>
        </div>
        ${tab === "etapas" ? `
          <div class="vx-board">
            <div class="vx-palette">
              ${BLOCKS.map((b) => `<button type="button" class="vx-palette-item" data-palette="${b.type}" title="${esc(b.hint)}"><span>${esc(b.label)}</span></button>`).join("")}
            </div>
              <div class="vx-canvas" data-canvas>
              <svg class="vx-wires" width="2400" height="1600" aria-hidden="true">${renderWires(pipe)}</svg>
              <div class="vx-nodes">${pipe.nodes.map((n) => renderNode(n, state.selected)).join("")}</div>
            </div>
            <div class="vx-insp">${inspectorHtml(pipe)}</div>
            <div class="vx-canvas-hint">Arraste um bloco da esquerda · ligue as bolinhas · arraste o bloco para mover</div>
          </div>` : extra}
      </div>`;
  }

  function render(root) {
    const r = route();
    if (r.view === "list") {
      state.selected = null;
      renderList(root);
      return;
    }
    const pipe = currentPipe();
    if (!pipe) {
      go("/pipelines");
      return;
    }
    renderEditor(root, pipe, r.tab);
  }

  function persistPipe(mutator) {
    const pipe = currentPipe();
    if (!pipe) return;
    ensureGraph(pipe);
    mutator(pipe);
    syncStages(pipe);
    save(state.data);
  }

  function addNode(type, x, y) {
    const meta = blockMeta(type);
    const node = {
      id: uid("n"),
      type,
      name: meta.label,
      x: snap(Math.max(24, x)),
      y: snap(Math.max(24, y)),
      agentId: "",
      brief: "",
      done: "Segue pela ligação de saída.",
      error: "Para a execução e avisa."
    };
    persistPipe((p) => {
      p.nodes.push(node);
    });
    state.selected = node.id;
    return node;
  }

  function canvasEl(root) {
    return root.querySelector("[data-canvas]");
  }

  function toCanvas(canvas, clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    return {
      x: clientX - r.left + canvas.scrollLeft,
      y: clientY - r.top + canvas.scrollTop
    };
  }

  function moveNodeDom(root, id, x, y) {
    const el = root.querySelector(`.vx-node[data-nid="${id}"]`);
    if (el) {
      el.style.left = x + "px";
      el.style.top = y + "px";
    }
    const pipe = currentPipe();
    if (!pipe) return;
    const svg = root.querySelector(".vx-wires");
    if (svg) svg.innerHTML = renderWires(pipe);
  }

  let skipClick = false;

  function onClick(root, e) {
    if (skipClick) {
      skipClick = false;
      return;
    }
    const pal = e.target.closest("[data-palette]");
    if (pal && !drag) {
      const canvas = canvasEl(root);
      const n = (currentPipe()?.nodes || []).length;
      addNode(pal.getAttribute("data-palette"), 80 + (n % 6) * 40, 80 + (n % 5) * 36);
      render(root);
      return;
    }
    const t = e.target.closest("[data-act]");
    if (!t) {
      if (e.target.closest("[data-canvas]") && !e.target.closest(".vx-node")) {
        state.selected = null;
        render(root);
      }
      return;
    }
    const act = t.dataset.act;
    if (act === "new") {
      const id = uid("pl");
      state.data.unshift({
        id,
        name: "Novo pipeline",
        desc: "Vários agentes em sequência, com desvios e repetição.",
        status: "rascunho",
        runs: 0,
        stages: [],
        nodes: [],
        edges: []
      });
      ensureGraph(state.data[0]);
      save(state.data);
      go("/pipelines/" + id);
      return;
    }
    if (act === "open") {
      go("/pipelines/" + t.dataset.id);
      return;
    }
    if (act === "back") {
      go("/pipelines");
      return;
    }
    if (act === "tab") {
      const pipe = currentPipe();
      go("/pipelines/" + pipe.id + "?tab=" + t.dataset.tab);
      return;
    }
    if (act === "select") {
      state.selected = t.dataset.id;
      render(root);
      return;
    }
    if (act === "remove-node") {
      persistPipe((p) => {
        p.nodes = p.nodes.filter((n) => n.id !== state.selected);
        p.edges = p.edges.filter((e) => e.from !== state.selected && e.to !== state.selected);
        state.selected = p.nodes.find((n) => n.type !== "start" && n.type !== "end")?.id || null;
      });
      render(root);
      return;
    }
    if (act === "save") {
      t.textContent = "Salvo";
      setTimeout(() => render(root), 700);
      return;
    }
    if (act === "run") {
      persistPipe((p) => {
        p.runs += 1;
        const agents = p.nodes.filter((n) => n.type === "agent");
        if (agents.length && agents.every((s) => s.agentId)) p.status = "ativo";
      });
      go("/pipelines/" + currentPipe().id + "?tab=execucoes");
    }
  }

  function onInput(root, e) {
    const field = e.target.dataset.field;
    if (e.target.dataset.act === "search") {
      state.query = e.target.value;
      render(root);
      root.querySelector("[data-act=search]")?.focus();
      const el = root.querySelector("[data-act=search]");
      if (el) el.selectionStart = el.selectionEnd = el.value.length;
      return;
    }
    if (field === "pipe-name") {
      persistPipe((p) => { p.name = e.target.value; });
      return;
    }
    if (!field) return;
    persistPipe((p) => {
      const node = p.nodes.find((n) => n.id === state.selected);
      if (node) node[field] = e.target.value;
    });
    if (field === "agentId" || field === "name") {
      const card = root.querySelector(`.vx-node[data-nid="${state.selected}"]`);
      const node = currentPipe()?.nodes.find((n) => n.id === state.selected);
      if (card && node) {
        const h = card.querySelector("h5");
        const p = card.querySelector("p");
        if (h) h.textContent = node.name;
        if (p) p.textContent = nodeSubtitle(node);
        card.classList.toggle("is-warn", node.type === "agent" && !node.agentId);
      }
    }
  }

  function onPointerDown(root, e) {
    if (e.button != null && e.button !== 0) return;
    const port = e.target.closest(".vx-port");
    if (port) {
      e.preventDefault();
      e.stopPropagation();
      const pipe = currentPipe();
      const from = pipe.nodes.find((n) => n.id === port.getAttribute("data-nid"));
      if (!from) return;
      const p = port.getAttribute("data-port");
      if (p === "in") return;
      const canvas = canvasEl(root);
      drag = { kind: "wire", fromId: from.id, port: p, canvas };
      port.setPointerCapture?.(e.pointerId);
      return;
    }
    const pal = e.target.closest("[data-palette]");
    if (pal) {
      const type = pal.getAttribute("data-palette");
      const ghost = document.createElement("div");
      ghost.className = "vx-ghost";
      ghost.textContent = blockMeta(type).label;
      document.body.appendChild(ghost);
      ghost.style.left = e.clientX + "px";
      ghost.style.top = e.clientY + "px";
      drag = { kind: "palette", type, ghost, startX: e.clientX, startY: e.clientY, moved: false };
      pal.setPointerCapture?.(e.pointerId);
      return;
    }
    const nodeEl = e.target.closest(".vx-node");
    if (nodeEl && !e.target.closest(".vx-port")) {
      const id = nodeEl.getAttribute("data-nid");
      const pipe = currentPipe();
      const node = pipe.nodes.find((n) => n.id === id);
      if (!node) return;
      e.preventDefault();
      const canvas = canvasEl(root);
      const pt = toCanvas(canvas, e.clientX, e.clientY);
      drag = {
        kind: "node",
        id,
        dx: pt.x - node.x,
        dy: pt.y - node.y,
        startX: e.clientX,
        startY: e.clientY,
        moved: false,
        canvas
      };
      nodeEl.setPointerCapture?.(e.pointerId);
    }
  }

  function onPointerMove(root, e) {
    if (!drag) return;
    if (drag.kind === "palette" && drag.ghost) {
      drag.moved = drag.moved || Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > 4;
      drag.ghost.style.left = e.clientX + "px";
      drag.ghost.style.top = e.clientY + "px";
      const canvas = canvasEl(root);
      canvas?.classList.toggle("is-drop", canvas.contains(document.elementFromPoint(e.clientX, e.clientY)) || canvas === document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-canvas]"));
      return;
    }
    if (drag.kind === "node") {
      drag.moved = drag.moved || Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > 4;
      const pt = toCanvas(drag.canvas, e.clientX, e.clientY);
      const node = currentPipe().nodes.find((n) => n.id === drag.id);
      if (!node) return;
      node.x = snap(Math.max(8, pt.x - drag.dx));
      node.y = snap(Math.max(8, pt.y - drag.dy));
      moveNodeDom(root, node.id, node.x, node.y);
      return;
    }
    if (drag.kind === "wire") {
      const pt = toCanvas(drag.canvas, e.clientX, e.clientY);
      const from = currentPipe().nodes.find((n) => n.id === drag.fromId);
      const a = portXY(from, drag.port);
      const svg = root.querySelector(".vx-wires");
      if (svg) svg.innerHTML = renderWires(currentPipe(), { a, b: pt });
    }
  }

  function onPointerUp(root, e) {
    if (!drag) return;
    const current = drag;
    drag = null;
    if (current.ghost) current.ghost.remove();
    root.querySelector("[data-canvas]")?.classList.remove("is-drop");

    if (current.kind === "palette") {
      const canvas = canvasEl(root);
      const over = document.elementFromPoint(e.clientX, e.clientY);
      if (canvas && (canvas.contains(over) || over?.closest("[data-canvas]"))) {
        skipClick = true;
        const pt = toCanvas(canvas, e.clientX, e.clientY);
        addNode(current.type, pt.x - NODE_W / 2, pt.y - 24);
        render(root);
      }
      return;
    }
    if (current.kind === "node") {
      persistPipe(() => {});
      if (current.moved) skipClick = true;
      else {
        state.selected = current.id;
        render(root);
      }
      return;
    }
    if (current.kind === "wire") {
      skipClick = true;
      const over = document.elementFromPoint(e.clientX, e.clientY);
      const port = over?.closest?.(".vx-port");
      const toId = port?.getAttribute("data-nid");
      const toPort = port?.getAttribute("data-port");
      if (toId && toPort === "in" && toId !== current.fromId) {
        persistPipe((p) => {
          const dup = p.edges.some((ed) => ed.from === current.fromId && ed.to === toId && ed.port === current.port);
          if (!dup) p.edges.push({ id: uid("e"), from: current.fromId, to: toId, port: current.port });
        });
      }
      render(root);
    }
  }

  function bind(root) {
    if (root.dataset.vxBound === "1") return;
    root.dataset.vxBound = "1";
    root.addEventListener("click", (e) => onClick(root, e));
    root.addEventListener("input", (e) => onInput(root, e));
    root.addEventListener("change", (e) => onInput(root, e));
    root.addEventListener("pointerdown", (e) => onPointerDown(root, e));
    window.addEventListener("pointermove", (e) => onPointerMove(root, e));
    window.addEventListener("pointerup", (e) => onPointerUp(root, e));
    window.addEventListener("pointercancel", (e) => onPointerUp(root, e));
  }

  let writing = false;
  function mount() {
    const r = route();
    if (r.view === "other" || writing) return;
    const slot = document.querySelector(".vx-pipe-root");
    if (!slot) return;
    const key = location.pathname + location.search;
    if (slot.dataset.vxRoute === key && slot.querySelector(".vx-pl") && drag) {
      bind(slot);
      return;
    }
    if (slot.dataset.vxRoute === key && slot.querySelector(".vx-pl") && !drag) {
      bind(slot);
      return;
    }
    writing = true;
    slot.dataset.vxRoute = key;
    render(slot);
    bind(slot);
    queueMicrotask(() => {
      writing = false;
    });
  }

  function onRoute() {
    if (drag) return;
    const slot = document.querySelector(".vx-pipe-root");
    if (slot) slot.dataset.vxRoute = "";
    requestAnimationFrame(() => requestAnimationFrame(mount));
  }

  const start = () => {
    const sub = () => {
      const router = window.__reactRouterDataRouter;
      if (router?.subscribe) router.subscribe(onRoute);
      else setTimeout(sub, 200);
    };
    sub();
    window.addEventListener("popstate", onRoute);
    onRoute();
    let tries = 0;
    const boot = setInterval(() => {
      const r = route();
      if (r.view === "other" || document.querySelector(".vx-pl") || ++tries > 20) {
        clearInterval(boot);
        return;
      }
      mount();
    }, 200);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
