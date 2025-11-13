import type { IRepository } from '../../../common/ports/repository.base.js';
import type { NormalizedPagination, PageResult } from '../../../common/ports/pagination.types.js';
import type { Region } from '@exprealty/shared-domain';

/**
 * Repository port for Region aggregate.
 * This is the contract that the domain/application layer depends on.
 * Infrastructure adapters (TypeORM, in-memory, etc.) implement this interface.
 */
export interface IRegionsRepository extends IRepository<string, Region> {
  /**
   * Finds a region by normalized name.
   * Used for duplicate checking during create/update operations.
   * 
   * @param normalizedName - Lowercase, trimmed region name
   * @returns The region if found, null otherwise
   */
  findByNormalizedName(normalizedName: string): Promise<Region | null>;
}
