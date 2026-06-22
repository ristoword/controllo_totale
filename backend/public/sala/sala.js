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

function t(key, vars) {
  let s = typeof window.rwT === "function" ? window.rwT(key) : key;
  if (vars) {
    Object.keys(vars).forEach((k) => {
      s = s.replace(new RegExp("\\{" + k + "\\}", "g"), String(vars[k]));
    });
  }
  return s;
}

function tableStatusLabel(stato) {
  const map = {
    libero: "sala_status_libero",
    aperto: "sala_status_aperto",
    conto: "sala_status_conto",
    sporco: "sala_status_sporco",
  };
  return t(map[stato] || stato);
}

function refreshSalaI18n() {
  renderMgmtBar();
  renderFloor();
  renderActiveOrders();
  if (orderTable) updateMenuSectionLabel();
  if (courses.length) {
    renderCourseTabs();
    renderCoursesSummary();
    updateSendBtn();
  }
}

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
  dailyActive: () => api("GET", "/api/daily-menu/active"),
};

// ============================================================
//   LOAD / REFRESH
// ============================================================

function orderMatchesTable(order, tableRef) {
  if (window.RW_TABLE_MATCH?.tablesMatch) {
    return window.RW_TABLE_MATCH.tablesMatch(order.table, tableRef);
  }
  return String(order.table) === String(tableRef);
}

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
  document.getElementById("mgmt-count").textContent = `${tables.length} ${t("sala_tables_word")}`;
  const btnLayout = document.getElementById("btn-layout-toggle");
  btnLayout.setAttribute("aria-pressed", String(editLayout));
  btnLayout.textContent = editLayout ? t("sala_exit_layout") : t("sala_move_tables");
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
  if (st === "servito") return t("sala_cs_state_servito");
  if (st === "pronto") return t("sala_cs_state_pronto");
  if (st === "in_preparazione") return t("sala_cs_state_in_prep");
  if (st === "in_attesa") return t("sala_cs_state_queued");
  return t("sala_cs_state_turn");
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
      return `<span class="course-badge ${cls}">${cn}${t("sala_course_degree")} <span style="opacity:.7">${lbl}</span></span>`;
    }).join("");

    const activeState = (order.courseStates && order.courseStates[String(order.activeCourse)]) || "queued";
    const marciaDisabled = activeState === "servito";

    return `
      <div class="order-card">
        <div class="order-card-head">
          <span class="order-table-name">${t("sala_table_abbr")} ${escHtml(String(order.table))}</span>
          <span class="order-meta">${escHtml(order.waiter || "—")} · ${order.covers || "—"}p</span>
        </div>
        <div class="course-badges">${badgesHtml}</div>
        <button class="marcia-btn" data-order-id="${escHtml(order.id)}" ${marciaDisabled ? "disabled" : ""}>
          ${t("sala_marcia")}
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
      await ordersApi.patchStatus(order.id, "in_preparazione");
    } else if (currentState === "in_preparazione") {
      await ordersApi.patchStatus(order.id, "pronto");
    } else if (currentState === "pronto" && isLastCourse) {
      await ordersApi.patchStatus(order.id, "servito");
    } else if (currentState === "pronto" && !isLastCourse) {
      const idx = courseNums.indexOf(currentCourse);
      const nextCourse = idx >= 0 && idx < courseNums.length - 1 ? courseNums[idx + 1] : null;
      if (nextCourse) {
        await ordersApi.patchActiveCourse(order.id, nextCourse);
      }
    }
    await loadAll();
  } catch (e) {
    console.error("Errore marcia:", e);
    showMgmtError(t("sala_marcia_error", { msg: e.message }));
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

  tables.forEach((table) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `table-btn forma-${table.forma} stato-${table.stato}`;
    btn.style.left = `${table.x}%`;
    btn.style.top  = `${table.y}%`;
    btn.dataset.id = table.id;
    if (editLayout) {
      btn.setAttribute("aria-label", t("sala_drag_hint", { name: table.nome }));
    } else {
      const statoLabel = tableStatusLabel(table.stato);
      btn.setAttribute("aria-label", t("sala_table_aria", { name: table.nome, status: statoLabel, seats: table.posti }));
    }
    btn.innerHTML = `
      <span class="table-name">${escHtml(table.nome)}</span>
      <span class="table-posti">${table.posti}p</span>
    `;

    if (editLayout) {
      addDragHandlers(btn, table);
    } else {
      btn.addEventListener("click", () => openTableModal(table));
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
function openTableModal(table) {
  if (editLayout) return;
  selectedTable = table;
  modalCoperti = table.posti;
  modalCorsi   = 1;
  noteDest     = "cucina";

  document.getElementById("modal-table-title").textContent = table.nome;
  document.getElementById("modal-table-sub").textContent =
    `${table.posti} ${t("sala_seats")} · ${t("sala_state")}: ${tableStatusLabel(table.stato)}`;
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
  const table = selectedTable;
  if (!table) return;

  const ordersForTable = activeOrders.filter((o) =>
    orderMatchesTable(o, table.nome) && !["chiuso", "annullato"].includes(o.status)
  );

  switch (actionId) {
    case "apri-tavolo":
      await tablesApi.patchStatus(table.id, "aperto").catch(console.error);
      await loadAll();
      if (selectedTable) {
        const updated = tables.find((x) => x.id === table.id);
        if (updated) {
          selectedTable = updated;
          document.getElementById("modal-table-sub").textContent =
            `${updated.posti} ${t("sala_seats")} · ${t("sala_state")}: ${tableStatusLabel(updated.stato)}`;
        }
      }
      showModalFlash(t("sala_flash_opened"));
      break;

    case "tavolo-libero":
      if (ordersForTable.length > 0) {
        if (!confirm(t("sala_confirm_free_with_orders", { n: ordersForTable.length }))) break;
        for (const order of ordersForTable) {
          await ordersApi.patchStatus(order.id, "annullato").catch(console.error);
        }
      }
      await tablesApi.patchStatus(table.id, "libero").catch(console.error);
      await loadAll();
      showModalFlash(t("sala_flash_free"));
      break;

    case "chiedi-conto":
      await tablesApi.patchStatus(table.id, "conto").catch(console.error);
      await loadAll();
      showModalFlash(t("sala_flash_bill"));
      break;

    case "marcia-portata":
      for (const order of ordersForTable) {
        await handleMarcia(order);
      }
      showModalFlash(t("sala_flash_marcia"));
      break;

    case "chiudi-tavolo": {
      let closed = 0;
      for (const order of ordersForTable) {
        try {
          await ordersApi.patchStatus(order.id, "chiuso");
          closed += 1;
        } catch (err) {
          console.error("chiudi ordine", order.id, err);
        }
      }
      await tablesApi.patchStatus(table.id, "sporco").catch(console.error);
      await loadAll();
      if (ordersForTable.length > 0 && closed === 0) {
        showModalFlash(t("sala_flash_close_error"));
      } else {
        showModalFlash(
          closed > 0
            ? t("sala_flash_closed_orders", { n: closed })
            : t("sala_flash_closed_dirty")
        );
      }
      break;
    }

    case "cancella-tavolo":
      for (const order of ordersForTable) {
        await ordersApi.patchStatus(order.id, "annullato").catch(console.error);
      }
      await tablesApi.patchStatus(table.id, "libero").catch(console.error);
      await loadAll();
      showModalFlash(t("sala_flash_cancelled"));
      break;

    case "prendi-ordine":
      closeTableModal();
      openOrderModal(table);
      break;

    case "menu-casa":
      closeTableModal();
      window.location.href = "/menu-admin/menu-admin.html";
      break;

    case "menu-giorno":
      closeTableModal();
      openOrderModal(table, "Menu del Giorno");
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
      showModalFlash(t("sala_flash_not_impl", { a: actionId }));
  }
}

// ============================================================
//   ORDER MODAL
// ============================================================
function openOrderModal(table, initialCatFilter) {
  orderTable   = table;
  orderCovers  = modalCoperti;
  orderWaiter  = "";
  orderNotes   = "";
  courses      = Array.from({ length: modalCorsi }, (_, i) => ({ n: i + 1, items: [] }));
  activeCourse = 1;
  menuSearch   = "";
  menuAreaFilter = "all";
  menuCatFilter  = initialCatFilter || "all";
  sending      = false;

  document.getElementById("modal-order-title").textContent = `${t("sala_table_abbr")} ${table.nome}`;
  document.getElementById("modal-order-sub").textContent   = `${table.posti} ${t("sala_seats")}`;
  document.getElementById("order-coperti-val").textContent = orderCovers;
  document.getElementById("order-waiter").value  = orderWaiter;
  document.getElementById("order-notes").value   = "";
  document.getElementById("order-send-error").style.display = "none";
  document.getElementById("menu-search").value   = "";
  document.getElementById("menu-area-filter").value = "all";
  document.getElementById("menu-cat-filter").value  = menuCatFilter;

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
    const [items, dailyData] = await Promise.all([
      menuApi.list(),
      menuApi.dailyActive().catch(() => ({ menuActive: false, dishes: [] })),
    ]);
    menuItems = Array.isArray(items) ? items.filter((i) => i.active !== false) : [];

    if (dailyData && dailyData.menuActive && Array.isArray(dailyData.dishes)) {
      const dailyItems = dailyData.dishes.map((d) => ({
        id: "daily-" + d.id,
        name: d.name,
        price: d.price || 0,
        area: "cucina",
        category: "Menu del Giorno",
        active: true,
        isDaily: true,
        description: d.description || "",
        allergens: d.allergens || "",
        dailyCategory: d.category || "",
      }));
      menuItems = menuItems.concat(dailyItems);
    }

    menuLoaded = true;
    buildCategoryFilter();
  } catch (e) {
    errEl.textContent = t("sala_menu_load_error", { msg: e.message });
    errEl.style.display = "block";
  } finally {
    loadEl.style.display = "none";
  }
  renderMenuGrid();
}

function buildCategoryFilter() {
  const cats = [...new Set(menuItems.map((i) => i.category).filter(Boolean))];
  const sel = document.getElementById("menu-cat-filter");
  sel.innerHTML = `<option value="all">${escHtml(t("sala_all_categories"))}</option>`;
  cats.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    sel.appendChild(opt);
  });
  if (menuCatFilter !== "all") sel.value = menuCatFilter;
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
    grid.innerHTML = `<p class="menu-empty">${escHtml(t("sala_menu_empty"))}</p>`;
    return;
  }
  grid.innerHTML = items.map((item) => {
    const area = (item.area || "cucina").toLowerCase();
    const dailyCls = item.isDaily ? " menu-item-daily" : "";
    const dailyBadge = item.isDaily
      ? `<span class="area-badge area-daily">📅 del giorno</span>`
      : "";
    return `
      <button type="button" class="menu-item-btn${dailyCls}" data-item-id="${escHtml(String(item.id))}">
        <span class="menu-item-name">${escHtml(item.name)}</span>
        <div class="menu-item-meta">
          <span class="menu-item-price">€${Number(item.price || 0).toFixed(2)}</span>
          ${areaBadge(area)}
          ${dailyBadge}
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
    return `<button type="button" class="${cls}" data-cn="${c.n}">${c.n}${t("sala_course_degree")}${escHtml(cnt)}</button>`;
  }).join("") +
    `<button type="button" class="course-tab-add" id="btn-add-course">${t("sala_add_course")}</button>`;

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
    t("sala_add_to_course", { n: activeCourse, m: menuItems.length });
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
    const stateLabel = isFirst ? t("sala_course_active") : t("sala_course_waiting");
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
        <p class="course-summary-title ${titleCls}">${c.n}${t("sala_course_degree")} — ${stateLabel}</p>
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
    label.textContent = t("sala_sending");
  } else {
    icon.textContent = "🚀";
    const coursesWord = courses.length === 1 ? t("sala_course_one") : t("sala_courses_many");
    label.textContent = t("sala_send_order_fmt", { total, n: courses.length, courses: coursesWord });
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
    document.getElementById("order-send-error").textContent = e.message || t("sala_order_send_error");
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
    showMgmtError(t("sala_add_table_error", { msg: e.message }));
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
    orderMatchesTable(o, candidate.nome) && !["chiuso", "annullato"].includes(o.status)
  );
  if (ordersOnTable.length > 0) {
    showMgmtError(t("sala_remove_active_orders", { name: candidate.nome }));
    return;
  }
  if (!confirm(t("sala_remove_confirm", { name: candidate.nome }))) return;

  tablesBusy = true;
  try {
    await tablesApi.remove(candidate.id);
    await loadAll();
  } catch (e) {
    showMgmtError(t("sala_remove_error", { msg: e.message }));
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
window.addEventListener("rw:orders-update", async (ev) => {
  try {
    if (ev.detail && ev.detail.orders) {
      activeOrders = Array.isArray(ev.detail.orders) ? ev.detail.orders : [];
    } else {
      const o = await ordersApi.listActive();
      activeOrders = Array.isArray(o) ? o : [];
    }
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
      showModalFlash(t("sala_flash_note_empty"));
      return;
    }
    try {
      await api("POST", "/api/sala/note", {
        table: selectedTable?.nome || "",
        department: noteDest,
        text: testo,
      });
      showModalFlash(t("sala_flash_note_sent", { dest: noteDest }));
      document.getElementById("note-text").value = "";
    } catch (e) {
      showModalFlash(t("sala_flash_note_error", { msg: e.message }));
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

  window.addEventListener("i18n:updated", refreshSalaI18n);

  // Auto-refresh ogni 30s
  setInterval(loadAll, 30000);
});
