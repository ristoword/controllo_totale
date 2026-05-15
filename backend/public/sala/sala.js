// sala.js – CONTROLLO TOTALE Sala – redesign ristosaas-style v20260510
// ============================================================
//   STATO
// ============================================================
let tables      = [];  // sala tables from API
let activeOrders = []; // active orders from API
let menuItems   = [];  // menu items (caricati al primo open modal)
let menuLoaded  = false;

let selectedTable    = null; // table obj attualmente nel modal
let editLayout       = false;
let tablesBusy       = false;

// modale comanda
let orderTable       = null;
let courses          = [{ n: 1, items: [] }];
let activeCourse     = 1;
let orderCovers      = 2;
let orderWaiter      = "";
let orderNotes       = "";
let sending          = false;
let menuSearch       = "";
let menuAreaFilter   = "all";
let menuCatFilter    = "all";

// drag state
let dragState = null;

// modal coperti/corsi
let modalCoperti = 2;
let modalCorsi   = 1;
let noteDest     = "cucina";

const MAX_TABLES = 30;

// ============================================================
//   API HELPERS
// ============================================================
async function api(method, path, body) {
  const opts = { method, credentials: "same-origin", headers: {} };
  if (body !== undefined) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const r = await fetch(path, opts);
  if (!r.ok) {
    const msg = await r.json().then(d => d.error || d.message).catch(() => r.statusText);
    throw new Error(msg);
  }
  return r.json();
}

const tablesApi = {
  list: () => api("GET", "/api/sala/tables"),
  create: (data) => api("POST", "/api/sala/tables", data),
  update: (id, patch) => api("PATCH", `/api/sala/tables/${encodeURIComponent(id)}`, patch),
  patchStatus: (id, stato) => api("PATCH", `/api/sala/tables/${encodeURIComponent(id)}/status`, { stato }),
  remove: (id) => api("DELETE", `/api/sala/tables/${encodeURIComponent(id)}`),
};

const ordersApi = {
  listActive: () => api("GET", "/api/orders?active=true"),
  create: (body) => api("POST", "/api/orders", body),
  patchStatus: (id, status) => api("PATCH", `/api/orders/${encodeURIComponent(id)}/status`, { status }),
  patchActiveCourse: (id, activeCourse) => api("PATCH", `/api/orders/${encodeURIComponent(id)}/active-course`, { activeCourse }),
};

const menuApi = {
  list: () => api("GET", "/api/menu/active"),
};

// ============================================================
//   LOAD / REFRESH
// ============================================================
async function loadAll() {
  try {
    const [t, o] = await Promise.all([tablesApi.list(), ordersApi.listActive()]);
    tables = Array.isArray(t) ? t : [];
    activeOrders = Array.isArray(o) ? o : [];

    // Se non ci sono tavoli nella nuova installation, seminiamo 20 di default
    if (tables.length === 0) {
      await seedDefaultTables();
    }
  } catch (e) {
    console.error("Errore caricamento dati sala:", e);
  }
  renderAll();
}

async function seedDefaultTables() {
  const cols = 5;
  const leftPad = 12, topPad = 18, colStep = 15, rowStep = 22;
  const items = [];
  for (let i = 1; i <= 20; i++) {
    const row = Math.floor((i - 1) / cols);
    const col = (i - 1) % cols;
    items.push({
      nome: `T${i}`,
      posti: 4,
      x: leftPad + col * colStep,
      y: topPad + row * rowStep,
      forma: i % 3 === 0 ? "tondo" : "quadrato",
    });
  }
  for (const item of items) {
    try { await tablesApi.create(item); } catch (_) {}
  }
  tables = await tablesApi.list();
}

// ============================================================
//   RENDER
// ============================================================
function renderAll() {
  renderKpis();
  renderMgmtBar();
  renderActiveOrders();
  renderFloor();
}

function renderKpis() {
  document.getElementById("kpi-active-orders").textContent = activeOrders.length;
}

