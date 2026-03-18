import type { IRepository } from '../../../common/ports/repository.base.js';
import type { NormalizedPagination, PageResult } from '../../../common/ports/pagination.types.js';
import type { Company } from '@exprealty/shared-domain'; // your domain type (can map from entity)

export interface ICompaniesRepository extends IRepository<string, Company> {
  // Example domain-specific query
  searchByNameFragment(p: NormalizedPagination, q: string): Promise<PageResult<Company>>;
}
