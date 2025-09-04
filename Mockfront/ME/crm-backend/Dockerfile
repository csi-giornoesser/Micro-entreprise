# Image Puppeteer officielle (inclut Node 22 + Chromium + dépendances)
FROM ghcr.io/puppeteer/puppeteer:22

WORKDIR /app

# Copie des deps et install prod
COPY package*.json ./
RUN npm ci --omit=dev

# Copie du code source
COPY src ./src

# Variables d'exécution
ENV NODE_ENV=production \
    PORT=8000 \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    PUPPETEER_SKIP_DOWNLOAD=true

EXPOSE 8000

# On **n'utilise pas** de .env dans l'image; compose injecte l'env
CMD ["node", "src/server.js"]
