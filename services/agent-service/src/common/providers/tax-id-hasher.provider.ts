import type { Provider } from '@nestjs/common';
import { HmacService } from '@exprealty/encryption';
import { ConfigService } from '../../core/config.service.js';

/**
 * Shared NestJS provider for the TaxIdHasher port.
 *
 * Single source of truth for TaxIdHasher wiring. Import this constant in any
 * module that needs `@Inject('TaxIdHasher')`:
 *
 * ```typescript
 * providers: [taxIdHasherProvider, ...]
 * ```
 *
 * Reads HMAC_SECRET (required) and HMAC_SECRET_PREVIOUS (optional) from
 * ConfigService, which validates both at startup via ConfigSchema.
 * Exposes both hash() (writes) and hashWithFallback() (rotation-safe reads).
 */
export const taxIdHasherProvider: Provider = {
	provide: 'TaxIdHasher',
	useFactory: (config: ConfigService) => {
		const current = config.get('HMAC_SECRET');
		const previous = config.get('HMAC_SECRET_PREVIOUS');
		const hmac = new HmacService({ current, ...(previous ? { previous } : {}) });
		return {
			hash: (plaintext: string) => hmac.hash(plaintext),
			hashWithFallback: (plaintext: string) => hmac.hashWithFallback(plaintext),
		};
	},
	inject: [ConfigService],
};