function renderMgmtBar() {
  document.getElementById("mgmt-count").textContent = `${tables.length} tavoli`;
  const btnLayout = document.getElementById("btn-layout-toggle");
  btnLayout.setAttribute("aria-pressed", String(editLayout));
  btnLayout.textContent = editLayout ? "⤡ Esci dal layout" : "⤡ Sposta tavoli";
  btnLayout.classList.toggle("btn", true);
  btnLayout.classList.toggle("ghost", true);
  if (editLayout) {
    btnLayout.style.background = "var(--amber-bg)";
    btnLayout.style.borderColor = "var(--amber-ring)";
    btnLayout.style.color = "var(--accent-soft)";
  } else {
    btnLayout.style.background = "";
    btnLayout.style.borderColor = "";
    btnLayout.style.color = "";
  }
}

// ============================================================
//   ACTIVE ORDERS CARDS
// ============================================================
function courseChipClass(st, isActive) {
  if (st === "servito") return "cb-servito";
  if (st === "pronto") return "cb-pronto";
  if (st === "in_preparazione") return "cb-in_prep";
  if (isActive) return "cb-active";
  return "cb-waiting";
}

function courseStateLabel(st) {
  if (st === "servito") return "servito";
  if (st === "pronto") return "pronto";
  if (st === "in_preparazione") return "in prep";
  if (st === "in_attesa") return "in coda";
  return "attesa turno";
}

function renderActiveOrders() {
  const grid = document.getElementById("active-orders-grid");
  const relevant = activeOrders.filter(
    (o) => !["servito", "chiuso", "annullato"].includes(o.status)
  );
  if (relevant.length === 0) {
    grid.style.display = "none";
    return;
  }
  grid.style.display = "grid";

  grid.innerHTML = relevant.map((order) => {
    const courseNums = [...new Set(order.items.map((i) => i.course))].sort((a, b) => a - b);
    const badgesHtml = courseNums.map((cn) => {
      const st = (order.courseStates && order.courseStates[String(cn)]) || "queued";
      const isActive = cn === order.activeCourse;
      const cls = courseChipClass(st, isActive);
      const lbl = courseStateLabel(st === "queued" && isActive ? "active" : st);
      return `<span class="course-badge ${cls}">${cn}° corso <span style="opacity:.7">${lbl}</span></span>`;
    }).join("");

    const isLastCourse = courseNums.indexOf(order.activeCourse) >= courseNums.length - 1;

    return `
      <div class="order-card">
        <div class="order-card-head">
          <span class="order-table-name">Tav. ${escHtml(String(order.table))}</span>
          <span class="order-meta">${escHtml(order.waiter || "—")} · ${order.covers || "—"}p</span>
        </div>
        <div class="course-badges">${badgesHtml}</div>
        <button class="marcia-btn" data-order-id="${escHtml(order.id)}" ${isLastCourse ? "disabled" : ""}>
          🚀 Marcia
        </button>
      </div>`;
  }).join("");

  grid.querySelectorAll(".marcia-btn[data-order-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const order = activeOrders.find((o) => o.id === btn.dataset.orderId);
      if (order) {
        btn.disabled = true;
        await handleMarcia(order);
        btn.disabled = false;
      }
    });
  });
}

// ============================================================
//   MARCIA LOGIC (identica a ristosaas)
// ============================================================
async function handleMarcia(order) {
  const courseNums = [...new Set(order.items.map((i) => i.course))].sort((a, b) => a - b);
  const currentCourse = order.activeCourse;
  const courseStates = order.courseStates || {};
  const currentState = courseStates[String(currentCourse)] || "queued";
  const isLastCourse = courseNums.indexOf(currentCourse) === courseNums.length - 1;

  try {
    if (currentState === "queued" || currentState === "in_attesa") {
      await ordersApi.patchActiveCourse(order.id, currentCourse);
    } else if (currentState === "pronto" || currentState === "in_preparazione") {
      if (!isLastCourse) {
        await ordersApi.patchStatus(order.id, "servito");
      } else {
        await ordersApi.patchStatus(order.id, "servito");
      }
    }
    await loadAll();
  } catch (e) {
    console.error("Errore marcia:", e);
    showMgmtError("Errore marcia: " + e.message);
  }
}

