# Debugging Guide

This guide explains how to debug the Agent Service and Orchestrator services locally using VS Code.

## Prerequisites

1. **VS Code** with the following extensions:
   - [JavaScript Debugger](https://marketplace.visualstudio.com/items?itemName=ms-vscode.js-debug) (built-in)

2. **Docker** running for PostgreSQL and Redis

3. **Dependencies installed**:
   ```bash
   pnpm install
   ```

4. **Packages built**:
   ```bash
   pnpm build:packages
   ```

## Quick Start

### 1. Start Infrastructure (Database & Redis)

Start only the database and Redis containers (not the services):

```bash
docker compose up postgres redis -d
```

### 2. Run Database Migrations

```bash
pnpm migration:run
```

### 3. Run Services (without debugging)

```bash
# Run both services in parallel
pnpm dev

# Run only agent-service (port 3000)
pnpm dev:agent

# Run only orchestrator (port 3001)
pnpm dev:orchestrator
```

### 4. Launch Debugger (with breakpoints)

In VS Code:
1. Open the **Run and Debug** panel (`Ctrl+Shift+D` / `Cmd+Shift+D`)
2. Select a configuration from the dropdown:
   - **Debug Agent Service** - Debug agent-service on port 3000
   - **Debug Orchestrator** - Debug orchestrator on port 3001
   - **Debug Both Services** - Debug both simultaneously
3. Press `F5` or click the green play button

## Debug Configurations

| Configuration | Port | Description |
|---------------|------|-------------|
| Debug Agent Service | 3000 | Main API service with database access |
| Debug Orchestrator | 3001 | API gateway that proxies to agent-service |
| Debug Both Services | 3000, 3001 | Run both services for end-to-end debugging |

## Environment Files

Local debug configurations use `.env.local` files:

- `services/agent-service/.env.local` - Agent service local config
- `services/orchestrator/.env.local` - Orchestrator local config

These files point to `localhost` for database/Redis (via Docker) and use debug-friendly settings.

## Setting Breakpoints

1. Open any `.ts` file in the `services/agent-service/src` or `services/orchestrator/src` directories
2. Click in the gutter (left of line numbers) to set a breakpoint
3. Start debugging - execution will pause at breakpoints

## Common Debug Scenarios

### Debug a Controller Endpoint

1. Set a breakpoint in a controller method (e.g., `countries.controller.ts`)
2. Start "Debug Agent Service"
3. Make a request: `curl http://localhost:3000/v1/countries`
4. Debugger pauses at your breakpoint

### Debug Through Orchestrator

1. Start "Debug Both Services"
2. Set breakpoints in both orchestrator and agent-service
3. Make a request to orchestrator: `curl http://localhost:3001/v1/countries`
4. Follow the request through both services

### Debug a Service/Repository

1. Set breakpoints in service or repository files
2. Start debugging
3. Make API requests that trigger the code path

## Attach to Running Process

If services are already running with debug enabled:

```bash
# In services/agent-service
pnpm start:debug  # Starts on port 9229

# In services/orchestrator
pnpm start:debug  # Starts on port 9229
```

Then use:
- **Debug Agent Service (Attach)** - Attach to agent-service on port 9229
- **Debug Orchestrator (Attach)** - Attach to orchestrator on port 9230

## Troubleshooting

### "Cannot find module" errors

Rebuild packages:
```bash
pnpm build:packages
```

### Database connection errors

Ensure PostgreSQL is running:
```bash
docker compose up postgres -d
docker compose logs postgres
```

### Redis connection errors

Ensure Redis is running:
```bash
docker compose up redis -d
docker compose logs redis
```

### Breakpoints not hitting

1. Ensure source maps are enabled (they are by default)
2. Check that you're debugging the correct service
3. Try restarting the debug session

### Port already in use

Stop any running services:
```bash
docker compose down
# Or kill specific port
lsof -ti:3000 | xargs kill -9
```

## Tips

- Use **Debug Console** (`Ctrl+Shift+Y`) to evaluate expressions at breakpoints
- Use **Watch** panel to monitor variable values
- Use **Call Stack** panel to see the execution path
- Use `debugger;` statement in code to force a breakpoint
