// common/pagination/pagination.providers.ts
import { Provider } from '@nestjs/common';
import { PaginationInterceptor, PaginationInterceptorOptions } from './pagination.interceptor.js';

export const PAGINATION_INTERCEPTOR_OPTS = Symbol('PAGINATION_INTERCEPTOR_OPTS');

export const PaginationInterceptorProvider = (opts: PaginationInterceptorOptions = {}): Provider[] => ([
  { provide: PAGINATION_INTERCEPTOR_OPTS, useValue: opts },
  {
    provide: PaginationInterceptor,
    useFactory: (paginationService, options: PaginationInterceptorOptions) =>
      new PaginationInterceptor(paginationService, options),
    inject: ['PaginationService', PAGINATION_INTERCEPTOR_OPTS],
  },
]);
