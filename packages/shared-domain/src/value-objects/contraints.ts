// Shared limits & regexes (single source of truth)
// These constraints are used by both Zod schemas (domain layer) and TypeORM entities (database layer)

/**
 * Name constraints for validation.
 * @public
 */
export const NAME = { min: 2, max: 50 } as const

/**
 * Phone number constraints and patterns.
 * @public
 */
export const PHONE = {
	e164: /^\+[1-9]\d{1,14}$/,
	maxLen: 20, // Updated to match database varchar(20)
} as const

/**
 * Email constraints for validation.
 * @public
 */
export const EMAIL = {
	maxLen: 255,
} as const

/**
 * Address field constraints for validation.
 * @public
 */
export const ADDRESS = {
	line: { min: 1, max: 256 },
	city: { min: 1, max: 128 },
	unit: { min: 1, max: 64 }, // state/province
	postal: { min: 2, max: 16 },
	countryAlpha2Len: 2, // ISO-3166-1 alpha-2
} as const

/**
 * ID validation patterns.
 * @public
 */
export const ID = {
	uuidRegex: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
} as const

/**
 * Agent entity field constraints.
 * @public
 */
export const AGENT = {
	firstName: { min: 1, max: 100 },
	middleName: { min: 1, max: 100 },
	lastName: { min: 1, max: 100 },
	suffix: { min: 1, max: 20 },
	title: { min: 1, max: 50 },
	lifecycleStatus: { max: 50 },
} as const

/**
 * Company entity field constraints.
 * @public
 */
export const COMPANY = {
	name: { min: 1, max: 255 },
	email: { max: 255 },
} as const

/**
 * Office entity field constraints.
 * @public
 */
export const OFFICE = {
	name: { min: 1, max: 255 },
} as const

/**
 * External Reference field constraints.
 * @public
 */
export const EXTERNAL_REFERENCE = {
	systemCode: { min: 1, max: 100 },
	refKey: { min: 1, max: 255 },
	refValue: { min: 1, max: 255 },
} as const

/**
 * Language entity field constraints.
 * @public
 */
export const LANGUAGE = {
	name: { min: 1, max: 100 },
	code: { min: 2, max: 10 },
} as const

/**
 * Contact Method field constraints.
 * @public
 */
export const CONTACT_METHOD = {
	name: { min: 1, max: 255 },
	channel: { max: 50 },
	subType: { max: 50 },
	value: { min: 1, max: 255 },
} as const

/**
 * Email Forward field constraints.
 * @public
 */
export const EMAIL_FORWARD = {
	recipientId: { min: 1, max: 255 },
	forwardId: { min: 1, max: 255 },
	language: { max: 50 },
} as const

/**
 * Social entity field constraints.
 * @public
 */
export const SOCIAL = {
	context: { max: 50 },
	value: { min: 1, max: 500 },
} as const

/**
 * Specialty entity field constraints.
 * @public
 */
export const SPECIALTY = {
	name: { min: 1, max: 255 },
} as const

/**
 * Active Location field constraints.
 * @public
 */
export const ACTIVE_LOCATION = {
	name: { min: 1, max: 255 },
	postalCode: { min: 1, max: 20 },
	city: { min: 1, max: 100 },
} as const

/**
 * Line of Business field constraints.
 * @public
 */
export const LINE_OF_BUSINESS = {
	name: { min: 1, max: 255 },
} as const

/**
 * License entity field constraints.
 * @public
 */
export const LICENSE = {
	type: { max: 50 },
	firstName: { min: 1, max: 100 },
	middleName: { min: 1, max: 100 },
	lastName: { min: 1, max: 100 },
	suffix: { min: 1, max: 20 },
	number: { min: 1, max: 100 },
} as const

/**
 * Note entity field constraints.
 * @public
 */
export const NOTE = {
	actor: { min: 1, max: 255 },
} as const

/**
 * Lifecycle Event field constraints.
 * @public
 */
