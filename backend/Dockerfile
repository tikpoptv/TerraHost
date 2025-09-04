FROM node:18-bookworm-slim AS base
ENV DEBIAN_FRONTEND=noninteractive

# ติดตั้งระบบพื้นฐาน + เครื่องมือ build + GDAL (ใช้ HTTPS เหมือน server)
RUN set -eux; \
    echo "deb https://ftp.debian.org/debian/ bookworm contrib main non-free non-free-firmware" > /etc/apt/sources.list; \
    echo "deb https://ftp.debian.org/debian/ bookworm-updates contrib main non-free non-free-firmware" >> /etc/apt/sources.list; \
    echo "deb https://security.debian.org/debian-security/ bookworm-security contrib main non-free non-free-firmware" >> /etc/apt/sources.list; \
    apt-get update -o Acquire::Retries=5 -o Acquire::http::Timeout=30; \
    apt-get install -y --no-install-recommends \
        ca-certificates curl wget gnupg \
        python3 python3-pip python3-venv python3-dev \
        build-essential pkg-config \
        gdal-bin libgdal-dev libproj-dev libgeos-dev libsqlite3-dev; \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Node deps
COPY package.json package-lock.json* ./
# --only=production เลิกใช้แล้ว เปลี่ยนเป็น --omit=dev
RUN npm ci --omit=dev && npm cache clean --force

# Python deps
COPY requirements.txt ./
RUN python3 -m venv /opt/venv \
 && /opt/venv/bin/pip install --no-cache-dir --upgrade pip setuptools wheel \
 && /opt/venv/bin/pip install --no-cache-dir -r requirements.txt

# Copy source
COPY . .

# Set Python virtual environment path
ENV PATH="/opt/venv/bin:$PATH"

# Non-root user
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nodejs
USER nodejs

EXPOSE 8000
ENV PORT=8000 HOST=0.0.0.0
CMD ["node", "src/server.js"]
