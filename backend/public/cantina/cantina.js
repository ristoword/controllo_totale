(function () {
  "use strict";
  var wines = [];

  function $(id) { return document.getElementById(id); }

  async function api(url, opts) {
    var res = await fetch(url, Object.assign({ credentials: "same-origin", headers: { "Content-Type": "application/json" } }, opts || {}));
    var data = await res.json().catch(function () { return null; });
    if (!res.ok) throw new Error((data && data.error) || "Errore " + res.status);
    return data;
  }

  function margin(w) {
    var sale = Number(w.salePrice) || 0;
    var buy = Number(w.purchasePrice) || 0;
    if (sale <= 0) return 0;
    return Math.round(((sale - buy) / sale) * 100);
  }

  function euro(n) {
    return "€ " + Number(n || 0).toFixed(2).replace(".", ",");
  }

  function showError(msg) {
    var el = $("cantina-load-error");
    if (!el) return;
    el.textContent = msg || "Errore caricamento cantina.";
    el.style.display = msg ? "block" : "none";
  }

  function applyStatsFromWines() {
    var active = wines.filter(function (w) { return w.active !== false; });
    var totalBottles = active.reduce(function (s, w) { return s + (Number(w.stock) || 0); }, 0);
    var low = active.filter(function (w) {
      var st = Number(w.stock) || 0;
      return st > 0 && st <= 3;
    }).length;
    var marginSum = 0;
    var marginN = 0;
    for (var i = 0; i < active.length; i++) {
      var sale = Number(active[i].salePrice) || 0;
      if (sale > 0) {
        marginSum += margin(active[i]);
        marginN += 1;
      }
    }
    $("st-total").textContent = String(active.length);
    $("st-bottles").textContent = String(totalBottles);
    $("st-low").textContent = String(low);
    $("st-margin").textContent = String(marginN ? Math.round(marginSum / marginN) : 0) + "%";
  }

  function render() {
    var tbody = $("wines-tbody");
    tbody.innerHTML = "";
    if (!wines.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="padding:16px;color:var(--text-muted)">Nessun vino in carta. Clicca «+ Nuovo vino» o Aggiorna.</td></tr>';
      return;
    }
    for (var i = 0; i < wines.length; i++) {
      var w = wines[i];
      var tr = document.createElement("tr");
      tr.innerHTML =
        '<td class="name"><strong>' + (w.producer || "") + '</strong><br><span style="font-size:11px;color:var(--text-muted)">' + w.name + (w.vintage ? " " + w.vintage : "") + "</span></td>" +
        '<td><span class="badge ' + w.color + '">' + w.color + "</span></td>" +
        '<td class="num">' + (w.stock || 0) + "</td>" +
        '<td class="num">' + euro(w.salePrice) + "</td>" +
        '<td class="num ' + (margin(w) >= 55 ? "cantina-margin-ok" : "cantina-margin-low") + '">' + margin(w) + "%</td>" +
        '<td class="actions"><button class="btn ghost small" data-edit="' + w.id + '">Mod</button><button class="btn ghost small" data-del="' + w.id + '">Del</button></td>';
      tbody.appendChild(tr);
    }
    tbody.querySelectorAll("[data-edit]").forEach(function (btn) {
      btn.addEventListener("click", function () { editWine(btn.getAttribute("data-edit")); });
    });
    tbody.querySelectorAll("[data-del]").forEach(function (btn) {
      btn.addEventListener("click", function () { deleteWine(btn.getAttribute("data-del")); });
    });
  }

  async function loadStats() {
    try {
      var snap = await api("/api/cantina/ai");
      $("st-total").textContent = String(snap.summary.total || 0);
      $("st-bottles").textContent = String(snap.summary.totalBottles || 0);
      $("st-low").textContent = String(snap.summary.lowStock || 0);
      $("st-margin").textContent = String(snap.summary.avgMarginPct || 0) + "%";
    } catch (_) {
      applyStatsFromWines();
    }
  }

  async function loadWines() {
    var q = $("f-search").value.trim();
    var color = $("f-color").value;
    var url = "/api/cantina?";
    if (q) url += "q=" + encodeURIComponent(q) + "&";
    if (color) url += "color=" + encodeURIComponent(color);
    wines = await api(url);
    if (!Array.isArray(wines)) wines = [];
    render();
    applyStatsFromWines();
  }

  function resetForm() {
    $("wine-id").value = "";
    $("form-title").textContent = "Nuovo vino";
    $("wine-form").reset();
  }

  function editWine(id) {
    var w = wines.find(function (x) { return x.id === id; });
    if (!w) return;
    $("wine-id").value = w.id;
    $("form-title").textContent = "Modifica vino";
    $("wine-producer").value = w.producer || "";
    $("wine-name").value = w.name || "";
    $("wine-vintage").value = w.vintage || "";
    $("wine-color").value = w.color || "rosso";
    $("wine-country").value = w.country || "";
    $("wine-buy").value = w.purchasePrice || "";
    $("wine-sale").value = w.salePrice || "";
    $("wine-stock").value = w.stock || 0;
    $("wine-pairings").value = w.pairings || "";
  }

  async function deleteWine(id) {
    if (!confirm("Eliminare questo vino?")) return;
    await api("/api/cantina/" + id, { method: "DELETE" });
    await loadWines();
    await loadStats();
  }

  async function load() {
    showError("");
    try {
      await loadWines();
      await loadStats();
    } catch (e) {
      showError((e && e.message) || "Impossibile caricare i vini. Accedi al gestionale e riprova.");
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    load();
    $("btn-refresh").addEventListener("click", load);
    $("f-search").addEventListener("input", loadWines);
    $("f-color").addEventListener("change", loadWines);
    $("btn-new").addEventListener("click", resetForm);
    $("btn-cancel").addEventListener("click", resetForm);
    $("btn-ai").addEventListener("click", async function () {
      try {
        var snap = await api("/api/cantina/ai");
        $("ai-panel").style.display = "";
        $("ai-output").textContent = JSON.stringify(snap, null, 2);
      } catch (e) {
        alert((e && e.message) || "Errore snapshot AI cantina");
      }
    });
    $("wine-form").addEventListener("submit", async function (e) {
      e.preventDefault();
      var payload = {
        producer: $("wine-producer").value.trim(),
        name: $("wine-name").value.trim(),
        vintage: Number($("wine-vintage").value) || null,
        color: $("wine-color").value,
        country: $("wine-country").value.trim(),
        purchasePrice: Number($("wine-buy").value) || 0,
        salePrice: Number($("wine-sale").value) || 0,
        stock: Number($("wine-stock").value) || 0,
        pairings: $("wine-pairings").value.trim(),
      };
      var id = $("wine-id").value;
      if (id) await api("/api/cantina/" + id, { method: "PATCH", body: JSON.stringify(payload) });
      else await api("/api/cantina", { method: "POST", body: JSON.stringify(payload) });
      resetForm();
      await load();
    });
  });
})();
