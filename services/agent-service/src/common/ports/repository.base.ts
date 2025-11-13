import type { NormalizedPagination, PageResult } from './pagination.types.js';

export interface IRepository<TId, TEntity> {
  // Reads
  findById(id: TId): Promise<TEntity | null>;

  // Offset pagination (standard list)
  findPage(p: NormalizedPagination, opts?: unknown): Promise<PageResult<TEntity>>;

  // Writes (optional—keep minimal for now)
  // Omits id, createdAt, updatedAt as those are auto-generated
  create(entity: Omit<TEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<TEntity>;
  update(id: TId, patch: Partial<TEntity>): Promise<TEntity>;
  delete(id: TId): Promise<void>;
}