// ============================================================
//   FLOOR PLAN
// ============================================================
function renderFloor() {
  const floor = document.getElementById("sala-floor");
  const editHint = document.getElementById("floor-edit-hint");
  editHint.style.display = editLayout ? "block" : "none";
  floor.classList.toggle("edit-mode", editLayout);

  // rimuovi vecchi tavoli
  floor.querySelectorAll(".table-btn").forEach((el) => el.remove());

  tables.forEach((t) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `table-btn forma-${t.forma} stato-${t.stato}`;
    btn.style.left = `${t.x}%`;
    btn.style.top  = `${t.y}%`;
    btn.dataset.id = t.id;
    if (editLayout) {
      btn.setAttribute("aria-label", `Trascina il tavolo ${t.nome} per spostarlo.`);
    } else {
      const statoLabel = { libero: "Libero", aperto: "Aperto", conto: "Conto", sporco: "Da pulire" }[t.stato] || t.stato;
      btn.setAttribute("aria-label", `Tavolo ${t.nome}, ${statoLabel}, ${t.posti} posti. Tocca per aprire le azioni.`);
    }
    btn.innerHTML = `
      <span class="table-name">${escHtml(t.nome)}</span>
      <span class="table-posti">${t.posti}p</span>
    `;

    if (editLayout) {
      addDragHandlers(btn, t);
    } else {
      btn.addEventListener("click", () => openTableModal(t));
    }

    floor.appendChild(btn);
  });
}

// ============================================================
//   DRAG & DROP
// ============================================================
function addDragHandlers(btn, table) {
  let dragging = false;
  let lastX = table.x;
  let lastY = table.y;

  btn.addEventListener("pointerdown", (e) => {
    if (!editLayout) return;
    e.preventDefault();
    e.stopPropagation();
    btn.setPointerCapture(e.pointerId);
    dragging = true;
    lastX = table.x;
    lastY = table.y;
    btn.dataset.dragging = "1";
  });

  btn.addEventListener("pointermove", (e) => {
    if (!dragging || !editLayout) return;
    const floor = document.getElementById("sala-floor");
    const rect = floor.getBoundingClientRect();
    const x = clamp(((e.clientX - rect.left) / rect.width) * 100, 4, 96);
    const y = clamp(((e.clientY - rect.top) / rect.height) * 100, 4, 96);
    lastX = x;
    lastY = y;
    btn.style.left = `${x}%`;
    btn.style.top  = `${y}%`;
    // update local table
    const t = tables.find((t) => t.id === table.id);
    if (t) { t.x = x; t.y = y; }
  });

  async function endDrag(e) {
    if (!dragging) return;
    btn.releasePointerCapture(e.pointerId);
    dragging = false;
    delete btn.dataset.dragging;
    if (lastX !== table.x || lastY !== table.y || true) {
      try {
        await tablesApi.update(table.id, { x: parseFloat(lastX.toFixed(2)), y: parseFloat(lastY.toFixed(2)) });
        table.x = lastX;
        table.y = lastY;
      } catch (err) {
        console.error("Salvataggio posizione fallito:", err);
        await loadAll(); // reset to server truth
      }
    }
  }

  btn.addEventListener("pointerup", endDrag);
  btn.addEventListener("pointercancel", endDrag);
}

function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val));
}

// ============================================================
//   TABLE ACTIONS MODAL
// ============================================================
function openTableModal(t) {
  if (editLayout) return;
  selectedTable = t;
  modalCoperti = t.posti;
  modalCorsi   = 1;
  noteDest     = "cucina";

  document.getElementById("modal-table-title").textContent = t.nome;
  document.getElementById("modal-table-sub").textContent =
    `${t.posti} posti · stato: ${{ libero: "Libero", aperto: "Aperto", conto: "Conto", sporco: "Da pulire" }[t.stato] || t.stato}`;
  document.getElementById("val-coperti").textContent = modalCoperti;
  document.getElementById("val-corsi").textContent = modalCorsi;
  hideModalFlash();

  const backdrop = document.getElementById("modal-backdrop");
  const modal    = document.getElementById("modal-table");
  backdrop.style.display = "block";
  modal.style.display = "flex";
  modal.setAttribute("aria-hidden", "false");
  document.getElementById("modal-close").focus();
}

