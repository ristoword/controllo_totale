# Controllo Totale — npm workspaces: un solo `npm ci` installa anche le dipendenze di `backend/`
# (vedi package.json root: "workspaces": ["backend"]).
# NODE_PATH: con dipendenze hoistate in /app/node_modules, i require da backend/ le trovano sempre.

FROM node:18-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json backend/

RUN npm ci

COPY . .

RUN test -d node_modules/express || (echo "npm ci non ha installato le dipendenze root" && exit 1)

ENV NODE_ENV=production
ENV NODE_PATH=/app/node_modules

EXPOSE 8080

CMD ["node", "backend/src/server.js"]
