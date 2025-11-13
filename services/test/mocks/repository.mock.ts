import type { IRepository } from '../../agent-service/src/common/ports/repository.base.js';
import type { IRegionsRepository } from '../../agent-service/src/modules/regions/ports/regions.repository.port.js';
import type { ICompaniesRepository } from '../../agent-service/src/modules/companies/ports/companies.repository.port.js';

/**
 * Generic repository mock factory.
 * Creates a mock implementation of IRepository for testing.
 * 
 * @example
 * const mockRepo = makeRepoMock<Region, string>();
 * mockRepo.findById.mockResolvedValue(someRegion);
 */
export function makeRepoMock<TEntity = any, TId = any>(): jest.Mocked<IRepository<TId, TEntity>> {
  return {
    findById: jest.fn(),
    findPage: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
}

/**
 * Creates a mock IRegionsRepository with custom methods.
 * Includes findByNormalizedName for region-specific operations.
 */
export function makeRegionsRepoMock(): jest.Mocked<IRegionsRepository> {
  return {
    ...makeRepoMock(),
    findByNormalizedName: jest.fn(),
  } as jest.Mocked<IRegionsRepository>;
}

/**
 * Creates a mock ICompaniesRepository with custom methods.
 * Add company-specific methods here as needed.
 */
export function makeCompaniesRepoMock(): jest.Mocked<ICompaniesRepository> {
  return {
    ...makeRepoMock(),
  } as jest.Mocked<ICompaniesRepository>;
}
