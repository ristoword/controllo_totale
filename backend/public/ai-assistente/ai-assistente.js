// AI Assistente – Controllo Totale
(function () {
  "use strict";

  const MODULES = [
    {
      id: "cantina",
      nameKey: "ai_mod_cantina_name",
      subtitleKey: "ai_mod_cantina_sub",
      icon: "🍷",
      accent: "var(--wine)",
      accentBg: "var(--wine-bg)",
      badgeKey: "ai_mod_cantina_badge",
      href: "/cantina",
      descKey: "ai_mod_cantina_desc",
      features: ["Carta vini", "Stock bottiglie", "Margini %", "AI insight", "Filtri colore"],
      chatDept: null,
    },
    {
      id: "situazione-giorno",
      nameKey: "ai_mod_situazione_name",
      subtitleKey: "ai_mod_situazione_sub",
      icon: "📡",
      accent: "var(--gold)",
      accentBg: "var(--gold-bg)",
      badgeKey: "ai_mod_situazione_badge",
      href: "/situazione-giorno",
      descKey: "ai_mod_situazione_desc",
      features: ["Dati live", "Prenotazioni", "Staff", "TTS briefing", "Magazzino critico"],
      chatDept: null,
    },
    {
      id: "risto-comandi",
      nameKey: "ai_mod_risto_name",
      subtitleKey: "ai_mod_risto_sub",
      icon: "🎤",
      accent: "var(--green)",
      accentBg: "var(--green-bg)",
      badgeKey: "ai_mod_risto_badge",
      href: "/risto-comandi",
      descKey: "ai_mod_risto_desc",
      features: ["Voce STT", "Tool magazzino", "Tool cantina", "Briefing", "Chat operativa"],
      chatDept: null,
    },
  ];

  const DEPT_META = [
    { id: "cantina-ai", icon: "🍾", color: "var(--wine)", colorBg: "var(--wine-bg)" },
    { id: "kitchen", icon: "👨‍🍳", color: "var(--orange)", colorBg: "var(--orange-bg)" },
    { id: "supervisor", icon: "📊", color: "var(--accent)", colorBg: "var(--accent-bg)" },
    { id: "warehouse", icon: "📦", color: "var(--teal)", colorBg: "var(--teal-bg)" },
    { id: "cash", icon: "💰", color: "var(--green)", colorBg: "var(--green-bg)" },
    { id: "sala", icon: "🍽️", color: "var(--blue)", colorBg: "var(--blue-bg)" },
    { id: "bar", icon: "🍸", color: "var(--pink)", colorBg: "var(--pink-bg)" },
    { id: "creative", icon: "✨", color: "var(--amber)", colorBg: "var(--amber-bg)" },
    { id: "pizzeria", icon: "🍕", color: "var(--red)", colorBg: "var(--red-bg)" },
    { id: "prenotazioni", icon: "📅", color: "var(--cyan)", colorBg: "var(--cyan-bg)" },
    { id: "fornitori", icon: "🚛", color: "var(--teal)", colorBg: "var(--teal-bg)" },
    { id: "haccp", icon: "🛡️", color: "var(--red)", colorBg: "var(--red-bg)" },
    { id: "turni", icon: "📋", color: "var(--blue)", colorBg: "var(--blue-bg)" },
    { id: "archivio", icon: "📈", color: "var(--accent)", colorBg: "var(--accent-bg)" },
    { id: "asporto", icon: "🛵", color: "var(--orange)", colorBg: "var(--orange-bg)" },
    { id: "catering", icon: "🎪", color: "var(--pink)", colorBg: "var(--pink-bg)" },
  ];

  function deptSlug(id) {
    return id.replace(/-/g, "_");
  }

  function resolveDept(meta) {
    const s = deptSlug(meta.id);
    const caps = [];
    const examples = [];
    for (let i = 0; i < 8; i++) {
      const k = `ai_dept_${s}_cap_${i}`;
      const v = t(k);
      if (v && v !== k) caps.push(v);
    }
    for (let i = 0; i < 4; i++) {
      const k = `ai_dept_${s}_ex_${i}`;
      const v = t(k);
      if (v && v !== k) examples.push(v);
    }
    return {
      id: meta.id,
      icon: meta.icon,
      color: meta.color,
      colorBg: meta.colorBg,
      name: t(`ai_dept_${s}_name`),
      subtitle: t(`ai_dept_${s}_sub`),
      description: t(`ai_dept_${s}_desc`),
      capabilities: caps,
      examples: examples,
    };
  }

  function getDepartments() {
    return DEPT_META.map(resolveDept);
  }

  let activeDept = null;
  let messages = [];
  let isLoading = false;

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function $(id) { return document.getElementById(id); }

  function t(key) {
    if (typeof window.rwT === "function") return window.rwT(key);
    return key;
  }

  // Check AI status
  async function checkAiStatus() {
    try {
      const r = await fetch("/api/ai/usage", { credentials: "same-origin" });
      if (r.ok) {
        $("ai-status-dot").classList.add("online");
        $("ai-status-text").textContent = t("ai_status_ok");
      } else {
        $("ai-status-dot").classList.add("offline");
        $("ai-status-text").textContent = t("ai_status_off");
      }
    } catch {
      $("ai-status-dot").classList.add("offline");
      $("ai-status-text").textContent = t("ai_status_no_conn");
    }
  }

  // Render operational module cards
  function renderModules() {
    const container = $("ai-modules");
    if (!container) return;
    container.innerHTML = MODULES.map((m) => `
      <article class="ai-module-card" style="--module-accent:${m.accent};--module-bg:${m.accentBg}">
        <div class="ai-module-card-head">
          <div class="ai-module-icon">${m.icon}</div>
          <div>
            <div class="ai-module-name">${esc(t(m.nameKey))}</div>
            <div class="ai-module-subtitle">${esc(t(m.subtitleKey))}</div>
            <span class="ai-module-badge">${esc(t(m.badgeKey))}</span>
          </div>
        </div>
        <div class="ai-module-desc">${esc(t(m.descKey))}</div>
        <div class="ai-module-features">
          ${m.features.map((f) => `<span class="ai-module-tag">${esc(f)}</span>`).join("")}
        </div>
        <div class="ai-module-actions">
          <a class="ai-module-btn primary" href="${esc(m.href)}">${esc(t("ai_open_module_btn"))}</a>
        </div>
      </article>
    `).join("");
  }

  // Render department cards
  function renderDepartments() {
    const container = $("ai-departments");
    const DEPARTMENTS = getDepartments();
    container.innerHTML = DEPARTMENTS.map((d) => `
      <div class="ai-dept-card" data-dept="${d.id}">
        <div class="ai-dept-card-head">
          <div class="ai-dept-icon" style="background:${d.colorBg};color:${d.color}">${d.icon}</div>
          <div>
            <div class="ai-dept-name">${esc(d.name)}</div>
            <div class="ai-dept-subtitle">${esc(d.subtitle)}</div>
          </div>
        </div>
        <div class="ai-dept-desc">${esc(d.description)}</div>
        <div class="ai-dept-capabilities">
          ${d.capabilities.map((c) => `<span class="ai-cap-tag">${esc(c)}</span>`).join("")}
        </div>
        <div class="ai-dept-footer">
          <span class="ai-dept-cta">${esc(t("ai_open_chat"))}</span>
          <span class="ai-dept-examples">${d.examples.length} ${esc(t("ai_quick_questions"))}</span>
        </div>
      </div>
    `).join("");

    container.querySelectorAll(".ai-dept-card").forEach((card) => {
      card.addEventListener("click", () => {
        const dept = getDepartments().find((d) => d.id === card.dataset.dept);
        if (dept) openChat(dept);
      });
    });
  }

  // Open chat for department
  function openChat(dept) {
    activeDept = dept;
    messages = [];
    isLoading = false;

    $("ai-chat-icon").textContent = dept.icon;
    $("ai-chat-title").textContent = dept.name;
    $("ai-chat-dept").textContent = dept.subtitle;
    $("ai-chat-backdrop").style.display = "flex";

    renderQuickPrompts();
    renderMessages();
    setTimeout(() => $("ai-chat-input").focus(), 150);
  }

  function closeChat() {
    $("ai-chat-backdrop").style.display = "none";
    activeDept = null;
    messages = [];
  }

  function renderQuickPrompts() {
    if (!activeDept) return;
    const container = $("ai-chat-quick");
    container.innerHTML = activeDept.examples.map((e) =>
      `<button class="ai-qp" data-q="${esc(e)}">${esc(e)}</button>`
    ).join("");
    container.querySelectorAll(".ai-qp").forEach((btn) => {
      btn.addEventListener("click", () => sendMessage(btn.dataset.q));
    });
  }

  function renderMessages() {
    const container = $("ai-chat-messages");
    if (messages.length === 0) {
      container.innerHTML = `
        <div style="text-align:center;padding:40px 20px;color:var(--muted)">
          <div style="font-size:48px;margin-bottom:12px">${activeDept ? activeDept.icon : "🤖"}</div>
          <p style="font-size:15px;margin-bottom:6px">${esc(t("ai_chat_greeting"))} <strong style="color:var(--ink)">${esc(activeDept ? activeDept.name : "")}</strong></p>
          <p style="font-size:13px">${esc(t("ai_chat_hint"))}</p>
        </div>`;
      return;
    }
    container.innerHTML = messages.map((m) => {
      if (m.role === "user") return `<div class="ai-msg-user">${esc(m.content)}</div>`;
      if (m.role === "thinking") return `
        <div class="ai-msg-thinking">
          <div class="ai-thinking-dots"><span></span><span></span><span></span></div>
          ${esc(t("ai_thinking"))}
        </div>`;
      if (m.role === "error") return `<div class="ai-msg-error">${esc(m.content)}</div>`;
      return renderAssistant(m);
    }).join("");
    container.scrollTop = container.scrollHeight;

    container.querySelectorAll(".ai-msg-action").forEach((btn) => {
      btn.addEventListener("click", () => {
        const label = btn.dataset.label;
        if (label) sendMessage("Esegui azione: " + label);
      });
    });
  }

  function renderAssistant(msg) {
    const r = msg.raw || {};
    const summary = r.summary || r.answer || msg.content || "";
    const title = r.title || "";
    const insights = Array.isArray(r.insights) ? r.insights : [];
    const warnings = Array.isArray(r.warnings) ? r.warnings.filter(Boolean) : [];
    const actions = Array.isArray(r.actions) ? r.actions : [];
    const dp = r.dataPoints && typeof r.dataPoints === "object" ? r.dataPoints : {};
    const dpKeys = Object.keys(dp);

    let h = `<div class="ai-msg-assistant"><div class="ai-msg-card">`;
    if (title) h += `<div class="ai-msg-card-title">${esc(title)}</div>`;
    if (summary) h += `<div class="ai-msg-summary">${esc(summary)}</div>`;
    if (insights.length) {
      h += `<div class="ai-msg-insights">` +
        insights.map((i) => `<div class="ai-msg-insight">${esc(String(i))}</div>`).join("") + `</div>`;
    }
    if (dpKeys.length) {
      h += `<div class="ai-msg-dp">` +
        dpKeys.map((k) => `<span class="ai-msg-dp-item"><strong>${esc(k)}:</strong> ${esc(String(dp[k]))}</span>`).join("") + `</div>`;
    }
    if (warnings.length) {
      h += `<div class="ai-msg-warnings">` +
        warnings.map((w) => `<div class="ai-msg-warning">${esc(String(w))}</div>`).join("") + `</div>`;
    }
    if (actions.length) {
      h += `<div class="ai-msg-actions">` +
        actions.map((a) =>
          `<button class="ai-msg-action" data-label="${esc(a.label || "")}" title="${esc(a.description || "")}">${esc(a.label || a.id || "Azione")}</button>`
        ).join("") + `</div>`;
    }
    h += `</div></div>`;
    return h;
  }

  async function sendMessage(question) {
    const q = (question || "").trim();
    if (!q || isLoading || !activeDept) return;

    isLoading = true;
    $("ai-chat-send").disabled = true;
    messages.push({ role: "user", content: q });
    messages.push({ role: "thinking" });
    renderMessages();
    $("ai-chat-input").value = "";

    try {
      let result;
      if (activeDept.id === "cantina-ai") {
        const resp = await fetch("/api/ai/chat", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: q, context: "cantina", enableTools: false }),
        });
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          throw new Error(err.error || err.message || `HTTP ${resp.status}`);
        }
        const data = await resp.json();
        result = { summary: data.reply || data.answer || "Risposta ricevuta.", answer: data.reply };
      } else {
        const resp = await fetch(`/api/ai/${encodeURIComponent(activeDept.id)}/query`, {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: q, mode: "read" }),
        });
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          throw new Error(err.error || err.message || `HTTP ${resp.status}`);
        }
        result = await resp.json();
      }
      messages = messages.filter((m) => m.role !== "thinking");
      messages.push({
        role: "assistant",
        content: result.summary || result.answer || "Risposta ricevuta.",
        raw: result,
      });
    } catch (err) {
      messages = messages.filter((m) => m.role !== "thinking");
      messages.push({ role: "error", content: err.message || "Errore AI" });
    } finally {
      isLoading = false;
      $("ai-chat-send").disabled = false;
      renderMessages();
    }
  }

  // Init
  function init() {
    checkAiStatus();
    renderModules();
    renderDepartments();

    $("ai-chat-close").addEventListener("click", closeChat);
    $("ai-chat-backdrop").addEventListener("mousedown", (e) => {
      if (e.target === $("ai-chat-backdrop")) closeChat();
    });

    const input = $("ai-chat-input");
    const sendBtn = $("ai-chat-send");
    input.addEventListener("input", () => {
      sendBtn.disabled = !input.value.trim() || isLoading;
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && input.value.trim()) {
        e.preventDefault();
        sendMessage(input.value);
      }
    });
    sendBtn.addEventListener("click", () => {
      if (input.value.trim()) sendMessage(input.value);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && activeDept) closeChat();
    });

    window.addEventListener("i18n:updated", () => {
      checkAiStatus();
      renderModules();
      renderDepartments();
      if (activeDept) renderMessages();
    });
  }

  function boot() {
    init();
  }

  if (window.ControlloTotaleI18n && window.ControlloTotaleI18n.whenReady) {
    window.ControlloTotaleI18n.whenReady().then(boot);
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
