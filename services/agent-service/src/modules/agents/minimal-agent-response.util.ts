/**
 * Minimal agent response for guest scope (agent-service/read).
 * Used when Bearer token has scope "agent-service/read" to limit exposed data.
 */

/** When scope is agent-service/read, only these fields and includes are used (client include is ignored). */
export const MINIMAL_AGENT_FIELDS = ['id', 'firstName', 'lastName', 'lifecycleStatus'] as const;
export const MINIMAL_AGENT_INCLUDES = ['primaryEmail', 'primaryAddress'] as const;

export type MinimalAgentItem = {
	id: string;
	firstName: string;
	lastName: string;
	lifecycleStatus: string;
	primaryEmail?: { value: string };
	primaryAddress?: {
		country?: { name: string };
		state?: { name: string };
	};
};

export function mapToMinimalAgentResponse(agent: Record<string, unknown>): MinimalAgentItem {
	const primaryEmail = agent.primaryEmail as { value?: string } | undefined;
	const primaryAddress = agent.primaryAddress as {
		country?: { name?: string };
		state?: { name?: string };
	} | undefined;
	const hasCountry = primaryAddress?.country?.name != null;
	const hasState = primaryAddress?.state?.name != null;
	const primaryAddressPayload =
		primaryAddress != null && (hasCountry || hasState)
			? {
					...(hasCountry && { country: { name: primaryAddress.country!.name } }),
					...(hasState && { state: { name: primaryAddress.state!.name } }),
				}
			: undefined;
	return {
		id: agent.id as string,
		firstName: agent.firstName as string,
		lastName: agent.lastName as string,
		lifecycleStatus: (agent.lifecycleStatus as string) ?? 'Active',
		...(primaryEmail?.value != null && { primaryEmail: { value: primaryEmail.value } }),
		...(primaryAddressPayload && { primaryAddress: primaryAddressPayload }),
	};
}
