# Multi-stage build for Node.js + Python geospatial processing
FROM python:3.11-slim-bookworm AS python-base

# Fix repository sources - Debian 12 uses .sources files
RUN rm -f /etc/apt/sources.list.d/*.sources && \
    echo "deb https://ftp.debian.org/debian/ bookworm contrib main non-free non-free-firmware" > /etc/apt/sources.list && \
    echo "deb https://ftp.debian.org/debian/ bookworm-updates contrib main non-free non-free-firmware" >> /etc/apt/sources.list && \
    echo "deb https://security.debian.org/debian-security/ bookworm-security contrib main non-free non-free-firmware" >> /etc/apt/sources.list

# Install system dependencies for geospatial processing
RUN apt-get update && apt-get install -y \
    gdal-bin \
    libgdal-dev \
    libproj-dev \
    libgeos-dev \
    libsqlite3-dev \
    build-essential \
    pkg-config \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create virtual environment and install Python dependencies
COPY requirements.txt .
RUN python -m venv /app/venv \
    && /app/venv/bin/pip install --upgrade pip \
    && /app/venv/bin/pip install --no-cache-dir -r requirements.txt \
    && chmod +x /app/venv/bin/python

# Install Node.js
RUN apt-get update && apt-get install -y curl \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install Node.js dependencies
RUN npm ci --omit=dev && npm cache clean --force

# Copy application code
COPY . .

# Ensure scripts directory exists and has correct permissions
RUN mkdir -p /app/scripts \
    && ls -la /app/scripts/ \
    && chmod +x /app/scripts/geotiff_extractor.py \
    && ls -la /app/scripts/geotiff_extractor.py

# Create non-root user
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nodejs

# Create temp directory and set permissions
RUN mkdir -p /app/temp \
    && chown -R nodejs:nodejs /app \
    && chmod -R 755 /app/temp

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 8000

# Set environment variables
ENV PORT=8000 \
    HOST=0.0.0.0 \
    PYTHONPATH=/app/scripts \
    GDAL_DATA=/usr/share/gdal \
    PROJ_LIB=/usr/share/proj \
    PATH="/app/venv/bin:$PATH"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

# Start the application
CMD ["node", "src/server.js"]