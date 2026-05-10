(function () {
  "use strict";

  const money = (n) =>
    "€ " +
    (Number(n) || 0).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function todayISO() {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  }

  function defaultFromISO() {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 5);
    return d.toISOString().slice(0, 10);
  }

  function el(id) {
    return document.getElementById(id);
  }

  function showErr(id, msg) {
    const e = el(id);
    if (!e) return;
    e.style.display = msg ? "block" : "none";
    e.textContent = msg || "";
  }

  async function loadFinancial() {
    const from = el("f-from").value;
    const to = el("f-to").value;
    const groupBy = el("f-group").value;
    showErr("financial-err", "");
    try {
      const q = new URLSearchParams({ from, to, groupBy });
      const data = await window.RW_API.get("/api/archive/financial?" + q.toString());
      renderFinancialTable(data);
    } catch (err) {
      showErr("financial-err", err.message || String(err));
    }
  }

  function renderFinancialTable(data) {
    const head = el("tbl-financial-head");
    const body = el("tbl-financial-body");
    const g = data.groupBy || "day";
    if (g === "day") {
      head.innerHTML = `
        <th>Data</th>
        <th class="num">Incasso netto</th>
        <th class="num">Coperti (clienti)</th>
        <th class="num">Pagamenti</th>
        <th class="num">Staff in turno (univoci)</th>
        <th class="num">Spese (forn. + acquisti)</th>
      `;
      body.innerHTML = (data.series || [])
        .map(
          (r) => `
        <tr>
          <td>${r.date}</td>
          <td class="num">${money(r.netRevenue)}</td>
          <td class="num">${r.coversClients ?? 0}</td>
          <td class="num">${r.paymentsCount ?? 0}</td>
          <td class="num">${r.staffOnDuty ?? 0}</td>
          <td class="num">${money(r.expenseTotal)}</td>
        </tr>`
        )
        .join("");
    } else {
      head.innerHTML = `
        <th>Periodo</th>
        <th class="num">Incasso netto</th>
        <th class="num">Coperti</th>
        <th class="num">Pagamenti</th>
        <th class="num">Max staff/giorno</th>
        <th class="num">Spese</th>
        <th class="num">Giorni nel periodo</th>
      `;
      body.innerHTML = (data.series || [])
        .map(
          (r) => `
        <tr>
          <td>${r.key}</td>
          <td class="num">${money(r.netRevenue)}</td>
          <td class="num">${r.coversClients ?? 0}</td>
          <td class="num">${r.paymentsCount ?? 0}</td>
          <td class="num">${r.staffOnDutyMax ?? 0}</td>
          <td class="num">${money(r.expenseTotal)}</td>
          <td class="num">${r.days ?? 0}</td>
        </tr>`
        )
        .join("");
    }
  }

  async function loadCompare() {
    const yearA = Number(el("cmp-ya").value);
    const yearB = Number(el("cmp-yb").value);
    const month = Number(el("cmp-m").value);
    showErr("compare-err", "");
    try {
      const q = new URLSearchParams({ yearA, yearB, month });
      const data = await window.RW_API.get("/api/archive/financial/compare-month?" + q.toString());
      const tb = el("tbl-compare-body");
      tb.innerHTML = (data.rows || [])
        .map(
          (r) => `
        <tr>
          <td>${r.dayOfMonth}</td>
          <td class="num">${money(r.netRevenueA)}</td>
          <td class="num">${money(r.netRevenueB)}</td>
          <td class="num">${r.coversA ?? 0}</td>
          <td class="num">${r.coversB ?? 0}</td>
          <td class="num">${r.staffA ?? 0}</td>
          <td class="num">${r.staffB ?? 0}</td>
        </tr>`
        )
        .join("");
    } catch (err) {
      showErr("compare-err", err.message || String(err));
    }
  }

  async function loadPurchaseList() {
    const { items } = await window.RW_API.get("/api/archive/purchase-invoices");
    const tb = el("tbody-purchase");
    tb.innerHTML = (items || [])
      .map((x) => {
        const link = x.attachmentPath
          ? `<a href="/api/archive/purchase-invoices/${encodeURIComponent(x.id)}/file" target="_blank" rel="noopener">Scarica</a>`
          : "—";
        return `
        <tr>
          <td>${x.issueDate || "—"}</td>
          <td>${escapeHtml(x.supplierName || "")}</td>
          <td>${escapeHtml(x.invoiceNumber || "")}</td>
          <td class="num">${money(x.total)}</td>
          <td>${link}</td>
          <td><button type="button" class="btn danger btn-del-pi" data-id="${escapeHtml(x.id)}">Elimina</button></td>
        </tr>`;
      })
      .join("");

    tb.querySelectorAll(".btn-del-pi").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("Eliminare questa registrazione dall’archivio?")) return;
        try {
          await window.RW_API.del("/api/archive/purchase-invoices/" + encodeURIComponent(btn.dataset.id));
          await loadPurchaseList();
        } catch (e) {
          alert(e.message || String(e));
        }
      });
    });
  }

  function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  async function loadCassaInvoices() {
    const { invoices } = await window.RW_API.get("/api/archive/cassa-invoices");
    const tb = el("tbody-cassa-inv");
    tb.innerHTML = (invoices || [])
      .map(
        (x) => `
      <tr>
        <td>${x.date || "—"}</td>
        <td>${escapeHtml(x.number || "")}</td>
        <td>${escapeHtml(String(x.table ?? "—"))}</td>
        <td>${escapeHtml(x.clientName || "")}</td>
        <td class="num">${money(x.total)}</td>
      </tr>`
      )
      .join("");
  }

  async function savePurchase() {
    showErr("pi-err", "");
    const supplierName = el("pi-supplier").value.trim();
    const invoiceNumber = el("pi-number").value.trim();
    const issueDate = el("pi-date").value;
    const amount = parseFloat(el("pi-amount").value) || 0;
    const vatAmount = parseFloat(el("pi-vat").value) || 0;
    let total = parseFloat(el("pi-total").value);
    if (!Number.isFinite(total)) total = amount + vatAmount;
    const notes = el("pi-notes").value.trim();
    const fileInput = el("pi-file");
    const file = fileInput.files && fileInput.files[0];

    if (!supplierName || !issueDate) {
      showErr("pi-err", "Fornitore e data sono obbligatori.");
      return;
    }

    const body = {
      supplierName,
      invoiceNumber,
      issueDate,
      amount,
      vatAmount,
      total,
      notes,
    };

    if (file) {
      const b64 = await fileToBase64(file);
      body.fileBase64 = b64;
      body.fileName = file.name || "allegato";
    }

    try {
      await window.RW_API.post("/api/archive/purchase-invoices", body);
      el("pi-supplier").value = "";
      el("pi-number").value = "";
      el("pi-amount").value = "";
      el("pi-vat").value = "";
      el("pi-total").value = "";
      el("pi-notes").value = "";
      el("pi-file").value = "";
      await loadPurchaseList();
    } catch (err) {
      showErr("pi-err", err.message || String(err));
    }
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  function syncLocalCassaInvoices() {
    try {
      const raw = localStorage.getItem("rw_invoices");
      const arr = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(arr) || !arr.length) {
        alert("Nessuna fattura locale trovata (chiave rw_invoices). Apri la cassa da questo browser e salva almeno una fattura.");
        return;
      }
      window.RW_API
        .post("/api/archive/cassa-invoices/sync", { invoices: arr })
        .then((r) => {
          alert("Sincronizzate " + (r.merged || arr.length) + " voci in archivio.");
          return loadCassaInvoices();
        })
        .catch((e) => alert(e.message || String(e)));
    } catch (e) {
      alert(e.message || String(e));
    }
  }

  function initTabs() {
    document.querySelectorAll(".tab").forEach((t) => {
      t.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
        document.querySelectorAll(".panel").forEach((x) => x.classList.remove("active"));
        t.classList.add("active");
        const id = t.getAttribute("data-tab") === "in" ? "panel-in" : "panel-out";
        el(id).classList.add("active");
      });
    });
  }

  function initMonthSelect() {
    const sel = el("cmp-m");
    sel.innerHTML = "";
    for (let m = 1; m <= 12; m++) {
      const o = document.createElement("option");
      o.value = String(m);
      o.textContent = new Date(2000, m - 1, 1).toLocaleString("it-IT", { month: "long" });
      sel.appendChild(o);
    }
    const now = new Date();
    sel.value = String(now.getMonth() + 1);
  }

  document.addEventListener("DOMContentLoaded", () => {
    el("f-from").value = defaultFromISO();
    el("f-to").value = todayISO();
    const y = new Date().getFullYear();
    el("cmp-ya").value = y - 1;
    el("cmp-yb").value = y;
    initMonthSelect();
    el("pi-date").value = todayISO();

    el("btn-load-financial").addEventListener("click", loadFinancial);
    el("btn-compare").addEventListener("click", loadCompare);
    el("btn-pi-save").addEventListener("click", savePurchase);
    el("btn-sync-local").addEventListener("click", syncLocalCassaInvoices);
    el("btn-print").addEventListener("click", () => window.print());

    initTabs();

    loadFinancial();
    loadCompare();
    loadPurchaseList();
    loadCassaInvoices();
  });
})();
