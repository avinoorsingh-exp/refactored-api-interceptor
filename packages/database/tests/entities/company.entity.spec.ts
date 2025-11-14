import { DataSource } from 'typeorm'
import { CompanyEntity } from '../../src/entities/core/company.entity.js'

describe('CompanyEntity - Auditable Fields', () => {
	let dataSource: DataSource

	beforeAll(async () => {
		// Create in-memory SQLite database for testing
		dataSource = new DataSource({
			type: 'sqlite',
			database: ':memory:',
			synchronize: true,
			logging: false,
			entities: [CompanyEntity],
		})
		await dataSource.initialize()
	})

	afterAll(async () => {
		await dataSource.destroy()
	})

	afterEach(async () => {
		// Clean up after each test
		const repository = dataSource.getRepository(CompanyEntity)
		await repository.clear()
	})

	describe('Audit field auto-population', () => {
		it('should auto-populate created timestamp on insert', async () => {
			// Arrange
			const repository = dataSource.getRepository(CompanyEntity)
			const company = repository.create({
				name: 'Acme Corporation',
				email: 'contact@acme.com',
			})

			// Act
			const savedCompany = await repository.save(company)

			// Assert
			expect(savedCompany.created).toBeDefined()
			expect(savedCompany.created).toBeInstanceOf(Date)
			expect(savedCompany.created.getTime()).toBeLessThanOrEqual(Date.now())
		})

		it('should auto-populate lastModified timestamp on insert', async () => {
			// Arrange
			const repository = dataSource.getRepository(CompanyEntity)
			const company = repository.create({
				name: 'Global Tech Inc',
				email: 'info@globaltech.com',
			})

			// Act
			const savedCompany = await repository.save(company)

			// Assert
			expect(savedCompany.lastModified).toBeDefined()
			expect(savedCompany.lastModified).toBeInstanceOf(Date)
			expect(savedCompany.lastModified.getTime()).toBeLessThanOrEqual(Date.now())
		})

		it('should default modifiedBy to "system" on insert', async () => {
			// Arrange
			const repository = dataSource.getRepository(CompanyEntity)
			const company = repository.create({
				name: 'Innovative Solutions LLC',
				email: 'hello@innovate.com',
			})

			// Act
			const savedCompany = await repository.save(company)

			// Assert
			expect(savedCompany.modifiedBy).toBe('system')
		})

		it('should allow setting custom modifiedBy on insert', async () => {
			// Arrange
			const repository = dataSource.getRepository(CompanyEntity)
			const company = repository.create({
				name: 'Premier Services',
				email: 'contact@premier.com',
				modifiedBy: 'admin-user-123',
			})

			// Act
			const savedCompany = await repository.save(company)

			// Assert
			expect(savedCompany.modifiedBy).toBe('admin-user-123')
		})

		it('should update lastModified timestamp on update', async () => {
			// Arrange
			const repository = dataSource.getRepository(CompanyEntity)
			const company = repository.create({
				name: 'Beta Company',
				email: 'info@beta.com',
			})
			const savedCompany = await repository.save(company)
			const originalLastModified = savedCompany.lastModified

			// Wait a bit to ensure timestamp difference
			await new Promise(resolve => setTimeout(resolve, 10))

			// Act
			savedCompany.name = 'Beta Corporation' as any
			const updatedCompany = await repository.save(savedCompany)

			// Assert
			expect(updatedCompany.lastModified.getTime()).toBeGreaterThan(
				originalLastModified.getTime(),
			)
		})

		it('should NOT update created timestamp on update', async () => {
			// Arrange
			const repository = dataSource.getRepository(CompanyEntity)
			const company = repository.create({
				name: 'Gamma Industries',
				email: 'contact@gamma.com',
			})
			const savedCompany = await repository.save(company)
			const originalCreated = savedCompany.created

			// Wait a bit
			await new Promise(resolve => setTimeout(resolve, 10))

			// Act
			savedCompany.email = 'info@gamma.com' as any
			const updatedCompany = await repository.save(savedCompany)

			// Assert
			expect(updatedCompany.created.getTime()).toBe(originalCreated.getTime())
		})

		it('should update modifiedBy on update when explicitly set', async () => {
			// Arrange
			const repository = dataSource.getRepository(CompanyEntity)
			const company = repository.create({
				name: 'Delta Enterprises',
				email: 'hello@delta.com',
			})
			const savedCompany = await repository.save(company)

			// Act
			savedCompany.name = 'Delta Corporation' as any
			savedCompany.modifiedBy = 'user-456'
			const updatedCompany = await repository.save(savedCompany)

			// Assert
			expect(updatedCompany.modifiedBy).toBe('user-456')
		})
	})

	describe('Audit field persistence', () => {
		it('should persist all audit fields to database', async () => {
			// Arrange
			const repository = dataSource.getRepository(CompanyEntity)
			const company = repository.create({
				name: 'Epsilon Group',
				email: 'contact@epsilon.com',
				modifiedBy: 'test-user',
			})
			await repository.save(company)

			// Act - Fetch from database
			const fetchedCompany = await repository.findOne({
				where: { email: 'contact@epsilon.com' as any },
			})

			// Assert
			expect(fetchedCompany).not.toBeNull()
			expect(fetchedCompany!.created).toBeInstanceOf(Date)
			expect(fetchedCompany!.lastModified).toBeInstanceOf(Date)
			expect(fetchedCompany!.modifiedBy).toBe('test-user')
		})
	})

	describe('Integration with business logic', () => {
		it('should track creation and modification for audit trail', async () => {
			// Arrange
			const repository = dataSource.getRepository(CompanyEntity)
			
			// Act - Create
			const company = repository.create({
				name: 'Zeta Technologies',
				email: 'info@zeta.tech',
				modifiedBy: 'user-123',
			})
			const created = await repository.save(company)
			
			// Wait and update
			await new Promise(resolve => setTimeout(resolve, 10))
			created.name = 'Zeta Tech Solutions' as any
			created.modifiedBy = 'user-456'
			const updated = await repository.save(created)

			// Assert
			expect(updated.created).toEqual(created.created)
			expect(updated.lastModified.getTime()).toBeGreaterThan(created.lastModified.getTime())
			expect(updated.modifiedBy).toBe('user-456')
		})

		it('should maintain email uniqueness constraint with audit fields', async () => {
			// Arrange
			const repository = dataSource.getRepository(CompanyEntity)
			const company1 = repository.create({
				name: 'Theta Corp',
				email: 'duplicate@test.com',
			})
			await repository.save(company1)

			// Act & Assert
			const company2 = repository.create({
				name: 'Theta LLC',
				email: 'duplicate@test.com',
			})

			await expect(repository.save(company2)).rejects.toThrow()
		})
	})
})
