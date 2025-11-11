# Build stage
FROM node:20-alpine AS builder

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodeuser -u 1001

# Copy all source code first
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.json ./
COPY packages/config ./packages/config
COPY packages/logger ./packages/logger
COPY packages/shared-domain ./packages/shared-domain
COPY services/orchestrator ./services/orchestrator

# Install dependencies (allow build scripts to run, but skip husky)
ENV HUSKY=0
RUN pnpm install --frozen-lockfile

# Build packages in order
WORKDIR /app/packages/config
RUN pnpm build

WORKDIR /app/packages/logger
RUN pnpm build

WORKDIR /app/packages/shared-domain
RUN pnpm build

# Build orchestrator service
WORKDIR /app/services/orchestrator
RUN pnpm build

# Production stage
FROM node:20-alpine

# Install pnpm
RUN npm install -g pnpm

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nodeuser -u 1001

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/config/package.json ./packages/config/
COPY packages/logger/package.json ./packages/logger/
COPY packages/shared-domain/package.json ./packages/shared-domain/
COPY services/orchestrator/package.json ./services/orchestrator/

# Install only production dependencies
ENV HUSKY=0
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# Copy built files from builder
COPY --from=builder /app/packages/config/dist ./packages/config/dist
COPY --from=builder /app/packages/logger/dist ./packages/logger/dist
COPY --from=builder /app/packages/shared-domain/dist ./packages/shared-domain/dist
COPY --from=builder /app/services/orchestrator/dist ./services/orchestrator/dist

# Create logs directory and change ownership to non-root user
RUN mkdir -p /app/logs && chown -R nodeuser:nodejs /app

WORKDIR /app/services/orchestrator

# Switch to non-root user
USER nodeuser

EXPOSE 8081

CMD ["node", "dist/main.js"]