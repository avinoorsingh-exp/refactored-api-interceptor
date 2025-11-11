// @exprealty/shared-domain/logging.ts
import { z } from 'zod'
import { CapabilityEnum, ServiceIdSchema } from './capabilities.js'
export const EnvEnum = z.enum(['dev', 'test', 'prod'])
export const HttpMethodEnum = z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])

/**
 * Keep endpoints “sluggy” (no IDs). e.g., "/demographics" or "listing/search"
 * If you need subpaths, dash/alpha-num only to keep Loki labels safe.
 */
export const EndpointSlug = z
  .string()
  .min(1)
  .regex(/^\/?[a-z0-9-]+(?:\/[a-z0-9-]+)*$/i, 'use slugified endpoint path (no IDs)')


  export const ServiceCallEventSchema = z.object({
  event: z.literal('service_call'),
  service: z.string().min(1),               // e.g., "orchestrator"
  env: EnvEnum,                              // "dev" | "test" | "prod"

  // Your service IDs like "agent:contries", "agent:mls", "agent:address"
  serviceCall: ServiceIdSchema,

  // Optional but very useful for dashboards: "listing.search", "address.geocode", etc.
  capability: CapabilityEnum.optional(),

  endpoint: EndpointSlug,                    // normalized slug (no IDs)
  method: HttpMethodEnum.default('GET'),

  status: z.number().int().min(0).max(599),
  ok: z.boolean(),

  duration_ms: z.number().finite().min(0),

  retries: z.number().int().min(0).default(0),

  // Helpful for correlation, but do NOT make these Loki labels
  request_id: z.string().uuid().optional(),
  error_kind: z.string().optional(),         // e.g., "ECONNABORTED", "ETIMEDOUT"
})

export type ServiceCallEvent = z.infer<typeof ServiceCallEventSchema>