# Error Handling Architecture

This document covers exception handling, RFC 9457 Problem Details, validation errors, and database error mapping.

## Problem Details (RFC 9457)

All errors are formatted as RFC 9457 Problem Details:

```json
{
  "type": "https://api.exprealty.com/problems/validation",
  "title": "Validation Error",
  "status": 400,
  "detail": "Price must be between $0 and $100,000,000",
  "instance": "/v1/listings?search=999999999999",
  "field": "listPrice",
  "searchTerm": "999999999999",
  "validation": { "min": 0, "max": 100000000 },
  "hint": "Check field validation rules in metadata endpoint",
  "timestamp": "2024-12-10T15:30:00.000Z",
  "traceId": "abc-123-def"
}
```

## ProblemDetailsFilter

The global exception filter catches and formats all errors:

```typescript
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const problemDetails = this.formatException(exception, request);

    response
      .status(problemDetails.status)
      .json(problemDetails);
  }
}
```

## Exception Hierarchy

### DomainException (Base)

```typescript
export abstract class DomainException extends HttpException {
  constructor(
    public readonly i18nType: string,
    message: string,
    status: HttpStatus,
    public readonly details?: Record<string, unknown>,
  ) {
    super({ message, i18nType, ...details }, status);
  }
}
```

### SearchValidationException

Thrown when search values are invalid:

```typescript
throw new SearchValidationException('listPrice', '999999999999', 'Value exceeds maximum', {
  expectedType: 'number',
  providedValue: '999999999999',
  hint: 'Use whole numbers (e.g., 123)',
  examples: ['500000', '1000000', '250000'],
  validation: { max: 100000000 },
});
```

### FilterValidationException

Thrown when filter operators or values are invalid:

```typescript
throw new FilterValidationException('status', 'invalid_op', 'active', 'Invalid operator', {
  allowedOperators: ['eq', 'neq', 'in'],
  hint: 'Use eq for exact match',
});
```

### Custom HttpExceptions

Use NestJS built-in exceptions with i18nType:

```typescript
throw new NotFoundException({
  message: `Agent with id '${id}' not found`,
  i18nType: 'agent.not_found',
});

throw new ConflictException({
  message: 'Agent with this email already exists',
  i18nType: 'agent.email_exists',
  email: dto.email,
});

throw new BadRequestException({
  message: 'Invalid date format',
  i18nType: 'validation.date_format',
  expected: 'YYYY-MM-DD',
  provided: value,
});
```

## Database Error Mapping

PostgreSQL errors are mapped to HTTP exceptions:

| PG Error Code | Error Type | HTTP Status | Description |
|---------------|------------|-------------|-------------|
| 23505 | Unique violation | 409 Conflict | Duplicate key |
| 23503 | Foreign key violation | 400 Bad Request | Invalid reference |
| 23502 | Not null violation | 400 Bad Request | Required field missing |
| 23514 | Check violation | 400 Bad Request | Constraint failed |
| 22P02 | Invalid input syntax | 400 Bad Request | Type mismatch |

```typescript
// errors/database-error.handler.ts
export function handleDatabaseError(error: QueryFailedError): never {
  const pgError = error.driverError;

  switch (pgError.code) {
    case '23505': // Unique violation
      throw new ConflictException({
        message: extractUniqueViolationMessage(pgError),
        i18nType: 'database.unique_violation',
        constraint: pgError.constraint,
        detail: pgError.detail,
      });

    case '23503': // Foreign key violation
      throw new BadRequestException({
        message: 'Referenced entity does not exist',
        i18nType: 'database.foreign_key_violation',
        constraint: pgError.constraint,
      });

    case '23502': // Not null violation
      throw new BadRequestException({
        message: `Required field '${pgError.column}' is missing`,
        i18nType: 'database.not_null_violation',
        field: pgError.column,
      });

    default:
      throw new InternalServerErrorException({
        message: 'Database operation failed',
        i18nType: 'database.operation_failed',
      });
  }
}
```

## Zod Validation Errors

Zod validation errors are formatted with field-level details:

```json
{
  "type": "https://api.exprealty.com/problems/validation",
  "title": "Validation Error",
  "status": 400,
  "detail": "Request validation failed",
  "instance": "/v1/agents",
  "i18nType": "agent.validation",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format",
      "code": "invalid_string"
    },
    {
      "field": "firstName",
      "message": "String must contain at least 2 character(s)",
      "code": "too_small",
      "minimum": 2
    }
  ]
}
```

## Logging Strategy

### Log Levels

| Level | When to Use | Example |
|-------|-------------|---------|
| ERROR | 500 errors, unhandled exceptions | Stack trace + full context |
| WARN | 400 errors, client mistakes | Request context |
| DEBUG | Detailed validation errors | Field-level details |
| INFO | Successful operations | Operation summaries |

### Log Context

Always include:
- Correlation ID (from `x-request-id` header)
- Request path and method
- User ID (if authenticated)
- Duration (for performance)

```typescript
this.logger.warn('Validation error', {
  correlationId: request.headers['x-request-id'],
  path: request.path,
  method: request.method,
  error: error.message,
  field: error.field,
  value: error.value,
});
```

## Error Response Examples

### 400 Bad Request - Validation Error

```json
{
  "type": "https://api.exprealty.com/problems/validation",
  "title": "Validation Error",
  "status": 400,
  "detail": "First name must be between 2 and 50 characters",
  "instance": "/v1/agents",
  "i18nType": "agent.validation",
  "field": "firstName",
  "validation": { "minLength": 2, "maxLength": 50 }
}
```

### 404 Not Found

```json
{
  "type": "https://api.exprealty.com/problems/not-found",
  "title": "Not Found",
  "status": 404,
  "detail": "Agent with id '123' not found",
  "instance": "/v1/agents/123",
  "i18nType": "agent.not_found"
}
```

### 409 Conflict

```json
{
  "type": "https://api.exprealty.com/problems/conflict",
  "title": "Conflict",
  "status": 409,
  "detail": "Agent with this email already exists",
  "instance": "/v1/agents",
  "i18nType": "agent.email_exists",
  "email": "existing@example.com"
}
```

### 500 Internal Server Error

```json
{
  "type": "https://api.exprealty.com/problems/internal-error",
  "title": "Internal Server Error",
  "status": 500,
  "detail": "An unexpected error occurred",
  "instance": "/v1/agents",
  "traceId": "abc-123-def"
}
```

## Critical Rules

1. **Never expose stack traces** to clients in production
2. **Always provide actionable error messages** with hints
3. **Include field context** for validation errors
4. **Map database errors** to appropriate HTTP status codes
5. **Log errors before returning** to client
6. **Use Problem Details format** consistently
7. **Include i18nType** for client-side localization
8. **Add traceId** for debugging correlation

## Error Handling Checklist

When implementing error handling:

- [ ] Exception extends DomainException or uses HttpException
- [ ] i18nType provided for all errors
- [ ] Hint included where applicable
- [ ] Field context for validation errors
- [ ] Logged with correlation ID
- [ ] Stack trace not exposed in production
- [ ] Appropriate HTTP status code
