# Imagem única: compila o cliente web e roda o servidor (que também serve o cliente).
# Funciona no Render, Koyeb, Fly.io, Oracle Cloud, VPS ou qualquer host com Docker.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build -w client

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8080
COPY package.json package-lock.json* ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --omit=dev --no-audit --no-fund -w server -w shared && npm cache clean --force
COPY shared shared
COPY server server
COPY --from=build /app/client/dist client/dist
EXPOSE 8080
USER node
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:${PORT}/health || exit 1
CMD ["node", "server/src/index.js"]
