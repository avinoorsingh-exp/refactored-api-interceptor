# Build stage
FROM node:20-alpine AS builder

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/config/package.json ./packages/config/
COPY packages/logger/package.json ./packages/logger/
COPY packages/shared-domain/package.json ./packages/shared-domain/
COPY services/orchestrator/package.json ./services/orchestrator/

# Install dependencies (skip prepare scripts like husky)
ENV HUSKY=0
RUN pnpm install --frozen-lockfile --ignore-scripts

# Copy source code and tsconfig
COPY tsconfig.json ./
COPY packages/config ./packages/config
COPY packages/logger ./packages/logger
COPY packages/shared-domain ./packages/shared-domain
COPY services/orchestrator ./services/orchestrator

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

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/config/package.json ./packages/config/
COPY packages/logger/package.json ./packages/logger/
COPY packages/shared-domain/package.json ./packages/shared-domain/
COPY services/orchestrator/package.json ./services/orchestrator/

# Install all dependencies including peerDependencies (skip prepare scripts like husky)
ENV HUSKY=0
RUN pnpm install --frozen-lockfile --ignore-scripts

# Copy built files from builder
COPY --from=builder /app/packages/config/dist ./packages/config/dist
COPY --from=builder /app/packages/logger/dist ./packages/logger/dist
COPY --from=builder /app/packages/shared-domain/dist ./packages/shared-domain/dist
COPY --from=builder /app/services/orchestrator/dist ./services/orchestrator/dist

WORKDIR /app/services/orchestrator

EXPOSE 8081

CMD ["node", "dist/main.js"]
