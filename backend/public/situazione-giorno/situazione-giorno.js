(function () {
  "use strict";
  var lastNarrative = "";

  function $(id) { return document.getElementById(id); }

  function t(key) {
    if (typeof window.rwT === "function") return window.rwT(key);
    return key;
  }

  function speechLang() {
    var lang = (window.ControlloTotaleI18n && window.ControlloTotaleI18n.getLang()) || "it";
    return lang === "en" ? "en-US" : lang === "de" ? "de-DE" : lang === "fr" ? "fr-FR" : lang === "es" ? "es-ES" : lang === "nl" ? "nl-NL" : "it-IT";
  }

  function localeTag() {
    var lang = (window.ControlloTotaleI18n && window.ControlloTotaleI18n.getLang()) || "it";
    return lang === "en" ? "en-GB" : lang + "-" + lang.toUpperCase();
  }

  async function loadBriefing() {
    $("narrative").textContent = t("situazione_loading");
    var res = await fetch("/api/operational-briefing", { credentials: "same-origin" });
    var data = await res.json();
    var b = data.briefing || {};
    lastNarrative = data.narrative || "";

    $("k-bookings").textContent = String(b.bookings?.count || 0);
    $("k-covers").textContent = String(b.bookings?.covers || 0);
    $("k-staff").textContent = String(b.staff?.onShift || 0);
    $("k-late").textContent = String(b.kitchen?.late || 0);
    $("k-revenue").textContent = "€ " + Number(b.sales?.revenueToday || 0).toFixed(2);
    $("k-stock").textContent = String(b.inventory?.lowStockCount || 0);
    $("narrative").textContent = lastNarrative || t("situazione_no_data");
    $("live-time").textContent = new Date(b.generatedAt || Date.now()).toLocaleTimeString(localeTag());

    var btbody = $("bookings-tbody");
    btbody.innerHTML = "";
    (b.bookings?.items || []).forEach(function (row) {
      var tr = document.createElement("tr");
      tr.innerHTML = "<td>" + row.time + "</td><td>" + row.name + "</td><td>" + row.covers + "</td><td>" + row.table + "</td>";
      btbody.appendChild(tr);
    });

    var stbody = $("stock-tbody");
    stbody.innerHTML = "";
    (b.inventory?.lowStock || []).forEach(function (row) {
      var tr = document.createElement("tr");
      tr.innerHTML = "<td>" + row.name + "</td><td>" + row.qty + "</td><td>" + row.threshold + "</td>";
      stbody.appendChild(tr);
    });
  }

  function speak(text) {
    if (!window.speechSynthesis) return alert(t("tts_unsupported"));
    window.speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text);
    u.lang = speechLang();
    window.speechSynthesis.speak(u);
  }

  function startVoice() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return alert(t("risto_voice_unsupported"));
    var rec = new SR();
    rec.lang = speechLang();
    rec.onresult = async function (ev) {
      var text = ev.results[0][0].transcript;
      var res = await fetch("/api/ai/chat", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          enableTools: true,
          context: "risto",
          locale: (window.ControlloTotaleI18n && window.ControlloTotaleI18n.getLang()) || "it",
        }),
      });
      var data = await res.json();
      $("narrative").textContent = data.reply || t("situazione_no_response");
      if (data.reply) speak(data.reply);
    };
    rec.start();
  }

  function init() {
    loadBriefing();
    $("btn-refresh").addEventListener("click", loadBriefing);
    $("btn-speak").addEventListener("click", function () { speak(lastNarrative); });
    $("btn-voice").addEventListener("click", startVoice);
    setInterval(loadBriefing, 60000);
  }

  if (window.ControlloTotaleI18n && window.ControlloTotaleI18n.whenReady) {
    window.ControlloTotaleI18n.whenReady().then(init);
  } else {
    document.addEventListener("DOMContentLoaded", init);
  }
})();
