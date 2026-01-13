// services/address-provider/src/controllers/address.controller.ts
import { Controller, Get } from '@nestjs/common'

@Controller('/v1/agent')
export class AgentController {
	@Get('/health')
	health() {
		return { status: 'ok', service: 'agent-service', timestamp: new Date().toISOString() }
	}
}

/**
 * Root-level health check endpoint for ECS health checks
 * ECS may check /health instead of /v1/agent/health
 */
@Controller()
export class RootHealthController {
	@Get('/health')
	health() {
		return { status: 'ok', service: 'agent-service', timestamp: new Date().toISOString() }
	}
}