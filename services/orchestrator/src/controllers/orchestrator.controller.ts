// services/orchestrator/src/controllers/orchestrator.controller.ts
import { Controller, Get } from '@nestjs/common'
import { LoggerService } from '../core/logger.service.js'


@Controller('/v1')
export class OrchestratorController {
  constructor(
    private readonly logger: LoggerService,
  ) {}

  @Get('/health')
  health() {
    return { status: 'ok', service: 'orchestrator', timestamp: new Date().toISOString() }
  }
}
