import { z } from 'zod'
import { InstantUTC } from '../value-objects/dates.js'

/**
 * Base schema for Note entity.
 *
 * @public
 */
export const NoteBaseSchema = z
	.object({
		id: z.string().uuid(),
		actor: z.string().min(1).max(255),
		body: z.string(),
		date: InstantUTC,
	})
	.describe('Base Note')

/**
 * @public
 */
export type NoteBase = z.infer<typeof NoteBaseSchema>

/**
 * Expanded schema for Note entity with relationships.
 *
 * @public
 */
export const NoteExpandedSchema = NoteBaseSchema.extend({
	lifecycleEvents: z.lazy(() => z.array(z.any())).optional(),
}).describe('Expanded Note with relationships')

/**
 * @public
 */
export type NoteExpanded = z.infer<typeof NoteExpandedSchema>

/**
 * @public
 */
export type Note = NoteExpanded

/**
 * Schema for creating a new Note.
 *
 * @public
 */
export const CreateNoteInputSchema = NoteBaseSchema.omit({ id: true })

/**
 * @public
 */
export type CreateNoteInput = z.infer<typeof CreateNoteInputSchema>

/**
 * Schema for updating a Note.
 *
 * @public
 */
export const UpdateNoteInputSchema = NoteBaseSchema.omit({ id: true }).partial()

/**
 * @public
 */
export type UpdateNoteInput = z.infer<typeof UpdateNoteInputSchema>
