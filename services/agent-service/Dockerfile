# Build stage
FROM node:20-alpine AS builder

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy all source code first
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.json ./
COPY packages/config ./packages/config
COPY packages/logger ./packages/logger
COPY packages/cache ./packages/cache
COPY packages/database ./packages/database
COPY packages/shared-domain ./packages/shared-domain
COPY services/agent-service ./services/agent-service

# Install dependencies (allow build scripts to run, but skip husky)
ENV HUSKY=0
RUN pnpm install --frozen-lockfile

# Build packages in order
WORKDIR /app/packages/config
RUN pnpm build

WORKDIR /app/packages/logger
RUN pnpm build

WORKDIR /app/packages/cache
RUN pnpm build

WORKDIR /app/packages/shared-domain
RUN pnpm build

WORKDIR /app/packages/database
RUN pnpm build

# Build agent-service
WORKDIR /app/services/agent-service
RUN pnpm build

# Production stage
FROM node:20-alpine

RUN apk add --no-cache chromium nss freetype harfbuzz ttf-freefont ca-certificates lsb-release xdg-utils wget 

# Create a non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy SSL certificate for database connection
COPY global-bundle.pem /etc/ssl/certs/global-bundle.pem

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/config/package.json ./packages/config/
COPY packages/logger/package.json ./packages/logger/
COPY packages/cache/package.json ./packages/cache/
COPY packages/database/package.json ./packages/database/
COPY packages/shared-domain/package.json ./packages/shared-domain/
COPY services/agent-service/package.json ./services/agent-service/

# Install only production dependencies
ENV HUSKY=0
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# Copy built files from builder
COPY --from=builder /app/packages/config/dist ./packages/config/dist
COPY --from=builder /app/packages/logger/dist ./packages/logger/dist
COPY --from=builder /app/packages/cache/dist ./packages/cache/dist
COPY --from=builder /app/packages/database/dist ./packages/database/dist
COPY --from=builder /app/packages/shared-domain/dist ./packages/shared-domain/dist
COPY --from=builder /app/services/agent-service/dist ./services/agent-service/dist

WORKDIR /app/services/agent-service

# Create logs directory with full write permissions for the non-root user
RUN mkdir -p ./logs && chown -R appuser:appgroup ./logs && chmod -R 755 ./logs

# Switch to non-root user
USER appuser

EXPOSE 3000

CMD ["node", "dist/main.js"]