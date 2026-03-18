import {
	CreateContactMethodInput,
	UpdateContactMethodInput,
	ContactMethodChannelSchema,
	ContactMethodSubTypeSchema,
	EmailSubTypeSchema,
	PhoneSubTypeSchema,
} from '@exprealty/shared-domain';

describe('ContactMethod Schema Validation', () => {
	describe('ContactMethodChannelSchema', () => {
		it('should accept "email" as valid channel', () => {
			const result = ContactMethodChannelSchema.safeParse('email');
			expect(result.success).toBe(true);
		});

		it('should accept "phone" as valid channel', () => {
			const result = ContactMethodChannelSchema.safeParse('phone');
			expect(result.success).toBe(true);
		});

		it('should reject invalid channel', () => {
			const result = ContactMethodChannelSchema.safeParse('sms');
			expect(result.success).toBe(false);
		});
	});

	describe('EmailSubTypeSchema', () => {
		it.each(['personal', 'work', 'home'])('should accept "%s" as valid email subType', (subType) => {
			const result = EmailSubTypeSchema.safeParse(subType);
			expect(result.success).toBe(true);
		});

		it.each(['mobile', 'fax'])('should reject "%s" as invalid email subType', (subType) => {
			const result = EmailSubTypeSchema.safeParse(subType);
			expect(result.success).toBe(false);
		});
	});

	describe('PhoneSubTypeSchema', () => {
		it.each(['mobile', 'home', 'work', 'fax'])('should accept "%s" as valid phone subType', (subType) => {
			const result = PhoneSubTypeSchema.safeParse(subType);
			expect(result.success).toBe(true);
		});

		it('should reject "personal" as invalid phone subType', () => {
			const result = PhoneSubTypeSchema.safeParse('personal');
			expect(result.success).toBe(false);
		});
	});

	describe('CreateContactMethodInput', () => {
		const validEmailBase = {
			name: 'Work Email',
			channel: 'email' as const,
			value: 'test@example.com',
			isPrimary: false,
		};

		const validPhoneBase = {
			name: 'Mobile Phone',
			channel: 'phone' as const,
			value: '+14155552671',
			isPrimary: false,
		};

		describe('Email channel validation', () => {
			it('should accept valid email with personal subType', () => {
				const result = CreateContactMethodInput.safeParse({
					...validEmailBase,
					subType: 'personal',
				});
				expect(result.success).toBe(true);
			});

			it('should accept valid email with work subType', () => {
				const result = CreateContactMethodInput.safeParse({
					...validEmailBase,
					subType: 'work',
				});
				expect(result.success).toBe(true);
			});

			it('should accept valid email with home subType', () => {
				const result = CreateContactMethodInput.safeParse({
					...validEmailBase,
					subType: 'home',
				});
				expect(result.success).toBe(true);
			});

			it('should accept valid email without subType', () => {
				const result = CreateContactMethodInput.safeParse(validEmailBase);
				expect(result.success).toBe(true);
			});

			it('should reject email with invalid format', () => {
				const result = CreateContactMethodInput.safeParse({
					...validEmailBase,
					value: 'not-an-email',
				});
				expect(result.success).toBe(false);
				if (!result.success) {
					const valueError = result.error.issues.find((i) => i.path.includes('value'));
					expect(valueError).toBeDefined();
					expect(valueError?.message).toBe('errors.contactMethod.value.invalidEmail');
				}
			});

			it('should reject email with mobile subType', () => {
				const result = CreateContactMethodInput.safeParse({
					...validEmailBase,
					subType: 'mobile',
				});
				expect(result.success).toBe(false);
				if (!result.success) {
					const subTypeError = result.error.issues.find((i) => i.path.includes('subType'));
					expect(subTypeError).toBeDefined();
					expect(subTypeError?.message).toBe('errors.contactMethod.subType.invalidForChannel');
				}
			});

			it('should reject email with fax subType', () => {
				const result = CreateContactMethodInput.safeParse({
					...validEmailBase,
					subType: 'fax',
				});
				expect(result.success).toBe(false);
				if (!result.success) {
					const subTypeError = result.error.issues.find((i) => i.path.includes('subType'));
					expect(subTypeError).toBeDefined();
					expect(subTypeError?.message).toBe('errors.contactMethod.subType.invalidForChannel');
				}
			});
		});

		describe('Phone channel validation', () => {
			it('should accept valid E.164 phone with mobile subType', () => {
				const result = CreateContactMethodInput.safeParse({
					...validPhoneBase,
					subType: 'mobile',
				});
				expect(result.success).toBe(true);
			});

			it('should accept valid E.164 phone with home subType', () => {
				const result = CreateContactMethodInput.safeParse({
					...validPhoneBase,
					subType: 'home',
				});
				expect(result.success).toBe(true);
			});

			it('should accept valid E.164 phone with work subType', () => {
				const result = CreateContactMethodInput.safeParse({
					...validPhoneBase,
					subType: 'work',
				});
				expect(result.success).toBe(true);
			});

			it('should accept valid E.164 phone with fax subType', () => {
				const result = CreateContactMethodInput.safeParse({
					...validPhoneBase,
					subType: 'fax',
				});
				expect(result.success).toBe(true);
			});

			it('should accept valid E.164 phone without subType', () => {
				const result = CreateContactMethodInput.safeParse(validPhoneBase);
				expect(result.success).toBe(true);
			});

			it('should reject phone with personal subType', () => {
				const result = CreateContactMethodInput.safeParse({
					...validPhoneBase,
					subType: 'personal',
				});
				expect(result.success).toBe(false);
				if (!result.success) {
					const subTypeError = result.error.issues.find((i) => i.path.includes('subType'));
					expect(subTypeError).toBeDefined();
					expect(subTypeError?.message).toBe('errors.contactMethod.subType.invalidForChannel');
				}
			});

			describe('E.164 phone format validation', () => {
				it('should accept valid US phone number (+1)', () => {
					const result = CreateContactMethodInput.safeParse({
						...validPhoneBase,
						value: '+14155552671',
					});
					expect(result.success).toBe(true);
				});

				it('should accept valid UK phone number (+44)', () => {
					const result = CreateContactMethodInput.safeParse({
						...validPhoneBase,
						value: '+442071234567',
					});
					expect(result.success).toBe(true);
				});

				it('should accept valid Australian phone number (+61)', () => {
					const result = CreateContactMethodInput.safeParse({
						...validPhoneBase,
						value: '+61412345678',
					});
					expect(result.success).toBe(true);
				});

				it('should accept phone number with spaces (stripped during validation)', () => {
					const result = CreateContactMethodInput.safeParse({
						...validPhoneBase,
						value: '+1 415 555 2671',
					});
					expect(result.success).toBe(true);
				});

				it('should accept phone number with dashes (stripped during validation)', () => {
					const result = CreateContactMethodInput.safeParse({
						...validPhoneBase,
						value: '+1-415-555-2671',
					});
					expect(result.success).toBe(true);
				});

				it('should accept phone number with parentheses (stripped during validation)', () => {
					const result = CreateContactMethodInput.safeParse({
						...validPhoneBase,
						value: '+1 (415) 555-2671',
					});
					expect(result.success).toBe(true);
				});

				it('should reject phone without + prefix', () => {
					const result = CreateContactMethodInput.safeParse({
						...validPhoneBase,
						value: '14155552671',
					});
					expect(result.success).toBe(false);
					if (!result.success) {
						const valueError = result.error.issues.find((i) => i.path.includes('value'));
						expect(valueError).toBeDefined();
						expect(valueError?.message).toBe('errors.contactMethod.value.invalidPhone');
					}
				});

				it('should reject phone with country code starting with 0', () => {
					const result = CreateContactMethodInput.safeParse({
						...validPhoneBase,
						value: '+04155552671',
					});
					expect(result.success).toBe(false);
				});

				it('should reject phone number too short', () => {
					const result = CreateContactMethodInput.safeParse({
						...validPhoneBase,
						value: '+12345',
					});
					expect(result.success).toBe(false);
				});

				it('should reject phone number too long', () => {
					const result = CreateContactMethodInput.safeParse({
						...validPhoneBase,
						value: '+12345678901234567890',
					});
					expect(result.success).toBe(false);
				});

				it('should reject US-formatted phone without country code', () => {
					const result = CreateContactMethodInput.safeParse({
						...validPhoneBase,
						value: '(415) 555-2671',
					});
					expect(result.success).toBe(false);
				});

				it('should reject plain 10-digit US number', () => {
					const result = CreateContactMethodInput.safeParse({
						...validPhoneBase,
						value: '4155552671',
					});
					expect(result.success).toBe(false);
				});
			});
		});

		describe('Required field validation', () => {
			it('should reject missing name', () => {
				const { name, ...withoutName } = validEmailBase;
				const result = CreateContactMethodInput.safeParse(withoutName);
				expect(result.success).toBe(false);
			});

			it('should reject missing channel', () => {
				const { channel, ...withoutChannel } = validEmailBase;
				const result = CreateContactMethodInput.safeParse(withoutChannel);
				expect(result.success).toBe(false);
			});

			it('should reject missing value', () => {
				const { value, ...withoutValue } = validEmailBase;
				const result = CreateContactMethodInput.safeParse(withoutValue);
				expect(result.success).toBe(false);
			});

			it('should reject missing isPrimary', () => {
				const { isPrimary, ...withoutIsPrimary } = validEmailBase;
				const result = CreateContactMethodInput.safeParse(withoutIsPrimary);
				expect(result.success).toBe(false);
			});
		});

		describe('Name trimming', () => {
			it('should trim whitespace from name', () => {
				const result = CreateContactMethodInput.safeParse({
					...validEmailBase,
					name: '  Work Email  ',
				});
				expect(result.success).toBe(true);
				if (result.success) {
					expect(result.data.name).toBe('Work Email');
				}
			});

			it('should reject empty name after trimming', () => {
				const result = CreateContactMethodInput.safeParse({
					...validEmailBase,
					name: '   ',
				});
				expect(result.success).toBe(false);
			});
		});
	});

	describe('UpdateContactMethodInput', () => {
		describe('Partial update validation', () => {
			it('should allow updating only name', () => {
				const result = UpdateContactMethodInput.safeParse({
					name: 'Updated Name',
				});
				expect(result.success).toBe(true);
			});

			it('should allow updating only isPrimary', () => {
				const result = UpdateContactMethodInput.safeParse({
					isPrimary: true,
				});
				expect(result.success).toBe(true);
			});

			it('should allow updating value without channel (no validation)', () => {
				const result = UpdateContactMethodInput.safeParse({
					value: 'anything@example.com',
				});
				expect(result.success).toBe(true);
			});

			it('should allow updating subType without channel (no validation)', () => {
				const result = UpdateContactMethodInput.safeParse({
					subType: 'mobile',
				});
				expect(result.success).toBe(true);
			});
		});

		describe('Channel + value validation', () => {
			it('should validate email format when both channel and value provided', () => {
				const result = UpdateContactMethodInput.safeParse({
					channel: 'email',
					value: 'not-an-email',
				});
				expect(result.success).toBe(false);
				if (!result.success) {
					const valueError = result.error.issues.find((i) => i.path.includes('value'));
					expect(valueError).toBeDefined();
					expect(valueError?.message).toBe('errors.contactMethod.value.invalidEmail');
				}
			});

			it('should validate phone format when both channel and value provided', () => {
				const result = UpdateContactMethodInput.safeParse({
					channel: 'phone',
					value: '4155552671',
				});
				expect(result.success).toBe(false);
				if (!result.success) {
					const valueError = result.error.issues.find((i) => i.path.includes('value'));
					expect(valueError).toBeDefined();
					expect(valueError?.message).toBe('errors.contactMethod.value.invalidPhone');
				}
			});

			it('should accept valid email when both channel and value provided', () => {
				const result = UpdateContactMethodInput.safeParse({
					channel: 'email',
					value: 'test@example.com',
				});
				expect(result.success).toBe(true);
			});

			it('should accept valid E.164 phone when both channel and value provided', () => {
				const result = UpdateContactMethodInput.safeParse({
					channel: 'phone',
					value: '+14155552671',
				});
				expect(result.success).toBe(true);
			});
		});

		describe('Channel + subType validation', () => {
			it('should validate subType for email when both channel and subType provided', () => {
				const result = UpdateContactMethodInput.safeParse({
					channel: 'email',
					subType: 'mobile',
				});
				expect(result.success).toBe(false);
				if (!result.success) {
					const subTypeError = result.error.issues.find((i) => i.path.includes('subType'));
					expect(subTypeError).toBeDefined();
					expect(subTypeError?.message).toBe('errors.contactMethod.subType.invalidForChannel');
				}
			});

			it('should validate subType for phone when both channel and subType provided', () => {
				const result = UpdateContactMethodInput.safeParse({
					channel: 'phone',
					subType: 'personal',
				});
				expect(result.success).toBe(false);
				if (!result.success) {
					const subTypeError = result.error.issues.find((i) => i.path.includes('subType'));
					expect(subTypeError).toBeDefined();
					expect(subTypeError?.message).toBe('errors.contactMethod.subType.invalidForChannel');
				}
			});

			it('should accept valid subType for email', () => {
				const result = UpdateContactMethodInput.safeParse({
					channel: 'email',
					subType: 'personal',
				});
				expect(result.success).toBe(true);
			});

			it('should accept valid subType for phone', () => {
				const result = UpdateContactMethodInput.safeParse({
					channel: 'phone',
					subType: 'mobile',
				});
				expect(result.success).toBe(true);
			});
		});

		describe('Full update validation', () => {
			it('should validate all fields when doing complete update', () => {
				const result = UpdateContactMethodInput.safeParse({
					name: 'Updated Email',
					channel: 'email',
					subType: 'work',
					value: 'updated@example.com',
					isPrimary: true,
				});
				expect(result.success).toBe(true);
			});

			it('should reject complete update with invalid combination', () => {
				const result = UpdateContactMethodInput.safeParse({
					name: 'Updated Phone',
					channel: 'phone',
					subType: 'personal',
					value: '+14155552671',
					isPrimary: true,
				});
				expect(result.success).toBe(false);
			});
		});
	});
});
