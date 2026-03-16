import { Global, DynamicModule, Module } from '@nestjs/common'
import { DataSource } from 'typeorm'
import { CacheService } from '@exprealty/cache'
import { CountCacheService, CountCacheConfig } from './count-cache.service.js'
import { LoggerService } from '../../core/logger.service.js'

export interface CountCacheModuleOptions {
  countCache?: Partial<CountCacheConfig>
}

@Global()
@Module({})
export class CountCacheModule {

  static forRoot(options: CountCacheModuleOptions = {}): DynamicModule {
    return {
      module: CountCacheModule,
      global: true,
      providers: [
        {
          provide: 'COUNT_CACHE_CONFIG',
          useValue: options.countCache ?? {},
        },
        {
          provide: CountCacheService,
          useFactory: (
            cache: CacheService,
            dataSource: DataSource,
            logger: LoggerService,
            config: Partial<CountCacheConfig>,
          ) => new CountCacheService(cache, dataSource, logger, config),
          inject: [CacheService, DataSource, LoggerService, 'COUNT_CACHE_CONFIG'],
        },
      ],
      exports: [CountCacheService],
    }
  }

  static forRootAsync(options: {
    inject?: any[]
    useFactory: (...args: any[]) => CountCacheModuleOptions | Promise<CountCacheModuleOptions>
    imports?: any[]
  }): DynamicModule {
    return {
      module: CountCacheModule,
      global: true,
      imports: options.imports ?? [],
      providers: [
        {
          provide: 'COUNT_CACHE_MODULE_OPTIONS',
          useFactory: options.useFactory,
          inject: options.inject ?? [],
        },
        {
          provide: 'COUNT_CACHE_CONFIG',
          useFactory: (moduleOptions: CountCacheModuleOptions) =>
            moduleOptions.countCache ?? {},
          inject: ['COUNT_CACHE_MODULE_OPTIONS'],
        },
        {
          provide: CountCacheService,
          useFactory: (
            cache: CacheService,
            dataSource: DataSource,
            logger: LoggerService,
            config: Partial<CountCacheConfig>,
          ) => new CountCacheService(cache, dataSource, logger, config),
          inject: [CacheService, DataSource, LoggerService, 'COUNT_CACHE_CONFIG'],
        },
      ],
      exports: [CountCacheService],
    }
  }
}
