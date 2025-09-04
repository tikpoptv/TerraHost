# เสถียรสุดสำหรับ Node 20
FROM node:20-bookworm-slim AS base
ENV DEBIAN_FRONTEND=noninteractive

# (กันกรณีแหล่งเป็น http) บังคับแหล่งเป็น https เช่นกัน
RUN set -eux; \
  sed -i 's|http://deb.debian.org|https://deb.debian.org|g' /etc/apt/sources.list; \
  sed -i 's|http://security.debian.org|https://security.debian.org|g' /etc/apt/sources.list; \
  rm -rf /var/lib/apt/lists/*; \
  apt-get update -o Acquire::Retries=5; \
  apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv \
    gdal-bin libgdal-dev libgeos-dev libproj-dev libsqlite3-dev \
    build-essential ca-certificates curl wget gnupg; \
  rm -rf /var/lib/apt/lists/*

# ----- deps -----
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --only=production && npm cache clean --force
COPY requirements.txt ./
RUN python3 -m pip install --no-cache-dir --upgrade pip setuptools wheel \
 && pip3 install --no-cache-dir -r requirements.txt

# ----- runner -----
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production PYTHONPATH=/app/scripts
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nodejs
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs . .
RUN chmod +x scripts/*.py || true
USER nodejs
EXPOSE 8000
ENV PORT=8000 HOST=0.0.0.0
CMD ["node", "src/server.js"]
