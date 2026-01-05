# Runbook: Adding a New Route/Endpoint

This runbook guides you through adding a new API endpoint to an existing module.

## Prerequisites

Before starting:
1. Read `docs/architecture/api-patterns.md`
2. Read `.github/instructions/api-architect.instructions.md`
3. Understand the module structure for the target domain

## Steps

### 1. Define the DTO Schema (if new input/output)

Create or update schemas in `@exprealty/shared-domain`:

```typescript
// packages/shared-domain/src/schemas/my-resource.ts
import { z } from 'zod';

export const CreateMyResourceSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().optional(),
  agentId: z.string().uuid(),
});

export type CreateMyResource = z.infer<typeof CreateMyResourceSchema>;
```

### 2. Create Request/Response DTOs

```typescript
// modules/my-resource/dto/create-my-resource.dto.ts
import { CreateMyResourceSchema } from '@exprealty/shared-domain';
import { createZodDto } from 'nestjs-zod';

export class CreateMyResourceDto extends createZodDto(CreateMyResourceSchema) {}
```

### 3. Add Repository Method (if needed)

Update the port interface:

```typescript
// modules/my-resource/ports/my-resource.repository.port.ts
export interface IMyResourceRepository extends IRepository<MyResource, string> {
  findByAgentId(agentId: string, query: QueryParams): Promise<PageResult<MyResource>>;
  // Add new method
  findByName(name: string): Promise<MyResource | null>;
}
```

Implement in adapter:

```typescript
// modules/my-resource/my-resource.repository.ts
async findByName(name: string): Promise<MyResource | null> {
  const entity = await this.repo.findOne({ where: { name } });
  return entity ? this.mapToDomain(entity) : null;
}
```

### 4. Add Service Method

```typescript
// modules/my-resource/my-resource.service.ts
async create(dto: CreateMyResourceDto): Promise<MyResource> {
  // Business validation
  const existing = await this.repository.findByName(dto.name);
  if (existing) {
    throw new ConflictException({
      message: `Resource with name '${dto.name}' already exists`,
      i18nType: 'my_resource.name_exists',
    });
  }

  return this.repository.create(dto);
}
```

### 5. Add Controller Endpoint

```typescript
// modules/my-resource/my-resource.controller.ts
import { ZodValidationPipe } from '@common/zod-validation.pipe';
import { CreateMyResourceSchema } from '@exprealty/shared-domain';

@ApiTags('my-resources')
@Controller('v1/my-resources')
export class MyResourceController {
  constructor(private readonly service: MyResourceService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new resource' })
  @ApiResponse({ status: 201, description: 'Resource created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 409, description: 'Resource already exists' })
  async create(
    @Body(new ZodValidationPipe(CreateMyResourceSchema, 'my_resource.validation'))
    dto: CreateMyResourceDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<MyResourceResponseDto> {
    const resource = await this.service.create(dto);
    res.setHeader('Location', `/v1/my-resources/${resource.id}`);
    return resource;
  }
}
```

### 6. Register in Module (if new provider)

```typescript
// modules/my-resource/my-resource.module.ts
@Module({
  imports: [TypeOrmModule.forFeature([MyResourceEntity])],
  controllers: [MyResourceController],
  providers: [
    MyResourceService,
    {
      provide: 'IMyResourceRepository',
      useClass: MyResourceTypeOrmRepository,
    },
  ],
})
export class MyResourceModule {}
```

### 7. Add Tests

Unit test for service:

```typescript
// modules/my-resource/my-resource.service.spec.ts
describe('MyResourceService', () => {
  let service: MyResourceService;
  let repository: jest.Mocked<IMyResourceRepository>;

  beforeEach(() => {
    repository = {
      findByName: jest.fn(),
      create: jest.fn(),
    } as jest.Mocked<IMyResourceRepository>;

    service = new MyResourceService(repository);
  });

  describe('create', () => {
    it('should create resource when name is unique', async () => {
      repository.findByName.mockResolvedValue(null);
      repository.create.mockResolvedValue({ id: '1', name: 'test' });

      const result = await service.create({ name: 'test' });

      expect(result.id).toBe('1');
    });

    it('should throw conflict when name exists', async () => {
      repository.findByName.mockResolvedValue({ id: '1', name: 'test' });

      await expect(service.create({ name: 'test' }))
        .rejects.toThrow(ConflictException);
    });
  });
});
```

E2E test:

```typescript
// test/my-resource.e2e-spec.ts
describe('MyResource (e2e)', () => {
  it('POST /v1/my-resources should create resource', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/my-resources')
      .send({ name: 'Test Resource' })
      .expect(201);

    expect(response.body.id).toBeDefined();
    expect(response.headers.location).toContain(response.body.id);
  });
});
```

### 8. Verify

```bash
# Build packages
pnpm build:packages

# Run unit tests
pnpm test:unit

# Start service
pnpm dev

# Test endpoint
curl -X POST http://localhost:3000/v1/my-resources \
  -H "Content-Type: application/json" \
  -d '{"name": "Test"}'
```

## Checklist

- [ ] Schema defined in shared-domain
- [ ] DTO created using createZodDto
- [ ] Repository port interface updated (if needed)
- [ ] Repository adapter implemented (if needed)
- [ ] Service method added with business validation
- [ ] Controller endpoint with proper decorators
- [ ] Swagger documentation (@ApiOperation, @ApiResponse)
- [ ] Validation pipe with i18nType
- [ ] HTTP status code set correctly
- [ ] Location header for created resources
- [ ] Unit tests for service
- [ ] E2E test for endpoint
- [ ] Build succeeds
- [ ] Tests pass

## Common Issues

### "Cannot find module" error
- Run `pnpm build:packages` to rebuild shared-domain

### Validation error not formatted as Problem Details
- Ensure ProblemDetailsFilter is registered globally

### 500 error instead of 400
- Check that Zod schema handles edge cases
- Ensure service catches and throws appropriate HttpExceptions

## Related Documents

- `docs/architecture/api-patterns.md`
- `docs/architecture/error-handling.md`
- `.github/instructions/api-architect.instructions.md`
