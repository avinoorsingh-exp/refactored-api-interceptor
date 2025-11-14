import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { IRegionsRepository } from './ports/regions.repository.port.js';
import type { NormalizedPagination, PageResult } from '../../common/ports/pagination.types.js';
import { RegionEntity } from '@exprealty/database';
import type { Region } from '@exprealty/shared-domain';

/**
 * Maps a TypeORM RegionEntity to a domain Region type.
 * Separates persistence concerns from domain model.
 */
const mapEntity = (e: RegionEntity): Region => ({
  id: e.id,
  name: e.name,
  created: e.created,
  lastModified: e.lastModified,
  modifiedBy: e.modifiedBy,
});

/**
 * TypeORM adapter implementing IRegionsRepository port.
 * This is the infrastructure layer - can be swapped without affecting business logic.
 */
@Injectable()
export class RegionsTypeOrmRepository implements IRegionsRepository {
  constructor(
    @InjectRepository(RegionEntity)
    private readonly repo: Repository<RegionEntity>,
  ) {}

  async findById(id: string): Promise<Region | null> {
    const entity = await this.repo.findOne({ where: { id } });
    return entity ? mapEntity(entity) : null;
  }

  async findByNormalizedName(normalizedName: string): Promise<Region | null> {
    const entity = await this.repo.findOne({ where: { name: normalizedName } });
    return entity ? mapEntity(entity) : null;
  }

  async findPage(p: NormalizedPagination): Promise<PageResult<Region>> {
    const [rows, total] = await this.repo.findAndCount({
      order: { name: 'ASC' }, // Sort by name ascending
      skip: p.offset,
      take: p.limit,
    });

    return {
      items: rows.map(mapEntity),
      total,
    };
  }

  async create(data: Omit<Region, 'id'>): Promise<Region> {
    const entity = this.repo.create(data);
    const saved = await this.repo.save(entity);
    return mapEntity(saved);
  }

  async update(id: string, patch: Partial<Region>): Promise<Region> {
    await this.repo.update({ id }, patch);
    const updated = await this.repo.findOneOrFail({ where: { id } });
    return mapEntity(updated);
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete({ id });
  }
}
