import { z } from 'zod';

const HmacConfigSchema = z.object({
  current: z
    .string()
    .min(32, 'HMAC secret must be at least 32 characters for security'),
  previous: z
    .string()
    .min(32, 'Previous HMAC secret must be at least 32 characters')
    .optional(),
});

/**
 * Top-level encryption configuration.
 *
 * Consumed by `createFieldEncryptionService()` factory.
 * Validated at construction time — fails fast on misconfiguration.
 */
export const EncryptionConfigSchema = z.object({
  kms: z.object({
    /** AWS KMS key ARN or alias ARN (e.g., arn:aws:kms:us-east-1:...:key/... or alias/trupryce-pii) */
    keyArn: z.string().min(1, 'KMS key ARN is required'),

    /** AWS region for KMS calls */
    region: z.string().default('us-east-1'),

    /**
     * Optional: cache data encryption keys (DEKs) locally to reduce KMS API calls.
     * When set, DEKs are reused for this many seconds before requesting new ones.
     * Only enable if you're doing high-volume encryption operations.
     */
    cacheTtlSeconds: z.number().positive().optional(),

    /**
     * Optional: maximum number of messages a cached DEK can encrypt.
     * Works alongside cacheTtlSeconds — whichever limit is hit first triggers a new DEK.
     * Default: 100
     */
    cacheMaxMessages: z.number().positive().default(100),
  }),

  hmac: HmacConfigSchema,
});

export type EncryptionConfig = z.infer<typeof EncryptionConfigSchema>;
export type HmacConfig = z.infer<typeof HmacConfigSchema>