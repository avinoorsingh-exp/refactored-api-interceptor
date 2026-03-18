# Correlation ID & Async Context Storage

## Overview

The cache package provides correlation ID tracking and async context storage using Node.js `AsyncLocalStorage`. This enables request tracing across microservices without passing correlation IDs explicitly through every function call.

## Architecture

```
HTTP Request → Middleware → AsyncLocalStorage → Controllers/Services
                ↓
         CorrelationIdHelper
                ↓
        AsyncContextStorage
                ↓
           AsyncLocalStorage
```

## Components

### 1. AsyncContextStorage

Low-level wrapper around Node.js `AsyncLocalStorage` for storing request context:

```typescript
interface RequestContext {
  correlationId: string
  userId?: string
  requestPath?: string
  method?: string
  ip?: string
  timestamp: number
}
```

**Methods:**
- `getStore()` - Get current RequestContext
- `run(context, callback)` - Execute callback with context
- `getCorrelationId()` - Get correlation ID from context
- `getUserId()` - Get user ID from context
- `getRequestPath()` - Get request path
- `getMethod()` - Get HTTP method
- `getIp()` - Get client IP
- `getTimestamp()` - Get context creation time
- `getContext()` - Get full context object
- `updateContext(updates)` - Merge updates into context

### 2. CorrelationIdHelper

High-level helper for correlation ID operations:

**Methods:**
- `extractCorrelationId(incoming?)` - Extract from header or generate new UUID
- `generateCorrelationId()` - Generate new UUID v4
- `isValidCorrelationId(id)` - Validate ID format
- `runInContext(id, metadata, callback)` - Run callback with correlation context
- `getCorrelationId()` - Get ID from context
- `getOrGenerateCorrelationId()` - Get or generate if missing

## Usage

### In Middleware

```typescript
import { CorrelationIdHelper, CORRELATION_ID_HEADER } from '@exprealty/cache'

@Injectable()
export class CorrelationIdHttpMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Extract or generate correlation ID
    const incomingId = req.header(CORRELATION_ID_HEADER)
    const correlationId = CorrelationIdHelper.extractCorrelationId(incomingId)

    // Attach to response for downstream services
    res.setHeader(CORRELATION_ID_HEADER, correlationId)

    // Run request in correlation context
    CorrelationIdHelper.runInContext(
      correlationId,
      {
        requestPath: req.path,
        method: req.method,
        ip: req.ip,
      },
      () => next()
    )
  }
}
```

### In Controllers/Services

```typescript
import { AsyncContextStorage } from '@exprealty/cache'

@Controller('agents')
export class AgentController {
  @Get(':id')
  async getAgent(@Param('id') id: string) {
    // Correlation ID is automatically available
    const correlationId = AsyncContextStorage.getCorrelationId()
    
    this.logger.log('Fetching agent', { correlationId, agentId: id })
    
    // Available in nested async calls without passing explicitly
    return this.agentService.findOne(id)
  }
}

@Injectable()
export class AgentService {
  async findOne(id: string) {
    // Correlation ID still available here
    const correlationId = AsyncContextStorage.getCorrelationId()
    
    this.logger.log('DB query', { correlationId, agentId: id })
    
    return this.repository.findOne(id)
  }
}
```

### Making HTTP Calls to Other Services

```typescript
import { AsyncContextStorage, CORRELATION_ID_HEADER } from '@exprealty/cache'

async function callDownstreamService(data: any) {
  const correlationId = AsyncContextStorage.getCorrelationId()
  
  // Pass correlation ID to downstream service
  const response = await axios.post('http://other-service/api/endpoint', data, {
    headers: {
      [CORRELATION_ID_HEADER]: correlationId
    }
  })
  
  return response.data
}
```

## Security

The `isValidCorrelationId` function provides basic security validation:
- Rejects empty strings
- Rejects IDs over 100 characters
- Rejects IDs with newlines (prevents header injection)

## Benefits

1. **No Parameter Drilling** - Access correlation ID anywhere without passing through every function
2. **Async-Safe** - Works across async/await, Promises, setTimeout, etc.
3. **Microservice Tracing** - Track requests across service boundaries
4. **Logging Context** - Automatically include correlation ID in all logs
5. **Type-Safe** - Full TypeScript support

## Testing

Tests run without requiring Redis:

```bash
pnpm --filter @exprealty/cache test async-context.storage
```

All 26 tests verify:
- Context isolation between requests
- Async operation support
- Correlation ID generation and validation
- Metadata storage and retrieval

## Future Enhancements

The design supports future migration to Redis for distributed tracing:

```typescript
// Current: In-memory AsyncLocalStorage
AsyncContextStorage.run(context, callback)

// Future: Redis-backed distributed context
AsyncContextStorage.runDistributed(context, callback)
```

This allows seamless upgrade to distributed tracing without changing consuming code.
