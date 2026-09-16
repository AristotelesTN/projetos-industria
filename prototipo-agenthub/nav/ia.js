/* Arquitetura de informação própria do VIVIX AgentHub. */
(function () {
  const ICONS = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z"/></svg>',
    pulse: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 12h4l2-5 4 10 2-5h6"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m12 3 2.6 6.4L21 10l-4.8 4.2L17.6 21 12 17.6 6.4 21l1.4-6.8L3 10l6.4-.6z"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8"/><path d="M12 8v5l3 2"/></svg>',
    bot: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="8" width="16" height="11" rx="2"/><path d="M9 8V6a3 3 0 0 1 6 0v2M8 13h.01M16 13h.01"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 5a3 3 0 0 1 3-2h11v16H8a3 3 0 0 0-3 2z"/><path d="M5 5v14a3 3 0 0 1 3 2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 5v14M5 12h14"/></svg>',
    layout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="7" height="7"/><rect x="13" y="4" width="7" height="7"/><rect x="4" y="13" width="7" height="7"/><rect x="13" y="13" width="7" height="7"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 6v12l10-6z"/></svg>',
    branch: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 3v12"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>',
    run: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4z"/></svg>',
    cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3v4M16 3v4"/></svg>',
    stack: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m4 8 8-4 8 4-8 4z"/><path d="m4 12 8 4 8-4M4 16l8 4 8-4"/></svg>',
    plug: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 7v5a3 3 0 0 0 6 0V7M8 7h8M12 15v6"/></svg>',
    tool: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 7a4 4 0 0 0 5 5l-8 8-5-5 8-8z"/></svg>',
    spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v4M12 17v4M4.9 6.5l2.8 2.8M16.3 14.7l2.8 2.8M3 12h4M17 12h4M4.9 17.5l2.8-2.8M16.3 9.3l2.8-2.8"/></svg>',
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 12a4 4 0 0 1 0-6l2-2a4 4 0 0 1 6 6l-1 1"/><path d="M15 12a4 4 0 0 1 0 6l-2 2a4 4 0 1 1-6-6l1-1"/></svg>',
    kb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/></svg>',
    prompt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 6h14M5 12h8M5 18h10"/></svg>',
    shop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 9h16l-1 11H5z"/><path d="M8 9V7a4 4 0 0 1 8 0v2"/></svg>',
    grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="6" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>',
    ops: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19V5M4 19h16M8 15v4M12 11v8M16 8v11"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    log: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/></svg>',
    alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m12 4 9 16H3z"/><path d="M12 10v4M12 17h.01"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 7 10 17l-6-6"/></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 5.6-7 10-7 10z"/></svg>',
    chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19h16M7 16v-5M12 16V8M17 16v-8"/></svg>',
    coin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8"/><path d="M12 7v10M9.5 9.5c.5-1 4.5-1.4 4.5.6 0 2.4-5 1.6-5 4 0 1.8 3.2 2.2 5 .6"/></svg>',
    trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 5h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M10 20h4M12 14v6"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6z"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="8" r="3"/><path d="M3 19a6 6 0 0 1 12 0"/><circle cx="17" cy="9" r="2.4"/><path d="M17 13.2c2.2.4 3.8 1.8 4 4.8"/></svg>',
    key: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="8" cy="15" r="3"/><path d="m10.2 12.8 8-8L21 7.6l-2 2-2-1-1 2-2-.2"/></svg>',
    env: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 10h16"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M12 4v2M12 18v2M4 12h2M18 12h2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4"/></svg>',
    note: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 4h8l5 5v11H7z"/><path d="M15 4v5h5"/></svg>'
  };

  const IA = [
    {
      id: "inicio",
      label: "Início",
      items: [
        { href: "/", label: "Visão Geral", icon: "home" },
        { href: "/activity", label: "Minha Atividade", icon: "pulse" },
        { href: "/favorites", label: "Favoritos", icon: "star" },
        { href: "/recent", label: "Recentes", icon: "clock" }
      ]
    },
    {
      id: "agentes",
      label: "Agentes",
      items: [
        { href: "/agents", label: "Meus Agentes", icon: "bot" },
        { href: "/registry", label: "Catálogo de Agentes", icon: "book" },
        { href: "/create-agent", label: "Criar Agente", icon: "plus" },
        { href: "/agent-templates", label: "Templates de Agentes", icon: "layout" },
        { href: "/playground", label: "Playground", icon: "play" }
      ]
    },
    {
      id: "pipelines",
      label: "Pipelines",
      items: [
        { href: "/pipelines", label: "Meus Pipelines", icon: "branch" },
        { href: "/create-pipeline", label: "Criar Pipeline", icon: "plus" },
        { href: "/pipeline-runs", label: "Execuções", icon: "run" },
        { href: "/pipeline-schedules", label: "Agendamentos", icon: "cal" },
        { href: "/pipeline-templates", label: "Templates de Pipelines", icon: "layout" }
      ]
    },
    {
      id: "capacidades",
      label: "Capacidades",
      items: [
        { href: "/capabilities", label: "Catálogo de Capacidades", icon: "stack" },
        { href: "/catalog", label: "MCP Servers", icon: "plug" },
        { href: "/capabilities/tools", label: "Tools", icon: "tool" },
        { href: "/capabilities/skills", label: "Skills", icon: "spark" },
        { href: "/capabilities/integrations", label: "Integrações", icon: "link" },
        { href: "/capabilities/knowledge", label: "Conhecimento", icon: "kb" },
        { href: "/capabilities/prompts", label: "Prompts", icon: "prompt" }
      ]
    },
    {
      id: "marketplace",
      label: "Marketplace",
      items: [
        { href: "/marketplace", label: "Explorar", icon: "shop" },
        { href: "/marketplace/agents", label: "Agentes", icon: "bot" },
        { href: "/marketplace/skills", label: "Skills", icon: "spark" },
        { href: "/marketplace/tools", label: "Tools", icon: "tool" },
        { href: "/marketplace/mcp", label: "MCP Servers", icon: "plug" },
        { href: "/marketplace/templates", label: "Templates", icon: "layout" },
        { href: "/marketplace/pipelines", label: "Pipelines", icon: "branch" },
        { href: "/marketplace/areas", label: "Soluções por Área", icon: "grid" }
      ]
    },
    {
      id: "operacoes",
      label: "Operações",
      items: [
        { href: "/ops", label: "Central de Operações", icon: "ops" },
        { href: "/ops/runs", label: "Execuções", icon: "run" },
        { href: "/ops/observability", label: "Observabilidade", icon: "eye" },
        { href: "/ops/logs", label: "Logs & Traces", icon: "log" },
        { href: "/ops/incidents", label: "Incidentes", icon: "alert" },
        { href: "/ops/approvals", label: "Aprovações", icon: "check" },
        { href: "/ops/agents-health", label: "Saúde dos Agentes", icon: "heart" },
        { href: "/ops/pipelines-health", label: "Saúde dos Pipelines", icon: "branch" }
      ]
    },
    {
      id: "resultados",
      label: "Resultados",
      items: [
        { href: "/results", label: "Performance", icon: "chart" },
        { href: "/costs", label: "Custos", icon: "coin" },
        { href: "/results/roi", label: "ROI", icon: "chart" },
        { href: "/results/adoption", label: "Adoção", icon: "users" },
        { href: "/results/value", label: "Valor Gerado", icon: "spark" },
        { href: "/leaderboard", label: "Leaderboard", icon: "trophy" }
      ]
    },
    {
      id: "admin",
      label: "Administração",
      items: [
        { href: "/governance", label: "Governança", icon: "shield" },
        { href: "/governance/policies", label: "Políticas & Guardrails", icon: "shield" },
        { href: "/admin/users", label: "Usuários & Times", icon: "users" },
        { href: "/admin/permissions", label: "Permissões", icon: "key" },
        { href: "/admin/environments", label: "Ambientes", icon: "env" },
        { href: "/settings", label: "Configurações", icon: "gear" },
        { href: "/changelog", label: "Changelog", icon: "note" }
      ]
    }
  ];

  const STORE = "vivix-nav-open-groups";

  function pathNow() {
    return location.pathname.replace(/\/+$/, "") || "/";
  }

  function isActive(href) {
    const p = pathNow();
    if (href === "/") return p === "/";
    if (p === href) return true;
    if (href === "/pipelines" && /^\/pipelines\/(?!new$)/.test(p)) return true;
    if (href === "/agents" && /^\/agents\/.+/.test(p)) return true;
    return false;
  }

  function currentGroupId() {
    const p = pathNow();
    for (const g of IA) {
      if (g.items.some((it) => isActive(it.href) || (it.href !== "/" && p.startsWith(it.href + "/")))) return g.id;
    }
    return "inicio";
  }

  function currentLabel() {
    const p = pathNow();
    let best = { href: "", label: "Visão Geral" };
    for (const g of IA) {
      for (const it of g.items) {
        if (isActive(it.href) && it.href.length >= best.href.length) best = it;
      }
    }
    if (p.startsWith("/pipelines/") && p !== "/pipelines") return "Pipeline";
    return best.label;
  }

  function openGroups() {
    try {
      const raw = sessionStorage.getItem(STORE);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return { [currentGroupId()]: true, inicio: true };
  }

  function saveGroups(map) {
    sessionStorage.setItem(STORE, JSON.stringify(map));
  }

  function htmlNav() {
    const open = openGroups();
    const cur = currentGroupId();
    if (!open[cur]) open[cur] = true;
    return IA.map((g) => {
      const on = open[g.id] !== false;
      return `<div class="vx-nav-group ${on ? "" : "is-closed"}" data-group="${g.id}">
        <button type="button" class="vx-nav-label" data-toggle="${g.id}">${g.label}
          <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 4.5 6 7.5 9 4.5"/></svg>
        </button>
        <div class="vx-nav-items">${g.items.map((it) => {
          const active = isActive(it.href);
          return `<a href="${it.href}" class="${active ? "is-on" : ""}" ${active ? 'aria-current="page"' : ""}>${ICONS[it.icon] || "" }<span>${it.label}</span></a>`;
        }).join("")}</div>
      </div>`;
    }).join("");
  }

  function go(href) {
    const router = window.__reactRouterDataRouter;
    if (router) router.navigate(href);
    else location.assign(href);
  }

  function syncHeader() {
    const el = document.querySelector("#container header [data-fg-ccit63]");
    const label = currentLabel();
    if (el && el.textContent !== label) el.textContent = label;
  }

  function highlight(root) {
    root.querySelectorAll("a").forEach((a) => {
      const on = isActive(a.getAttribute("href"));
      a.classList.toggle("is-on", on);
      if (on) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    syncHeader();
  }

  let writing = false;
  let bound = false;

  function bindNav(nav) {
    if (bound) return;
    bound = true;
    nav.addEventListener("click", (e) => {
      const tog = e.target.closest("[data-toggle]");
      if (tog) {
        e.preventDefault();
        const id = tog.getAttribute("data-toggle");
        const box = nav.querySelector(`[data-group="${id}"]`);
        if (!box) return;
        box.classList.toggle("is-closed");
        const map = openGroups();
        map[id] = !box.classList.contains("is-closed");
        saveGroups(map);
        return;
      }
      const a = e.target.closest("a");
      if (!a) return;
      e.preventDefault();
      go(a.getAttribute("href"));
      if (window.innerWidth <= 768) document.documentElement.classList.remove("vivix-nav-open");
    });
  }

  function ensure(fromRoute) {
    if (writing) return;
    const aside = document.querySelector("#container aside");
    if (!aside) return;
    let nav = aside.querySelector(".vx-nav");
    const path = pathNow();

    writing = true;
    try {
      if (!nav) {
        nav = document.createElement("nav");
        nav.className = "vx-nav";
        nav.setAttribute("aria-label", "Navegação AgentHub");
        const figmaNav = [...aside.children].find((n) => n.tagName === "NAV" && !n.classList.contains("vx-nav"));
        if (figmaNav) figmaNav.insertAdjacentElement("afterend", nav);
        else aside.insertBefore(nav, aside.lastElementChild);
        bound = false;
        bindNav(nav);
        nav.dataset.vxPath = path;
        nav.innerHTML = htmlNav();
      } else if (nav.dataset.vxPath !== path) {
        nav.dataset.vxPath = path;
        nav.innerHTML = htmlNav();
      } else if (fromRoute) {
        highlight(nav);
      }
    } finally {
      queueMicrotask(() => {
        writing = false;
      });
    }
  }

  function onRoute() {
    ensure(true);
  }

  window.VivixIA = { IA, currentLabel, go, pathNow };

  let waitId = 0;
  const obs = new MutationObserver(() => {
    if (writing) return;
    if (document.querySelector("#container aside .vx-nav")) return;
    if (waitId) return;
    waitId = requestAnimationFrame(() => {
      waitId = 0;
      ensure(false);
    });
  });

  function start() {
    const box = document.getElementById("container");
    if (box) obs.observe(box, { childList: true, subtree: true });
    const watchAside = () => {
      ensure(false);
    };
    watchAside();
    const sub = () => {
      const router = window.__reactRouterDataRouter;
      if (router?.subscribe) router.subscribe(onRoute);
      else setTimeout(sub, 250);
    };
    sub();
    window.addEventListener("popstate", onRoute);
    let tries = 0;
    const boot = setInterval(() => {
      watchAside();
      if (document.querySelector(".vx-nav") || ++tries > 40) clearInterval(boot);
    }, 150);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
