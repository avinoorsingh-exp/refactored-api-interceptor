import * as fc from 'fast-check';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PayPlansController } from './pay-plans.controller.js';
import { PayPlansService } from './pay-plans.service.js';
import type { IPayPlansRepository } from './ports/pay-plans.repository.port.js';
import type { PayPlan, CreatePayPlanInput, UpdatePayPlanInput } from '@exprealty/shared-domain';
import { payPlanArbitrary, createPayPlanInputArbitrary, uuidArbitrary } from '../../../../../test/utils/generators.js';

/**
 * Property-Based Tests for PayPlans Module
 * 
 * These tests verify universal properties that should hold across all valid inputs.
 * Using fast-check for property-based testing.
 * 
 * Validates: Requirements 1.4, 2.4
 */
describe('PayPlans Module Property Tests', () => {
  /**
   * **Feature: agent-service-coverage, Property 1: Controller CRUD Operations Delegate to Service** (PayPlans)
   * 
   * *For any* valid input to a controller CRUD operation (create, findAll, findById, update),
   * the controller SHALL delegate to the corresponding service method and return the service result.
   * 
   * **Validates: Requirements 1.4**
   */
  describe('Property 1: Controller CRUD Operations Delegate to Service (PayPlans)', () => {
    let controller: PayPlansController;
    let mockService: jest.Mocked<PayPlansService>;

    beforeEach(() => {
      mockService = {
        create: jest.fn(),
        findById: jest.fn(),
        findByName: jest.fn(),
        update: jest.fn(),
        findPage: jest.fn(),
      } as any;

      controller = new PayPlansController(mockService);
    });

    it('should delegate create to service for any valid pay plan input', async () => {
      const samples = fc.sample(createPayPlanInputArbitrary, 50);
      
      for (const input of samples) {
        mockService.create.mockReset();
        
        const expectedPayPlan: PayPlan = {
          id: 'generated-id',
          name: input.name,
          active: input.active,
          agentPercentage: input.agentPercentage,
          cap: input.cap,
          created: new Date(),
          lastModified: new Date(),
          modifiedBy: 'system',
        };

        mockService.create.mockResolvedValue(expectedPayPlan);

        const mockRes = { setHeader: jest.fn() };
        const mockReq = { headers: { 'x-correlation-id': 'test-id' } };

        const result = await controller.create(input as CreatePayPlanInput, mockRes as any, mockReq as any);

        expect(mockService.create).toHaveBeenCalledWith(input);
        expect(result).toEqual(expectedPayPlan);
      }
    });

    it('should delegate findById to service for any valid UUID', async () => {
      const idSamples = fc.sample(uuidArbitrary, 50);
      const payPlanSamples = fc.sample(payPlanArbitrary, 50);
      
      for (let i = 0; i < idSamples.length; i++) {
        const id = idSamples[i];
        const payPlan = payPlanSamples[i];
        
        mockService.findById.mockReset();
        
        const payPlanWithId = { ...payPlan, id };
        mockService.findById.mockResolvedValue(payPlanWithId as PayPlan);

        const mockReq = { headers: { 'x-correlation-id': 'test-id' } };
        const result = await controller.findById({ id }, mockReq as any);

        expect(mockService.findById).toHaveBeenCalledWith(id);
        expect(result).toEqual(payPlanWithId);
      }
    });

    it('should delegate findAll to service and return items with total', async () => {
      const offsetSamples = fc.sample(fc.integer({ min: 0, max: 1000 }), 50);
      const limitSamples = fc.sample(fc.integer({ min: 1, max: 50 }), 50);
      const payPlansSamples = fc.sample(fc.array(payPlanArbitrary, { minLength: 0, maxLength: 10 }), 50);
      
      for (let i = 0; i < offsetSamples.length; i++) {
        const offset = offsetSamples[i];
        const limit = limitSamples[i];
        const payPlans = payPlansSamples[i];
        
        mockService.findPage.mockReset();
        
        mockService.findPage.mockResolvedValue({
          payPlans: payPlans as PayPlan[],
          total: payPlans.length + offset,
        });

        const mockReq = { headers: { 'x-correlation-id': 'test-id' } };
        const result = await controller.findAll({ offset, limit }, mockReq as any);

        expect(mockService.findPage).toHaveBeenCalled();
        expect(result.items).toEqual(payPlans);
        expect(result.total).toBe(payPlans.length + offset);
      }
    });

    it('should delegate update to service for any valid update input', async () => {
      const idSamples = fc.sample(uuidArbitrary, 50);
      const updateSamples = fc.sample(createPayPlanInputArbitrary, 50);
      const payPlanSamples = fc.sample(payPlanArbitrary, 50);
      
      for (let i = 0; i < idSamples.length; i++) {
        const id = idSamples[i];
        const updateInput = updateSamples[i];
        const payPlan = payPlanSamples[i];
        
        mockService.update.mockReset();
        
        const updatedPayPlan = { ...payPlan, id, ...updateInput };
        mockService.update.mockResolvedValue(updatedPayPlan as PayPlan);

        const mockReq = { headers: { 'x-correlation-id': 'test-id' } };
        const result = await controller.update({ id }, updateInput as UpdatePayPlanInput, mockReq as any);

        expect(mockService.update).toHaveBeenCalledWith(id, updateInput);
        expect(result).toEqual(updatedPayPlan);
      }
    });
  });

  /**
   * **Feature: agent-service-coverage, Property 2: Service Operations Orchestrate Repository Calls** (PayPlans)
   * 
   * *For any* valid input to a service operation, the service SHALL call the appropriate
   * repository method(s) and return the mapped domain result.
   * 
   * **Validates: Requirements 2.4**
   */
  describe('Property 2: Service Operations Orchestrate Repository Calls (PayPlans)', () => {
    let service: PayPlansService;
    let mockRepository: jest.Mocked<IPayPlansRepository>;

    beforeEach(() => {
      mockRepository = {
        findById: jest.fn(),
        findByName: jest.fn(),
        findPage: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findAll: jest.fn(),
      } as jest.Mocked<IPayPlansRepository>;

      service = new PayPlansService(mockRepository);
    });

    it('should call repository.create for any valid create input when name is unique', async () => {
      const samples = fc.sample(createPayPlanInputArbitrary, 50);
      
      for (const input of samples) {
        mockRepository.findByName.mockReset();
        mockRepository.create.mockReset();
        
        const expectedPayPlan: PayPlan = {
          id: 'new-id',
          name: input.name,
          active: input.active,
          agentPercentage: input.agentPercentage,
          cap: input.cap,
          created: new Date(),
          lastModified: new Date(),
          modifiedBy: 'system',
        };

        mockRepository.findByName.mockResolvedValue(null);
        mockRepository.create.mockResolvedValue(expectedPayPlan);

        const result = await service.create(input as CreatePayPlanInput);

        expect(mockRepository.findByName).toHaveBeenCalledWith(input.name);
        expect(mockRepository.create).toHaveBeenCalledWith(input);
        expect(result).toEqual(expectedPayPlan);
      }
    });

    it('should call repository.findById for any valid UUID', async () => {
      const idSamples = fc.sample(uuidArbitrary, 50);
      const payPlanSamples = fc.sample(payPlanArbitrary, 50);
      
      for (let i = 0; i < idSamples.length; i++) {
        const id = idSamples[i];
        const payPlan = payPlanSamples[i];
        
        mockRepository.findById.mockReset();
        
        const payPlanWithId = { ...payPlan, id };
        mockRepository.findById.mockResolvedValue(payPlanWithId as PayPlan);

        const result = await service.findById(id);

        expect(mockRepository.findById).toHaveBeenCalledWith(id);
        expect(result).toEqual(payPlanWithId);
      }
    });

    it('should call repository.findPage for any valid pagination params', async () => {
      const offsetSamples = fc.sample(fc.integer({ min: 0, max: 1000 }), 50);
      const limitSamples = fc.sample(fc.integer({ min: 1, max: 50 }), 50);
      const payPlansSamples = fc.sample(fc.array(payPlanArbitrary, { minLength: 0, maxLength: 10 }), 50);
      
      for (let i = 0; i < offsetSamples.length; i++) {
        const offset = offsetSamples[i];
        const limit = limitSamples[i];
        const payPlans = payPlansSamples[i];
        
        mockRepository.findPage.mockReset();
        
        mockRepository.findPage.mockResolvedValue({
          items: payPlans as PayPlan[],
          total: payPlans.length,
        });

        const result = await service.findPage({ offset, limit });

        expect(mockRepository.findPage).toHaveBeenCalledWith({ offset, limit }, undefined);
        expect(result.payPlans).toEqual(payPlans);
        expect(result.total).toBe(payPlans.length);
      }
    });

    it('should throw ConflictException on create when name already exists', async () => {
      const inputSamples = fc.sample(createPayPlanInputArbitrary, 50);
      const existingPayPlanSamples = fc.sample(payPlanArbitrary, 50);
      
      for (let i = 0; i < inputSamples.length; i++) {
        const input = inputSamples[i];
        const existingPayPlan = existingPayPlanSamples[i];
        
        mockRepository.findByName.mockReset();
        mockRepository.create.mockReset();
        
        const existingWithSameName = { ...existingPayPlan, name: input.name };
        mockRepository.findByName.mockResolvedValue(existingWithSameName as PayPlan);

        await expect(service.create(input as CreatePayPlanInput)).rejects.toThrow(ConflictException);

        try {
          await service.create(input as CreatePayPlanInput);
        } catch (error) {
          expect(error).toBeInstanceOf(ConflictException);
          const response = (error as ConflictException).getResponse() as any;
          expect(response.i18nType).toBe('agent.payplan.duplicate_name');
        }

        expect(mockRepository.create).not.toHaveBeenCalled();
      }
    });

    it('should throw NotFoundException for any non-existent ID', async () => {
      const idSamples = fc.sample(uuidArbitrary, 50);
      
      for (const id of idSamples) {
        mockRepository.findById.mockReset();
        mockRepository.findById.mockResolvedValue(null);

        await expect(service.findById(id)).rejects.toThrow(NotFoundException);

        try {
          await service.findById(id);
        } catch (error) {
          expect(error).toBeInstanceOf(NotFoundException);
          const response = (error as NotFoundException).getResponse() as any;
          expect(response.i18nType).toBe('agent.payplan.not_found');
          expect(response.message).toContain(id);
        }
      }
    });

    it('should throw NotFoundException on update for any non-existent ID', async () => {
      const idSamples = fc.sample(uuidArbitrary, 50);
      
      for (const id of idSamples) {
        mockRepository.findById.mockReset();
        mockRepository.update.mockReset();
        mockRepository.findById.mockResolvedValue(null);

        const updateInput: UpdatePayPlanInput = { name: 'Updated' };

        await expect(service.update(id, updateInput)).rejects.toThrow(NotFoundException);

        try {
          await service.update(id, updateInput);
        } catch (error) {
          expect(error).toBeInstanceOf(NotFoundException);
          const response = (error as NotFoundException).getResponse() as any;
          expect(response.i18nType).toBe('agent.payplan.not_found');
        }

        expect(mockRepository.update).not.toHaveBeenCalled();
      }
    });
  });
});
