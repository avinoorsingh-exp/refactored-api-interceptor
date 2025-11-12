import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryFailedError } from 'typeorm';
import { ConflictException } from '@nestjs/common';
import type { ICountriesRepository } from './ports/countries.repository.port.js';
import type { NormalizedPagination, PageResult } from '../../common/ports/pagination.types.js';
import { CountryEntity } from '@exprealty/database';
import type { Country, CreateCountryInput } from '@exprealty/shared-domain';

/**
 * Maps a CountryEntity (infrastructure) to Country domain type.
 * This keeps the domain pure and independent of database implementation.
 */
const mapEntity = (e: CountryEntity): Country => ({
  countryId: e.countryId,
  name: e.name,
  alpha2: e.alpha2,
  alpha3: e.alpha3,
  number: e.number,
  dialingCode: e.dialingCode,
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
export class CountriesTypeOrmRepository implements ICountriesRepository {
  constructor(
    @InjectRepository(CountryEntity)
    private readonly repo: Repository<CountryEntity>,
  ) {}

  /**
   * Find a country by its numeric ID.
   */
  async findById(id: number): Promise<Country | null> {
    const entity = await this.repo.findOne({ where: { countryId: id } });
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
   * Retrieve a paginated list of countries sorted by alpha-2 code ascending.
   */
  async findPage(p: NormalizedPagination): Promise<PageResult<Country>> {
    const [entities, total] = await this.repo.findAndCount({
      order: { alpha2: 'ASC' },
      skip: p.offset,
      take: p.limit,
    });

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
   */
  async update(id: number, patch: Partial<Country>): Promise<Country> {
    await this.repo.update({ countryId: id }, patch);
    const updated = await this.repo.findOneOrFail({ where: { countryId: id } });
    return mapEntity(updated);
  }

  /**
   * Delete a country by ID.
   */
  async delete(id: number): Promise<void> {
    await this.repo.delete({ countryId: id });
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
