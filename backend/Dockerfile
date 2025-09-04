FROM debian:bookworm-slim AS base
ENV DEBIAN_FRONTEND=noninteractive

# ติดตั้ง Node.js 20
RUN apt-get update \
 && apt-get install -y curl gnupg \
 && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
 && apt-get install -y nodejs

# ติดตั้ง system GDAL + dev headers + build tools
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv python3-dev \
    gdal-bin libgdal-dev \
    build-essential pkg-config \
    libproj-dev libgeos-dev libsqlite3-dev \
    ca-certificates curl wget gnupg \
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
