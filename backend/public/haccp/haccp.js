let allChecks = [];
let activeFilters = { date: "", type: "" };

async function fetchJSON(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    ...options,
  });
  if (!res.ok) {
    if (res.status === 401) {
      try { localStorage.removeItem("rw_auth"); } catch (_) {}
      const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = "/login/login.html" + (returnTo ? "?return=" + returnTo : "");
      return;
    }
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

async function loadFromAPI() {
  const data = await fetchJSON("/api/haccp");
  return Array.isArray(data) ? data : [];
}

async function saveCheckAPI(payload) {
  return fetchJSON("/api/haccp", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

async function deleteCheckAPI(id) {
  return fetchJSON(`/api/haccp/${id}`, { method: "DELETE" });
}

function typeLabel(type) {
  const labels = {
    temperatura_frigo: "Temperatura frigo",
    temperatura_congelatore: "Temperatura congelatore",
    temperatura_alimento: "Temperatura alimento",
    pulizia: "Pulizia",
    scadenza: "Controllo scadenze",
    ricezione_merce: "Ricezione merce",
    altro: "Altro",
  };
  return labels[type] || type || "-";
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("it-IT");
}

function formatTime(timeStr) {
  if (!timeStr) return "";
  return String(timeStr).substring(0, 5);
}

function renderKpi() {
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayList = allChecks.filter(
    (c) => (c.date || c.createdAt || "").slice(0, 10) === todayStr
  );
  document.getElementById("kpi-total").textContent = allChecks.length;
  document.getElementById("kpi-today").textContent = todayList.length;
}

function applyFilters(checks) {
  let filtered = [...checks];
  if (activeFilters.date) {
    filtered = filtered.filter(
      (c) => (c.date || c.createdAt || "").slice(0, 10) === activeFilters.date
    );
  }
  if (activeFilters.type) {
    filtered = filtered.filter((c) => c.type === activeFilters.type);
  }
  filtered.sort((a, b) => {
    const aKey = (a.date || a.createdAt || "") + " " + (a.time || "");
    const bKey = (b.date || b.createdAt || "") + " " + (b.time || "");
    return bKey.localeCompare(aKey);
  });
  return filtered;
}

function renderChecksList() {
  const container = document.getElementById("checks-list");
  container.innerHTML = "";

  const filtered = applyFilters(allChecks);

  if (!filtered.length) {
    container.innerHTML =
      '<div class="check-meta">Nessun controllo registrato con i filtri attuali.</div>';
    renderKpi();
    return;
  }

  filtered.forEach((c) => {
    const div = document.createElement("div");
    div.className = "check-card";
    div.innerHTML = `
      <div class="check-top">
        <div class="check-main">
          <div class="check-type">${typeLabel(c.type)}</div>
          <div class="check-meta">
            ${formatDate(c.date || c.createdAt)} • ${formatTime(c.time) || "-"}
            ${c.operator ? " • Operatore: " + c.operator.replace(/</g, "&lt;") : ""}
          </div>
          <div class="check-meta">
            Valore: <strong>${String(c.value ?? c.temp ?? "-").replace(/</g, "&lt;")}</strong>
            ${c.unit ? " " + c.unit : ""}
          </div>
          ${c.note || c.notes ? `<div class="check-meta">Note: ${String(c.note || c.notes).replace(/</g, "&lt;")}</div>` : ""}
        </div>
      </div>
      <div class="check-actions">
        <button class="btn-xs danger" data-action="delete" data-id="${c.id}">Elimina</button>
      </div>
    `;

    div.querySelector("[data-action='delete']").addEventListener("click", () => {
      handleDeleteCheck(c.id);
    });

    container.appendChild(div);
  });

  renderKpi();
}

function setupFilters() {
  const dateInput = document.getElementById("filter-date");
  const typeSel = document.getElementById("filter-type");
  const resetBtn = document.getElementById("btn-reset-filters");

  dateInput.addEventListener("change", () => {
    activeFilters.date = dateInput.value || "";
    renderChecksList();
  });
  typeSel.addEventListener("change", () => {
    activeFilters.type = typeSel.value || "";
    renderChecksList();
  });
  resetBtn.addEventListener("click", () => {
    activeFilters = { date: "", type: "" };
    dateInput.value = "";
    typeSel.value = "";
    renderChecksList();
  });
}

async function handleSaveCheck() {
  const type = document.getElementById("field-type").value;
  const value = document.getElementById("field-value").value.trim();
  const date = document.getElementById("field-date").value;
  const time = document.getElementById("field-time").value;
  const operator = document.getElementById("field-operator").value.trim();
  const unit = document.getElementById("field-unit").value.trim();
  const notes = document.getElementById("field-notes").value.trim();

  if (!type) {
    alert("Seleziona il tipo di controllo.");
    return;
  }
  if (!date) {
    alert("Inserisci la data del controllo.");
    return;
  }

  try {
    const created = await saveCheckAPI({
      type,
      value,
      date,
      time,
      operator,
      unit,
      notes,
    });
    allChecks.push(created);

    document.getElementById("field-value").value = "";
    document.getElementById("field-operator").value = "";
    document.getElementById("field-unit").value = "";
    document.getElementById("field-notes").value = "";

    renderChecksList();
  } catch (err) {
    console.error("Errore salvataggio controllo:", err);
    alert("Errore: " + (err.message || "Salvataggio fallito."));
  }
}

async function handleDeleteCheck(id) {
  if (!confirm("Eliminare questo controllo HACCP?")) return;

  try {
    await deleteCheckAPI(id);
    allChecks = allChecks.filter((c) => c.id !== id);
    renderChecksList();
  } catch (err) {
    console.error("Errore eliminazione:", err);
    alert("Errore: " + (err.message || "Eliminazione fallita."));
  }
}

async function refreshChecks() {
  const listEl = document.getElementById("checks-list");
  listEl.innerHTML = "<div class='check-meta'>Caricamento...</div>";

  try {
    allChecks = await loadFromAPI();
    renderChecksList();
  } catch (err) {
    console.error("Errore caricamento controlli:", err);
    listEl.innerHTML = "<div class='check-meta error'>Errore caricamento. Riprova.</div>";
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const todayStr = new Date().toISOString().slice(0, 10);
  const fieldDate = document.getElementById("field-date");
  const now = new Date();
  const timeStr = String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
  const fieldTime = document.getElementById("field-time");
  if (fieldDate) fieldDate.value = todayStr;
  if (fieldTime) fieldTime.value = timeStr;

  document.getElementById("btn-save-check").addEventListener("click", handleSaveCheck);
  document.getElementById("btn-refresh").addEventListener("click", refreshChecks);

  setupFilters();
  await refreshChecks();
});
