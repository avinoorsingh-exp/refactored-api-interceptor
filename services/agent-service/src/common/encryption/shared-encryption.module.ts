import { Global, Module, Inject, type OnModuleInit } from '@nestjs/common';
import {
	FieldEncryptionService,
	createFieldEncryptionService,
	createLocalFieldEncryptionService,
} from '@exprealty/encryption';
import { ConfigService } from '../../core/config.service.js';
import { LoggerService } from '../../core/logger.service.js';

@Global()
@Module({
	providers: [
		{
			provide: 'FIELD_ENCRYPTION',
			useFactory: (config: ConfigService): FieldEncryptionService => {
				if (config.get('NODE_ENV') === 'local') {
					return createLocalFieldEncryptionService(config.get('HMAC_SECRET'));
				}
				return createFieldEncryptionService({
					kms: {
						keyArn: config.get('KMS_KEY_ARN'),
						region: config.get('KMS_KEY_REGION'),
						cacheTtlSeconds: config.get('KMS_CACHE_TTL_SECONDS'),
						cacheMaxMessages: config.get('KMS_CACHE_MAX_MESSAGES'),
					},
					hmac: {
						current: config.get('HMAC_SECRET'),
						previous: config.get('HMAC_SECRET_PREVIOUS'),
					},
				});
			},
			inject: [ConfigService],
		},
		{
			provide: 'TaxIdHasher',
			useFactory: (encryption: FieldEncryptionService) => ({
				hash: (plaintext: string) => encryption.generateBlindIndex(plaintext),
				hashWithFallback: (plaintext: string) => encryption.generateBlindIndexWithFallback(plaintext),
			}),
			inject: ['FIELD_ENCRYPTION'],
		},
	],
	exports: ['FIELD_ENCRYPTION', 'TaxIdHasher'],
})
export class SharedEncryptionModule implements OnModuleInit {
	constructor(
		@Inject('FIELD_ENCRYPTION') private readonly encryption: FieldEncryptionService,
		private readonly config: ConfigService,
		private readonly logger: LoggerService,
	) {}

	onModuleInit() {
		const env = this.config.get('NODE_ENV');
		if (env === 'local') {
			this.logger.info('[Encryption] Local envelope encryption active (no KMS)');
		} else {
			this.logger.info(`[Encryption] KMS key: ${this.config.get('KMS_KEY_ARN')}`);
		}
		if (this.encryption.isHmacRotationActive()) {
			this.logger.warn('[Encryption] HMAC rotation active — dual-hash lookups enabled');
		}
	}
}
