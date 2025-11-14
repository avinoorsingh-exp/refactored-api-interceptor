import { DataSource } from 'typeorm'
import { RegionEntity } from '../../src/entities/core/region.entity.js'

describe('RegionEntity - Auditable Fields', () => {
	let dataSource: DataSource

	beforeAll(async () => {
		// Create in-memory SQLite database for testing
		dataSource = new DataSource({
			type: 'sqlite',
			database: ':memory:',
			synchronize: true,
			logging: false,
			entities: [RegionEntity],
		})
		await dataSource.initialize()
	})

	afterAll(async () => {
		await dataSource.destroy()
	})

	afterEach(async () => {
		// Clean up after each test
		const repository = dataSource.getRepository(RegionEntity)
		await repository.clear()
	})

	describe('Audit field auto-population', () => {
		it('should auto-populate created timestamp on insert', async () => {
			// Arrange
			const repository = dataSource.getRepository(RegionEntity)
			const region = repository.create({
				name: 'Pacific Northwest',
			})

			// Act
			const savedRegion = await repository.save(region)

			// Assert
			expect(savedRegion.created).toBeDefined()
			expect(savedRegion.created).toBeInstanceOf(Date)
			expect(savedRegion.created.getTime()).toBeLessThanOrEqual(Date.now())
		})

		it('should auto-populate lastModified timestamp on insert', async () => {
			// Arrange
			const repository = dataSource.getRepository(RegionEntity)
			const region = repository.create({
				name: 'Southwest',
			})

			// Act
			const savedRegion = await repository.save(region)

			// Assert
			expect(savedRegion.lastModified).toBeDefined()
			expect(savedRegion.lastModified).toBeInstanceOf(Date)
			expect(savedRegion.lastModified.getTime()).toBeLessThanOrEqual(Date.now())
		})

		it('should default modifiedBy to "system" on insert', async () => {
			// Arrange
			const repository = dataSource.getRepository(RegionEntity)
			const region = repository.create({
				name: 'Midwest',
			})

			// Act
			const savedRegion = await repository.save(region)

			// Assert
			expect(savedRegion.modifiedBy).toBe('system')
		})

		it('should allow setting custom modifiedBy on insert', async () => {
			// Arrange
			const repository = dataSource.getRepository(RegionEntity)
			const region = repository.create({
				name: 'Northeast',
				modifiedBy: 'admin-user-123',
			})

			// Act
			const savedRegion = await repository.save(region)

			// Assert
			expect(savedRegion.modifiedBy).toBe('admin-user-123')
		})

		it('should update lastModified timestamp on update', async () => {
			// Arrange
			const repository = dataSource.getRepository(RegionEntity)
			const region = repository.create({
				name: 'Southeast',
			})
			const savedRegion = await repository.save(region)
			const originalLastModified = savedRegion.lastModified

			// Wait a bit to ensure timestamp difference
			await new Promise(resolve => setTimeout(resolve, 10))

			// Act
			savedRegion.name = 'Southern Region'
			const updatedRegion = await repository.save(savedRegion)

			// Assert
			expect(updatedRegion.lastModified.getTime()).toBeGreaterThan(
				originalLastModified.getTime(),
			)
		})

		it('should NOT update created timestamp on update', async () => {
			// Arrange
			const repository = dataSource.getRepository(RegionEntity)
			const region = repository.create({
				name: 'Mountain West',
			})
			const savedRegion = await repository.save(region)
			const originalCreated = savedRegion.created

			// Wait a bit
			await new Promise(resolve => setTimeout(resolve, 10))

			// Act
			savedRegion.name = 'Rocky Mountain Region'
			const updatedRegion = await repository.save(savedRegion)

			// Assert
			expect(updatedRegion.created.getTime()).toBe(originalCreated.getTime())
		})

		it('should update modifiedBy on update when explicitly set', async () => {
			// Arrange
			const repository = dataSource.getRepository(RegionEntity)
			const region = repository.create({
				name: 'Central',
			})
			const savedRegion = await repository.save(region)

			// Act
			savedRegion.name = 'Central Region'
			savedRegion.modifiedBy = 'user-456'
			const updatedRegion = await repository.save(savedRegion)

			// Assert
			expect(updatedRegion.modifiedBy).toBe('user-456')
		})
	})

	describe('Audit field persistence', () => {
		it('should persist all audit fields to database', async () => {
			// Arrange
			const repository = dataSource.getRepository(RegionEntity)
			const region = repository.create({
				name: 'Great Plains',
				modifiedBy: 'test-user',
			})
			await repository.save(region)

			// Act - Fetch from database
			const fetchedRegion = await repository.findOne({
				where: { name: 'Great Plains' },
			})

			// Assert
			expect(fetchedRegion).not.toBeNull()
			expect(fetchedRegion!.created).toBeInstanceOf(Date)
			expect(fetchedRegion!.lastModified).toBeInstanceOf(Date)
			expect(fetchedRegion!.modifiedBy).toBe('test-user')
		})
	})

	describe('Integration with business logic', () => {
		it('should track creation and modification for audit trail', async () => {
			// Arrange
			const repository = dataSource.getRepository(RegionEntity)
			
			// Act - Create
			const region = repository.create({
				name: 'Atlantic Coast',
				modifiedBy: 'user-123',
			})
			const created = await repository.save(region)
			
			// Wait and update
			await new Promise(resolve => setTimeout(resolve, 10))
			created.name = 'Atlantic Seaboard'
			created.modifiedBy = 'user-456'
			const updated = await repository.save(created)

			// Assert
			expect(updated.created).toEqual(created.created)
			expect(updated.lastModified.getTime()).toBeGreaterThan(created.lastModified.getTime())
			expect(updated.modifiedBy).toBe('user-456')
		})
	})
})
