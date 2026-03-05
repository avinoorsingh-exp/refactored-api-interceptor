// services/orchestrator/src/app.module.ts
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common'
import { ConfigModule } from './core/config.module.js'
import { OrchestratorController } from './controllers/orchestrator.controller.js'
import { AgentServiceController } from './controllers/agent-service.controller.js'
import { SwaggerProxyController } from './controllers/swagger-proxy.controller.js'
import { AgentServiceClientFactory } from './clients/agent-service/agent-service.factory.js'
import { LoggerService } from './core/logger.service.js'
import { ConfigService } from './core/config.service.js'
import { CorrelationIdHttpMiddleware } from './middleware/correlation-id-http.middleware.js'

@Module({
  imports: [ConfigModule],
  controllers: [
    OrchestratorController,
    AgentServiceController,
    SwaggerProxyController,
  ],
  providers: [
    LoggerService,
    ConfigService,
    AgentServiceClientFactory,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Register CorrelationIdHttpMiddleware globally for all routes
    consumer
      .apply(CorrelationIdHttpMiddleware)
      .forRoutes('*')
  }
}