export const LIFECYCLE_EVENT = {
	actor: { min: 1, max: 255 },
	type: { max: 50 },
} as const

/**
 * License Event field constraints.
 * @public
 */
export const LICENSE_EVENT = {
	actor: { min: 1, max: 255 },
	type: { max: 50 },
	status: { max: 50 },
} as const

/**
 * Relationship entity field constraints.
 * @public
 */
export const RELATIONSHIP = {
	type: { max: 50 },
} as const

/**
 * MLS entity field constraints.
 * @public
 */
export const MLS = {
	ouid: { max: 255 },
	lifecycleStatus: { max: 50 },
	name: { min: 1, max: 255 },
	shortName: { max: 255 },
	displayName: { max: 255 },
	website: { max: 500 },
	orgType: { max: 50 },
	larversionUrl: { max: 500 },
	logoUrl: { max: 500 },
	modifiedBy: { min: 1, max: 255 },
	brokerOfRecordName: { max: 255 },
	brokerOfRecordEmail: { max: 255 },
	brokerOfRecordPhone: { max: 20 },
} as const

/**
 * Country entity field constraints.
 * Conforms to ISO 3166-1 international standard.
 * @public
 */
export const COUNTRY = {
	name: { min: 1, max: 255 },
	alpha2: 2,
	alpha3: 3,
	number: { min: 1, max: 999 },
	dialingCode: { min: 1 },
} as const

/**
 * Region entity field constraints.
 * @public
 */
export const REGION = {
	name: { min: 1, max: 255 },
} as const

/**
 * State entity field constraints.
 * @public
 */
export const STATE = {
	name: { min: 1, max: 255 },
	code: { max: 10 },
	email: { max: 255 },
	signatureDistributionEmail: { max: 255 },
	modifiedBy: { min: 1, max: 255 },
} as const

/**
 * Program entity field constraints.
 * @public
 */
export const PROGRAM = {
	name: { min: 1, max: 255 },
} as const

/**
 * Organization Contact field constraints.
 * @public
 */
export const ORGANIZATION_CONTACT = {
	name: { min: 1, max: 255 },
	email: { max: 255 },
	phone: { max: 20 },
	address: { max: 500 },
} as const

/**
 * W9 entity field constraints.
 * @public
 */
export const W9 = {
	tin: { min: 1, max: 20 },
	legalName: { min: 1, max: 255 },
	businessName: { max: 255 },
	federalTaxClassification: { max: 100 },
	federalTaxClassificationOther: { max: 255 },
	exemptPayeeCode: { max: 50 },
	exemptionFromFatcaReportingCode: { max: 50 },
} as const

/**
 * Tax entity field constraints.
 * @public
 */
export const TAX = {
	taxId: { min: 1, max: 50 },
	type: { min: 1, max: 100 },
	jurisdiction: { min: 1, max: 255 },
} as const

/**
 * Artifact entity field constraints.
 * @public
 */
export const ARTIFACT = {
	type: { min: 1, max: 100 },
	name: { min: 1, max: 255 },
	storageKey: { max: 500 },
} as const

/**
 * Custom Flag entity field constraints (@beta).
 * @beta
 */
export const CUSTOM_FLAG = {
	name: { min: 1, max: 255 },
	type: { max: 50 },
	scope: { max: 50 },
} as const

/**
 * Fees entity field constraints (@beta).
 * @beta
 */
export const FEES = {
	name: { min: 1, max: 255 },
	paidBy: { max: 255 },
} as const

/**
 * Approval entity field constraints (@beta).
 * @beta
 */
export const APPROVAL = {
	approvalState: { max: 50 },
	template: { max: 50 },
	note: { max: 1000 },
} as const

/**
 * URL constraints.
 * @public
 */
export const URL = {
	maxLen: 2048,
} as const

/**
 * Generic text field constraints.
 * @public
 */
export const TEXT = {
	short: { max: 255 }, // varchar(255)
	medium: { max: 500 }, // varchar(500)
	long: { max: 1000 }, // varchar(1000)
} as const
