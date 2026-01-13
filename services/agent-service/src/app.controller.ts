// services/address-provider/src/controllers/address.controller.ts
import { Controller, Get } from '@nestjs/common'
import { LoggerService } from '../core/logger.service.js'

@Controller('/v1/agent')
export class AgentController {
	private readonly logger: LoggerService

	constructor(logger: LoggerService) {
		this.logger = logger
		this.logger.setContext('AgentController')
	}

	@Get('/health')
	health() {
		this.logger.debug('Health check requested', { endpoint: '/v1/agent/health' })
		return { status: 'ok', service: 'agent-service', timestamp: new Date().toISOString() }
	}
}

/**
 * Root-level health check endpoint for ECS health checks
 * ECS may check /health instead of /v1/agent/health
 */
@Controller()
export class RootHealthController {
	private readonly logger: LoggerService

	constructor(logger: LoggerService) {
		this.logger = logger
		this.logger.setContext('RootHealthController')
	}

	@Get('/health')
	health() {
		this.logger.debug('Health check requested', { endpoint: '/health' })
		return { status: 'ok', service: 'agent-service', timestamp: new Date().toISOString() }
	}
}