function closeTableModal() {
  document.getElementById("modal-backdrop").style.display = "none";
  document.getElementById("modal-table").style.display = "none";
  document.getElementById("modal-table").setAttribute("aria-hidden", "true");
  selectedTable = null;
}

function showModalFlash(msg) {
  const el = document.getElementById("modal-flash");
  el.textContent = msg;
  el.style.display = "block";
  setTimeout(() => { el.style.display = "none"; }, 2400);
}
function hideModalFlash() {
  document.getElementById("modal-flash").style.display = "none";
}

async function handleTableAction(actionId) {
  const t = selectedTable;
  if (!t) return;

  const ordersForTable = activeOrders.filter((o) =>
    String(o.table) === String(t.nome) && !["chiuso", "annullato"].includes(o.status)
  );

  switch (actionId) {
    case "apri-tavolo":
      await tablesApi.patchStatus(t.id, "aperto").catch(console.error);
      await loadAll();
      // aggiorna modal sub
      if (selectedTable) {
        const updated = tables.find((x) => x.id === t.id);
        if (updated) {
          selectedTable = updated;
          document.getElementById("modal-table-sub").textContent =
            `${updated.posti} posti · stato: Aperto`;
        }
      }
      showModalFlash("Tavolo aperto.");
      break;

    case "tavolo-libero":
      await tablesApi.patchStatus(t.id, "libero").catch(console.error);
      await loadAll();
      showModalFlash("Tavolo libero.");
      break;

    case "chiedi-conto":
      await tablesApi.patchStatus(t.id, "conto").catch(console.error);
      await loadAll();
      showModalFlash("Conto richiesto.");
      break;

    case "marcia-portata":
      for (const order of ordersForTable) {
        await handleMarcia(order);
      }
      showModalFlash("Marcia eseguita.");
      break;

    case "chiudi-tavolo":
      for (const order of ordersForTable) {
        await ordersApi.patchStatus(order.id, "chiuso").catch(console.error);
      }
      await tablesApi.patchStatus(t.id, "sporco").catch(console.error);
      await loadAll();
      showModalFlash("Tavolo chiuso, da pulire.");
      break;

    case "cancella-tavolo":
      for (const order of ordersForTable) {
        await ordersApi.patchStatus(order.id, "annullato").catch(console.error);
      }
      await tablesApi.patchStatus(t.id, "libero").catch(console.error);
      await loadAll();
      showModalFlash("Tavolo cancellato.");
      break;

    case "prendi-ordine":
      closeTableModal();
      openOrderModal(t);
      break;

    case "menu-casa":
      closeTableModal();
      window.location.href = "/menu-admin/menu-admin.html";
      break;

    case "menu-giorno":
      closeTableModal();
      window.location.href = "/daily-menu/daily-menu.html";
      break;

    case "fuori-menu":
      closeTableModal();
      window.location.href = "/menu-admin/menu-admin.html";
      break;

    case "ordine-bevande":
      closeTableModal();
      window.location.href = "/bar/bar.html";
      break;

    default:
      showModalFlash(`Azione «${actionId}» non ancora implementata.`);
  }
}

// ============================================================
//   ORDER MODAL
// ============================================================
function openOrderModal(t) {
  orderTable   = t;
  orderCovers  = t.posti;
  orderWaiter  = "";
  orderNotes   = "";
  courses      = [{ n: 1, items: [] }];
  activeCourse = 1;
  menuSearch   = "";
  menuAreaFilter = "all";
  menuCatFilter  = "all";
  sending      = false;

  document.getElementById("modal-order-title").textContent = `Tav. ${t.nome}`;
  document.getElementById("modal-order-sub").textContent   = `${t.posti} posti`;
  document.getElementById("order-coperti-val").textContent = orderCovers;
  document.getElementById("order-waiter").value  = orderWaiter;
  document.getElementById("order-notes").value   = "";
  document.getElementById("order-send-error").style.display = "none";
  document.getElementById("menu-search").value   = "";
  document.getElementById("menu-area-filter").value = "all";
  document.getElementById("menu-cat-filter").value  = "all";

  document.getElementById("modal-backdrop").style.display = "block";
  document.getElementById("modal-order").style.display = "flex";

  renderCourseTabs();
  renderCoursesSummary();
  updateSendBtn();
  loadMenuIfNeeded();
}

