# Phase 3: OpenAPI Export & Postman Collection Generation

Automated export of the OpenAPI spec and conversion to a Postman collection + environment template.

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | >= 20.0.0 | Pinned in `.nvmrc` |
| pnpm | >= 9.0.0 | `corepack enable` |
| curl | any | For fetching the OpenAPI spec |
| Docker Compose | Latest stable | For running agent-service locally |

---

## Quick Start

```bash
# 1. Start agent-service
docker compose up -d

# 2. Wait for it to be healthy
curl -s http://localhost:3000/v1/agent/health

# 3. Export OpenAPI + generate Postman artifacts (one command)
pnpm postman:generate
```

This produces:

```
artifacts/
  openapi/
    agent-service.openapi.json          # Full OpenAPI 3.0 spec
  postman/
    agent-service.postman_collection.json  # Importable Postman collection
    env.template.json                      # Postman environment template
```

---

## Step-by-Step

### 1. Start Agent Service

```bash
# Full stack (postgres, redis, agent-service, orchestrator)
docker compose up -d

# Or just the service (if DB/Redis are already running)
pnpm dev:agent
```

The service runs on `http://localhost:3000` with:
- Swagger UI: `http://localhost:3000/api`
- OpenAPI JSON: `http://localhost:3000/api-json`

### 2. Export OpenAPI Spec

```bash
pnpm openapi:export

# Or against a different environment:
BASE_URL=https://dev.example.com pnpm openapi:export
```

Output: `artifacts/openapi/agent-service.openapi.json`

The script fetches from `{BASE_URL}/api-json` and validates the response is valid JSON.

### 3. Generate Postman Collection

```bash
# After openapi:export has been run:
node scripts/generate-postman.mjs

# Or do both in one step:
pnpm postman:generate
```

Output:
- `artifacts/postman/agent-service.postman_collection.json`
- `artifacts/postman/env.template.json`

### 4. Import into Postman

1. Open Postman
2. Click **Import** (top left)
3. Drag or select `artifacts/postman/agent-service.postman_collection.json`
4. Click **Import** again for `artifacts/postman/env.template.json`
5. Select the **Agent Service (Template)** environment from the dropdown (top right)
6. Edit the environment variables to set `baseUrl` for your target

---

## Environment Template Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `baseUrl` | `http://localhost:3000` | Target service URL |
| `authMode` | `none` | Auth strategy: `none`, `bearer`, `apikey` |
| `authToken` | *(empty)* | Bearer token (when authMode=bearer) |
| `apiKey` | *(empty)* | API key (when authMode=apikey) |
| `s2sKey` | *(empty)* | Service-to-service internal key |

### Auth Usage

The collection has bearer auth configured at the collection level using `{{authToken}}`. To use it:

1. Set `authMode` to `bearer` in your Postman environment
2. Set `authToken` to your JWT/bearer token
3. All requests will automatically include `Authorization: Bearer {{authToken}}`

For API key auth, add a pre-request script at the collection level:
```javascript
if (pm.environment.get('authMode') === 'apikey') {
    pm.request.headers.add({
        key: 'x-api-key',
        value: pm.environment.get('apiKey')
    });
}
```

---

## Swagger JSON Endpoint

The OpenAPI spec is served by NestJS Swagger at:

```
GET {BASE_URL}/api-json
```

This is configured in `services/agent-service/src/main.ts`:
```typescript
SwaggerModule.setup('api', app, document)
```

The spec includes all annotated controllers, DTOs, and response schemas.

---

## Script Reference

| Script | Description |
|--------|-------------|
| `pnpm openapi:export` | Fetch OpenAPI JSON from running agent-service |
| `pnpm postman:generate` | Export OpenAPI + convert to Postman collection + env template |

---

## Artifact Layout

```
artifacts/                              # gitignored
  openapi/
    agent-service.openapi.json          # OpenAPI 3.0 JSON spec
  postman/
    agent-service.postman_collection.json  # Postman v2.1 collection
    env.template.json                      # Postman environment template
```

---

## Existing Postman Collections

The `postman/` directory at the repo root contains manually maintained Postman collections for specific API test flows (agent-companies, agent-taxes, etc.). These are separate from the auto-generated collection and are useful for targeted test scenarios.

The auto-generated collection covers all endpoints from the OpenAPI spec and is best used as a starting point for exploration and ad-hoc testing.

---

## Troubleshooting

**"Could not connect" error:**
```
Make sure agent-service is running:
  docker compose up -d
  pnpm dev:agent
```

**Empty or incomplete spec:**
If the generated collection is missing endpoints, check that controllers are properly decorated with `@ApiTags()` and DTOs with `@ApiProperty()`.

**Non-local environments:**
```bash
BASE_URL=https://dev.example.com pnpm postman:generate
```
Swagger must be enabled in the target environment (it is enabled for dev and test).
