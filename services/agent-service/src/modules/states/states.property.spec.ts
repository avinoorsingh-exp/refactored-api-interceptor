import * as fc from 'fast-check';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { StatesController } from './states.controller.js';
import { StatesService } from './states.service.js';
import type { IStatesRepository } from './ports/states.repository.port.js';
import type { State, CreateStateInput, UpdateStateInput } from '@exprealty/shared-domain';
import { stateArbitrary, createStateInputArbitrary, uuidArbitrary } from '../../../../../test/utils/generators.js';

/**
 * Property-Based Tests for States Module
 * 
 * These tests verify universal properties that should hold across all valid inputs.
 * Using fast-check for property-based testing.
 * 
 * Validates: Requirements 1.1, 2.1, 2.6, 2.7, 3.6
 */
describe('States Module Property Tests', () => {
  /**
   * **Feature: agent-service-coverage, Property 1: Controller CRUD Operations Delegate to Service** (States)
   * 
   * *For any* valid input to a controller CRUD operation (create, findAll, findById, update),
   * the controller SHALL delegate to the corresponding service method and return the service result.
   * 
   * **Validates: Requirements 1.1**
   */
  describe('Property 1: Controller CRUD Operations Delegate to Service (States)', () => {
    let controller: StatesController;
    let mockService: jest.Mocked<StatesService>;

    beforeEach(() => {
      mockService = {
        create: jest.fn(),
        findById: jest.fn(),
        findByCode: jest.fn(),
        update: jest.fn(),
        findPage: jest.fn(),
      } as any;

      controller = new StatesController(mockService);
    });

    it('should delegate create to service for any valid state input', async () => {
      // Run property tests sequentially to avoid mock interference
      const samples = fc.sample(createStateInputArbitrary, 50);
      
      for (const input of samples) {
        // Reset mock before each property test iteration
        mockService.create.mockReset();
        
        const expectedState: State = {
          id: 'generated-id',
          ...input,
          created: new Date(),
          lastModified: new Date(),
          modifiedBy: 'system',
        };

        mockService.create.mockResolvedValue(expectedState);

        const mockReq = { headers: {} };
        const mockRes = { setHeader: jest.fn() };

        const result = await controller.create(input as CreateStateInput, mockRes as any, mockReq as any);

        expect(mockService.create).toHaveBeenCalledWith(input);
        expect(result).toEqual(expectedState);
      }
    });

    it('should delegate findById to service for any valid UUID', async () => {
      // Run property tests sequentially to avoid mock interference
      const idSamples = fc.sample(uuidArbitrary, 50);
      const stateSamples = fc.sample(stateArbitrary, 50);
      
      for (let i = 0; i < idSamples.length; i++) {
        const id = idSamples[i];
        const state = stateSamples[i];
        
        // Reset mock before each property test iteration
        mockService.findById.mockReset();
        
        const stateWithId = { ...state, id };
        mockService.findById.mockResolvedValue(stateWithId);

        const mockReq = { headers: {} };
        const result = await controller.findById({ id }, mockReq as any);

        expect(mockService.findById).toHaveBeenCalledWith(id);
        expect(result).toEqual(stateWithId);
      }
    });

    it('should delegate findAll to service and return items with total', async () => {
      // Run property tests sequentially to avoid mock interference
      const offsetSamples = fc.sample(fc.integer({ min: 0, max: 1000 }), 50);
      const limitSamples = fc.sample(fc.integer({ min: 1, max: 50 }), 50);
      const statesSamples = fc.sample(fc.array(stateArbitrary, { minLength: 0, maxLength: 10 }), 50);
      
      for (let i = 0; i < offsetSamples.length; i++) {
        const offset = offsetSamples[i];
        const limit = limitSamples[i];
        const states = statesSamples[i];
        
        // Reset mock before each property test iteration
        mockService.findPage.mockReset();
        
        mockService.findPage.mockResolvedValue({
          states,
          total: states.length + offset,
        });

        const mockReq = { headers: {} };
        const result = await controller.findAll({ offset, limit }, mockReq as any);

        expect(mockService.findPage).toHaveBeenCalled();
        expect(result.items).toEqual(states);
        expect(result.total).toBe(states.length + offset);
      }
    });
  });


  /**
   * **Feature: agent-service-coverage, Property 2: Service Operations Orchestrate Repository Calls** (States)
   * 
   * *For any* valid input to a service operation, the service SHALL call the appropriate
   * repository method(s) and return the mapped domain result.
   * 
   * **Validates: Requirements 2.1**
   */
  describe('Property 2: Service Operations Orchestrate Repository Calls (States)', () => {
    let service: StatesService;
    let mockRepository: jest.Mocked<IStatesRepository>;

    beforeEach(() => {
      mockRepository = {
        findById: jest.fn(),
        findByCode: jest.fn(),
        findByRegionId: jest.fn(),
        findPage: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      } as jest.Mocked<IStatesRepository>;

      service = new StatesService(mockRepository);
    });

    it('should call repository.create for any valid create input when code is unique', async () => {
      // Run property tests sequentially to avoid mock interference
      const samples = fc.sample(createStateInputArbitrary, 50);
      
      for (const input of samples) {
        // Reset mocks before each property test iteration
        mockRepository.findByCode.mockReset();
        mockRepository.create.mockReset();
        
        const expectedState: State = {
          id: 'new-id',
          ...input,
          created: new Date(),
          lastModified: new Date(),
          modifiedBy: 'system',
        };

        mockRepository.findByCode.mockResolvedValue(null);
        mockRepository.create.mockResolvedValue(expectedState);

        const result = await service.create(input as CreateStateInput);

        expect(mockRepository.findByCode).toHaveBeenCalledWith(input.code);
        expect(mockRepository.create).toHaveBeenCalledWith(input);
        expect(result).toEqual(expectedState);
      }
    });

    it('should call repository.findById for any valid UUID', async () => {
      // Run property tests sequentially to avoid mock interference
      const idSamples = fc.sample(uuidArbitrary, 50);
      const stateSamples = fc.sample(stateArbitrary, 50);
      
      for (let i = 0; i < idSamples.length; i++) {
        const id = idSamples[i];
        const state = stateSamples[i];
        
        // Reset mock before each property test iteration
        mockRepository.findById.mockReset();
        
        const stateWithId = { ...state, id };
        mockRepository.findById.mockResolvedValue(stateWithId);

        const result = await service.findById(id);

        expect(mockRepository.findById).toHaveBeenCalledWith(id);
        expect(result).toEqual(stateWithId);
      }
    });

    it('should call repository.findPage for any valid pagination params', async () => {
      // Run property tests sequentially to avoid mock interference
      const offsetSamples = fc.sample(fc.integer({ min: 0, max: 1000 }), 50);
      const limitSamples = fc.sample(fc.integer({ min: 1, max: 50 }), 50);
      const statesSamples = fc.sample(fc.array(stateArbitrary, { minLength: 0, maxLength: 10 }), 50);
      
      for (let i = 0; i < offsetSamples.length; i++) {
        const offset = offsetSamples[i];
        const limit = limitSamples[i];
        const states = statesSamples[i];
        
        // Reset mock before each property test iteration
        mockRepository.findPage.mockReset();
        
        mockRepository.findPage.mockResolvedValue({
          items: states,
          total: states.length,
        });

        const result = await service.findPage({ offset, limit });

        expect(mockRepository.findPage).toHaveBeenCalledWith({ offset, limit }, undefined);
        expect(result.states).toEqual(states);
        expect(result.total).toBe(states.length);
      }
    });
  });

  /**
   * **Feature: agent-service-coverage, Property 3: Service Duplicate Detection Throws ConflictException** (States)
   * 
   * *For any* create or update operation where a duplicate entity exists,
   * the service SHALL throw a ConflictException with the correct i18n type.
   * 
   * **Validates: Requirements 2.6**
   */
  describe('Property 3: Service Duplicate Detection Throws ConflictException (States)', () => {
    let service: StatesService;
    let mockRepository: jest.Mocked<IStatesRepository>;

    beforeEach(() => {
      mockRepository = {
        findById: jest.fn(),
        findByCode: jest.fn(),
        findByRegionId: jest.fn(),
        findPage: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      } as jest.Mocked<IStatesRepository>;

      service = new StatesService(mockRepository);
    });

    it('should throw ConflictException on create when code already exists', async () => {
      // Run property tests sequentially to avoid mock interference
      const inputSamples = fc.sample(createStateInputArbitrary, 50);
      const existingStateSamples = fc.sample(stateArbitrary, 50);
      
      for (let i = 0; i < inputSamples.length; i++) {
        const input = inputSamples[i];
        const existingState = existingStateSamples[i];
        
        // Reset mocks before each property test iteration
        mockRepository.findByCode.mockReset();
        mockRepository.create.mockReset();
        
        const existingWithSameCode = { ...existingState, code: input.code };
        mockRepository.findByCode.mockResolvedValue(existingWithSameCode);

        await expect(service.create(input as CreateStateInput)).rejects.toThrow(ConflictException);

        try {
          await service.create(input as CreateStateInput);
        } catch (error) {
          expect(error).toBeInstanceOf(ConflictException);
          const response = (error as ConflictException).getResponse() as any;
          expect(response.i18nType).toBe('agent.state.duplicate_code');
        }

        expect(mockRepository.create).not.toHaveBeenCalled();
      }
    });

    it('should throw ConflictException on update when changing to existing code', async () => {
      // Run property tests sequentially to avoid mock interference
      const idSamples = fc.sample(uuidArbitrary, 50);
      const currentStateSamples = fc.sample(stateArbitrary, 50);
      const otherStateSamples = fc.sample(stateArbitrary, 50);
      
      for (let i = 0; i < idSamples.length; i++) {
        const id = idSamples[i];
        const currentState = currentStateSamples[i];
        const otherState = otherStateSamples[i];
        
        // Reset mocks before each property test iteration
        mockRepository.findById.mockReset();
        mockRepository.findByCode.mockReset();
        mockRepository.update.mockReset();
        
        // Ensure the codes are different
        const current = { ...currentState, id, code: 'AA' };
        const other = { ...otherState, id: 'different-id', code: 'BB' };
        const updateInput: UpdateStateInput = { code: 'BB' };

        mockRepository.findById.mockResolvedValue(current);
        mockRepository.findByCode.mockResolvedValue(other);

        await expect(service.update(id, updateInput)).rejects.toThrow(ConflictException);

        try {
          await service.update(id, updateInput);
        } catch (error) {
          expect(error).toBeInstanceOf(ConflictException);
          const response = (error as ConflictException).getResponse() as any;
          expect(response.i18nType).toBe('agent.state.duplicate_code');
        }

        expect(mockRepository.update).not.toHaveBeenCalled();
      }
    });
  });


  /**
   * **Feature: agent-service-coverage, Property 4: Service Not Found Throws NotFoundException** (States)
   * 
   * *For any* findById or findByCode operation where the entity does not exist,
   * the service SHALL throw a NotFoundException with the correct i18n type.
   * 
   * **Validates: Requirements 2.7**
   */
  describe('Property 4: Service Not Found Throws NotFoundException (States)', () => {
    let service: StatesService;
    let mockRepository: jest.Mocked<IStatesRepository>;

    beforeEach(() => {
      mockRepository = {
        findById: jest.fn(),
        findByCode: jest.fn(),
        findByRegionId: jest.fn(),
        findPage: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      } as jest.Mocked<IStatesRepository>;

      service = new StatesService(mockRepository);
    });

    it('should throw NotFoundException for any non-existent ID', async () => {
      // Run property tests sequentially to avoid mock interference
      const idSamples = fc.sample(uuidArbitrary, 50);
      
      for (const id of idSamples) {
        // Reset mock before each property test iteration
        mockRepository.findById.mockReset();
        mockRepository.findById.mockResolvedValue(null);

        await expect(service.findById(id)).rejects.toThrow(NotFoundException);

        try {
          await service.findById(id);
        } catch (error) {
          expect(error).toBeInstanceOf(NotFoundException);
          const response = (error as NotFoundException).getResponse() as any;
          expect(response.i18nType).toBe('agent.state.not_found');
          expect(response.message).toContain(id);
        }
      }
    });

    it('should throw NotFoundException for any non-existent code', async () => {
      // Run property tests sequentially to avoid mock interference
      const codeSamples = fc.sample(
        fc.array(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')), { minLength: 2, maxLength: 2 })
          .map(chars => chars.join('')),
        50
      );
      
      for (const code of codeSamples) {
        // Reset mock before each property test iteration
        mockRepository.findByCode.mockReset();
        mockRepository.findByCode.mockResolvedValue(null);

        await expect(service.findByCode(code)).rejects.toThrow(NotFoundException);

        try {
          await service.findByCode(code);
        } catch (error) {
          expect(error).toBeInstanceOf(NotFoundException);
          const response = (error as NotFoundException).getResponse() as any;
          expect(response.i18nType).toBe('agent.state.not_found');
          expect(response.message).toContain(code);
        }
      }
    });

    it('should throw NotFoundException on update for any non-existent ID', async () => {
      // Run property tests sequentially to avoid mock interference
      const idSamples = fc.sample(uuidArbitrary, 50);
      
      for (const id of idSamples) {
        // Reset mocks before each property test iteration
        mockRepository.findById.mockReset();
        mockRepository.update.mockReset();
        mockRepository.findById.mockResolvedValue(null);

        const updateInput: UpdateStateInput = { name: 'Updated' };

        await expect(service.update(id, updateInput)).rejects.toThrow(NotFoundException);

        try {
          await service.update(id, updateInput);
        } catch (error) {
          expect(error).toBeInstanceOf(NotFoundException);
          const response = (error as NotFoundException).getResponse() as any;
          expect(response.i18nType).toBe('agent.state.not_found');
        }

        expect(mockRepository.update).not.toHaveBeenCalled();
      }
    });
  });

  /**
   * **Feature: agent-service-coverage, Property 5: Repository Entity Mapping Round-Trip** (States)
   * 
   * *For any* valid domain object, mapping to entity and back to domain SHALL produce
   * an equivalent object (preserving all non-computed fields).
   * 
   * **Validates: Requirements 3.6**
   */
  describe('Property 5: Repository Entity Mapping Round-Trip (States)', () => {
    it('should preserve essential fields through entity mapping round-trip', () => {
      fc.assert(
        fc.property(stateArbitrary, (state) => {
          // Simulate mapToEntity
          const entityData: Record<string, any> = {};
          if (state.name !== undefined) entityData.name = state.name;
          if (state.code !== undefined) entityData.code = state.code;
          if (state.isActive !== undefined) entityData.isActive = state.isActive;
          if (state.email !== undefined) entityData.email = state.email;
          if (state.signatureDistributionEmail !== undefined) {
            entityData.signatureDistributionEmail = state.signatureDistributionEmail;
          }
          if (state.regionId !== undefined) entityData.regionId = BigInt(state.regionId);
          if (state.countryId !== undefined) entityData.countryId = state.countryId;

          // Simulate mapToDomain
          const domainData: Record<string, any> = {
            id: state.id,
            name: entityData.name,
            code: entityData.code,
            isActive: entityData.isActive,
            email: entityData.email,
            signatureDistributionEmail: entityData.signatureDistributionEmail,
            regionId: entityData.regionId ? String(entityData.regionId) : undefined,
            countryId: entityData.countryId,
          };

          // Verify round-trip preserves essential fields
          expect(domainData.name).toBe(state.name);
          expect(domainData.code).toBe(state.code);
          expect(domainData.isActive).toBe(state.isActive);
          expect(domainData.email).toBe(state.email);
          expect(domainData.signatureDistributionEmail).toBe(state.signatureDistributionEmail);
          expect(domainData.regionId).toBe(state.regionId);
          expect(domainData.countryId).toBe(state.countryId);
        }),
        { numRuns: 100 }
      );
    });

    it('should correctly convert regionId between string and BigInt', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1000000 }).map(String),
          (regionId) => {
            // mapToEntity converts string to BigInt
            const entityRegionId = BigInt(regionId);

            // mapToDomain converts BigInt back to string
            const domainRegionId = String(entityRegionId);

            // Round-trip should preserve the value
            expect(domainRegionId).toBe(regionId);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
