import { Module } from '@nestjs/common'
import { CacheAdminController } from './cache-admin.controller.js'

@Module({
	controllers: [CacheAdminController],
})
export class CacheAdminModule {}
