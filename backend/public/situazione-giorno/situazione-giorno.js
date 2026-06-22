(function () {
  "use strict";
  var lastNarrative = "";

  function $(id) { return document.getElementById(id); }

  async function loadBriefing() {
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
    $("narrative").textContent = lastNarrative;
    $("live-time").textContent = new Date(b.generatedAt || Date.now()).toLocaleTimeString("it-IT");

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
    if (!window.speechSynthesis) return alert("TTS non supportato");
    window.speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text);
    u.lang = "it-IT";
    window.speechSynthesis.speak(u);
  }

  function startVoice() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return alert("Riconoscimento vocale non supportato");
    var rec = new SR();
    rec.lang = "it-IT";
    rec.onresult = async function (ev) {
      var text = ev.results[0][0].transcript;
      var res = await fetch("/api/ai/chat", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, enableTools: true, context: "risto" }),
      });
      var data = await res.json();
      $("narrative").textContent = data.reply || "Nessuna risposta";
      if (data.reply) speak(data.reply);
    };
    rec.start();
  }

  document.addEventListener("DOMContentLoaded", function () {
    loadBriefing();
    $("btn-refresh").addEventListener("click", loadBriefing);
    $("btn-speak").addEventListener("click", function () { speak(lastNarrative); });
    $("btn-voice").addEventListener("click", startVoice);
    setInterval(loadBriefing, 60000);
  });
})();
