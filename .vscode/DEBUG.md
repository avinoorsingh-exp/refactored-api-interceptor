# Debugging Guide

This guide explains how to debug the Agent Service and Orchestrator services locally using VS Code or Cursor.

## Prerequisites

1. **VS Code/Cursor** with the following extensions:
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

In VS Code/Cursor:
1. Open the **Run and Debug** panel (`Ctrl+Shift+D` / `Cmd+Shift+D`)
2. Select a configuration from the dropdown:
   - **Debug Agent Service** - Starts and attaches debugger (port 9229)
   - **Debug Orchestrator** - Starts and attaches debugger (port 9230)
   - **Debug Both Services** - Debug both simultaneously
3. Press `F5` or click the green play button

## Debug Configurations

| Configuration | App Port | Debug Port | Description |
|---------------|----------|------------|-------------|
| Debug Agent Service | 3000 | 9229 | Starts service and attaches debugger |
| Debug Orchestrator | 9230 | 9231 | Starts service and attaches debugger |
| Debug Both Services | 3000, 9230 | 9229, 9231 | Run both services for end-to-end debugging |
| Attach to Agent Service | - | 9229 | Attach to already running service |
| Attach to Orchestrator | - | 9231 | Attach to already running service |

## How It Works

The debug configurations use VS Code tasks to:
1. Start the service with `pnpm start:debug` (which runs `nest start --debug --watch`)
2. Wait for the debugger to be ready
3. Automatically attach VS Code's debugger

This approach:
- Works with ESM modules (which this project uses)
- Provides hot reload via NestJS watch mode
- Enables full source map support

## Environment Files

Local debug configurations use `.env.<service>.local` files:

- `services/agent-service/.env.agentservice.local` - Agent service local debug config (PORT=3000)
- `services/orchestrator/.env.orchestrator.local` - Orchestrator local debug config (PORT=9230)

Docker configurations use `.env.<service>` files:

- `services/agent-service/.env.agentservice` - Agent service Docker config
- `services/orchestrator/.env.orchestrator` - Orchestrator Docker config

The `.local` files take precedence over the standard files when `NODE_ENV=local`, allowing you to override Docker settings for local debugging.

## Setting Breakpoints

1. Open any `.ts` file in the `services/agent-service/src` or `services/orchestrator/src` directories
2. Click in the gutter (left of line numbers) to set a breakpoint
3. Start debugging - execution will pause at breakpoints

## Common Debug Scenarios

### Debug a Controller Endpoint

1. Set a breakpoint in a controller method (e.g., `agent.controller.ts`)
2. Start "Debug Agent Service"
3. Wait for "Debugger listening on ws://..." message
4. Make a request: `curl http://localhost:3000/v1/agents`
5. Debugger pauses at your breakpoint

### Debug Through Orchestrator

1. Start "Debug Both Services"
2. Set breakpoints in both orchestrator and agent-service
3. Make a request to orchestrator: `curl http://localhost:3001/v1/agents`
4. Follow the request through both services

### Debug a Service/Repository

1. Set breakpoints in service or repository files
2. Start debugging
3. Make API requests that trigger the code path

## Manual Attach (Alternative)

If you prefer to start services manually:

```bash
# Terminal 1 - Agent Service (debug port 9229)
cd services/agent-service
pnpm start:debug

# Terminal 2 - Orchestrator (app port 9230, debug port 9231)
cd services/orchestrator
pnpm start:debug
```

Then use:
- **Attach to Agent Service** - Attach to agent-service on port 9229
- **Attach to Orchestrator** - Attach to orchestrator on port 9231

## Troubleshooting

### Debugger doesn't attach

1. Check the integrated terminal for errors
2. Ensure no other process is using debug ports 9229 or 9231:
   ```bash
   lsof -i :9229
   lsof -i :9231
   ```
3. Kill any existing debug processes and try again

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

1. Ensure source maps are enabled (they are by default in tsconfig)
2. Check that you're debugging the correct service
3. Verify the `dist/` folder has `.js.map` files
4. Try restarting the debug session

### Port already in use

Stop any running services:
```bash
docker compose down
# Or kill specific ports
lsof -ti:3000 | xargs kill -9
lsof -ti:9229 | xargs kill -9
lsof -ti:9230 | xargs kill -9
```

## Tips

- Use **Debug Console** (`Ctrl+Shift+Y`) to evaluate expressions at breakpoints
- Use **Watch** panel to monitor variable values
- Use **Call Stack** panel to see the execution path
- Use `debugger;` statement in code to force a breakpoint
- The terminal shows live logs while debugging
