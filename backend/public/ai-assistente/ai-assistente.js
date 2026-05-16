// AI Assistente – Controllo Totale
(function () {
  "use strict";

  const DEPARTMENTS = [
    {
      id: "kitchen",
      name: "AI Cucina",
      subtitle: "Produzione e preparazioni",
      icon: "👨‍🍳",
      color: "var(--orange)",
      colorBg: "var(--orange-bg)",
      description: "Gestisci la linea di produzione con suggerimenti AI in tempo reale basati sugli ordini attivi, scorte e menu.",
      capabilities: [
        "Ordini in attesa",
        "Prep list giornaliera",
        "Piatti in ritardo",
        "Prodotti in scadenza",
        "Semilavorati da preparare",
        "Piatti da spingere/sospendere",
        "Nuove ricette e varianti",
        "Ottimizzazione tempi"
      ],
      examples: [
        "Cosa devo preparare adesso?",
        "Ci sono prodotti in scadenza?",
        "Quali piatti sono in ritardo?",
        "Mostra la prep list del giorno",
      ],
    },
    {
      id: "supervisor",
      name: "AI Supervisor",
      subtitle: "Direzione e analisi",
      icon: "📊",
      color: "var(--accent)",
      colorBg: "var(--accent-bg)",
      description: "Panoramica completa della giornata con analisi vendite, margini, menu engineering e previsioni.",
      capabilities: [
        "Riepilogo giornata",
        "Incasso e coperti",
        "Scontrino medio",
        "Top piatti venduti",
        "Menu engineering",
        "Analisi margini",
        "Forecast vendite",
        "Criticità reparti"
      ],
      examples: [
        "Riepilogo della giornata",
        "Top piatti venduti oggi",
        "Analisi margini per reparto",
        "Previsioni per domani",
      ],
    },
    {
      id: "warehouse",
      name: "AI Magazzino",
      subtitle: "Scorte e acquisti",
      icon: "📦",
      color: "var(--teal)",
      colorBg: "var(--teal-bg)",
      description: "Monitora scorte, identifica sottoscorte e scadenze, ottimizza gli ordini ai fornitori.",
      capabilities: [
        "Sottoscorte critiche",
        "Prodotti in scadenza",
        "Stock fermo",
        "Lista acquisti ottimizzata",
        "Variazioni costo",
        "Menu anti-spreco",
        "Priorità riordino",
        "Trasferimenti reparto"
      ],
      examples: [
        "Cosa devo riordinare oggi?",
        "Prodotti sotto scorta minima",
        "Cosa sta per scadere?",
        "Lista acquisti ottimizzata",
      ],
    },
    {
      id: "cash",
      name: "AI Cassa",
      subtitle: "Incassi e pagamenti",
      icon: "💰",
      color: "var(--green)",
      colorBg: "var(--green-bg)",
      description: "Analizza incassi, metodi di pagamento, anomalie e performance dei turni cassa.",
      capabilities: [
        "Riepilogo incassi",
        "Metodi di pagamento",
        "Sconti e storni",
        "Anomalie scontrini",
        "Scontrino medio",
        "Confronto periodi",
        "Turni fuori media",
        "Andamento giornata"
      ],
      examples: [
        "Riepilogo incassi di oggi",
        "Quali metodi di pagamento si usano di più?",
        "Ci sono anomalie sugli scontrini?",
        "Scontrino medio rispetto alla settimana scorsa",
      ],
    },
    {
      id: "sala",
      name: "AI Sala",
      subtitle: "Servizio e tavoli",
      icon: "🍽️",
      color: "var(--blue)",
      colorBg: "var(--blue-bg)",
      description: "Gestisci il servizio in sala con informazioni su tavoli, ordini attivi, coperti e tempi.",
      capabilities: [
        "Tavoli aperti/occupati",
        "Ordini attivi",
        "Attesa conto",
        "Coperti in sala",
        "Tempi di servizio",
        "Flusso clienti",
        "Upselling suggerimenti",
        "Anomalie servizio"
      ],
      examples: [
        "Com'è la situazione tavoli adesso?",
        "Quanti ordini attivi ci sono?",
        "Quali tavoli aspettano il conto?",
        "Suggerisci come ottimizzare il servizio",
      ],
    },
    {
      id: "bar",
      name: "AI Bar",
      subtitle: "Bevande e cocktail",
      icon: "🍸",
      color: "var(--pink)",
      colorBg: "var(--pink-bg)",
      description: "Analizza ordini bar, scorte bevande, cocktail popolari e suggerisci drink del giorno.",
      capabilities: [
        "Ordini bar aperti",
        "Drink più richiesti",
        "Scorte in esaurimento",
        "Cocktail del giorno",
        "Drink stagionali",
        "Abbinamenti vino",
        "Bottiglie critiche",
        "Promozioni bevande"
      ],
      examples: [
        "Quali drink vanno di più oggi?",
        "Cosa sta finendo al bar?",
        "Suggerisci un cocktail del giorno",
        "Ordini bar aperti adesso",
      ],
    },
    {
      id: "creative",
      name: "AI Menu Creativo",
      subtitle: "Ricette e menu design",
      icon: "✨",
      color: "var(--amber)",
      colorBg: "var(--amber-bg)",
      description: "Crea menu del giorno, piatti stagionali e ricette usando ingredienti disponibili e target food cost.",
      capabilities: [
        "Menu del giorno",
        "Menu stagionali",
        "Nuovi piatti",
        "Ricette anti-spreco",
        "Food cost stimato",
        "Prezzo suggerito",
        "Abbinamenti",
        "Piatti con stock disponibile"
      ],
      examples: [
        "Proponi un menu del giorno",
        "Nuovi piatti con ingredienti disponibili",
        "Ricette anti-spreco",
        "Abbinamenti vino per il menu attuale",
      ],
    },
    {
      id: "pizzeria",
      name: "AI Pizzeria",
      subtitle: "Produzione pizze",
      icon: "🍕",
      color: "var(--red)",
      colorBg: "var(--red-bg)",
      description: "Gestisci la produzione pizze: ordini in coda, impasto, ingredienti e speciali del giorno.",
      capabilities: [
        "Ordini pizza in coda",
        "Ingredienti in esaurimento",
        "Impasto disponibile",
        "Tempi di cottura",
        "Speciali del giorno",
        "Varianti pizza",
        "Ottimizzazione forno",
        "Sottoscorte critiche"
      ],
      examples: [
        "Quanti ordini pizza ci sono in coda?",
        "Quali ingredienti stanno finendo?",
        "Impasto disponibile per oggi?",
        "Proponi una pizza speciale",
      ],
    },
    {
      id: "bookings",
      name: "AI Prenotazioni",
      subtitle: "Gestione prenotazioni",
      icon: "📅",
      color: "var(--cyan)",
      colorBg: "var(--cyan-bg)",
      description: "Visualizza e ottimizza prenotazioni, coperti previsti, orari di punta e no-show.",
      capabilities: [
        "Prenotazioni oggi",
        "Coperti previsti",
        "Tavoli disponibili",
        "No-show storici",
        "Orari di punta",
        "Prenotazioni confermate",
        "Richieste speciali",
        "Ottimizzazione turni"
      ],
      examples: [
        "Quante prenotazioni ci sono oggi?",
        "Coperti previsti per stasera",
        "Tavoli ancora disponibili",
        "Ci sono richieste speciali?",
      ],
    },
    {
      id: "suppliers",
      name: "AI Fornitori",
      subtitle: "Acquisti e rapporti",
      icon: "🤝",
      color: "var(--amber)",
      colorBg: "var(--amber-bg)",
      description: "Gestisci rapporti con i fornitori, ordini, fatture, confronta prezzi e valuta puntualità.",
      capabilities: [
        "Ordini aperti",
        "Fatture in sospeso",
        "Confronto prezzi",
        "Puntualità consegne",
        "Fornitori alternativi",
        "Scadenza contratti",
        "Top fornitori",
        "Criticità forniture"
      ],
      examples: [
        "Ordini aperti ai fornitori",
        "Fatture in sospeso",
        "Confronta prezzi per un prodotto",
        "Quali fornitori consegnano in ritardo?",
      ],
    },
    {
      id: "haccp",
      name: "AI HACCP",
      subtitle: "Sicurezza alimentare",
      icon: "🧪",
      color: "var(--green)",
      colorBg: "var(--green-bg)",
      description: "Monitora controlli HACCP, temperature, scadenze e genera report di conformità.",
      capabilities: [
        "Controlli scaduti",
        "Temperature fuori norma",
        "Scadenze prodotti",
        "Non conformità",
        "Registro pulizie",
        "CCP attivi",
        "Report conformità",
        "Azioni correttive"
      ],
      examples: [
        "Controlli HACCP scaduti",
        "Ci sono temperature fuori norma?",
        "Prodotti in scadenza oggi",
        "Genera report conformità",
      ],
    },
    {
      id: "shifts",
      name: "AI Turni",
      subtitle: "Pianificazione personale",
      icon: "📋",
      color: "var(--blue)",
      colorBg: "var(--blue-bg)",
      description: "Analizza turni, coperture, straordinari e suggerisci ottimizzazioni per il personale.",
      capabilities: [
        "Turni di oggi",
        "Coperture mancanti",
        "Straordinari",
        "Ferie e assenze",
        "Costo personale",
        "Ottimizzazione turni",
        "Disponibilità staff",
        "Conflitti turno"
      ],
      examples: [
        "Chi è in turno oggi?",
        "Ci sono coperture mancanti?",
        "Straordinari di questa settimana",
        "Ottimizza i turni della settimana",
      ],
    },
    {
      id: "archive",
      name: "AI Archivio",
      subtitle: "Storico e report",
      icon: "📁",
      color: "var(--muted)",
      colorBg: "rgba(139,144,165,.12)",
      description: "Analizza dati storici: incassi, fatture, comande, confronti periodi e trend.",
      capabilities: [
        "Incassi mensili",
        "Confronto periodi",
        "Trend vendite",
        "Fatture emesse",
        "Comande archiviate",
        "Piatti più venduti",
        "Marginalità storica",
        "Report esportabili"
      ],
      examples: [
        "Incassi ultimo mese",
        "Confronta questa settimana con la precedente",
        "Trend vendite degli ultimi 3 mesi",
        "Piatti più venduti questo mese",
      ],
    },
    {
      id: "takeaway",
      name: "AI Asporto",
      subtitle: "Ordini asporto",
      icon: "🥡",
      color: "var(--orange)",
      colorBg: "var(--orange-bg)",
      description: "Gestisci ordini asporto, orari di ritiro, preparazioni e analisi trend delivery.",
      capabilities: [
        "Ordini asporto aperti",
        "Orari di ritiro",
        "Tempi preparazione",
        "Trend asporto",
        "Piatti più ordinati",
        "Ritardi preparazione",
        "Packaging necessario",
        "Fasce orarie di punta"
      ],
      examples: [
        "Ordini asporto in coda",
        "Prossimi ritiri",
        "Quali piatti vanno di più in asporto?",
        "Ci sono ritardi nelle preparazioni?",
      ],
    },
    {
      id: "catering",
      name: "AI Catering",
      subtitle: "Eventi e banchetti",
      icon: "🎉",
      color: "var(--pink)",
      colorBg: "var(--pink-bg)",
      description: "Pianifica eventi catering con lista acquisti, prep list, timeline produzione e budget.",
      capabilities: [
        "Prossimi eventi",
        "Coperti e menu",
        "Liste acquisti",
        "Prep list evento",
        "Timeline produzione",
        "Criticità logistiche",
        "Scorte per evento",
        "Budget e margini"
      ],
      examples: [
        "Prossimo evento catering",
        "Lista acquisti per l'evento",
        "Prep list e timeline",
        "Criticità da risolvere",
      ],
    },
  ];

  let activeDept = null;
  let messages = [];
  let isLoading = false;

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function $(id) { return document.getElementById(id); }

  async function checkAiStatus() {
    try {
      const r = await fetch("/api/ai/usage", { credentials: "same-origin" });
      if (r.ok) {
        $("ai-status-dot").classList.add("online");
        $("ai-status-text").textContent = "AI operativa";
      } else {
        $("ai-status-dot").classList.add("offline");
        $("ai-status-text").textContent = "AI non raggiungibile";
      }
    } catch {
      $("ai-status-dot").classList.add("offline");
      $("ai-status-text").textContent = "Connessione assente";
    }
  }

  function renderDepartments() {
    const container = $("ai-departments");
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
          <span class="ai-dept-cta">Apri chat AI →</span>
          <span class="ai-dept-examples">${d.examples.length} domande rapide</span>
        </div>
      </div>
    `).join("");

    container.querySelectorAll(".ai-dept-card").forEach((card) => {
      card.addEventListener("click", () => {
        const dept = DEPARTMENTS.find((d) => d.id === card.dataset.dept);
        if (dept) openChat(dept);
      });
    });
  }

  function openChat(dept) {
    activeDept = dept;
    messages = [];
    isLoading = false;

    $("ai-chat-icon").textContent = dept.icon;
    $("ai-chat-title").textContent = dept.name;
    $("ai-chat-dept").textContent = dept.subtitle;
    $("ai-chat-backdrop").style.display = "flex";

    document.body.style.overflow = "hidden";

    renderQuickPrompts();
    renderMessages();

    const isMobile = window.innerWidth <= 680;
    if (!isMobile) {
      setTimeout(() => $("ai-chat-input").focus(), 150);
    }
  }

  function closeChat() {
    $("ai-chat-backdrop").style.display = "none";
    document.body.style.overflow = "";
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

  function scrollToBottom() {
    const container = $("ai-chat-messages");
    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
  }

  function renderMessages() {
    const container = $("ai-chat-messages");
    if (messages.length === 0) {
      container.innerHTML = `
        <div style="text-align:center;padding:40px 20px;color:var(--muted)">
          <div style="font-size:48px;margin-bottom:12px">${activeDept ? activeDept.icon : "🤖"}</div>
          <p style="font-size:15px;margin-bottom:6px">Ciao! Sono l'AI di <strong style="color:var(--ink)">${esc(activeDept ? activeDept.name : "")}</strong></p>
          <p style="font-size:13px">Usa le domande rapide o scrivi qualsiasi cosa.</p>
        </div>`;
      return;
    }
    container.innerHTML = messages.map((m) => {
      if (m.role === "user") return `<div class="ai-msg-user">${esc(m.content)}</div>`;
      if (m.role === "thinking") return `
        <div class="ai-msg-thinking">
          <div class="ai-thinking-dots"><span></span><span></span><span></span></div>
          AI sta elaborando…
        </div>`;
      if (m.role === "error") return `<div class="ai-msg-error">${esc(m.content)}</div>`;
      return renderAssistant(m);
    }).join("");

    scrollToBottom();

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
    const sendBtn = $("ai-chat-send");
    const input = $("ai-chat-input");
    sendBtn.disabled = true;
    messages.push({ role: "user", content: q });
    messages.push({ role: "thinking" });
    renderMessages();
    input.value = "";

    try {
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
      const result = await resp.json();
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
      sendBtn.disabled = false;
      renderMessages();
    }
  }

  function init() {
    checkAiStatus();
    renderDepartments();

    $("ai-chat-close").addEventListener("click", closeChat);

    $("ai-chat-backdrop").addEventListener("mousedown", (e) => {
      if (e.target === $("ai-chat-backdrop")) closeChat();
    });
    $("ai-chat-backdrop").addEventListener("touchstart", (e) => {
      if (e.target === $("ai-chat-backdrop")) closeChat();
    }, { passive: true });

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

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", () => {
        if (!activeDept) return;
        const modal = $("ai-chat-modal");
        if (window.innerWidth <= 680) {
          modal.style.height = window.visualViewport.height + "px";
        } else {
          modal.style.height = "";
        }
        scrollToBottom();
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
