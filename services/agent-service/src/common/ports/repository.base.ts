import type { NormalizedPagination, PageResult } from './pagination.types.js';
import type { QueryParams, FieldSelection } from '@exprealty/shared-domain';

export interface IRepository<TId, TEntity> {
  // Reads
  findById(id: TId): Promise<TEntity | null>;

  // Offset pagination with optional filtering, sorting, search, and projection
  findPage(query: Partial<QueryParams>, selection?: FieldSelection): Promise<PageResult<TEntity>>;

  // Writes (optional—keep minimal for now)
  // Omits id and audit fields (created, lastModified, modifiedBy) as those are auto-generated
  create(entity: Omit<TEntity, 'id' | 'created' | 'lastModified' | 'modifiedBy'>): Promise<TEntity>;
  update(id: TId, patch: Partial<TEntity>): Promise<TEntity>;
  delete(id: TId): Promise<void>;
}