function closeOrderModal() {
  document.getElementById("modal-backdrop").style.display = "none";
  document.getElementById("modal-order").style.display = "none";
  orderTable = null;
}

async function loadMenuIfNeeded() {
  if (menuLoaded) {
    renderMenuGrid();
    return;
  }
  const loadEl = document.getElementById("menu-loading");
  const errEl  = document.getElementById("menu-error");
  loadEl.style.display = "block";
  errEl.style.display  = "none";
  try {
    const items = await menuApi.list();
    menuItems = Array.isArray(items) ? items.filter((i) => i.active !== false) : [];
    menuLoaded = true;
    buildCategoryFilter();
  } catch (e) {
    errEl.textContent = "Errore caricamento menu: " + e.message;
    errEl.style.display = "block";
  } finally {
    loadEl.style.display = "none";
  }
  renderMenuGrid();
}

function buildCategoryFilter() {
  const cats = [...new Set(menuItems.map((i) => i.category).filter(Boolean))];
  const sel = document.getElementById("menu-cat-filter");
  sel.innerHTML = `<option value="all">Tutte le categorie</option>`;
  cats.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    sel.appendChild(opt);
  });
}

function filteredMenu() {
  const q = menuSearch.trim().toLowerCase();
  return menuItems.filter((item) => {
    const area = (item.area || "cucina").toLowerCase();
    const matchArea = menuAreaFilter === "all" || area === menuAreaFilter;
    const matchCat  = menuCatFilter  === "all" || item.category === menuCatFilter;
    const matchSearch = q === "" || item.name.toLowerCase().includes(q);
    return matchArea && matchCat && matchSearch;
  });
}

function areaBadge(area) {
  const map = {
    cucina: "area-cucina",
    pizzeria: "area-pizzeria",
    bar: "area-bar",
  };
  const cls = map[(area || "").toLowerCase()] || "area-sala";
  return `<span class="area-badge ${cls}">${escHtml(area || "cucina")}</span>`;
}

function renderMenuGrid() {
  const grid = document.getElementById("menu-grid");
  const items = filteredMenu();
  if (items.length === 0) {
    grid.innerHTML = `<p class="menu-empty">Nessuna voce menu corrisponde ai filtri.</p>`;
    return;
  }
  grid.innerHTML = items.map((item) => {
    const area = (item.area || "cucina").toLowerCase();
    return `
      <button type="button" class="menu-item-btn" data-item-id="${escHtml(String(item.id))}">
        <span class="menu-item-name">${escHtml(item.name)}</span>
        <div class="menu-item-meta">
          <span class="menu-item-price">€${Number(item.price || 0).toFixed(2)}</span>
          ${areaBadge(area)}
        </div>
      </button>`;
  }).join("");

  grid.querySelectorAll(".menu-item-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = menuItems.find((i) => String(i.id) === btn.dataset.itemId);
      if (item) addItemToActiveCourse(item);
    });
  });
}

function addItemToActiveCourse(item) {
  const normalizeArea = (raw) => {
    const v = (raw || "").toLowerCase();
    return ["cucina", "pizzeria", "bar", "sala"].includes(v) ? v : "cucina";
  };
  courses = courses.map((c) => {
    if (c.n !== activeCourse) return c;
    const existing = c.items.find((i) => i.name === item.name);
    if (existing) {
      return { ...c, items: c.items.map((i) => i.name === item.name ? { ...i, qty: i.qty + 1 } : i) };
    }
    return {
      ...c,
      items: [...c.items, {
        name: item.name,
        qty: 1,
        category: item.category || "",
        area: normalizeArea(item.area),
        price: item.price || 0,
        note: null,
      }],
    };
  });
  renderCoursesSummary();
  renderCourseTabs();
  updateSendBtn();
}

function removeItemFromCourse(courseN, name) {
  courses = courses.map((c) =>
    c.n === courseN ? { ...c, items: c.items.filter((i) => i.name !== name) } : c
  );
  renderCoursesSummary();
  renderCourseTabs();
  updateSendBtn();
}

