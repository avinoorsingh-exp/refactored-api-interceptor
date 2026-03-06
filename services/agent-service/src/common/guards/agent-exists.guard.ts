
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import type { AgentService } from '../../modules/agents/agent.service.js';

/**
 * Agent Exists Guard
 * 
 * Validates that the agent in route params exists.
 * Use on controllers/routes with :agentId or :id parameter.
 * 
 * Supports both param names:
 * - :agentId - nested resources (e.g., /agents/:agentId/contactmethods)
 * - :id - agent routes (e.g., /agents/:id)
 * 
 * Benefits:
 * - Clean REST semantics (404 if agent doesn't exist)
 * - DRY - No duplicate validation code
 * - Fail fast - Before entering controller logic
 * - Attaches validated agent to request for reuse
 */
@Injectable()
export class AgentExistsGuard implements CanActivate {
  constructor(
    @Inject('AGENT_SERVICE')
    private readonly agentService: AgentService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    
    // Support both param names: :agentId (nested) or :id (agent routes)
    const agentId = request.params.agentId ?? request.params.id;

    if (!agentId) {
      // No agent ID in params - let it pass (not our concern)
      return true;
    }

    // Validate agent exists using AgentService.findById
    // This throws NotFoundException if not found
    try {
      const agent = await this.agentService.findById(agentId);
      
      // Attach agent to request for reuse by @Agent() decorator
      request.agent = agent;
      
      return true;
    } catch (error) {
      // Re-throw NotFoundException from service as-is
      if (error instanceof NotFoundException) {
        throw error;
      }
      
      // Transform other errors to 404 with clear message
      throw new NotFoundException({
        message: `Agent with ID '${agentId}' not found`,
        i18nType: 'agent.not_found',
      });
    }
  }
}