import {
	SecretsManagerClient,
	GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager'

/**
 * Fetch secrets from AWS Secrets Manager and inject into process.env
 * 
 * @param secretName - The name/ARN of the secret in Secrets Manager
 * @param region - AWS region (defaults to us-east-1)
 */
export async function loadSecretsFromAWS(
	secretName: string,
	region: string = 'us-east-1',
): Promise<void> {
	const client = new SecretsManagerClient({ region })

	try {
		const command = new GetSecretValueCommand({ SecretId: secretName })
		const response = await client.send(command)

		if (!response.SecretString) {
			console.warn(`[AWS Secrets] No SecretString found for: ${secretName}`)
			return
		}

		// Parse the secret JSON and inject into process.env
		const secrets = JSON.parse(response.SecretString) as Record<string, string>
		
		for (const [key, value] of Object.entries(secrets)) {
			// Only set if not already defined (existing env vars take precedence)
			if (process.env[key] === undefined) {
				process.env[key] = value
			}
		}

		console.log(`[AWS Secrets] Loaded ${Object.keys(secrets).length} secrets from: ${secretName}`)
	} catch (error) {
		if (error instanceof Error) {
			console.error(`[AWS Secrets] Failed to load secrets from ${secretName}:`, error.message)
			throw new Error(`Failed to load secrets from AWS Secrets Manager: ${error.message}`)
		}
		throw error
	}
}

/**
 * Load multiple secrets in parallel
 */
export async function loadMultipleSecrets(
	secrets: Array<{ name: string; region?: string }>,
): Promise<void> {
	await Promise.all(
		secrets.map((secret) => loadSecretsFromAWS(secret.name, secret.region)),
	)
}
