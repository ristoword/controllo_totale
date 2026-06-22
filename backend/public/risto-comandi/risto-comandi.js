(function () {
  "use strict";
  var listening = false;

  function $(id) { return document.getElementById(id); }

  function addMsg(text, role, isAction) {
    var el = document.createElement("div");
    el.className = "msg " + (role || "bot") + (isAction ? " action" : "");
    el.textContent = text;
    $("chat-log").appendChild(el);
    $("chat-log").scrollTop = $("chat-log").scrollHeight;
  }

  async function send(message) {
    if (!message.trim()) return;
    addMsg(message, "user");
    $("chat-input").value = "";
    var res = await fetch("/api/ai/chat", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: message, enableTools: true, context: "risto", locale: "it" }),
    });
    var data = await res.json();
    addMsg(data.reply || data.error || "Errore", "bot", data.isAction);
    if (data.actions && data.actions.length) {
      addMsg("Azioni eseguite: " + data.actions.map(function (a) { return a.tool; }).join(", "), "bot", true);
    }
  }

  function toggleMic() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return alert("Microfono non supportato");
    if (listening) return;
    var rec = new SR();
    rec.lang = "it-IT";
    rec.continuous = false;
    rec.interimResults = true;
    listening = true;
    $("btn-mic").textContent = "🔴 In ascolto...";
    rec.onresult = function (ev) {
      var text = ev.results[ev.results.length - 1][0].transcript;
      $("chat-input").value = text;
      if (ev.results[ev.results.length - 1].isFinal) {
        send(text);
        listening = false;
        $("btn-mic").textContent = "🎤 Parla";
      }
    };
    rec.onend = function () {
      listening = false;
      $("btn-mic").textContent = "🎤 Parla";
    };
    rec.start();
  }

  document.addEventListener("DOMContentLoaded", function () {
    addMsg("Ciao! Sono Risto. Chiedimi la situazione, aggiorna stock, aggiungi vini o fai il briefing.", "bot");
    $("chat-form").addEventListener("submit", function (e) {
      e.preventDefault();
      send($("chat-input").value);
    });
    $("btn-mic").addEventListener("click", toggleMic);
    document.querySelectorAll(".quick").forEach(function (btn) {
      btn.addEventListener("click", function () { send(btn.getAttribute("data-cmd")); });
    });
  });
})();
