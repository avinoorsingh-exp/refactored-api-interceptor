import type { IRepository } from '../../../common/ports/repository.base.js';
import type { Country, CreateCountryInput } from '@exprealty/shared-domain';

/**
 * Port (interface) for Countries repository operations.
 * Defines the contract that any countries data source must implement.
 * 
 * This abstraction allows the service layer to depend on an interface
 * rather than a concrete TypeORM implementation, enabling:
 * - Easy unit testing with mocks
 * - Swapping implementations (TypeORM, Prisma, in-memory, etc.)
 * - Clean separation between domain logic and infrastructure
 */
export interface ICountriesRepository extends IRepository<number, Country> {
  /**
   * Find all countries (for lookup lists).
   *
   * @returns All countries ordered by alpha2 ASC
   */
  findAll(): Promise<Country[]>;

  /**
   * Find a country by its alpha-2 code (e.g., "US", "CA").
   * 
   * @param code - The ISO 3166-1 alpha-2 country code
   * @returns The country if found, null otherwise
   */
  findByCode(code: string): Promise<Country | null>;

  /**
   * Create a new country.
   * 
   * @param data - Country input data (without countryId which is auto-generated)
   * @returns The created country with generated countryId
   */
  create(data: CreateCountryInput): Promise<Country>;

  /**
   * Upsert a country: create if doesn't exist, update if it does.
   * Uses alpha2 code as the conflict key.
   * 
   * @param data - Country data to upsert
   * @returns Object containing the country and whether it was created (true) or updated (false)
   */
  upsert(data: CreateCountryInput): Promise<{ country: Country; created: boolean }>;
}
