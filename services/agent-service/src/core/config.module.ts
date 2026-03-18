import { Global, Module } from '@nestjs/common'
import { ConfigModule as NestConfigModule } from '@nestjs/config'
import configuration from './configuration.js'
import { ConfigService } from './config.service.js'

@Global()
@Module({
	imports: [
		NestConfigModule.forRoot({
			load: [configuration],
			isGlobal: true,
			envFilePath: ['.env.local', '.env.agentservice', '../../.env'],
		}),
	],
	providers: [ConfigService],
	exports: [ConfigService],
})
export class ConfigModule {}
