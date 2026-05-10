(function () {
  "use strict";

  let offset = 0;
  const limit = 80;

  function el(id) {
    return document.getElementById(id);
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function ymdMonthsAgo(m) {
    const d = new Date();
    d.setMonth(d.getMonth() - m);
    return d.toISOString().slice(0, 10);
  }

  function showErr(msg) {
    const e = el("load-err");
    e.style.display = msg ? "block" : "none";
    e.textContent = msg || "";
  }

  function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  function previewItems(items) {
    if (!items || !items.length) return "—";
    return items
      .map((it) => `${escapeHtml(it.name || "")} ×${it.qty != null ? it.qty : 1}`)
      .join(", ");
  }

  async function load(reset) {
    if (reset) offset = 0;
    const from = el("f-from").value || null;
    const to = el("f-to").value || null;
    showErr("");
    try {
      const q = new URLSearchParams({ limit: String(limit), offset: String(offset) });
      if (from) q.set("from", from);
      if (to) q.set("to", to);
      const data = await window.RW_API.get("/api/archive/orders?" + q.toString());
      el("tot-lbl").textContent =
        "Risultati: " + (data.total || 0) + " comande (mostrate " + (data.orders || []).length + " in questo blocco).";

      const tb = el("tbody-orders");
      const rows = (data.orders || [])
        .map((o) => {
          const ts = o.updatedAt || o.createdAt || "";
          return `
          <tr>
            <td>${escapeHtml(ts.slice(0, 19).replace("T", " "))}</td>
            <td>${escapeHtml(o.table != null ? o.table : "—")}</td>
            <td>${escapeHtml(o.area || "—")}</td>
            <td>${escapeHtml(o.status || "")}</td>
            <td>${o.covers != null ? o.covers : "—"}</td>
            <td>${escapeHtml(o.waiter || "—")}</td>
            <td style="max-width:320px;font-size:12px;">${previewItems(o.itemsPreview)}</td>
            <td class="no-print">
              <button type="button" class="btn danger btn-hide" data-id="${escapeHtml(o.id)}">Nascondi dall’archivio</button>
            </td>
          </tr>`;
        })
        .join("");

      if (reset) tb.innerHTML = rows;
      else tb.innerHTML += rows;

      tb.querySelectorAll(".btn-hide").forEach((btn) => {
        btn.addEventListener("click", async () => {
          if (!confirm("Nascondere questa comanda dall’archivio? L’ordine resta nel sistema.")) return;
          try {
            await window.RW_API.post("/api/archive/orders/" + encodeURIComponent(btn.dataset.id) + "/hide", {});
            await load(true);
          } catch (e) {
            alert(e.message || String(e));
          }
        });
      });
    } catch (err) {
      showErr(err.message || String(err));
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    el("f-to").value = todayISO();
    el("f-from").value = ymdMonthsAgo(3);
    el("btn-load").addEventListener("click", () => load(true));
    el("btn-more").addEventListener("click", () => {
      offset += limit;
      load(false);
    });
    el("btn-print").addEventListener("click", () => window.print());
    load(true);
  });
})();
