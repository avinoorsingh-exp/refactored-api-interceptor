import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { RegionEntity } from '@exprealty/database'
import { RegionsController } from './regions.controller.js'
import { RegionsService } from './regions.service.js'

/**
 * Module for Region entity operations.
 */
@Module({
	imports: [TypeOrmModule.forFeature([RegionEntity])],
	controllers: [RegionsController],
	providers: [RegionsService],
	exports: [RegionsService],
})
export class RegionsModule {}