function updateItemQty(courseN, name, delta) {
  courses = courses.map((c) => {
    if (c.n !== courseN) return c;
    return {
      ...c,
      items: c.items
        .map((i) => i.name === name ? { ...i, qty: Math.max(0, i.qty + delta) } : i)
        .filter((i) => i.qty > 0),
    };
  });
  renderCoursesSummary();
  renderCourseTabs();
  updateSendBtn();
}

function addCourse() {
  const next = courses.length + 1;
  if (next > 12) return;
  courses = [...courses, { n: next, items: [] }];
  activeCourse = next;
  renderCourseTabs();
  renderCoursesSummary();
  updateMenuSectionLabel();
}

function renderCourseTabs() {
  const container = document.getElementById("course-tabs");
  container.innerHTML = courses.map((c) => {
    const isActive = c.n === activeCourse;
    const cls = isActive ? "course-tab active" : "course-tab inactive";
    const cnt = c.items.length > 0 ? ` (${c.items.length})` : "";
    return `<button type="button" class="${cls}" data-cn="${c.n}">${c.n}° corso${escHtml(cnt)}</button>`;
  }).join("") +
    `<button type="button" class="course-tab-add" id="btn-add-course">+ Corso</button>`;

  container.querySelectorAll(".course-tab[data-cn]").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeCourse = parseInt(btn.dataset.cn, 10);
      renderCourseTabs();
      updateMenuSectionLabel();
    });
  });
  const addBtn = document.getElementById("btn-add-course");
  if (addBtn) addBtn.addEventListener("click", addCourse);
}

function updateMenuSectionLabel() {
  document.getElementById("menu-section-label").textContent =
    `Aggiungi al ${activeCourse}° corso · ${menuItems.length} voci menu`;
}

function renderCoursesSummary() {
  const container = document.getElementById("courses-summary");
  const withItems = courses.filter((c) => c.items.length > 0);
  if (withItems.length === 0) {
    container.innerHTML = "";
    return;
  }
  container.innerHTML = withItems.map((c) => {
    const isFirst = c.n === 1;
    const titleCls = isFirst ? "cs-active" : "cs-waiting";
    const stateLabel = isFirst ? "ATTIVO" : "IN ATTESA";
    const itemsHtml = c.items.map((it) => `
      <div class="course-item-row">
        <div>
          <span class="ci-name">${escHtml(it.name)}</span>
          <span class="ci-price">€${(it.price || 0).toFixed(2)}</span>
        </div>
        <div class="ci-qty-ctrl">
          <button type="button" class="ci-qty-btn" data-cn="${c.n}" data-name="${escHtml(it.name)}" data-delta="-1">−</button>
          <span class="ci-qty-val">${it.qty}</span>
          <button type="button" class="ci-qty-btn" data-cn="${c.n}" data-name="${escHtml(it.name)}" data-delta="1">+</button>
          <button type="button" class="ci-del-btn" data-cn="${c.n}" data-name="${escHtml(it.name)}">🗑</button>
        </div>
      </div>`).join("");
    return `
      <div class="course-summary-block">
        <p class="course-summary-title ${titleCls}">${c.n}° corso — ${stateLabel}</p>
        ${itemsHtml}
      </div>`;
  }).join("");

  // qty buttons
  container.querySelectorAll(".ci-qty-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      updateItemQty(parseInt(btn.dataset.cn, 10), btn.dataset.name, parseInt(btn.dataset.delta, 10));
    });
  });
  container.querySelectorAll(".ci-del-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      removeItemFromCourse(parseInt(btn.dataset.cn, 10), btn.dataset.name);
    });
  });
}

function updateSendBtn() {
  const total = courses.reduce((s, c) => s + c.items.reduce((ss, i) => ss + i.qty, 0), 0);
  const btn = document.getElementById("btn-send-order");
  btn.disabled = total === 0 || sending;
  const label = document.getElementById("send-label");
  const icon  = document.getElementById("send-icon");
  if (sending) {
    icon.textContent = "⏳";
    label.textContent = "Invio in corso…";
  } else {
    icon.textContent = "🚀";
    label.textContent = `Invia comanda (${total} piatti, ${courses.length} ${courses.length === 1 ? "corso" : "corsi"})`;
  }
}

