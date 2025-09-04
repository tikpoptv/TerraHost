# ---- Base: Node 20 + Debian 12 (bookworm) ----
FROM node:20-bookworm-slim AS base
ENV DEBIAN_FRONTEND=noninteractive

# System deps: Python + GDAL + build tools
RUN set -eux; \
  rm -rf /var/lib/apt/lists/*; \
  apt-get update -o Acquire::Retries=5; \
  apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv python3-dev pkg-config \
    gdal-bin libgdal-dev libgeos-dev libproj-dev libsqlite3-dev \
    build-essential ca-certificates curl wget gnupg; \
  rm -rf /var/lib/apt/lists/*

# ---- Deps stage ----
FROM base AS deps
WORKDIR /app

# Node dependencies
COPY package.json package-lock.json* ./
RUN npm ci --only=production && npm cache clean --force

# Python dependencies
COPY requirements.txt ./
RUN python3 -m pip install --no-cache-dir --upgrade pip setuptools wheel \
 && pip3 install --no-cache-dir -r requirements.txt

# ---- Runner ----
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PYTHONPATH=/app/scripts

# Non-root user
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nodejs

# Copy deps & source
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs . .

# Make Python scripts executable (เผื่อมี)
RUN chmod +x scripts/*.py || true

USER nodejs

EXPOSE 8000
ENV PORT=8000
ENV HOST=0.0.0.0

CMD ["node", "src/server.js"]
