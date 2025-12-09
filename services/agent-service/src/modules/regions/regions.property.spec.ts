import * as fc from 'fast-check';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { RegionsController } from './regions.controller.js';
import { RegionsService } from './regions.service.js';
import type { IRegionsRepository } from './ports/regions.repository.port.js';
import type { Region, CreateRegionInput, UpdateRegionInput } from '@exprealty/shared-domain';
import { regionArbitrary, createRegionInputArbitrary, uuidArbitrary } from '../../../../../test/utils/generators.js';

/**
 * Property-Based Tests for Regions Module
 * 
 * These tests verify universal properties that should hold across all valid inputs.
 * Using fast-check for property-based testing.
 * 
 * Validates: Requirements 1.3, 2.3
 */
describe('Regions Module Property Tests', () => {
  /**
   * **Feature: agent-service-coverage, Property 1: Controller CRUD Operations Delegate to Service** (Regions)
   * 
   * *For any* valid input to a controller CRUD operation (create, findAll, findById, update),
   * the controller SHALL delegate to the corresponding service method and return the service result.
   * 
   * **Validates: Requirements 1.3**
   */
  describe('Property 1: Controller CRUD Operations Delegate to Service (Regions)', () => {
    let controller: RegionsController;
    let mockService: jest.Mocked<RegionsService>;

    beforeEach(() => {
      mockService = {
        create: jest.fn(),
        findById: jest.fn(),
        update: jest.fn(),
        findPage: jest.fn(),
      } as any;

      // Create controller with mocked service and pagination service
      const mockPaginationService = {
        normalized: jest.fn().mockReturnValue({ offset: 0, limit: 25 }),
        buildMeta: jest.fn(),
        buildLinkHeader: jest.fn(),
      };

      controller = new RegionsController(mockService, mockPaginationService as any);
    });

    it('should delegate create to service for any valid region input', async () => {
      // Run property tests sequentially to avoid mock interference
      const samples = fc.sample(createRegionInputArbitrary, 50);
      
      for (const input of samples) {
        // Reset mock before each property test iteration
        mockService.create.mockReset();
        
        const expectedRegion: Region = {
          id: 'generated-id',
          name: input.name.toLowerCase().trim(),
          created: new Date(),
          lastModified: new Date(),
          modifiedBy: 'system',
        };

        mockService.create.mockResolvedValue(expectedRegion);

        const mockRes = { setHeader: jest.fn() };

        const result = await controller.create(input as CreateRegionInput, mockRes as any);

        expect(mockService.create).toHaveBeenCalledWith(input);
        expect(result).toEqual(expectedRegion);
      }
    });

    it('should delegate findById to service for any valid UUID', async () => {
      // Run property tests sequentially to avoid mock interference
      const idSamples = fc.sample(uuidArbitrary, 50);
      const regionSamples = fc.sample(regionArbitrary, 50);
      
      for (let i = 0; i < idSamples.length; i++) {
        const id = idSamples[i];
        const region = regionSamples[i];
        
        // Reset mock before each property test iteration
        mockService.findById.mockReset();
        
        const regionWithId = { ...region, id };
        mockService.findById.mockResolvedValue(regionWithId);

        const result = await controller.findById({ id });

        expect(mockService.findById).toHaveBeenCalledWith(id);
        expect(result).toEqual(regionWithId);
      }
    });

    it('should delegate findAll to service and return items with total', async () => {
      // Run property tests sequentially to avoid mock interference
      const offsetSamples = fc.sample(fc.integer({ min: 0, max: 1000 }), 50);
      const limitSamples = fc.sample(fc.integer({ min: 1, max: 50 }), 50);
      const regionsSamples = fc.sample(fc.array(regionArbitrary, { minLength: 0, maxLength: 10 }), 50);
      
      for (let i = 0; i < offsetSamples.length; i++) {
        const offset = offsetSamples[i];
        const limit = limitSamples[i];
        const regions = regionsSamples[i];
        
        // Reset mock before each property test iteration
        mockService.findPage.mockReset();
        
        mockService.findPage.mockResolvedValue({
          regions,
          total: regions.length + offset,
        });

        const result = await controller.findAll({ offset, limit });

        expect(mockService.findPage).toHaveBeenCalled();
        expect(result.items).toEqual(regions);
        expect(result.total).toBe(regions.length + offset);
      }
    });

    it('should delegate update to service for any valid update input', async () => {
      // Run property tests sequentially to avoid mock interference
      const idSamples = fc.sample(uuidArbitrary, 50);
      const updateSamples = fc.sample(createRegionInputArbitrary, 50);
      const regionSamples = fc.sample(regionArbitrary, 50);
      
      for (let i = 0; i < idSamples.length; i++) {
        const id = idSamples[i];
        const updateInput = updateSamples[i];
        const region = regionSamples[i];
        
        // Reset mock before each property test iteration
        mockService.update.mockReset();
        
        const updatedRegion = { ...region, id, name: updateInput.name.toLowerCase().trim() };
        mockService.update.mockResolvedValue(updatedRegion);

        const result = await controller.update(id, updateInput as UpdateRegionInput);

        expect(mockService.update).toHaveBeenCalledWith(id, updateInput);
        expect(result).toEqual(updatedRegion);
      }
    });
  });

  /**
   * **Feature: agent-service-coverage, Property 2: Service Operations Orchestrate Repository Calls** (Regions)
   * 
   * *For any* valid input to a service operation, the service SHALL call the appropriate
   * repository method(s) and return the mapped domain result.
   * 
   * **Validates: Requirements 2.3**
   */
  describe('Property 2: Service Operations Orchestrate Repository Calls (Regions)', () => {
    let service: RegionsService;
    let mockRepository: jest.Mocked<IRegionsRepository>;

    beforeEach(() => {
      mockRepository = {
        findById: jest.fn(),
        findByNormalizedName: jest.fn(),
        findPage: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findAll: jest.fn(),
      } as jest.Mocked<IRegionsRepository>;

      service = new RegionsService(mockRepository);
    });

    it('should call repository.create for any valid create input when name is unique', async () => {
      // Run property tests sequentially to avoid mock interference
      const samples = fc.sample(createRegionInputArbitrary, 50);
      
      for (const input of samples) {
        // Reset mocks before each property test iteration
        mockRepository.findByNormalizedName.mockReset();
        mockRepository.create.mockReset();
        
        const normalizedName = input.name.toLowerCase().trim();
        const expectedRegion: Region = {
          id: 'new-id',
          name: normalizedName,
          created: new Date(),
          lastModified: new Date(),
          modifiedBy: 'system',
        };

        mockRepository.findByNormalizedName.mockResolvedValue(null);
        mockRepository.create.mockResolvedValue(expectedRegion);

        const result = await service.create(input as CreateRegionInput);

        expect(mockRepository.findByNormalizedName).toHaveBeenCalledWith(normalizedName);
        expect(mockRepository.create).toHaveBeenCalledWith({ name: normalizedName });
        expect(result).toEqual(expectedRegion);
      }
    });

    it('should call repository.findById for any valid UUID', async () => {
      // Run property tests sequentially to avoid mock interference
      const idSamples = fc.sample(uuidArbitrary, 50);
      const regionSamples = fc.sample(regionArbitrary, 50);
      
      for (let i = 0; i < idSamples.length; i++) {
        const id = idSamples[i];
        const region = regionSamples[i];
        
        // Reset mock before each property test iteration
        mockRepository.findById.mockReset();
        
        const regionWithId = { ...region, id };
        mockRepository.findById.mockResolvedValue(regionWithId);

        const result = await service.findById(id);

        expect(mockRepository.findById).toHaveBeenCalledWith(id);
        expect(result).toEqual(regionWithId);
      }
    });

    it('should call repository.findPage for any valid pagination params', async () => {
      // Run property tests sequentially to avoid mock interference
      const offsetSamples = fc.sample(fc.integer({ min: 0, max: 1000 }), 50);
      const limitSamples = fc.sample(fc.integer({ min: 1, max: 50 }), 50);
      const regionsSamples = fc.sample(fc.array(regionArbitrary, { minLength: 0, maxLength: 10 }), 50);
      
      for (let i = 0; i < offsetSamples.length; i++) {
        const offset = offsetSamples[i];
        const limit = limitSamples[i];
        const regions = regionsSamples[i];
        
        // Reset mock before each property test iteration
        mockRepository.findPage.mockReset();
        
        mockRepository.findPage.mockResolvedValue({
          items: regions,
          total: regions.length,
        });

        const result = await service.findPage({ offset, limit });

        expect(mockRepository.findPage).toHaveBeenCalledWith({ offset, limit });
        expect(result.regions).toEqual(regions);
        expect(result.total).toBe(regions.length);
      }
    });

    it('should throw ConflictException on create when name already exists', async () => {
      // Run property tests sequentially to avoid mock interference
      const inputSamples = fc.sample(createRegionInputArbitrary, 50);
      const existingRegionSamples = fc.sample(regionArbitrary, 50);
      
      for (let i = 0; i < inputSamples.length; i++) {
        const input = inputSamples[i];
        const existingRegion = existingRegionSamples[i];
        
        // Reset mocks before each property test iteration
        mockRepository.findByNormalizedName.mockReset();
        mockRepository.create.mockReset();
        
        const normalizedName = input.name.toLowerCase().trim();
        const existingWithSameName = { ...existingRegion, name: normalizedName };
        mockRepository.findByNormalizedName.mockResolvedValue(existingWithSameName);

        await expect(service.create(input as CreateRegionInput)).rejects.toThrow(ConflictException);

        try {
          await service.create(input as CreateRegionInput);
        } catch (error) {
          expect(error).toBeInstanceOf(ConflictException);
          const response = (error as ConflictException).getResponse() as any;
          expect(response.i18nType).toBe('agent.region.duplicate_name');
        }

        expect(mockRepository.create).not.toHaveBeenCalled();
      }
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
          expect(response.i18nType).toBe('agent.region.not_found');
          expect(response.message).toContain(id);
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

        const updateInput: UpdateRegionInput = { name: 'Updated' };

        await expect(service.update(id, updateInput)).rejects.toThrow(NotFoundException);

        try {
          await service.update(id, updateInput);
        } catch (error) {
          expect(error).toBeInstanceOf(NotFoundException);
          const response = (error as NotFoundException).getResponse() as any;
          expect(response.i18nType).toBe('agent.region.not_found');
        }

        expect(mockRepository.update).not.toHaveBeenCalled();
      }
    });
  });
});
