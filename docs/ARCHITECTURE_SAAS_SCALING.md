# Architettura SaaS e scala (10.000+ ristoranti)

## Principi

1. **Isolamento tenant** — Ogni riga operativa include `restaurant_id` (già in uso nel core MySQL). Nessuna query senza filtro tenant.
2. **Connessioni DB** — Pool MySQL con limite per processo; a scala molto alta: **read replicas** per report e **shard** per tenant solo se necessario (non subito).
3. **Sessioni** — Session store già compatibile con MySQL (`express-mysql-session`); evitare sessioni enormi; JWT opzionale per API mobile in fase 2.
4. **Deploy** — Orizzontale: N istanze stateless dietro load balancer; WebSocket con sticky session o adapter Redis (roadmap).
5. **Billing SaaS** — Stripe già integrato: `customer` / `subscription` per tenant owner; webhook (richiede `STRIPE_WEBHOOK_SECRET` in produzione).

## Strati

```
[ CDN / TLS ]
      ↓
[ Load balancer ]
      ↓
[ App Node x N ]  →  MySQL primary (+ repliche read)
      ↓
[ Backup incrementale + object storage export ]
```

## Metriche da monitorare

- QPS per tenant, errori 5xx, latenza p95 API ordini  
- Dimensione tabelle `orders`, `order_items` per tenant  
- Job code: stampa, magazzino, email

## Limite 10.000 ristoranti

Fattibile su un solo cluster MySQL ben dimensionato con **indici su `restaurant_id`**, partizioni opzionali per `orders` per anno, e archiviazione ordini chiusi. Oltre certe soglie valutare **shard per regione** o **database per cluster geografico**.

---

*Documento guida — adattare a infrastruttura reale (Railway, GCP, AWS).*
