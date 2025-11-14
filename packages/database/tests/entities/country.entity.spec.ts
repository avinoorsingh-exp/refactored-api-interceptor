import { DataSource } from 'typeorm'
import { CountryEntity } from '../../src/entities/core/country.entity.js'

describe('CountryEntity - Auditable Fields', () => {
	let dataSource: DataSource

	beforeAll(async () => {
		// Create in-memory SQLite database for testing
		dataSource = new DataSource({
			type: 'sqlite',
			database: ':memory:',
			synchronize: true,
			logging: false,
			entities: [CountryEntity],
		})
		await dataSource.initialize()
	})

	afterAll(async () => {
		await dataSource.destroy()
	})

	afterEach(async () => {
		// Clean up after each test
		const repository = dataSource.getRepository(CountryEntity)
		await repository.clear()
	})

	describe('Audit field auto-population', () => {
		it('should auto-populate created timestamp on insert', async () => {
			// Arrange
			const repository = dataSource.getRepository(CountryEntity)
			const country = repository.create({
				name: 'United States',
				alpha2: 'US',
				alpha3: 'USA',
				number: 840,
				dialingCode: 1,
			})

			// Act
			const savedCountry = await repository.save(country)

			// Assert
			expect(savedCountry.created).toBeDefined()
			expect(savedCountry.created).toBeInstanceOf(Date)
			expect(savedCountry.created.getTime()).toBeLessThanOrEqual(Date.now())
		})

		it('should auto-populate lastModified timestamp on insert', async () => {
			// Arrange
			const repository = dataSource.getRepository(CountryEntity)
			const country = repository.create({
				name: 'Canada',
				alpha2: 'CA',
				alpha3: 'CAN',
				number: 124,
				dialingCode: 1,
			})

			// Act
			const savedCountry = await repository.save(country)

			// Assert
			expect(savedCountry.lastModified).toBeDefined()
			expect(savedCountry.lastModified).toBeInstanceOf(Date)
			expect(savedCountry.lastModified.getTime()).toBeLessThanOrEqual(Date.now())
		})

		it('should default modifiedBy to "system" on insert', async () => {
			// Arrange
			const repository = dataSource.getRepository(CountryEntity)
			const country = repository.create({
				name: 'Mexico',
				alpha2: 'MX',
				alpha3: 'MEX',
				number: 484,
				dialingCode: 52,
			})

			// Act
			const savedCountry = await repository.save(country)

			// Assert
			expect(savedCountry.modifiedBy).toBe('system')
		})

		it('should allow setting custom modifiedBy on insert', async () => {
			// Arrange
			const repository = dataSource.getRepository(CountryEntity)
			const country = repository.create({
				name: 'Brazil',
				alpha2: 'BR',
				alpha3: 'BRA',
				number: 76,
				dialingCode: 55,
				modifiedBy: 'admin-user-123',
			})

			// Act
			const savedCountry = await repository.save(country)

			// Assert
			expect(savedCountry.modifiedBy).toBe('admin-user-123')
		})

		it('should update lastModified timestamp on update', async () => {
			// Arrange
			const repository = dataSource.getRepository(CountryEntity)
			const country = repository.create({
				name: 'Germany',
				alpha2: 'DE',
				alpha3: 'DEU',
				number: 276,
				dialingCode: 49,
			})
			const savedCountry = await repository.save(country)
			const originalLastModified = savedCountry.lastModified

			// Wait a bit to ensure timestamp difference
			await new Promise(resolve => setTimeout(resolve, 10))

			// Act
			savedCountry.name = 'Federal Republic of Germany'
			const updatedCountry = await repository.save(savedCountry)

			// Assert
			expect(updatedCountry.lastModified.getTime()).toBeGreaterThan(
				originalLastModified.getTime(),
			)
		})

		it('should NOT update created timestamp on update', async () => {
			// Arrange
			const repository = dataSource.getRepository(CountryEntity)
			const country = repository.create({
				name: 'France',
				alpha2: 'FR',
				alpha3: 'FRA',
				number: 250,
				dialingCode: 33,
			})
			const savedCountry = await repository.save(country)
			const originalCreated = savedCountry.created

			// Wait a bit
			await new Promise(resolve => setTimeout(resolve, 10))

			// Act
			savedCountry.name = 'French Republic'
			const updatedCountry = await repository.save(savedCountry)

			// Assert
			expect(updatedCountry.created.getTime()).toBe(originalCreated.getTime())
		})

		it('should update modifiedBy on update when explicitly set', async () => {
			// Arrange
			const repository = dataSource.getRepository(CountryEntity)
			const country = repository.create({
				name: 'Japan',
				alpha2: 'JP',
				alpha3: 'JPN',
				number: 392,
				dialingCode: 81,
			})
			const savedCountry = await repository.save(country)

			// Act
			savedCountry.name = 'State of Japan'
			savedCountry.modifiedBy = 'user-456'
			const updatedCountry = await repository.save(savedCountry)

			// Assert
			expect(updatedCountry.modifiedBy).toBe('user-456')
		})
	})

	describe('Audit field persistence', () => {
		it('should persist all audit fields to database', async () => {
			// Arrange
			const repository = dataSource.getRepository(CountryEntity)
			const country = repository.create({
				name: 'Australia',
				alpha2: 'AU',
				alpha3: 'AUS',
				number: 36,
				dialingCode: 61,
				modifiedBy: 'test-user',
			})
			await repository.save(country)

			// Act - Fetch from database
			const fetchedCountry = await repository.findOne({
				where: { alpha2: 'AU' },
			})

			// Assert
			expect(fetchedCountry).not.toBeNull()
			expect(fetchedCountry!.created).toBeInstanceOf(Date)
			expect(fetchedCountry!.lastModified).toBeInstanceOf(Date)
			expect(fetchedCountry!.modifiedBy).toBe('test-user')
		})
	})
})
