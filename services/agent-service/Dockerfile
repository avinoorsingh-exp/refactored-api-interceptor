# Build stage
FROM node:20-alpine AS builder

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

# Install dependencies (skip prepare scripts like husky)
ENV HUSKY=0
RUN pnpm install --frozen-lockfile --ignore-scripts

# Copy source code and tsconfig
COPY tsconfig.json ./
COPY packages/config ./packages/config
COPY packages/logger ./packages/logger
COPY packages/cache ./packages/cache
COPY packages/database ./packages/database
COPY packages/shared-domain ./packages/shared-domain
COPY services/agent-service ./services/agent-service

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

# Install all dependencies including peerDependencies (skip prepare scripts like husky)
ENV HUSKY=0
RUN pnpm install --frozen-lockfile --ignore-scripts

# Copy built files from builder
COPY --from=builder /app/packages/config/dist ./packages/config/dist
COPY --from=builder /app/packages/logger/dist ./packages/logger/dist
COPY --from=builder /app/packages/cache/dist ./packages/cache/dist
COPY --from=builder /app/packages/database/dist ./packages/database/dist
COPY --from=builder /app/packages/shared-domain/dist ./packages/shared-domain/dist
COPY --from=builder /app/services/agent-service/dist ./services/agent-service/dist

WORKDIR /app/services/agent-service

EXPOSE 3000

CMD ["node", "dist/main.js"]
