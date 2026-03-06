# API Layer Patterns

This document defines the API layer patterns for controllers, DTOs, validation, and interceptors.

## Controller Structure

### Standard RESTful Endpoints

Every resource controller follows this pattern:

```typescript
@ApiTags('resources')
@Controller('v1/resources')
export class ResourceController {
  constructor(private readonly service: ResourceService) {}

  // GET /v1/resources - List with pagination
  @Get()
  @UseInterceptors(PaginationInterceptor)
  async findAll(@Query() query: QueryParamsDto): Promise<PageResult<ResourceDto>> {}

  // GET /v1/resources/:id - Single entity
  @Get(':id')
  async findById(@Param() params: IdParamDto): Promise<ResourceDto> {}

  // POST /v1/resources - Create
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateResourceDto, @Res({ passthrough: true }) res: Response): Promise<ResourceDto> {
    const entity = await this.service.create(dto);
    res.setHeader('Location', `/v1/resources/${entity.id}`);
    return entity;
  }

  // PUT /v1/resources/:id - Update
  @Put(':id')
  async update(@Param() params: IdParamDto, @Body() dto: UpdateResourceDto): Promise<ResourceDto> {}

  // DELETE /v1/resources/:id - Delete (stub if not implemented)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param() params: IdParamDto): Promise<void> {
    // TODO: Implement soft delete
  }
}
```

### Nested Resource Controllers

For resources nested under a parent (e.g., `/agents/:id/addresses`):

```typescript
@ApiTags('agent-addresses')
@Controller('v1/agents/:id/addresses')
@UseGuards(AgentExistsGuard)  // Validates parent exists
export class AgentAddressController {
  constructor(private readonly service: AgentAddressService) {}

  @Get()
  @UseInterceptors(PaginationInterceptor)
  async findByAgentId(
    @Agent() agent: AgentType,  // Injected by guard
    @Query() query: QueryParamsDto
  ): Promise<PageResult<AgentAddressDto>> {
    return this.service.findByAgentId(agent.id, query);
  }
}
```

## DTO Patterns

### Request DTOs

DTOs use Zod schemas from `@exprealty/shared-domain`:

```typescript
// dto/create-resource.dto.ts
import { CreateResourceSchema } from '@exprealty/shared-domain';
import { createZodDto } from 'nestjs-zod';

export class CreateResourceDto extends createZodDto(CreateResourceSchema) {}
```

### Response DTOs

Response DTOs define the API contract:

```typescript
// dto/resource-response.dto.ts
import { ResourceBaseSchema, ResourceExpandedSchema } from '@exprealty/shared-domain';
import { z } from 'zod';

export type ResourceResponseDto = z.infer<typeof ResourceBaseSchema>;
export type ResourceDetailResponseDto = z.infer<typeof ResourceExpandedSchema>;
```

### Parameter DTOs

```typescript
// dto/id-param.dto.ts
import { z } from 'zod';

export const IdParamSchema = z.object({
  id: z.string().uuid(),
});

export type IdParamDto = z.infer<typeof IdParamSchema>;
```

## Validation

### ZodValidationPipe

All request body validation uses `ZodValidationPipe`:

```typescript
@Post()
async create(
  @Body(new ZodValidationPipe(CreateResourceSchema, 'resource.validation'))
  body: CreateResourceDto
): Promise<ResourceDto> {}
```

The second parameter is an `i18nType` for client-side localization.

### Query Parameter Validation

Query parameters are validated by `QueryService` automatically:
- `@Searchable` decorators define searchable fields
- `@Filterable` decorators define filterable fields
- `@Sortable` decorators define sortable fields

Invalid search/filter values throw `SearchValidationException` or `FilterValidationException`.

## Interceptors

### Required for List Endpoints

```typescript
@Get()
@UseInterceptors(PaginationInterceptor)
async findAll(@Query() query: QueryParamsDto): Promise<PageResult<ResourceDto>> {}
```

`PaginationInterceptor` wraps response in:
```json
{
  "data": [...],
  "meta": {
    "total": 150,
    "totalPages": 6,
    "currentPage": 1,
    "limit": 25,
    "offset": 0,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### Optional Debug Interceptors

Stack order matters when using multiple:

```typescript
@Get()
@UseInterceptors(QueryPerformanceInterceptor, QueryMetadataInterceptor, PaginationInterceptor)
async findAll(@Query() query: QueryParamsDto): Promise<PageResult<ResourceDto>> {}
```

- `QueryMetadataInterceptor`: Adds `meta.query` with applied search/filter/sort params
- `QueryPerformanceInterceptor`: Adds `meta.query.performance` with SQL, duration, explain plans

## Response Headers

### Pagination Headers

Set by `PaginationInterceptor`:
- `X-Total-Count`: Total number of records
- `Link`: RFC 8288 pagination links

### Location Header

Set for created resources:
```typescript
res.setHeader('Location', `/v1/resources/${entity.id}`);
```

## HTTP Status Codes

| Operation | Success Status | Error Status |
|-----------|---------------|--------------|
| GET (list) | 200 OK | 400 Bad Request |
| GET (single) | 200 OK | 404 Not Found |
| POST (create) | 201 Created | 400 Bad Request, 409 Conflict |
| PUT (update) | 200 OK | 400 Bad Request, 404 Not Found |
| DELETE | 204 No Content | 404 Not Found |

## Swagger Documentation

Every endpoint must have:

```typescript
@Post()
@ApiOperation({ summary: 'Create a new resource' })
@ApiResponse({ status: 201, description: 'Resource created', type: ResourceDto })
@ApiResponse({ status: 400, description: 'Validation error' })
@ApiResponse({ status: 409, description: 'Resource already exists' })
async create(@Body() dto: CreateResourceDto): Promise<ResourceDto> {}
```

## Cross-Aggregate Validation

When validating parent entities exist:

1. Use guards (preferred):
```typescript
@UseGuards(AgentExistsGuard)
export class AgentAddressController {}
```

2. Guard attaches validated entity to request:
```typescript
@Get()
async findByAgentId(@Agent() agent: AgentType) {
  // agent is guaranteed to exist
}
```

3. Services don't need cross-aggregate repository dependencies

## Quick Reference

| Pattern | Use When |
|---------|----------|
| `@UseGuards(AgentExistsGuard)` | Nested resource controller |
| `@UseInterceptors(PaginationInterceptor)` | List endpoint returning paginated data |
| `new ZodValidationPipe(Schema, 'i18nType')` | Request body validation |
| `@Param() params: IdParamDto` | Path parameter validation |
| `@HttpCode(HttpStatus.CREATED)` | POST endpoints |
| `@HttpCode(HttpStatus.NO_CONTENT)` | DELETE endpoints |
