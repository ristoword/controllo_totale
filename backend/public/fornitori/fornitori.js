/* global window, document, fetch, CustomEvent */

async function fetchJSON(url, options = {}) {
  const res = await fetch(url, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    if (res.status === 401) {
      const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = "/login/login.html" + (returnTo ? "?return=" + returnTo : "");
      return;
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function money(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return `€ ${x.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const STATUS_INV = {
  paid: "Pagata",
  open: "Aperta",
  overdue: "In ritardo",
};

let suppliersCache = [];
let selectedId = null;
let productTypesDraft = [];

function getFilterMode() {
  return document.getElementById("filter-archived")?.value || "exclude";
}

function getSearch() {
  return (document.getElementById("search-input")?.value || "").toLowerCase().trim();
}

function filteredSuppliers() {
  const q = getSearch();
  return suppliersCache.filter((s) => {
    if (!q) return true;
    const blob = [s.companyName, s.legalName, s.vatId, s.city, s.email, s.phone]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return blob.includes(q);
  });
}

function selectedSupplier() {
  return suppliersCache.find((s) => String(s.id) === String(selectedId)) || null;
}

async function loadSuppliers() {
  const mode = getFilterMode();
  const list = await fetchJSON("/api/suppliers?archived=" + encodeURIComponent(mode));
  suppliersCache = Array.isArray(list) ? list : [];
  renderList();
  const sel = selectedSupplier();
  if (!sel && suppliersCache.length) {
    selectSupplier(suppliersCache[0].id);
  } else if (sel) {
    await refreshSelected();
  } else {
    clearDetail();
  }
}

function renderList() {
  const el = document.getElementById("supplier-list");
  const items = filteredSuppliers();
  if (!items.length) {
    el.innerHTML = "<p class='muted'>Nessun fornitore in questa vista.</p>";
    return;
  }
  el.innerHTML = items
    .map((s) => {
      const inv = s.invoices || [];
      const overdue = inv.filter((i) => i.status === "overdue").length;
      const open = inv.filter((i) => i.status === "open").length;
      const ordCount = (s.orders || []).length;
      return `
        <button type="button" class="supplier-card ${String(s.id) === String(selectedId) ? "active" : ""}" data-id="${s.id}">
          <h3>${escapeHtml(s.companyName || "Senza nome")}</h3>
          <div class="mini">${escapeHtml(s.city || "—")} · P.IVA ${escapeHtml(s.vatId || "—")}</div>
          <div class="mini">
            ${s.archived ? '<span class="badge arch">Archiviato</span> ' : ""}
            <span class="muted">Ordini ${ordCount}</span> ·
            <span class="muted">Fatture ${inv.length}</span>
            ${open ? ` · <span class="badge open">${open} aperte</span>` : ""}
            ${overdue ? ` · <span class="badge overdue">${overdue} ritardo</span>` : ""}
          </div>
        </button>`;
    })
    .join("");

  el.querySelectorAll(".supplier-card").forEach((btn) => {
    btn.addEventListener("click", () => selectSupplier(btn.dataset.id));
  });
}

function clearDetail() {
  selectedId = null;
  document.getElementById("detail-empty").hidden = false;
  document.getElementById("detail-content").hidden = true;
}

async function selectSupplier(id) {
  selectedId = id;
  renderList();
  document.getElementById("detail-empty").hidden = true;
  document.getElementById("detail-content").hidden = false;
  await refreshSelected();
}

async function refreshSelected() {
  const s = selectedSupplier();
  if (!s) {
    clearDetail();
    return;
  }
  try {
    const full = await fetchJSON("/api/suppliers/" + encodeURIComponent(s.id));
    const idx = suppliersCache.findIndex((x) => String(x.id) === String(full.id));
    if (idx >= 0) suppliersCache[idx] = full;
    fillDetail(full);
  } catch (e) {
    console.error(e);
    alert(e.message || "Errore caricamento");
  }
}

function fillDetail(s) {
  document.getElementById("d-company").textContent = s.companyName || "—";
  document.getElementById("d-meta").textContent = [s.vatId && "P.IVA " + s.vatId, s.city, s.phone]
    .filter(Boolean)
    .join(" · ");

  const arch = document.getElementById("btn-archive");
  const rest = document.getElementById("btn-restore");
  if (s.archived) {
    arch.hidden = true;
    rest.hidden = false;
  } else {
    arch.hidden = false;
    rest.hidden = true;
  }

  document.getElementById("f-companyName").value = s.companyName || "";
  document.getElementById("f-legalName").value = s.legalName || "";
  document.getElementById("f-vatId").value = s.vatId || "";
  document.getElementById("f-fiscalCode").value = s.fiscalCode || "";
  document.getElementById("f-address").value = s.address || "";
  document.getElementById("f-cap").value = s.cap || "";
  document.getElementById("f-city").value = s.city || "";
  document.getElementById("f-province").value = s.province || "";
  document.getElementById("f-country").value = s.country || "IT";
  document.getElementById("f-phone").value = s.phone || "";
  document.getElementById("f-email").value = s.email || "";
  document.getElementById("f-pec").value = s.pec || "";
  document.getElementById("f-sdi").value = s.sdi || "";
  document.getElementById("f-bankName").value = s.bankName || "";
  document.getElementById("f-iban").value = s.iban || "";
  document.getElementById("f-paymentTerms").value = s.paymentTerms || "";
  document.getElementById("f-notes").value = s.notes || "";
  document.getElementById("f-defaultDiscountType").value = s.defaultDiscountType || "none";
  document.getElementById("f-defaultDiscountValue").value =
    s.defaultDiscountValue != null ? s.defaultDiscountValue : "";

  productTypesDraft = [...(s.productTypes || [])];
  renderProductTags();

  renderOrdersTable(s.orders || []);
  renderInvoicesTable(s.invoices || []);

  const y = new Date().getFullYear();
  document.getElementById("pay-from").value = `${y}-01-01`;
  document.getElementById("pay-to").value = new Date().toISOString().slice(0, 10);
  loadPaymentSummary();
}

function renderProductTags() {
  const wrap = document.getElementById("tags-product-types");
  wrap.innerHTML = productTypesDraft
    .map(
      (t, i) =>
        `<span class="tag">${escapeHtml(t)} <button type="button" data-i="${i}" aria-label="Rimuovi">&times;</button></span>`
    )
    .join("");
  wrap.querySelectorAll("button[data-i]").forEach((b) => {
    b.addEventListener("click", () => {
      productTypesDraft.splice(Number(b.dataset.i), 1);
      renderProductTags();
    });
  });
}

function renderOrdersTable(orders) {
  const tb = document.getElementById("tbody-orders");
  if (!orders.length) {
    tb.innerHTML = "<tr><td colspan='6' class='muted'>Nessun ordine registrato.</td></tr>";
    return;
  }
  tb.innerHTML = orders
    .map((o) => {
      return `<tr>
        <td>${escapeHtml(o.orderDate || "—")}</td>
        <td>${escapeHtml(o.reference || "—")}</td>
        <td>${escapeHtml(o.itemsSummary || o.notes || "—")}</td>
        <td>${money(o.totalAmount)}</td>
        <td>${escapeHtml(o.status || "—")}</td>
        <td class="no-print"><button type="button" class="btn small danger btn-del-order" data-id="${escapeHtml(o.id)}">Elimina</button></td>
      </tr>`;
    })
    .join("");
  tb.querySelectorAll(".btn-del-order").forEach((b) => {
    b.addEventListener("click", () => deleteOrder(b.dataset.id));
  });
}

function renderInvoicesTable(invoices) {
  const tb = document.getElementById("tbody-invoices");
  if (!invoices.length) {
    tb.innerHTML = "<tr><td colspan='8' class='muted'>Nessuna fattura registrata.</td></tr>";
    return;
  }
  tb.innerHTML = invoices
    .map((inv) => {
      const disc =
        inv.discountType === "percent"
          ? `${inv.discountValue || 0}%`
          : inv.discountType === "amount"
            ? money(inv.discountValue)
            : "—";
      const st = inv.status || "open";
      const badge =
        st === "paid" ? "paid" : st === "overdue" ? "overdue" : "open";
      return `<tr>
        <td>${escapeHtml(inv.number || "—")}</td>
        <td>${escapeHtml(inv.issueDate || "—")}</td>
        <td>${escapeHtml(inv.dueDate || "—")}</td>
        <td>${money(inv.amount)}</td>
        <td>${money(inv.paidAmount)}</td>
        <td>${escapeHtml(disc)}</td>
        <td><span class="badge ${badge}">${STATUS_INV[st] || st}</span></td>
        <td class="no-print"><button type="button" class="btn small danger btn-del-inv" data-id="${escapeHtml(inv.id)}">Elimina</button></td>
      </tr>`;
    })
    .join("");
  tb.querySelectorAll(".btn-del-inv").forEach((b) => {
    b.addEventListener("click", () => deleteInvoice(b.dataset.id));
  });
}

async function loadPaymentSummary() {
  const s = selectedSupplier();
  const el = document.getElementById("payment-summary");
  if (!s) {
    el.innerHTML = "";
    return;
  }
  const from = document.getElementById("pay-from")?.value || "";
  const to = document.getElementById("pay-to")?.value || "";
  const qs = new URLSearchParams();
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  try {
    const sum = await fetchJSON(
      "/api/suppliers/" + encodeURIComponent(s.id) + "/payment-summary?" + qs.toString()
    );
    el.innerHTML = `
      <div class="muted">Periodo: ${escapeHtml(sum.from || "…")} → ${escapeHtml(sum.to || "…")}</div>
      <div class="big">${money(sum.totalPaid)}</div>
      <div class="muted">Totale pagamenti registrati nel periodo (per data pagamento)</div>
      <p class="muted">Fatture: ${sum.countPaid} pagate · ${sum.countOpen} aperte · ${sum.countOverdue} in ritardo</p>
      <div class="payment-lines">
        ${(sum.invoiceLines || [])
          .map(
            (l) =>
              `<div>${escapeHtml(l.date)} — ${escapeHtml(l.number || l.invoiceId)} — ${money(l.paidAmount)}</div>`
          )
          .join("") || "<span class='muted'>Nessun pagamento nel periodo.</span>"}
      </div>`;
  } catch (e) {
    el.textContent = e.message || "Errore";
  }
}

async function saveAnagrafica() {
  const s = selectedSupplier();
  if (!s) return;
  const body = {
    companyName: document.getElementById("f-companyName").value.trim(),
    legalName: document.getElementById("f-legalName").value.trim(),
    vatId: document.getElementById("f-vatId").value.trim(),
    fiscalCode: document.getElementById("f-fiscalCode").value.trim(),
    address: document.getElementById("f-address").value.trim(),
    cap: document.getElementById("f-cap").value.trim(),
    city: document.getElementById("f-city").value.trim(),
    province: document.getElementById("f-province").value.trim(),
    country: document.getElementById("f-country").value.trim(),
    phone: document.getElementById("f-phone").value.trim(),
    email: document.getElementById("f-email").value.trim(),
    pec: document.getElementById("f-pec").value.trim(),
    sdi: document.getElementById("f-sdi").value.trim(),
    bankName: document.getElementById("f-bankName").value.trim(),
    iban: document.getElementById("f-iban").value.trim(),
    paymentTerms: document.getElementById("f-paymentTerms").value.trim(),
    notes: document.getElementById("f-notes").value.trim(),
    defaultDiscountType: document.getElementById("f-defaultDiscountType").value,
    defaultDiscountValue: parseFloat(document.getElementById("f-defaultDiscountValue").value) || 0,
  };
  if (!body.companyName) {
    alert("Ragione sociale obbligatoria.");
    return;
  }
  try {
    await fetchJSON("/api/suppliers/" + encodeURIComponent(s.id), {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    await loadSuppliers();
    await selectSupplier(s.id);
  } catch (e) {
    alert(e.message || "Errore salvataggio");
  }
}

async function saveProductTypes() {
  const s = selectedSupplier();
  if (!s) return;
  try {
    await fetchJSON("/api/suppliers/" + encodeURIComponent(s.id), {
      method: "PATCH",
      body: JSON.stringify({ productTypes: productTypesDraft }),
    });
    await loadSuppliers();
    await selectSupplier(s.id);
  } catch (e) {
    alert(e.message || "Errore");
  }
}

async function addOrder() {
  const s = selectedSupplier();
  if (!s) return;
  const orderDate = document.getElementById("o-date").value;
  const payload = {
    orderDate: orderDate || new Date().toISOString().slice(0, 10),
    reference: document.getElementById("o-ref").value.trim(),
    itemsSummary: document.getElementById("o-items").value.trim(),
    totalAmount: parseFloat(document.getElementById("o-amount").value) || 0,
    status: document.getElementById("o-status").value,
    notes: document.getElementById("o-notes").value.trim(),
  };
  try {
    await fetchJSON("/api/suppliers/" + encodeURIComponent(s.id) + "/orders", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    document.getElementById("o-ref").value = "";
    document.getElementById("o-items").value = "";
    document.getElementById("o-amount").value = "";
    document.getElementById("o-notes").value = "";
    await loadSuppliers();
    await selectSupplier(s.id);
  } catch (e) {
    alert(e.message || "Errore");
  }
}

async function deleteOrder(orderId) {
  const s = selectedSupplier();
  if (!s || !confirm("Eliminare questo ordine?")) return;
  try {
    await fetchJSON("/api/suppliers/" + encodeURIComponent(s.id) + "/orders/" + encodeURIComponent(orderId), {
      method: "DELETE",
    });
    await loadSuppliers();
    await selectSupplier(s.id);
  } catch (e) {
    alert(e.message || "Errore");
  }
}

async function addInvoice() {
  const s = selectedSupplier();
  if (!s) return;
  const payload = {
    number: document.getElementById("i-number").value.trim(),
    issueDate: document.getElementById("i-issue").value,
    dueDate: document.getElementById("i-due").value,
    amount: parseFloat(document.getElementById("i-amount").value) || 0,
    paidAmount: parseFloat(document.getElementById("i-paid").value) || 0,
    paidDate: document.getElementById("i-paid-date").value,
    discountType: document.getElementById("i-discount-type").value,
    discountValue: parseFloat(document.getElementById("i-discount-val").value) || 0,
    notes: document.getElementById("i-notes").value.trim(),
  };
  try {
    await fetchJSON("/api/suppliers/" + encodeURIComponent(s.id) + "/invoices", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    document.getElementById("i-number").value = "";
    document.getElementById("i-issue").value = "";
    document.getElementById("i-due").value = "";
    document.getElementById("i-amount").value = "";
    document.getElementById("i-paid").value = "";
    document.getElementById("i-paid-date").value = "";
    document.getElementById("i-discount-val").value = "";
    document.getElementById("i-notes").value = "";
    await loadSuppliers();
    await selectSupplier(s.id);
  } catch (e) {
    alert(e.message || "Errore");
  }
}

async function deleteInvoice(invoiceId) {
  const s = selectedSupplier();
  if (!s || !confirm("Eliminare questa fattura?")) return;
  try {
    await fetchJSON(
      "/api/suppliers/" + encodeURIComponent(s.id) + "/invoices/" + encodeURIComponent(invoiceId),
      { method: "DELETE" }
    );
    await loadSuppliers();
    await selectSupplier(s.id);
  } catch (e) {
    alert(e.message || "Errore");
  }
}

function showSubtab(name) {
  document.querySelectorAll(".subtab").forEach((b) => {
    b.classList.toggle("active", b.dataset.sub === name);
  });
  document.querySelectorAll(".subpanel").forEach((p) => {
    p.hidden = p.dataset.sub !== name;
  });
}

function printDetail() {
  if (!selectedId) return;
  const subs = document.querySelectorAll("#detail-content .subpanel");
  const prev = [];
  subs.forEach((el, i) => {
    prev[i] = el.hidden;
    el.hidden = false;
  });
  const onAfter = () => {
    subs.forEach((el, i) => {
      el.hidden = prev[i];
    });
    window.removeEventListener("afterprint", onAfter);
  };
  window.addEventListener("afterprint", onAfter);
  window.print();
}

async function createSupplier() {
  const body = {
    companyName: document.getElementById("m-companyName").value.trim(),
    vatId: document.getElementById("m-vatId").value.trim(),
    city: document.getElementById("m-city").value.trim(),
    phone: document.getElementById("m-phone").value.trim(),
    email: document.getElementById("m-email").value.trim(),
  };
  if (!body.companyName) {
    alert("Inserisci almeno la ragione sociale.");
    return;
  }
  try {
    const created = await fetchJSON("/api/suppliers", { method: "POST", body: JSON.stringify(body) });
    document.getElementById("modal-new").hidden = true;
    document.getElementById("m-companyName").value = "";
    document.getElementById("m-vatId").value = "";
    document.getElementById("m-city").value = "";
    document.getElementById("m-phone").value = "";
    document.getElementById("m-email").value = "";
    await loadSuppliers();
    await selectSupplier(created.id);
    showSubtab("anagrafica");
  } catch (e) {
    alert(e.message || "Errore");
  }
}

function init() {
  document.getElementById("btn-refresh").addEventListener("click", () => loadSuppliers());
  document.getElementById("filter-archived").addEventListener("change", () => loadSuppliers());
  document.getElementById("search-input").addEventListener("input", () => renderList());

  document.getElementById("btn-new-supplier").addEventListener("click", () => {
    document.getElementById("modal-new").hidden = false;
  });
  document.getElementById("modal-new-cancel").addEventListener("click", () => {
    document.getElementById("modal-new").hidden = true;
  });
  document.getElementById("modal-new").addEventListener("click", (e) => {
    if (e.target.dataset.close) document.getElementById("modal-new").hidden = true;
  });
  document.getElementById("modal-new-ok").addEventListener("click", createSupplier);

  document.getElementById("btn-save-anagrafica").addEventListener("click", saveAnagrafica);
  document.getElementById("btn-save-product-types").addEventListener("click", saveProductTypes);
  document.getElementById("btn-add-product-type").addEventListener("click", () => {
    const v = document.getElementById("input-product-type").value.trim();
    if (!v) return;
    productTypesDraft.push(v);
    document.getElementById("input-product-type").value = "";
    renderProductTags();
  });

  document.getElementById("btn-add-order").addEventListener("click", addOrder);
  document.getElementById("btn-add-invoice").addEventListener("click", addInvoice);

  document.getElementById("btn-apply-pay-range").addEventListener("click", loadPaymentSummary);
  document.getElementById("pay-from").addEventListener("change", loadPaymentSummary);
  document.getElementById("pay-to").addEventListener("change", loadPaymentSummary);

  document.getElementById("btn-print").addEventListener("click", printDetail);

  document.getElementById("btn-archive").addEventListener("click", async () => {
    const s = selectedSupplier();
    if (!s || !confirm("Archiviare questo fornitore? Resta consultabile in «Solo archivio».")) return;
    try {
      await fetchJSON("/api/suppliers/" + encodeURIComponent(s.id) + "/archive", { method: "POST", body: "{}" });
      await loadSuppliers();
    } catch (e) {
      alert(e.message || "Errore");
    }
  });

  document.getElementById("btn-restore").addEventListener("click", async () => {
    const s = selectedSupplier();
    if (!s) return;
    try {
      await fetchJSON("/api/suppliers/" + encodeURIComponent(s.id) + "/restore", { method: "POST", body: "{}" });
      await loadSuppliers();
      await selectSupplier(s.id);
    } catch (e) {
      alert(e.message || "Errore");
    }
  });

  document.querySelectorAll(".subtab").forEach((b) => {
    b.addEventListener("click", () => showSubtab(b.dataset.sub));
  });

  loadSuppliers();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
