// packages/@exprealty/shared-domain/src/decorators/agent.decorator.ts

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AgentEntity } from '@exprealty/database';

/**
 * Agent Decorator
 * 
 * Retrieves validated agent from request
 * Must be used with AgentExistsGuard
 */
export const Agent = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): AgentEntity => {
    const request = ctx.switchToHttp().getRequest();
    return request.agent; // ✅ Set by AgentExistsGuard
  },
);