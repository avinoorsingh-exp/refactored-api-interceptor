import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { http, HttpResponse } from 'msw'
import { AppModule } from '../src/app.module'
import { ProblemDetailsFilter } from '../src/common/problem-details.filter'
import { LoggerService } from '../src/core/logger.service'
import { mockServer } from '../../../test/setup-e2e'
import type { Server } from 'http'

interface HealthResponse {
	status: string
	timestamp: string
}

interface AddressValidateResponse {
	validated_address: {
		primary_line: string
		postal_code: string
	}
}

interface AddressGeocodeResponse {
	latitude: number
	longitude: number
}

interface PropertyLookupResponse {
	property_id: string
	bedrooms: number
}

interface PropertyAutocompleteResponse {
	suggestions: Array<{ address: string }>
}

interface PhoneVerifyResponse {
	phone_numbers: Array<{
		is_valid: boolean
		line_type: string
	}>
}

interface PhoneDNCResponse {
	phone_numbers: Array<{
		dnc: boolean
	}>
}

interface DemographicsGeocodeResponse {
	geoid: string
}

interface DemographicsACSResponse {
	median_gross_rent: number
	median_household_income: number
}

interface ProblemDetailsResponse {
	type: string
	title: string
	status: number
	detail: string
	instance: string
	traceId?: string
	upstream?: {
		code?: string
		url?: string
		method?: string
		providerStatus: number | null
	}
	invalidParams?: Array<{
		name: string
		reason: string
		in: string
	}>
}

describe('Orchestrator API (e2e)', () => {
	let app: INestApplication

	beforeAll(async () => {
		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [AppModule],
		}).compile()

		app = moduleFixture.createNestApplication()

		// Register the ProblemDetailsFilter to transform errors to RFC 9457
		const logger = app.get(LoggerService)
		app.useGlobalFilters(new ProblemDetailsFilter(logger))

		await app.init()
	})

	afterAll(async () => {
		await app.close()
	})

	describe('Health Check', () => {
		it('/v1/health (GET) should return healthy status', () => {
			return request(app.getHttpServer() as Server)
				.get('/v1/health')
				.expect(200)
				.expect((res) => {
					const body = res.body as HealthResponse
					expect(body).toHaveProperty('status', 'ok')
					expect(body).toHaveProperty('timestamp')
				})
		})
	})
})
