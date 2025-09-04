FROM node:18-bullseye-slim AS base
ENV DEBIAN_FRONTEND=noninteractive

# ติดตั้ง system dependencies แบบขั้นบันได
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl wget gnupg \
    && rm -rf /var/lib/apt/lists/*

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv python3-dev \
    && rm -rf /var/lib/apt/lists/*

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential pkg-config \
    && rm -rf /var/lib/apt/lists/*

RUN apt-get update && apt-get install -y --no-install-recommends \
    gdal-bin libgdal-dev \
    libproj-dev libgeos-dev libsqlite3-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Node deps
COPY package.json package-lock.json* ./
RUN npm ci --only=production && npm cache clean --force

# Python deps
COPY requirements.txt ./
RUN python3 -m pip install --no-cache-dir --upgrade pip setuptools wheel \
 && pip3 install --no-cache-dir -r requirements.txt

# Copy source
COPY . .

# Non-root user
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nodejs
USER nodejs

EXPOSE 8000
ENV PORT=8000 HOST=0.0.0.0
CMD ["node", "src/server.js"]
