import { z } from 'zod';
import { AgentLifecycleStatus } from '@exprealty/shared-domain';

/**
 * Zod schema for Enterprise_AgentUpdated_V2 translated payload.
 * This is the format that comes from translateKafkaMessageToUpsertData.
 */
export const EnterpriseAgentUpsertSchema = z.object({
	agent: z.object({
		id: z.string().uuid(),
		agentId: z.string().regex(/^\d+$/).optional(),
		systemId: z.number().int().optional(),
		firstName: z.string().min(1),
		middleName: z.string().optional(),
		lastName: z.string().min(1),
		suffix: z.enum(['Jr', 'Sr', 'II', 'III', 'IV', 'V', 'MD', 'PhD', 'Esq']).optional(),
		preferredName: z.string().optional(),
		title: z.enum(['Mr', 'Mrs', 'Ms', 'Miss']).optional(),
		birthDate: z.coerce.date().optional(),
		lifecycleStatus: AgentLifecycleStatus,
		joinDate: z.coerce.date().optional(),
		anniversaryDate: z.coerce.date().optional(),
		terminationDate: z.coerce.date().optional(),
		isStaff: z.boolean(),
		agentCompanyId: z.string().uuid().optional(),
	}),
	contactMethods: z.array(
		z.object({
			name: z.string().min(1),
			channel: z.enum(['email', 'phone']),
			value: z.string().min(1),
			isPrimary: z.boolean(),
			subType: z.enum(['mobile', 'home', 'work', 'fax', 'personal']).optional(),
			smsOptIn: z.boolean().optional(),
		}),
	).default([]),
	addresses: z.array(
		z.object({
			line1: z.string().min(1),
			line2: z.string().optional(),
			city: z.string().min(1),
			postalCode: z.string().min(1),
			unit: z.string().optional(),
			county: z.string().optional(),
			label: z.string().optional(),
			type: z.enum(['personal', 'company']).optional(),
			role: z.enum(['contact', 'bill_to', 'pay_to', 'ship_to', 'return_to']).optional(),
			isPrimary: z.boolean(),
			stateCode: z.string().optional(),
			countryAlpha2: z.string().optional(),
		}),
	).default([]),
	offices: z.array(
		z.object({
			officeId: z.string().optional(),
			officeName: z.string().min(1),
			isPrimary: z.boolean(),
			companyId: z.string().optional(),
			lifecycleStatus: z.string().optional(),
			phone: z.string().optional(),
			website: z.string().optional(),
			primaryState: z.string().optional(),
		}),
	).default([]),
	mls: z.array(
		z.object({
			mlsId: z.string().optional(),
			name: z.string().min(1),
			ouid: z.string().optional(),
			globalId: z.number().int().optional(),
			shortName: z.string().optional(),
			orgType: z.string().min(1),
			lifecycleStatus: z.string().min(1),
		}),
	).default([]),
});

export type EnterpriseAgentUpsertInput = z.infer<typeof EnterpriseAgentUpsertSchema>;




