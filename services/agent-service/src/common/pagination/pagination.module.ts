import { Module } from '@nestjs/common';
import { PaginationService } from './pagination.service.js';
import { PaginationInterceptor } from './pagination.interceptor.js';

@Module({
  providers: [
    PaginationService,
    PaginationInterceptor,
  ],
  exports: [
    PaginationService,
    PaginationInterceptor,
  ],
})
export class PaginationModule {}
