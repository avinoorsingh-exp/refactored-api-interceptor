import { BadRequestException } from '@nestjs/common';
import { ProjectionService } from './projection.service.js';
import { SelectQueryBuilder } from 'typeorm';
import type { ProjectionConfig, FieldSelection } from '@exprealty/shared-domain';

// Mock entity class for testing
class MockEntity {
  id!: string;
  name!: string;
  email!: string;
  status!: string;
  createdAt!: Date;
}

describe('ProjectionService', () => {
  let service: ProjectionService;
  let mockQueryBuilder: jest.Mocked<SelectQueryBuilder<MockEntity>>;
  let mockLogger: any;

  const defaultConfig: ProjectionConfig = {
    required: ['id'],
    allowed: ['name', 'email', 'status', 'createdAt'],
    default: ['id', 'name', 'email'],
    relations: {
      company: {
        property: 'company',
        fields: ['id', 'name'],
      },
      region: {
        property: 'region',
        fields: ['id', 'name'],
      },
    },
  };

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    service = new ProjectionService(mockLogger);

    mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
    } as unknown as jest.Mocked<SelectQueryBuilder<MockEntity>>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('applyProjection', () => {
    it('should apply default projection when no fields specified', () => {
      service.applyProjection(mockQueryBuilder, 'entity', undefined, defaultConfig);

      expect(mockQueryBuilder.select).toHaveBeenCalledWith([
        'entity.id',
        'entity.name',
        'entity.email',
      ]);
    });

    it('should apply default projection when selection has no fields', () => {
      const selection: FieldSelection = {};

      service.applyProjection(mockQueryBuilder, 'entity', selection, defaultConfig);

      expect(mockQueryBuilder.select).toHaveBeenCalledWith([
        'entity.id',
        'entity.name',
        'entity.email',
      ]);
    });

    it('should apply requested fields with required fields', () => {
      const selection: FieldSelection = {
        fields: ['name', 'status'],
      };

      service.applyProjection(mockQueryBuilder, 'entity', selection, defaultConfig);

      // Should include required 'id' plus requested fields
      expect(mockQueryBuilder.select).toHaveBeenCalledWith(
        expect.arrayContaining(['entity.id', 'entity.name', 'entity.status']),
      );
    });

    it('should throw BadRequestException for invalid fields', () => {
      const selection: FieldSelection = {
        fields: ['name', 'invalidField'],
      };

      expect(() =>
        service.applyProjection(mockQueryBuilder, 'entity', selection, defaultConfig),
      ).toThrow(BadRequestException);
    });

    it('should include error details with allowed fields', () => {
      const selection: FieldSelection = {
        fields: ['invalidField'],
      };

      try {
        service.applyProjection(mockQueryBuilder, 'entity', selection, defaultConfig);
        fail('Expected BadRequestException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.getResponse()).toMatchObject({
          statusCode: 400,
          message: expect.stringContaining('invalidField'),
          allowedFields: defaultConfig.allowed,
        });
      }
    });

    it('should not duplicate required fields in selection', () => {
      const selection: FieldSelection = {
        fields: ['id', 'name'], // 'id' is already required
      };

      service.applyProjection(mockQueryBuilder, 'entity', selection, defaultConfig);

      const selectCall = mockQueryBuilder.select.mock.calls[0][0] as string[];
      const idCount = selectCall.filter((f) => f === 'entity.id').length;
      expect(idCount).toBe(1);
    });

    it('should log debug message when applying projection', () => {
      const selection: FieldSelection = {
        fields: ['name'],
      };

      service.applyProjection(mockQueryBuilder, 'entity', selection, defaultConfig);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Applying projection',
        expect.objectContaining({
          alias: 'entity',
          requestedFields: ['name'],
        }),
      );
    });

    it('should not call select when no default fields configured', () => {
      const configNoDefault: ProjectionConfig = {
        required: ['id'],
        allowed: ['name', 'email'],
        default: [],
        relations: {},
      };

      service.applyProjection(mockQueryBuilder, 'entity', undefined, configNoDefault);

      // TypeORM selects all columns when no select is called
      expect(mockQueryBuilder.select).not.toHaveBeenCalled();
    });
  });

  describe('applyRelations', () => {
    it('should not apply relations when no include specified', () => {
      service.applyRelations(mockQueryBuilder, 'entity', undefined, defaultConfig);

      expect(mockQueryBuilder.leftJoinAndSelect).not.toHaveBeenCalled();
    });

    it('should not apply relations when selection has no include', () => {
      const selection: FieldSelection = {
        fields: ['name'],
      };

      service.applyRelations(mockQueryBuilder, 'entity', selection, defaultConfig);

      expect(mockQueryBuilder.leftJoinAndSelect).not.toHaveBeenCalled();
    });

    it('should apply requested relations', () => {
      const selection: FieldSelection = {
        include: ['company'],
      };

      service.applyRelations(mockQueryBuilder, 'entity', selection, defaultConfig);

      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        'entity.company',
        'entity_company',
      );
    });

    it('should apply multiple relations', () => {
      const selection: FieldSelection = {
        include: ['company', 'region'],
      };

      service.applyRelations(mockQueryBuilder, 'entity', selection, defaultConfig);

      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledTimes(2);
      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        'entity.company',
        'entity_company',
      );
      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        'entity.region',
        'entity_region',
      );
    });

    it('should throw BadRequestException for invalid relations', () => {
      const selection: FieldSelection = {
        include: ['invalidRelation'],
      };

      expect(() =>
        service.applyRelations(mockQueryBuilder, 'entity', selection, defaultConfig),
      ).toThrow(BadRequestException);
    });

    it('should include available relations in error response', () => {
      const selection: FieldSelection = {
        include: ['invalidRelation'],
      };

      try {
        service.applyRelations(mockQueryBuilder, 'entity', selection, defaultConfig);
        fail('Expected BadRequestException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.getResponse()).toMatchObject({
          statusCode: 400,
          message: expect.stringContaining('invalidRelation'),
          availableRelations: ['company', 'region'],
        });
      }
    });

    it('should log debug message when loading relations', () => {
      const selection: FieldSelection = {
        include: ['company'],
      };

      service.applyRelations(mockQueryBuilder, 'entity', selection, defaultConfig);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Loading relation',
        expect.objectContaining({
          alias: 'entity',
          relationName: 'company',
          relationAlias: 'entity_company',
        }),
      );
    });
  });

  describe('getAllowedFields', () => {
    it('should return combined required and allowed fields', () => {
      const result = service.getAllowedFields(defaultConfig);

      expect(result).toContain('id');
      expect(result).toContain('name');
      expect(result).toContain('email');
      expect(result).toContain('status');
      expect(result).toContain('createdAt');
    });

    it('should return only required fields when no allowed fields', () => {
      const config: ProjectionConfig = {
        required: ['id'],
        allowed: [],
        default: [],
        relations: {},
      };

      const result = service.getAllowedFields(config);

      expect(result).toEqual(['id']);
    });
  });

  describe('getAvailableRelations', () => {
    it('should return all relation names', () => {
      const result = service.getAvailableRelations(defaultConfig);

      expect(result).toEqual(['company', 'region']);
    });

    it('should return empty array when no relations configured', () => {
      const config: ProjectionConfig = {
        required: ['id'],
        allowed: ['name'],
        default: ['id', 'name'],
        relations: {},
      };

      const result = service.getAvailableRelations(config);

      expect(result).toEqual([]);
    });
  });
});


