import { RegionsService } from './regions.service.js'
import type { IRegionsRepository } from './ports/regions.repository.port.js';
    
describe('RegionsService', () => {
  it('delegates to repo.findPage when no search term', async () => {
    const repo: jest.Mocked<IRegionsRepository> = {
      findById: jest.fn(),
      findPage: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      findByNormalizedName: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as any;

    const svc = new RegionsService(repo);
    const res = await svc.findPage({ offset: 0, limit: 25 });
    expect(repo.findPage).toHaveBeenCalledWith({ offset: 0, limit: 25 });
    expect(res.total).toBe(0);
    expect(res.regions).toEqual([]);
  });

  it('returns paginated results correctly', async () => {
    const mockRegion = { id: '1', name: 'test region', createdAt: new Date(), updatedAt: new Date() };
    const repo: jest.Mocked<IRegionsRepository> = {
      findById: jest.fn(),
      findPage: jest.fn().mockResolvedValue({ items: [mockRegion], total: 1 }),
      findByNormalizedName: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as any;

    const svc = new RegionsService(repo);
    const res = await svc.findPage({ offset: 0, limit: 25 });
    expect(repo.findPage).toHaveBeenCalledWith({ offset: 0, limit: 25 });
    expect(res.total).toBe(1);
    expect(res.regions).toEqual([mockRegion]);
  });
});
