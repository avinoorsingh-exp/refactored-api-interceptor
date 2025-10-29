// services/address-provider/src/main.ts
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module.js'

async function bootstrap() {
	const app = await NestFactory.create(AppModule)
	app.enableShutdownHooks()
	await app.listen(process.env.PORT ? Number(process.env.PORT) : 8080)
}
void bootstrap()
