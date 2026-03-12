import { z } from 'zod';
import {
  NormalizedPaginationSchema,
  PaginationMetaSchema,
} from '@exprealty/shared-domain'

export type NormalizedPagination = z.infer<typeof NormalizedPaginationSchema>;
export type PaginationMeta = z.infer<typeof PaginationMetaSchema>;

export type PageResult<T> = {
  items: T[];
  total: number; // omit if using count-less in cursor mode; keep for offset mode
  /** When true, total is an estimate (EXPLAIN or pg_class) — exact count is being computed in background */
  isApproximate?: boolean;
};
