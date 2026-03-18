import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryFailedError } from 'typeorm';
import { ConflictException } from '@nestjs/common';
import type { ICountriesRepository } from './ports/countries.repository.port.js';
import type { PageResult } from '../../common/ports/pagination.types.js';
import { CountryEntity } from '@exprealty/database';
import type { Country, CreateCountryInput, QueryParams } from '@exprealty/shared-domain';
import { QueryService } from '../../common/query/query.service.js';

/**
 * Maps a CountryEntity (infrastructure) to Country domain type.
 * This keeps the domain pure and independent of database implementation.
 */
const mapEntity = (e: CountryEntity): Country => ({
  id: e.id,
  name: e.name,
  alpha2: e.alpha2,
  alpha3: e.alpha3,
  number: e.number,
  dialingCode: e.dialingCode,
  created: e.created,
  lastModified: e.lastModified,
  modifiedBy: e.modifiedBy,
});

/**
 * TypeORM adapter implementation of ICountriesRepository.
 * 
 * This is the "adapter" in hexagonal architecture - it adapts TypeORM
 * to the port interface defined by the domain layer.
 * 
 * Benefits:
 * - Service layer depends on ICountriesRepository interface, not this class
 * - Easy to swap for different implementation (Prisma, in-memory, etc.)
 * - Unit tests can mock the interface without needing TypeORM
 */
@Injectable()
export class CountriesRepository implements ICountriesRepository {
  constructor(
    @InjectRepository(CountryEntity)
    private readonly repo: Repository<CountryEntity>,
    private readonly queryService: QueryService,
  ) {}

  /**
   * Find all countries ordered by alpha2 ASC.
   */
  async findAll(): Promise<Country[]> {
    const entities = await this.repo.find({ order: { alpha2: 'ASC' } });
    return entities.map(mapEntity);
  }

  /**
   * Find a country by its numeric ID.
   */
  async findById(id: number): Promise<Country | null> {
    const entity = await this.repo.findOne({ where: { id } });
    return entity ? mapEntity(entity) : null;
  }

  /**
   * Find a country by its alpha-2 code (e.g., "US").
   */
  async findByCode(code: string): Promise<Country | null> {
    const entity = await this.repo.findOne({ where: { alpha2: code } });
    return entity ? mapEntity(entity) : null;
  }

  /**
   * Retrieve a paginated list of countries with optional filtering, sorting, and search.
   * Default sort: name ASC (AC-2)
   * Uses strategy-based search for type-aware searching on numeric fields.
   */
  async findPage(query: Partial<QueryParams>): Promise<PageResult<Country>> {
    // Validate and normalize query params using entity decorators
    const normalized = this.queryService.normalizeWithValidation(query, CountryEntity);

    // Build query with TypeORM query builder
    const qb = this.repo.createQueryBuilder('country');

    // Apply filters, search, and sorting with strategy-based search
    this.queryService.applyAllWithStrategies(qb, normalized, CountryEntity, 'country');

    // Default sort by name ASC if no sort specified (AC-2)
    if (!normalized.sort || normalized.sort.conditions.length === 0) {
      qb.orderBy('country.name', 'ASC');
    }

    // Apply pagination
    qb.skip(normalized.offset).take(normalized.limit);

    // Execute query
    const [entities, total] = await qb.getManyAndCount();

    return {
      items: entities.map(mapEntity),
      total,
    };
  }

  /**
   * Create a new country.
   * @throws ConflictException if alpha2, alpha3, or number already exists
   */
  async create(data: CreateCountryInput): Promise<Country> {
    try {
      const entity = this.repo.create(data);
      const saved = await this.repo.save(entity);
      return mapEntity(saved);
    } catch (error) {
      // Handle unique constraint violations
      if (error instanceof QueryFailedError) {
        const pgError = error as QueryFailedError & {
          code?: string;
          constraint?: string;
          detail?: string;
        };

        if (pgError.code === '23505') {
          // Determine which field caused the conflict
          const errorDetail = pgError.detail || '';
          let conflictField = 'code';
          let conflictValue = '';

          if (errorDetail.includes('alpha_2')) {
            conflictField = 'alpha-2';
            conflictValue = data.alpha2;
          } else if (errorDetail.includes('alpha_3')) {
            conflictField = 'alpha-3';
            conflictValue = data.alpha3;
          } else if (errorDetail.includes('number')) {
            conflictField = 'number';
            conflictValue = data.number.toString();
          }

          throw new ConflictException({
            message: `A country with ${conflictField} code '${conflictValue}' already exists`,
            i18nType: 'agent.country.duplicate_code',
          });
        }
      }
      throw error;
    }
  }

  /**
   * Update an existing country by ID.
   * @throws ConflictException if alpha2, alpha3, or number already exists (via DatabaseExceptionFilter)
   * @throws NotFoundException if country with given ID doesn't exist
   */
  async update(id: number, patch: Partial<Country>): Promise<Country> {
    await this.repo.update({ id }, patch);
    const updated = await this.repo.findOneOrFail({ where: { id } });
    return mapEntity(updated);
  }

  /**
   * Delete a country by ID.
   */
  async delete(id: number): Promise<void> {
    await this.repo.delete({ id });
  }

  /**
   * Upsert a country: create if doesn't exist, update if it does.
   * Uses alpha2 code as the conflict key.
   */
  async upsert(
    data: CreateCountryInput,
  ): Promise<{ country: Country; created: boolean }> {
    // Check if country already exists
    const existing = await this.repo.findOne({ where: { alpha2: data.alpha2 } });
    const wasCreated = !existing;

    // Perform upsert operation
    await this.repo.upsert(data, {
      conflictPaths: ['alpha2'],
      skipUpdateIfNoValuesChanged: true,
    });

    // Fetch the final country state
    const country = await this.repo.findOneOrFail({ where: { alpha2: data.alpha2 } });

    return {
      country: mapEntity(country),
      created: wasCreated,
    };
  }
}
