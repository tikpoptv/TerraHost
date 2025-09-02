FROM node:20-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

RUN mkdir .next
RUN chown nextjs:nodejs .next

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create a startup script to inject runtime environment variables
COPY <<EOF /app/start.sh
#!/bin/sh

# Create runtime config for environment variables
echo "window.__RUNTIME_CONFIG__ = {" > /tmp/runtime-config.js
echo "  NEXT_PUBLIC_API_URL: '\${NEXT_PUBLIC_API_URL:-http://localhost:8000}'" >> /tmp/runtime-config.js
echo "};" >> /tmp/runtime-config.js

# Replace the placeholder in any HTML files if they exist
if [ -f "/app/public/runtime-config.js" ]; then
  cp /tmp/runtime-config.js /app/public/runtime-config.js
fi

# Start the Next.js server
exec node server.js
EOF

RUN chmod +x /app/start.sh

# Create placeholder runtime config file
RUN echo "window.__RUNTIME_CONFIG__ = {};" > /app/public/runtime-config.js

CMD ["/app/start.sh"]
