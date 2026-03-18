import { z } from 'zod'

/**
 * Base schema for Program entity.
 *
 * @public
 */
export const ProgramBaseSchema = z
	.object({
		id: z.string().uuid(),
		name: z.string().min(1).max(255),
	})
	.describe('Base Program')

/**
 * @public
 */
export type ProgramBase = z.infer<typeof ProgramBaseSchema>

/**
 * Expanded schema for Program entity with relationships.
 *
 * @public
 */
export const ProgramExpandedSchema = ProgramBaseSchema.extend({
	statePrograms: z.lazy(() => z.array(z.any())).optional(),
}).describe('Expanded Program with relationships')

/**
 * @public
 */
export type ProgramExpanded = z.infer<typeof ProgramExpandedSchema>

/**
 * @public
 */
export type Program = ProgramExpanded

/**
 * Schema for creating a new Program.
 *
 * @public
 */
export const CreateProgramInputSchema = ProgramBaseSchema.omit({ id: true })

/**
 * @public
 */
export type CreateProgramInput = z.infer<typeof CreateProgramInputSchema>

/**
 * Schema for updating a Program.
 *
 * @public
 */
export const UpdateProgramInputSchema = ProgramBaseSchema.omit({ id: true }).partial()

/**
 * @public
 */
export type UpdateProgramInput = z.infer<typeof UpdateProgramInputSchema>
