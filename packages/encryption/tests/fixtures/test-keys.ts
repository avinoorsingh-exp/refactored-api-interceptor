/**
 * Deterministic test secrets.
 *
 * NEVER use these in production. They exist solely for unit testing
 * the HMAC and last4 logic without needing AWS credentials.
 */
export const TEST_HMAC_SECRET_CURRENT =
  'test-hmac-current-secret-at-least-32-chars-long-for-validation';

export const TEST_HMAC_SECRET_PREVIOUS =
  'test-hmac-previous-secret-at-least-32-chars-for-validation!!';

export const TEST_KMS_KEY_ARN =
  'arn:aws:kms:us-east-1:123456789012:alias/test-key';

export const TEST_REGION = 'us-east-1';