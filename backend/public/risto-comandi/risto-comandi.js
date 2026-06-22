(function () {
  "use strict";
  var listening = false;
  var booted = false;

  function $(id) {
    return document.getElementById(id);
  }

  function t(key) {
    if (typeof window.rwT === "function") return window.rwT(key);
    return key;
  }

  function speechLang() {
    var lang = (window.ControlloTotaleI18n && window.ControlloTotaleI18n.getLang()) || "it";
    return lang === "en"
      ? "en-US"
      : lang === "de"
        ? "de-DE"
        : lang === "fr"
          ? "fr-FR"
          : lang === "es"
            ? "es-ES"
            : lang === "nl"
              ? "nl-NL"
              : "it-IT";
  }

  function currentLocale() {
    return (window.ControlloTotaleI18n && window.ControlloTotaleI18n.getLang()) || "it";
  }

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
    addMsg(t("risto_thinking"), "bot");
    var thinking = $("chat-log").lastElementChild;
    try {
      var res = await fetch("/api/ai/chat", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message,
          enableTools: true,
          context: "risto",
          locale: currentLocale(),
        }),
      });
      var data = await res.json();
      if (thinking && thinking.parentNode) thinking.remove();
      addMsg(data.reply || data.error || t("risto_error"), "bot", data.isAction);
      if (data.actions && data.actions.length) {
        addMsg(
          t("risto_actions_done") + " " + data.actions.map(function (a) { return a.tool; }).join(", "),
          "bot",
          true
        );
      }
    } catch (e) {
      if (thinking && thinking.parentNode) thinking.remove();
      addMsg(t("risto_error"), "bot");
    }
  }

  function setMicLabel(listeningNow) {
    var btn = $("btn-mic");
    if (!btn) return;
    btn.textContent = listeningNow ? t("risto_listening") : "🎤 " + t("risto_speak_btn");
  }

  function toggleMic() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return alert(t("risto_voice_unsupported"));
    if (listening) return;
    var rec = new SR();
    rec.lang = speechLang();
    rec.continuous = false;
    rec.interimResults = true;
    listening = true;
    setMicLabel(true);
    rec.onresult = function (ev) {
      var text = ev.results[ev.results.length - 1][0].transcript;
      $("chat-input").value = text;
      if (ev.results[ev.results.length - 1].isFinal) {
        send(text);
        listening = false;
        setMicLabel(false);
      }
    };
    rec.onend = function () {
      listening = false;
      setMicLabel(false);
    };
    rec.start();
  }

  function bindQuickTiles() {
    document.querySelectorAll(".quick-tile").forEach(function (btn) {
      btn.addEventListener("click", function () {
        send(btn.getAttribute("data-cmd") || "");
      });
    });
  }

  function init() {
    if (booted) return;
    booted = true;
    addMsg(t("risto_welcome"), "bot");
    $("chat-form").addEventListener("submit", function (e) {
      e.preventDefault();
      send($("chat-input").value);
    });
    $("btn-mic").addEventListener("click", toggleMic);
    bindQuickTiles();
    window.addEventListener("i18n:updated", function () {
      setMicLabel(listening);
    });
  }

  if (window.ControlloTotaleI18n && window.ControlloTotaleI18n.whenReady) {
    window.ControlloTotaleI18n.whenReady().then(init);
  } else {
    document.addEventListener("DOMContentLoaded", init);
  }
})();
