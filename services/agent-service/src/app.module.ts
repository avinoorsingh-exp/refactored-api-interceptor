// services/address-provider/src/app.module.ts
import { Module } from '@nestjs/common'
import { ConfigModule } from './core/config.module.js'
import { AgentController } from './controllers/agent.controller.js'


@Module({
  imports: [ConfigModule],
  controllers: [AgentController],
  // TODO: providers: [KafkaClient],
})
export class AppModule {
  // NestJS modules must be classes, even if empty
}
