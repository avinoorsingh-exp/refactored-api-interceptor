

import { Module, Global } from '@nestjs/common';
import { QueryService } from './query.service.js';
import { ColumnResolverService } from './column-resolver.service.js';
import { SearchMetadataReader } from './search-metadata-reader.service.js';
import { StringSearchStrategy } from './strategies/string-search.strategy.js';
import { NumericSearchStrategy } from './strategies/numeric-search.strategy.js';
import { DateSearchStrategy } from './strategies/date-search.strategy.js';
import { BooleanSearchStrategy } from './strategies/boolean-search.strategy.js';
import { SEARCH_STRATEGIES } from './query.tokens.js';

@Global()
@Module({
  providers: [
    QueryService,
    ColumnResolverService,
    SearchMetadataReader,
    StringSearchStrategy,
    NumericSearchStrategy,
    DateSearchStrategy,
    BooleanSearchStrategy,
    // Provide all strategies as an array for injection
    {
      provide: SEARCH_STRATEGIES,
      useFactory: (
        stringStrategy: StringSearchStrategy,
        numericStrategy: NumericSearchStrategy,
        dateStrategy: DateSearchStrategy,
        booleanStrategy: BooleanSearchStrategy,
      ) => ({
        string: stringStrategy,
        text: stringStrategy,
        numeric: numericStrategy,
        integer: numericStrategy,
        decimal: numericStrategy,
        date: dateStrategy,
        datetime: dateStrategy,
        boolean: booleanStrategy,
      }),
      inject: [
        StringSearchStrategy,
        NumericSearchStrategy,
        DateSearchStrategy,
        BooleanSearchStrategy,
      ],
    },
  ],
  exports: [
    QueryService,
    ColumnResolverService,
    SearchMetadataReader,
    SEARCH_STRATEGIES,
  ],
})
export class QueryModule {}