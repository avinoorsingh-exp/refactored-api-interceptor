import { z } from 'zod'

/**
 * Base schema for StateProgram junction entity.
 *
 * @public
 */
export const StateProgramBaseSchema = z
	.object({
		stateId: z.string().uuid(),
		programId: z.string().uuid(),
	})
	.describe('Base StateProgram')

/**
 * @public
 */
export type StateProgramBase = z.infer<typeof StateProgramBaseSchema>

/**
 * Expanded schema for StateProgram entity with relationships.
 *
 * @public
 */
export const StateProgramExpandedSchema = StateProgramBaseSchema.extend({
	state: z.lazy(() => z.any()).optional(),
	program: z.lazy(() => z.any()).optional(),
}).describe('Expanded StateProgram with relationships')

/**
 * @public
 */
export type StateProgramExpanded = z.infer<typeof StateProgramExpandedSchema>

/**
 * @public
 */
export type StateProgram = StateProgramExpanded

/**
 * Schema for creating a new StateProgram.
 *
 * @public
 */
export const CreateStateProgramInputSchema = StateProgramBaseSchema

/**
 * @public
 */
export type CreateStateProgramInput = z.infer<typeof CreateStateProgramInputSchema>
