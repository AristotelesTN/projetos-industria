/* Shell VIVIX: tokens + gaveta mobile no padrão do DS Mendix. */
(function () {
  const SIDE_BG = "#ffffff";
  const SIDE_TEXT = "#525252";
  const HEADER_BG = "#005751";
  const MQ = "(max-width: 768px)";
  let ticking = false;

  function isMobile() {
    return window.innerWidth <= 768;
  }

  function applyDrawer(open) {
    const aside = document.querySelector("#vivix-sidebar") || document.querySelector("#container .flex.h-screen > aside");
    if (!aside) return;
    const show = Boolean(open) && isMobile();
    aside.classList.toggle("vivix-drawer-open", show);
    if (!isMobile()) {
      aside.style.removeProperty("transform");
      return;
    }
    aside.style.setProperty("transform", show ? "none" : "translateX(-105%)", "important");
  }

  function setOpen(open) {
    document.documentElement.classList.toggle("vivix-nav-open", open);
    applyDrawer(open);
    const btn = document.querySelector(".vivix-menu-btn");
    if (btn) {
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      btn.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
      btn.innerHTML = open ? iconClose() : iconMenu();
    }
  }

  function iconMenu() {
    return '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  }

  function iconClose() {
    return '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  }

  function ensureChrome() {
    const header = document.querySelector("#container header");
    if (header && !header.querySelector(".vivix-menu-btn")) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "vivix-menu-btn";
      btn.setAttribute("aria-controls", "vivix-sidebar");
      btn.setAttribute("aria-expanded", "false");
      btn.setAttribute("aria-label", "Abrir menu");
      btn.innerHTML = iconMenu();
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        setOpen(!document.documentElement.classList.contains("vivix-nav-open"));
      });
      header.insertBefore(btn, header.firstChild);
    }

    const aside = document.querySelector("#vivix-sidebar") || document.querySelector("#container .flex.h-screen > aside");
    if (aside && !aside.id) aside.id = "vivix-sidebar";

    if (!document.querySelector(".vivix-backdrop")) {
      const backdrop = document.createElement("div");
      backdrop.className = "vivix-backdrop";
      backdrop.setAttribute("aria-hidden", "true");
      backdrop.addEventListener("click", () => setOpen(false));
      document.body.appendChild(backdrop);
    }
  }

  function paint() {
    const aside = document.querySelector("#vivix-sidebar") || document.querySelector("#container .flex.h-screen > aside");
    const header = document.querySelector("#container header");
    const main = document.querySelector("#container main");
    const shell = document.querySelector("#container .flex.h-screen");
    if (!aside || !header) return false;

    ensureChrome();

    if (shell) shell.style.setProperty("background-color", SIDE_BG, "important");
    aside.style.setProperty("background-color", SIDE_BG, "important");
    aside.style.setProperty("color", SIDE_TEXT, "important");
    aside.style.setProperty("border-right", "1px solid #e0e0e0", "important");
    header.style.setProperty("background-color", HEADER_BG, "important");
    header.style.setProperty("border-bottom", "none", "important");
    if (main) main.style.setProperty("background-color", SIDE_BG, "important");

    aside.querySelectorAll("a").forEach((a) => {
      if (a.closest(".vx-nav")) return;
      const active = a.getAttribute("aria-current") === "page" || a.classList.contains("active");
      a.style.setProperty("color", active ? "#00B2A9" : SIDE_TEXT, "important");
      a.style.setProperty(
        "background-color",
        active ? "rgba(0,178,169,0.12)" : "transparent",
        "important"
      );
    });

    const img = aside.querySelector("img");
    if (img) {
      img.style.setProperty("filter", "none", "important");
      const src = img.getAttribute("src") || "";
      if (/logo_vivix|\.png/i.test(src) && !src.includes("vivix-wordmark.svg")) {
        img.src = "/assets/vivix-wordmark.svg";
      }
    }

    applyDrawer(document.documentElement.classList.contains("vivix-nav-open"));
    return true;
  }

  function schedule() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      paint();
    });
  }

  function start() {
    paint();
    const root = document.getElementById("container");
    if (root) {
      const obs = new MutationObserver(schedule);
      obs.observe(root, { childList: true, subtree: true });
    }

    document.addEventListener("click", (e) => {
      const link = e.target.closest("#container aside a");
      if (link && isMobile()) setOpen(false);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") setOpen(false);
    });

    window.addEventListener("resize", () => {
      if (!isMobile()) setOpen(false);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