// ============================================================================
// Property-Based Tests
// ============================================================================
import * as fc from 'fast-check';

describe('ProjectionService - Property-Based Tests', () => {
  let service: ProjectionService;
  let mockQueryBuilder: jest.Mocked<SelectQueryBuilder<MockEntity>>;
  let mockLogger: any;

  const allFields = ['id', 'name', 'email', 'status', 'createdAt'];
  const requiredFields = ['id'];
  const allowedFields = ['name', 'email', 'status', 'createdAt'];

  const defaultConfig: ProjectionConfig = {
    required: requiredFields,
    allowed: allowedFields,
    default: ['id', 'name', 'email'],
    relations: {
      company: { property: 'company', fields: ['id', 'name'] },
      region: { property: 'region', fields: ['id', 'name'] },
    },
  };

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    service = new ProjectionService(mockLogger);

    mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
    } as unknown as jest.Mocked<SelectQueryBuilder<MockEntity>>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * **Feature: agent-service-coverage, Property 24: ProjectionService Field Selection**
   * *For any* field selection, ProjectionService.applyProjection SHALL add only the selected
   * fields to the query builder's SELECT clause.
   * **Validates: Requirements 14.1, 14.2**
   */
  describe('Property 24: ProjectionService Field Selection', () => {
    it('should always include required fields in selection', () => {
      fc.assert(
        fc.property(
          fc.array(fc.constantFrom(...allowedFields), { minLength: 1, maxLength: 4 }),
          (requestedFields) => {
            const uniqueFields = [...new Set(requestedFields)];
            const selection: FieldSelection = { fields: uniqueFields };

            mockQueryBuilder.select.mockClear();

            service.applyProjection(mockQueryBuilder, 'entity', selection, defaultConfig);

            const selectCall = mockQueryBuilder.select.mock.calls[0][0] as string[];

            // Invariant: required fields are always included
            requiredFields.forEach((reqField) => {
              expect(selectCall).toContain(`entity.${reqField}`);
            });

            // Invariant: all requested fields are included
            uniqueFields.forEach((field) => {
              expect(selectCall).toContain(`entity.${field}`);
            });
          },
        ),
        { numRuns: 50 },
      );
    });

    it('should reject any field not in allowed or required list', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }).filter((s) => !allFields.includes(s) && /^[a-zA-Z]+$/.test(s)),
          (invalidField) => {
            const selection: FieldSelection = { fields: [invalidField] };

            expect(() =>
              service.applyProjection(mockQueryBuilder, 'entity', selection, defaultConfig),
            ).toThrow(BadRequestException);
          },
        ),
        { numRuns: 50 },
      );
    });

    it('should not duplicate fields in selection', () => {
      fc.assert(
        fc.property(
          fc.array(fc.constantFrom(...allFields), { minLength: 1, maxLength: 5 }),
          (requestedFields) => {
            // Include duplicates intentionally
            const fieldsWithDuplicates = [...requestedFields, ...requestedFields.slice(0, 2)];
            const selection: FieldSelection = { fields: fieldsWithDuplicates };

            mockQueryBuilder.select.mockClear();

            service.applyProjection(mockQueryBuilder, 'entity', selection, defaultConfig);

            const selectCall = mockQueryBuilder.select.mock.calls[0][0] as string[];

            // Invariant: no duplicate fields in selection
            const uniqueSelectFields = [...new Set(selectCall)];
            expect(selectCall.length).toBe(uniqueSelectFields.length);
          },
        ),
        { numRuns: 50 },
      );
    });

    it('should apply valid relations without error', () => {
      const validRelations = ['company', 'region'];

      fc.assert(
        fc.property(
          fc.array(fc.constantFrom(...validRelations), { minLength: 1, maxLength: 2 }),
          (requestedRelations) => {
            const uniqueRelations = [...new Set(requestedRelations)];
            const selection: FieldSelection = { include: uniqueRelations };

            mockQueryBuilder.leftJoinAndSelect.mockClear();

            // Should not throw
            service.applyRelations(mockQueryBuilder, 'entity', selection, defaultConfig);

            // Invariant: leftJoinAndSelect called for each unique relation
            expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledTimes(uniqueRelations.length);
          },
        ),
        { numRuns: 30 },
      );
    });

    it('should reject any relation not in config', () => {
      // Exclude JavaScript built-in property names that exist on all objects
      const builtInProps = ['toString', 'valueOf', 'hasOwnProperty', 'constructor', 'isPrototypeOf', 'propertyIsEnumerable', 'toLocaleString', '__proto__'];
      
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }).filter((s) => 
            !['company', 'region'].includes(s) && 
            !builtInProps.includes(s) &&
            /^[a-zA-Z]+$/.test(s)
          ),
          (invalidRelation) => {
            const selection: FieldSelection = { include: [invalidRelation] };

            expect(() =>
              service.applyRelations(mockQueryBuilder, 'entity', selection, defaultConfig),
            ).toThrow(BadRequestException);
          },
        ),
        { numRuns: 50 },
      );
    });
  });
});
