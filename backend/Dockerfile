# Multi-stage build for Node.js + Python
FROM python:3.11-slim AS base

# Install system dependencies for Node.js and GDAL
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && apt-get install -y \
    gdal-bin \
    libgdal-dev \
    libgeos-dev \
    libproj-dev \
    libsqlite3-dev \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Install Node.js dependencies
COPY package.json package-lock.json* ./
RUN npm ci --only=production && npm cache clean --force

# Install Python dependencies
COPY requirements.txt ./
RUN pip3 install --no-cache-dir -r requirements.txt

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PYTHONPATH=/app/scripts

# Add user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

# Copy dependencies and source code
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs . .

# Make Python scripts executable
RUN chmod +x scripts/*.py

USER nodejs

EXPOSE 8000

ENV PORT=8000
ENV HOST=0.0.0.0

CMD ["node", "src/server.js"]
