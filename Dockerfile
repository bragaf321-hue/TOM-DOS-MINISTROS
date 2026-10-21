FROM node:20-bookworm-slim

# Instala ffmpeg, python3, pip e yt-dlp completo com dependências de descriptografia e JS
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    python3-pip \
    ca-certificates \
    curl \
  && pip3 install --no-cache-dir --break-system-packages -U "yt-dlp[default]" \
  && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

ENV PORT=3080
EXPOSE 3080

CMD ["node", "server.js"]