async function handleSendOrder() {
  if (!orderTable || sending) return;
  const allItems = courses.flatMap((c) =>
    c.items.map((it, idx) => ({
      id: `new-${c.n}-${idx}`,
      name: it.name,
      qty: it.qty,
      category: it.category,
      area: it.area,
      price: it.price,
      note: it.note,
      course: c.n,
    }))
  );
  if (allItems.length === 0) return;

  sending = true;
  updateSendBtn();
  document.getElementById("order-send-error").style.display = "none";

  try {
    await ordersApi.create({
      table: orderTable.nome,
      covers: orderCovers,
      area: "sala",
      waiter: document.getElementById("order-waiter").value || "—",
      notes: document.getElementById("order-notes").value,
      items: allItems,
    });
    // apri il tavolo se libero
    if (orderTable.stato === "libero") {
      await tablesApi.patchStatus(orderTable.id, "aperto").catch(() => {});
    }
    closeOrderModal();
    await loadAll();
  } catch (e) {
    document.getElementById("order-send-error").textContent = e.message || "Invio comanda non riuscito.";
    document.getElementById("order-send-error").style.display = "block";
  } finally {
    sending = false;
    updateSendBtn();
  }
}

// ============================================================
//   ADD / REMOVE TABLE
// ============================================================
function percentPositionForIndex(index) {
  const cols = 5;
  const leftPad = 12, rightPad = 12, topPad = 18, rowGap = 24;
  const usableWidth = 100 - leftPad - rightPad;
  const colStep = usableWidth / (cols - 1);
  const row = Math.floor(index / cols);
  const col = index % cols;
  return {
    x: Math.round(leftPad + col * colStep),
    y: Math.round(topPad + row * rowGap),
  };
}

function showMgmtError(msg) {
  const el = document.getElementById("mgmt-error");
  el.textContent = msg;
  el.style.display = "block";
  setTimeout(() => { el.style.display = "none"; }, 3500);
}

async function handleAddTable() {
  if (tables.length >= MAX_TABLES || tablesBusy || editLayout) return;
  tablesBusy = true;
  const usedNums = new Set(
    tables.map((t) => t.nome.trim().toUpperCase())
      .filter((n) => /^T\d+$/.test(n))
      .map((n) => Number(n.slice(1)))
  );
  let nextNum = 1;
  while (usedNums.has(nextNum)) nextNum++;

  const pos = percentPositionForIndex(tables.length);
  try {
    await tablesApi.create({
      nome: `T${nextNum}`,
      posti: 4,
      x: pos.x,
      y: pos.y,
      forma: tables.length % 2 === 0 ? "quadrato" : "tondo",
    });
    await loadAll();
  } catch (e) {
    showMgmtError("Errore aggiunta tavolo: " + e.message);
  } finally {
    tablesBusy = false;
  }
}

async function handleRemoveTable() {
  if (tables.length === 0 || tablesBusy || editLayout) return;
  const candidate =
    [...tables].reverse().find((t) => t.stato === "libero") || tables[tables.length - 1];
  if (!candidate) return;

  const ordersOnTable = activeOrders.filter((o) =>
    String(o.table) === String(candidate.nome) && !["chiuso", "annullato"].includes(o.status)
  );
  if (ordersOnTable.length > 0) {
    showMgmtError(`${candidate.nome} ha ordini attivi: chiudili prima di rimuoverlo.`);
    return;
  }
  if (!confirm(`Rimuovere ${candidate.nome}? L'azione non si può annullare.`)) return;

  tablesBusy = true;
  try {
    await tablesApi.remove(candidate.id);
    await loadAll();
  } catch (e) {
    showMgmtError("Errore rimozione: " + e.message);
  } finally {
    tablesBusy = false;
  }
}

// ============================================================
//   UTILITIES
// ============================================================
function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ============================================================
//   WEBSOCKET REFRESH
// ============================================================
document.addEventListener("ws:orders-update", async () => {
  try {
    const o = await ordersApi.listActive();
    activeOrders = Array.isArray(o) ? o : [];
    renderActiveOrders();
    renderKpis();
  } catch (_) {}
});

