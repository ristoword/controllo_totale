(function () {
  "use strict";

  var SECTIONS = [
    {
      id: "dashboard",
      title: "Dashboard",
      content: [
        "<p>La Dashboard è il punto di partenza operativo. Mostra in tempo reale:</p>",
        "<ul>",
        "<li><strong>KPI ordini:</strong> ordini aperti, tavoli occupati, pronti, in preparazione, in ritardo (&gt;15 min)</li>",
        "<li><strong>Trend revenue:</strong> incasso oggi/settimana/mese con delta % e previsioni 7/30 giorni</li>",
        "<li><strong>Stato cassa:</strong> turno aperto/chiuso con operatore e float</li>",
        "<li><strong>Avvisi:</strong> scorte basse, ordini in ritardo, giornata chiusa</li>",
        "<li><strong>Menu del giorno:</strong> riepilogo piatti attivi</li>",
        "<li><strong>AI Assist:</strong> domanda rapida all'AI per qualsiasi dato operativo</li>",
        "</ul>",
      ].join(""),
    },
    {
      id: "sala",
      title: "Sala (Gestione Tavoli e Ordini)",
      content: [
        "<p>Gestione completa dei tavoli e delle comande.</p>",
        "<h3>Funzionalità</h3>",
        "<ul>",
        "<li>Floor plan interattivo con tavoli trascinabili</li>",
        "<li>Stati tavolo: libero, aperto, conto, sporco</li>",
        "<li>Creazione comanda con corsi, coperti, note</li>",
        "<li>Marcia (corso attivo) per sincronizzare cucina e sala</li>",
        "<li>Ricerca piatti per nome o categoria</li>",
        "<li>Integrazione cantina vini</li>",
        "</ul>",
      ].join(""),
    },
    {
      id: "cucina",
      title: "Cucina (KDS)",
      content: [
        "<p>Kitchen Display System per la gestione della produzione.</p>",
        "<ul>",
        "<li>Colonne: In attesa → In preparazione → Pronto → Servito</li>",
        "<li>Gestione per corso (marcia)</li>",
        "<li>Timer e avvisi ordini in ritardo</li>",
        "<li>Ricette con food cost calcolato</li>",
        "<li>Lista spesa automatica</li>",
        "<li>AI Insights cucina</li>",
        "</ul>",
      ].join(""),
    },
    {
      id: "cassa",
      title: "Cassa (Pagamenti)",
      content: [
        "<p>Gestione completa degli incassi e chiusure.</p>",
        "<ul>",
        "<li>Pagamento tavolo: contanti, carta, online, ticket, misto</li>",
        "<li>Split conto (uguale, manuale, misto)</li>",
        "<li>Storni con motivazione</li>",
        "<li>Fatture</li>",
        "<li>Turni cassa: apertura, cambio, chiusura parziale, Z-Report</li>",
        "<li><strong>Pay Online:</strong> genera link Stripe per pagamento al tavolo via QR</li>",
        "</ul>",
      ].join(""),
    },
    {
      id: "magazzino",
      title: "Magazzino (Inventario)",
      content: [
        "<ul>",
        "<li>Inventario centrale con reparti (cucina, sala, bar)</li>",
        "<li>Trasferimenti tra reparti, resi, rettifiche</li>",
        "<li>Ricezione merce con barcode e comandi vocali</li>",
        "<li><strong>Smart Reorder:</strong> suggerimenti riordino basati su consumo 14gg</li>",
        "<li>Lista spesa e invio email al fornitore</li>",
        "<li>Storico movimenti</li>",
        "</ul>",
      ].join(""),
    },
    {
      id: "fornitori",
      title: "Fornitori e Ordini d'Acquisto",
      content: [
        "<ul>",
        "<li>Anagrafica fornitori con archivio e ripristino</li>",
        "<li><strong>Ordini d'Acquisto (PO):</strong> bozza → inviato → parziale → ricevuto → annullato</li>",
        "<li>Ricezione merce che aggiorna automaticamente il magazzino</li>",
        "<li>Report acquisti per fornitore</li>",
        "<li>Email ordine al fornitore</li>",
        "</ul>",
      ].join(""),
    },
    {
      id: "ai",
      title: "AI Operativa",
      content: [
        "<p>Controllo Totale integra AI in ogni modulo.</p>",
        "<ul>",
        "<li><strong>AI Assistente:</strong> chat con strumenti operativi (cerca stock, aggiorna giacenza, crea ricetta, aggiungi piatto menu, prepara ordine fornitore)</li>",
        "<li><strong>Risto Comandi:</strong> assistente vocale con esecuzione comandi</li>",
        "<li><strong>Situazione del Giorno:</strong> briefing operativo con narrazione TTS</li>",
        "<li><strong>Kitchen Insights:</strong> snapshot operativo cucina con ordini, ritardi, top piatti, scorte</li>",
        "<li><strong>Menu Generator:</strong> suggerimenti menu basati su disponibilità ingredienti e vendite</li>",
        "<li><strong>Pricing AI:</strong> ottimizzazione prezzi per raggiungere margine target</li>",
        "<li><strong>AI Proposals:</strong> proposte automatiche (riordino, ottimizzazione menu, alert operativi)</li>",
        "</ul>",
      ].join(""),
    },
    {
      id: "staff",
      title: "Staff e HR",
      content: [
        "<ul>",
        "<li>Anagrafica dipendenti</li>",
        "<li>Turni settimanali e mensili per area</li>",
        "<li>Timbrature (clock-in/out), presenze, assenze</li>",
        "<li>Ferie e richieste con approvazione</li>",
        "<li>Costi personale</li>",
        "<li>Profilo personale (Il mio profilo)</li>",
        "</ul>",
      ].join(""),
    },
    {
      id: "reports",
      title: "Reports e Analytics",
      content: [
        "<ul>",
        "<li><strong>Trends:</strong> revenue oggi/settimana/mese con delta % e previsioni</li>",
        "<li><strong>Report Giornaliero:</strong> ordini, incassi, metodi pagamento</li>",
        "<li><strong>Report Commercialista:</strong> export per periodo</li>",
        "<li><strong>Top Dishes:</strong> piatti più venduti</li>",
        "<li><strong>Dish Margins:</strong> margine per piatto con food cost %</li>",
        "<li><strong>Food Cost Alerts:</strong> piatti sopra soglia</li>",
        "<li><strong>Report Unificato:</strong> snapshot cross-modulo (ordini, stock, personale, revenue)</li>",
        "<li><strong>Archivio:</strong> storico finanziario con confronto mese</li>",
        "</ul>",
      ].join(""),
    },
  ];

  function renderTOC() {
    var toc = document.getElementById("manual-toc");
    if (!toc) return;
    var html = '<div class="toc-title">Indice</div><ul class="toc-list">';
    SECTIONS.forEach(function (s) {
      html += '<li><a href="#sec-' + s.id + '">' + s.title + "</a></li>";
    });
    html += "</ul>";
    toc.innerHTML = html;
  }

  function renderContent() {
    var content = document.getElementById("manual-content");
    if (!content) return;
    var html = "";
    SECTIONS.forEach(function (s) {
      html += '<div class="manual-section" id="sec-' + s.id + '" data-search="' +
        (s.title + " " + s.content).toLowerCase().replace(/<[^>]*>/g, "") + '">';
      html += "<h2>" + s.title + "</h2>";
      html += s.content;
      html += "</div>";
    });
    content.innerHTML = html;
  }

  function setupSearch() {
    var input = document.getElementById("manual-search");
    if (!input) return;
    input.addEventListener("input", function () {
      var q = input.value.trim().toLowerCase();
      var sections = document.querySelectorAll(".manual-section");
      sections.forEach(function (sec) {
        var data = sec.getAttribute("data-search") || "";
        sec.classList.toggle("hidden", q.length > 0 && data.indexOf(q) === -1);
      });
    });
  }

  function boot() {
    renderTOC();
    renderContent();
    setupSearch();
  }

  var hasAuth = !!document.querySelector('script[src*="auth-guard"]');
  document.addEventListener("rw:auth-ready", boot, { once: true });
  if (!hasAuth) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", boot, { once: true });
    } else {
      boot();
    }
  }
})();
