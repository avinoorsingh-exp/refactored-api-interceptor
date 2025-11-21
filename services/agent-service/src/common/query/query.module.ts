

import { Module, Global } from '@nestjs/common';
import { QueryService } from './query.service.js';

@Global()
@Module({
  providers: [QueryService],
  exports: [QueryService],
})
export class QueryModule {}