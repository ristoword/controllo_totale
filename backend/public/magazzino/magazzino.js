// magazzino.js – RISTOSAAS-style warehouse module (6 tabs)
// Backend field names: name, category, unit, quantity, cost, threshold, lot, supplier, deliveryDate, stocks, central

(function () {
  "use strict";

  // ─── helpers ───────────────────────────────────────────────────────
  async function fetchJSON(url, options) {
    const res = await fetch(url, {
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    if (!res.ok) {
      if (res.status === 401) {
        try { localStorage.removeItem("rw_auth"); } catch (_) {}
        const ret = encodeURIComponent(location.pathname + location.search);
        location.href = "/login/login.html?return=" + ret;
        return;
      }
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || "HTTP " + res.status);
    }
    return res.json();
  }

  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function fmtDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d)) return esc(iso);
    return d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  function fmtDateTime(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d)) return esc(iso);
    return d.toLocaleString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function fmtMoney(n) {
    return "€ " + (Number(n) || 0).toFixed(2).replace(".", ",");
  }

  function $(id) { return document.getElementById(id); }

  function openModal(id) { $(id)?.classList.add("open"); }
  function closeModal(id) { $(id)?.classList.remove("open"); }

  // ─── state ─────────────────────────────────────────────────────────
  let inventory = [];
  let transfers = [];
  let movements = [];
  let equipment = [];
  let shoppingList = [];
  let currentTab = "centrale";

  const SHOP_LS_KEY = "ct_shopping_list";

  const DEPT_KEYS = ["cucina", "pizzeria", "bar", "sala", "proprieta", "altro"];
  const DEPT_LABELS = {
    central: "Centrale",
    cucina: "Cucina",
    pizzeria: "Pizzeria",
    bar: "Bar",
    sala: "Sala",
    proprieta: "Proprietà",
    altro: "Altro",
  };

  const MOV_TYPE_BADGE = {
    load: '<span class="badge warning">carico</span>',
    carico: '<span class="badge warning">carico</span>',
    deduction: '<span class="badge danger">scarico</span>',
    scarico: '<span class="badge danger">scarico</span>',
    transfer_to_department: '<span class="badge info">trasferimento</span>',
    trasferimento: '<span class="badge info">trasferimento</span>',
    return_to_central: '<span class="badge success">rientro</span>',
    rettifica: '<span class="badge neutral">rettifica</span>',
    adjustment: '<span class="badge neutral">rettifica</span>',
  };

  // ─── tab switching ─────────────────────────────────────────────────
  function showTab(tab) {
    currentTab = tab;
    document.querySelectorAll(".mag-tab").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.toggle("active", p.id === "tab-" + tab));
    renderTab();
  }

  function renderTab() {
    switch (currentTab) {
      case "centrale": renderCentrale(); break;
      case "reparti": renderReparti(); break;
      case "ricezione": populateRecvProducts(); break;
      case "movimenti": renderMovimenti(); break;
      case "spesa": renderSpesa(); break;
      case "attrezzature": renderEquipment(); break;
    }
  }

  // ─── KPI ───────────────────────────────────────────────────────────
  function updateKPI() {
    const count = inventory.length;
    const low = inventory.filter(i => {
      const qty = Number(i.central ?? i.quantity) || 0;
      return Number(i.threshold) > 0 && qty <= Number(i.threshold);
    }).length;
    const totalValue = inventory.reduce((s, i) => {
      const qty = Number(i.central ?? i.quantity) || 0;
      return s + qty * (Number(i.cost) || 0);
    }, 0);

    $("kpi-count").textContent = count;
    $("kpi-low").textContent = low;
    $("kpi-value").textContent = fmtMoney(totalValue);

    const chip = $("kpi-sotto-scorta");
    if (chip) chip.classList.toggle("alert", low > 0);
  }

  // ─── data loading ──────────────────────────────────────────────────
  async function loadAll() {
    try {
      const [inv, xfer, mov] = await Promise.all([
        fetchJSON("/api/inventory"),
        fetchJSON("/api/inventory/transfers?limit=200"),
        fetchJSON("/api/stock-movements"),
      ]);
      inventory = Array.isArray(inv) ? inv : [];
      transfers = Array.isArray(xfer) ? xfer : [];
      movements = Array.isArray(mov) ? mov : [];
    } catch (e) {
      console.error("loadAll error:", e);
    }
    updateKPI();
    renderTab();
  }

  async function loadEquipment() {
    try {
      equipment = await fetchJSON("/api/devices");
      if (!Array.isArray(equipment)) equipment = [];
    } catch (_) {
      equipment = [];
    }
  }

  // ─── TAB 1: CENTRALE ──────────────────────────────────────────────
  function renderCentrale() {
    const tbody = $("tbody-centrale");
    if (!tbody) return;
    const search = ($("search-centrale")?.value || "").toLowerCase();
    const items = inventory.filter(i => {
      if (search) {
        const hay = ((i.name || "") + " " + (i.category || "") + " " + (i.supplier || "")).toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });

    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="muted" style="text-align:center">Nessun prodotto.</td></tr>';
      return;
    }

    tbody.innerHTML = items.map(i => {
      const qty = Number(i.central ?? i.quantity) || 0;
      const lowStock = Number(i.threshold) > 0 && qty <= Number(i.threshold);
      const lowBadge = lowStock ? ' <span class="badge danger">sotto scorta</span>' : "";
      const catLine = [i.category, i.supplier].filter(Boolean).map(esc).join(" · ");
      return `<tr data-id="${i.id}">
        <td>
          <div class="prod-name">${esc(i.name)}${lowBadge}</div>
          ${catLine ? '<div class="prod-meta">' + catLine + '</div>' : ""}
        </td>
        <td class="num">${qty} ${esc(i.unit || "")}</td>
        <td class="num">${fmtMoney(i.cost)}</td>
        <td>${esc(i.lot || "—")}</td>
        <td>${fmtDate(i.deliveryDate) || "—"}</td>
        <td class="center">
          <span class="stock-btns">
            <button data-act="minus" data-id="${i.id}" title="-1">−</button>
            <button data-act="plus" data-id="${i.id}" title="+1">+</button>
          </span>
        </td>
        <td>
          <div class="actions">
            <button class="btn small" data-act="edit" data-id="${i.id}">Modifica</button>
            <button class="btn small btn-danger" data-act="delete" data-id="${i.id}">Elimina</button>
          </div>
        </td>
      </tr>`;
    }).join("");

    tbody.onclick = handleCentraleClick;
  }

  async function handleCentraleClick(e) {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const act = btn.dataset.act;
    const id = btn.dataset.id;

    if (act === "minus" || act === "plus") {
      const delta = act === "plus" ? 1 : -1;
      try {
        await fetchJSON("/api/inventory/" + id + "/adjust", {
          method: "PATCH",
          body: JSON.stringify({ delta }),
        });
        await loadAll();
      } catch (err) { alert(err.message); }
    } else if (act === "edit") {
      openEditModal(id);
    } else if (act === "delete") {
      openDeleteModal(id);
    }
  }

  // add product
  async function addProduct() {
    const name = $("f-name")?.value.trim();
    if (!name) { alert("Nome obbligatorio."); return; }
    const body = {
      name,
      category: $("f-category")?.value.trim() || "",
      unit: $("f-unit")?.value || "pz",
      quantity: parseFloat($("f-qty")?.value) || 0,
      threshold: parseFloat($("f-threshold")?.value) || 0,
      cost: parseFloat($("f-cost")?.value) || 0,
      supplier: $("f-supplier")?.value.trim() || "",
      lot: $("f-lot")?.value.trim() || "",
      deliveryDate: $("f-expiry")?.value || "",
    };
    try {
      await fetchJSON("/api/inventory", { method: "POST", body: JSON.stringify(body) });
      ["f-name","f-category","f-qty","f-threshold","f-cost","f-supplier","f-lot","f-expiry"].forEach(id => { const el = $(id); if (el) el.value = ""; });
      $("f-unit").value = "pz";
      await loadAll();
    } catch (err) { alert(err.message); }
  }

  // edit modal
  let editingProductId = null;

  function openEditModal(id) {
    const item = inventory.find(i => String(i.id) === String(id));
    if (!item) return;
    editingProductId = id;
    $("edit-name").value = item.name || "";
    $("edit-category").value = item.category || "";
    $("edit-unit").value = item.unit || "pz";
    $("edit-qty").value = item.quantity ?? item.central ?? "";
    $("edit-threshold").value = item.threshold ?? "";
    $("edit-cost").value = item.cost ?? "";
    $("edit-supplier").value = item.supplier || "";
    $("edit-lot").value = item.lot || "";
    $("edit-expiry").value = item.deliveryDate ? item.deliveryDate.slice(0, 10) : "";
    openModal("modal-edit");
  }

  async function confirmEdit() {
    if (!editingProductId) return;
    const body = {
      name: $("edit-name").value.trim(),
      category: $("edit-category").value.trim(),
      unit: $("edit-unit").value,
      quantity: parseFloat($("edit-qty").value) || 0,
      threshold: parseFloat($("edit-threshold").value) || 0,
      cost: parseFloat($("edit-cost").value) || 0,
      supplier: $("edit-supplier").value.trim(),
      lot: $("edit-lot").value.trim(),
      deliveryDate: $("edit-expiry").value || "",
    };
    if (!body.name) { alert("Nome obbligatorio."); return; }
    try {
      await fetchJSON("/api/inventory/" + editingProductId, { method: "PATCH", body: JSON.stringify(body) });
      closeModal("modal-edit");
      editingProductId = null;
      await loadAll();
    } catch (err) { alert(err.message); }
  }

  // stock adjust modal
  let adjustProductId = null;

  function openAdjustModal(id) {
    const item = inventory.find(i => String(i.id) === String(id));
    if (!item) return;
    adjustProductId = id;
    $("adjust-product-label").textContent = item.name || "—";
    $("adjust-delta").value = "";
    openModal("modal-adjust");
  }

  async function confirmAdjust() {
    if (!adjustProductId) return;
    const delta = parseFloat($("adjust-delta").value);
    if (!Number.isFinite(delta) || delta === 0) { alert("Inserisci un valore."); return; }
    try {
      await fetchJSON("/api/inventory/" + adjustProductId + "/adjust", {
        method: "PATCH",
        body: JSON.stringify({ delta }),
      });
      closeModal("modal-adjust");
      adjustProductId = null;
      await loadAll();
    } catch (err) { alert(err.message); }
  }

  // delete modal
  let deleteProductId = null;

  function openDeleteModal(id) {
    const item = inventory.find(i => String(i.id) === String(id));
    if (!item) return;
    deleteProductId = id;
    $("delete-label").textContent = 'Eliminare "' + (item.name || "?") + '" dal magazzino?';
    openModal("modal-delete");
  }

  async function confirmDelete() {
    if (!deleteProductId) return;
    try {
      await fetchJSON("/api/inventory/" + deleteProductId, { method: "DELETE" });
      closeModal("modal-delete");
      deleteProductId = null;
      await loadAll();
    } catch (err) { alert(err.message); }
  }

  // ─── TAB 2: REPARTI ───────────────────────────────────────────────
  function renderReparti() {
    const tbody = $("tbody-reparti");
    if (!tbody) return;
    if (!inventory.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="muted" style="text-align:center">Nessun prodotto.</td></tr>';
      return;
    }

    tbody.innerHTML = inventory.map(i => {
      const central = Number(i.central ?? i.quantity) || 0;
      const stocks = i.stocks || {};
      const vals = DEPT_KEYS.map(k => Number(stocks[k]) || 0);
      const total = central + vals.reduce((a, b) => a + b, 0);
      return `<tr>
        <td class="prod-name">${esc(i.name)}</td>
        <td class="num">${central}</td>
        ${vals.map(v => '<td class="num">' + (v || "—") + '</td>').join("")}
        <td class="num" style="font-weight:600">${total}</td>
      </tr>`;
    }).join("");
  }

  // transfer modal
  function openTransferModal() {
    const sel = $("xfer-product");
    sel.innerHTML = inventory.map(i => `<option value="${i.id}">${esc(i.name)}</option>`).join("");
    $("xfer-qty").value = "";
    $("xfer-note").value = "";
    $("xfer-from").value = "central";
    $("xfer-to").value = "cucina";
    openModal("modal-transfer");
  }

  async function confirmTransfer() {
    const productId = $("xfer-product").value;
    const from = $("xfer-from").value;
    const to = $("xfer-to").value;
    const qty = parseFloat($("xfer-qty").value);
    const note = $("xfer-note").value.trim();

    if (!productId) { alert("Seleziona un prodotto."); return; }
    if (!qty || qty <= 0) { alert("Quantità non valida."); return; }
    if (from === to) { alert("Origine e destinazione devono essere diverse."); return; }

    try {
      if (from === "central") {
        await fetchJSON("/api/inventory/transfer", {
          method: "POST",
          body: JSON.stringify({ productId, toDepartment: to, quantity: qty, note }),
        });
      } else if (to === "central") {
        await fetchJSON("/api/inventory/return", {
          method: "POST",
          body: JSON.stringify({ productId, fromDepartment: from, quantity: qty, note }),
        });
      } else {
        await fetchJSON("/api/inventory/return", {
          method: "POST",
          body: JSON.stringify({ productId, fromDepartment: from, quantity: qty, note }),
        });
        await fetchJSON("/api/inventory/transfer", {
          method: "POST",
          body: JSON.stringify({ productId, toDepartment: to, quantity: qty, note }),
        });
      }
      closeModal("modal-transfer");
      await loadAll();
    } catch (err) { alert(err.message); }
  }

  // ─── TAB 3: RICEZIONE ─────────────────────────────────────────────
  function populateRecvProducts() {
    const sel = $("recv-product");
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">— seleziona —</option>' +
      inventory.map(i => `<option value="${i.id}">${esc(i.name)}</option>`).join("");
    if (current) sel.value = current;
  }

  async function doReceive() {
    const productId = $("recv-product").value;
    const qty = parseFloat($("recv-qty").value);
    const dest = $("recv-dest").value;
    const status = $("recv-status");

    if (!productId) { showStatus(status, "Seleziona un prodotto.", "error"); return; }
    if (!qty || qty <= 0) { showStatus(status, "Quantità non valida.", "error"); return; }

    try {
      showStatus(status, "Registrazione…", "info");
      await fetchJSON("/api/inventory/receive", {
        method: "POST",
        body: JSON.stringify({ productId, quantity: qty, destinationWarehouse: dest, unit: "pz" }),
      });
      showStatus(status, "Carico registrato.", "success");
      $("recv-qty").value = "";
      await loadAll();
      setTimeout(() => showStatus(status, "", ""), 3000);
    } catch (err) { showStatus(status, err.message, "error"); }
  }

  function showStatus(el, msg, type) {
    if (!el) return;
    el.textContent = msg;
    el.className = "receive-status " + (type || "");
  }

  // ─── TAB 4: MOVIMENTI ─────────────────────────────────────────────
  function renderMovimenti() {
    const tbody = $("tbody-movimenti");
    if (!tbody) return;

    const all = mergeMovements();
    if (!all.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="muted" style="text-align:center">Nessun movimento.</td></tr>';
      return;
    }

    tbody.innerHTML = all.map(m => {
      const badge = MOV_TYPE_BADGE[m.type] || '<span class="badge neutral">' + esc(m.type || "?") + '</span>';
      const from = m.fromWarehouse || m.from || "";
      const to = m.toWarehouse || m.to || "";
      const route = [from ? DEPT_LABELS[from] || from : "", to ? DEPT_LABELS[to] || to : ""].filter(Boolean).join(" → ") || "—";
      const canEdit = m.source === "transfer" && m.type === "load";
      return `<tr>
        <td>${fmtDateTime(m.createdAt || m.date)}</td>
        <td>${esc(m.productName || m.itemName || "—")}</td>
        <td>${badge}</td>
        <td class="num">${m.quantity ?? "—"}</td>
        <td>${route}</td>
        <td>${esc(m.reason || "—")}</td>
        <td>${esc(m.note || "—")}</td>
        <td>${canEdit ? '<button class="btn small" data-act="edit-mov" data-tid="' + m.id + '">Modifica</button>' : ""}</td>
      </tr>`;
    }).join("");

    tbody.onclick = e => {
      const btn = e.target.closest("[data-act='edit-mov']");
      if (btn) openEditMovModal(btn.dataset.tid);
    };
  }

  function mergeMovements() {
    const fromTransfers = transfers.map(t => ({ ...t, source: "transfer" }));
    const fromMovements = movements.map(m => ({ ...m, source: "movement" }));
    const all = [...fromTransfers, ...fromMovements];
    const seen = new Set();
    const deduped = all.filter(m => {
      const key = (m.productName || m.itemName || "") + "|" + m.quantity + "|" + (m.createdAt || m.date || "");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    deduped.sort((a, b) => new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0));
    return deduped;
  }

  // new movement modal
  function openMovementModal() {
    const sel = $("mov-product");
    sel.innerHTML = inventory.map(i => `<option value="${i.id}">${esc(i.name)}</option>`).join("");
    $("mov-type").value = "carico";
    $("mov-qty").value = "";
    $("mov-from").value = "";
    $("mov-to").value = "";
    $("mov-reason").value = "";
    $("mov-note").value = "";
    openModal("modal-movement");
  }

  async function confirmMovement() {
    const productId = $("mov-product").value;
    const type = $("mov-type").value;
    const qty = parseFloat($("mov-qty").value);
    const from = $("mov-from").value;
    const to = $("mov-to").value;
    const reason = $("mov-reason").value.trim();
    const note = $("mov-note").value.trim();

    if (!productId) { alert("Seleziona un prodotto."); return; }
    if (!qty || qty <= 0) { alert("Quantità non valida."); return; }

    try {
      if (type === "carico") {
        const dest = to || "central";
        await fetchJSON("/api/inventory/receive", {
          method: "POST",
          body: JSON.stringify({ productId, quantity: qty, destinationWarehouse: dest, unit: "pz", notes: reason || note }),
        });
      } else if (type === "scarico") {
        await fetchJSON("/api/inventory/" + productId + "/adjust", {
          method: "PATCH",
          body: JSON.stringify({ delta: -qty }),
        });
      } else if (type === "trasferimento") {
        if (from === "central" || !from) {
          await fetchJSON("/api/inventory/transfer", {
            method: "POST",
            body: JSON.stringify({ productId, toDepartment: to || "cucina", quantity: qty, note }),
          });
        } else {
          await fetchJSON("/api/inventory/return", {
            method: "POST",
            body: JSON.stringify({ productId, fromDepartment: from, quantity: qty, note }),
          });
          if (to && to !== "central") {
            await fetchJSON("/api/inventory/transfer", {
              method: "POST",
              body: JSON.stringify({ productId, toDepartment: to, quantity: qty, note }),
            });
          }
        }
      } else if (type === "rettifica") {
        await fetchJSON("/api/inventory/" + productId + "/adjust", {
          method: "PATCH",
          body: JSON.stringify({ delta: qty }),
        });
      }
      closeModal("modal-movement");
      await loadAll();
    } catch (err) { alert(err.message); }
  }

  // edit movement modal
  let editMovTransferId = null;

  function openEditMovModal(tid) {
    const t = transfers.find(x => String(x.id) === String(tid));
    if (!t) return;
    editMovTransferId = tid;
    $("editmov-label").textContent = (t.productName || "—") + " – " + (t.type || "");
    $("editmov-qty").value = t.quantity ?? "";
    $("editmov-note").value = t.note || "";
    openModal("modal-edit-mov");
  }

  async function confirmEditMov() {
    if (!editMovTransferId) return;
    const qty = parseFloat($("editmov-qty").value);
    const note = $("editmov-note").value.trim();
    if (!qty || qty <= 0) { alert("Quantità non valida."); return; }
    try {
      await fetchJSON("/api/inventory/transfers/" + encodeURIComponent(editMovTransferId), {
        method: "PATCH",
        body: JSON.stringify({ quantity: qty, note }),
      });
      closeModal("modal-edit-mov");
      editMovTransferId = null;
      await loadAll();
    } catch (err) { alert(err.message); }
  }

  // ─── TAB 5: LISTA SPESA ───────────────────────────────────────────
  function loadShoppingList() {
    try {
      const raw = localStorage.getItem(SHOP_LS_KEY);
      shoppingList = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(shoppingList)) shoppingList = [];
    } catch (_) { shoppingList = []; }
  }

  function saveShoppingList() {
    try { localStorage.setItem(SHOP_LS_KEY, JSON.stringify(shoppingList)); } catch (_) {}
  }

  function renderSpesa() {
    renderSuggestions();
    renderShopList();
  }

  function renderSuggestions() {
    const el = $("shop-suggestions");
    if (!el) return;
    const lowItems = inventory.filter(i => {
      const qty = Number(i.central ?? i.quantity) || 0;
      return Number(i.threshold) > 0 && qty <= Number(i.threshold);
    });
    if (!lowItems.length) {
      el.innerHTML = '<p class="muted">Nessun prodotto sotto scorta.</p>';
      return;
    }
    el.innerHTML = lowItems.map(i =>
      `<button class="suggestion-chip" data-name="${esc(i.name)}">${esc(i.name)} (${Number(i.central ?? i.quantity) || 0}/${i.threshold})</button>`
    ).join("");
    el.onclick = e => {
      const chip = e.target.closest(".suggestion-chip");
      if (!chip) return;
      addToShoppingList(chip.dataset.name, "");
    };
  }

  function renderShopList() {
    const el = $("shop-list");
    if (!el) return;
    if (!shoppingList.length) {
      el.innerHTML = '<p class="muted">Lista vuota.</p>';
      return;
    }
    el.innerHTML = shoppingList.map((item, idx) => {
      return `<div class="shop-item ${item.done ? "done" : ""}">
        <input type="checkbox" data-idx="${idx}" ${item.done ? "checked" : ""} />
        <span>${esc(item.name)}${item.qty ? " – " + esc(item.qty) : ""}</span>
        <button class="btn small btn-danger" data-del="${idx}" style="margin-left:auto">×</button>
      </div>`;
    }).join("");
    el.onclick = e => {
      const cb = e.target.closest("input[type=checkbox]");
      if (cb) {
        const idx = Number(cb.dataset.idx);
        shoppingList[idx].done = cb.checked;
        saveShoppingList();
        renderShopList();
        return;
      }
      const del = e.target.closest("[data-del]");
      if (del) {
        shoppingList.splice(Number(del.dataset.del), 1);
        saveShoppingList();
        renderShopList();
      }
    };
  }

  function addToShoppingList(name, qty) {
    if (!name) return;
    shoppingList.push({ name, qty: qty || "", done: false });
    saveShoppingList();
    renderShopList();
  }

  // ─── TAB 6: ATTREZZATURE ──────────────────────────────────────────
  let editingEquipId = null;

  async function renderEquipment() {
    if (!equipment.length) await loadEquipment();
    const tbody = $("tbody-equip");
    if (!tbody) return;
    if (!equipment.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="muted" style="text-align:center">Nessuna attrezzatura.</td></tr>';
      return;
    }

    const STATUS_BADGES = {
      operativo: '<span class="badge success">operativo</span>',
      manutenzione: '<span class="badge warning">manutenzione</span>',
      "fuori uso": '<span class="badge danger">fuori uso</span>',
    };

    tbody.innerHTML = equipment.map(e => `<tr data-eid="${e.id}">
      <td class="prod-name">${esc(e.name || "—")}</td>
      <td>${esc(e.category || "—")}</td>
      <td class="num">${e.quantity ?? e.qty ?? "—"}</td>
      <td>${STATUS_BADGES[e.status] || esc(e.status || "—")}</td>
      <td>${esc(e.location || "—")}</td>
      <td class="num">${fmtMoney(e.value || e.unitValue || 0)}</td>
      <td>
        <div class="actions">
          <button class="btn small" data-act="edit-eq" data-eid="${e.id}">Modifica</button>
          <button class="btn small btn-danger" data-act="del-eq" data-eid="${e.id}">Elimina</button>
        </div>
      </td>
    </tr>`).join("");

    tbody.onclick = async ev => {
      const btn = ev.target.closest("[data-act]");
      if (!btn) return;
      const eid = btn.dataset.eid;
      if (btn.dataset.act === "del-eq") {
        if (!confirm("Eliminare questa attrezzatura?")) return;
        try {
          await fetchJSON("/api/devices/" + eid, { method: "DELETE" });
          await loadEquipment();
          renderEquipment();
        } catch (err) { alert(err.message); }
      } else if (btn.dataset.act === "edit-eq") {
        fillEquipForm(eid);
      }
    };
  }

  function fillEquipForm(eid) {
    const item = equipment.find(e => String(e.id) === String(eid));
    if (!item) return;
    editingEquipId = eid;
    $("equip-form-title").textContent = "Modifica attrezzatura";
    $("eq-name").value = item.name || "";
    $("eq-category").value = item.category || "";
    $("eq-qty").value = item.quantity ?? item.qty ?? "";
    $("eq-status").value = item.status || "operativo";
    $("eq-location").value = item.location || "cucina";
    $("eq-value").value = item.value ?? item.unitValue ?? "";
    $("btn-eq-cancel").style.display = "inline-flex";
  }

  function resetEquipForm() {
    editingEquipId = null;
    $("equip-form-title").textContent = "Nuova attrezzatura";
    ["eq-name","eq-category","eq-qty","eq-value"].forEach(id => { const el = $(id); if (el) el.value = ""; });
    $("eq-status").value = "operativo";
    $("eq-location").value = "cucina";
    $("btn-eq-cancel").style.display = "none";
  }

  async function saveEquipment() {
    const name = $("eq-name").value.trim();
    if (!name) { alert("Nome obbligatorio."); return; }
    const body = {
      name,
      category: $("eq-category").value.trim(),
      quantity: parseInt($("eq-qty").value, 10) || 0,
      status: $("eq-status").value,
      location: $("eq-location").value,
      value: parseFloat($("eq-value").value) || 0,
    };
    try {
      if (editingEquipId) {
        await fetchJSON("/api/devices/" + editingEquipId, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await fetchJSON("/api/devices", { method: "POST", body: JSON.stringify(body) });
      }
      resetEquipForm();
      await loadEquipment();
      renderEquipment();
    } catch (err) { alert(err.message); }
  }

  // ─── INIT ──────────────────────────────────────────────────────────
  function init() {
    // tabs
    document.querySelectorAll(".mag-tab").forEach(btn => {
      btn.addEventListener("click", () => showTab(btn.dataset.tab));
    });

    // close modals via data-close
    document.querySelectorAll("[data-close]").forEach(btn => {
      btn.addEventListener("click", () => closeModal(btn.dataset.close));
    });
    document.querySelectorAll(".modal-overlay").forEach(ov => {
      ov.addEventListener("click", e => { if (e.target === ov) closeModal(ov.id); });
    });

    // refresh
    $("btn-refresh")?.addEventListener("click", () => loadAll());

    // centrale: search
    $("search-centrale")?.addEventListener("input", () => renderCentrale());
    // centrale: add product
    $("btn-add-product")?.addEventListener("click", e => { e.preventDefault(); addProduct(); });
    // edit confirm
    $("btn-edit-confirm")?.addEventListener("click", confirmEdit);
    // adjust confirm
    $("btn-adjust-confirm")?.addEventListener("click", confirmAdjust);
    // delete confirm
    $("btn-delete-confirm")?.addEventListener("click", confirmDelete);

    // reparti: transfer
    $("btn-new-transfer")?.addEventListener("click", openTransferModal);
    $("btn-xfer-confirm")?.addEventListener("click", confirmTransfer);

    // ricezione
    $("btn-recv")?.addEventListener("click", doReceive);

    // movimenti
    $("btn-new-movement")?.addEventListener("click", openMovementModal);
    $("btn-mov-confirm")?.addEventListener("click", confirmMovement);
    $("btn-editmov-confirm")?.addEventListener("click", confirmEditMov);

    // lista spesa
    $("btn-shop-add")?.addEventListener("click", () => {
      const name = $("shop-name")?.value.trim();
      const qty = $("shop-qty")?.value.trim();
      if (!name) return;
      addToShoppingList(name, qty);
      $("shop-name").value = "";
      $("shop-qty").value = "";
    });
    $("btn-shop-clear")?.addEventListener("click", () => {
      if (!shoppingList.length) return;
      shoppingList = [];
      saveShoppingList();
      renderShopList();
    });

    // attrezzature
    $("btn-eq-save")?.addEventListener("click", e => { e.preventDefault(); saveEquipment(); });
    $("btn-eq-cancel")?.addEventListener("click", resetEquipForm);

    // load data
    loadShoppingList();
    loadAll();
    loadEquipment();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
