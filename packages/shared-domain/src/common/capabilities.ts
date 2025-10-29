import {z} from 'zod'
export const CapabilityEnum = z.enum([
    'agent.search'
])
export type Capability = z.infer<typeof CapabilityEnum>

export const ServiceIdSchema = z.string().min(1)
