# Controllo Totale — Prodotto SaaS

## Posizionamento

**Controllo Totale** è il gestionale ristorazione multi-reparto (Sala → Cucina → Cassa → Magazzino) pensato per:

- **Multi-locale** (tenant isolati per `restaurant_id`)
- **SaaS** (abbonamento, Stripe, webhook)
- **Deploy cloud** (Railway, Docker, MySQL gestito)

Questo repository è **indipendente** da qualsiasi altro gestionale: non condividere deploy, database o cartelle dati con altri prodotti.

## Endpoint pubblici utili

| Endpoint | Uso |
|----------|-----|
| `GET /api/health` | Healthcheck orchestratori (Railway `healthcheckPath`) |
| `GET /api/system/product` | Metadati prodotto (nome, versione, slug) per login/branding client |
| `GET /api/system/health` | Stesso payload di `/api/health` |

Variabili: `APP_NAME`, `APP_VERSION`, `PRODUCT_SLUG` (vedi `backend/.env.example`).

## Credibilità commerciale

- **Isolamento dati** per tenant (middleware `tenantContext`)
- **Sessioni** sicure (`SESSION_SECRET` obbligatorio)
- **Licenza** e **owner setup** per onboarding cliente
- **Stripe** (checkout, webhook opzionale)

## Roadmap commerciale (non esaustiva)

1. White-label dominio cliente (CNAME)
2. Piani tariffari (posti, reparti, API)
3. Export GDPR / retention policy documentata
4. SLA monitoraggio (uptime su `/api/health`)