// ============================================================
//   INIT & EVENT LISTENERS
// ============================================================
document.addEventListener("DOMContentLoaded", () => {

  // TOPBAR
  document.getElementById("btn-refresh").addEventListener("click", loadAll);

  // MGMT BAR
  document.getElementById("btn-layout-toggle").addEventListener("click", () => {
    editLayout = !editLayout;
    renderMgmtBar();
    renderFloor();
  });
  document.getElementById("btn-add-table").addEventListener("click", handleAddTable);
  document.getElementById("btn-remove-table").addEventListener("click", handleRemoveTable);

  // TABLE MODAL – chiudi
  document.getElementById("modal-close").addEventListener("click", closeTableModal);
  document.getElementById("modal-backdrop").addEventListener("mousedown", (e) => {
    if (e.target === document.getElementById("modal-backdrop")) closeTableModal();
  });

  // ESC key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (document.getElementById("modal-order").style.display !== "none") {
        closeOrderModal();
      } else if (document.getElementById("modal-table").style.display !== "none") {
        closeTableModal();
      }
    }
  });

  // TABLE MODAL – coperti stepper
  document.getElementById("btn-coperti-minus").addEventListener("click", () => {
    modalCoperti = Math.max(1, modalCoperti - 1);
    document.getElementById("val-coperti").textContent = modalCoperti;
  });
  document.getElementById("btn-coperti-plus").addEventListener("click", () => {
    modalCoperti = Math.min(99, modalCoperti + 1);
    document.getElementById("val-coperti").textContent = modalCoperti;
  });

  // TABLE MODAL – corsi stepper
  document.getElementById("btn-corsi-minus").addEventListener("click", () => {
    modalCorsi = Math.max(1, modalCorsi - 1);
    document.getElementById("val-corsi").textContent = modalCorsi;
  });
  document.getElementById("btn-corsi-plus").addEventListener("click", () => {
    modalCorsi = Math.min(12, modalCorsi + 1);
    document.getElementById("val-corsi").textContent = modalCorsi;
  });

  // TABLE MODAL – azioni rapide
  document.getElementById("actions-grid").addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    btn.disabled = true;
    try {
      await handleTableAction(btn.dataset.action);
    } finally {
      btn.disabled = false;
    }
  });

  // TABLE MODAL – dest tabs
  document.querySelectorAll(".dest-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      noteDest = btn.dataset.dest;
      document.querySelectorAll(".dest-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

  // TABLE MODAL – invia nota (real API call → WebSocket broadcast)
  document.getElementById("btn-send-note").addEventListener("click", async () => {
    const testo = document.getElementById("note-text").value.trim();
    if (!testo) {
      showModalFlash("Scrivi una nota prima di inviarla.");
      return;
    }
    try {
      await api("POST", "/api/sala/note", {
        table: selectedTable?.nome || "",
        department: noteDest,
        text: testo,
      });
      showModalFlash(`Nota per ${noteDest}: inviata.`);
      document.getElementById("note-text").value = "";
    } catch (e) {
      showModalFlash("Errore invio nota: " + e.message);
    }
  });

  // ORDER MODAL – close
  document.getElementById("modal-order-close").addEventListener("click", closeOrderModal);

  // ORDER MODAL – coperti
  document.getElementById("order-coperti-minus").addEventListener("click", () => {
    orderCovers = Math.max(1, orderCovers - 1);
    document.getElementById("order-coperti-val").textContent = orderCovers;
  });
  document.getElementById("order-coperti-plus").addEventListener("click", () => {
    orderCovers += 1;
    document.getElementById("order-coperti-val").textContent = orderCovers;
  });

  // ORDER MODAL – search & filters
  document.getElementById("menu-search").addEventListener("input", (e) => {
    menuSearch = e.target.value;
    renderMenuGrid();
  });
  document.getElementById("menu-area-filter").addEventListener("change", (e) => {
    menuAreaFilter = e.target.value;
    renderMenuGrid();
  });
  document.getElementById("menu-cat-filter").addEventListener("change", (e) => {
    menuCatFilter = e.target.value;
    renderMenuGrid();
  });

  // ORDER MODAL – send
  document.getElementById("btn-send-order").addEventListener("click", () => void handleSendOrder());

  // AVVIO
  loadAll();

  // Auto-refresh ogni 30s
  setInterval(loadAll, 30000);
});
