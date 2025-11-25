import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { ICompaniesRepository } from  './ports/companies.repository.port.js';
import type { NormalizedPagination, PageResult } from '../../common/ports/pagination.types.js';
import { CompanyEntity } from '@exprealty/database'
import type { Company } from '@exprealty/shared-domain'

const mapEntity = (e: CompanyEntity): Company => ({
  id: e.id,
  name: e.name,
  email: e.email,
  created: e.created,
  lastModified: e.lastModified,
  modifiedBy: e.modifiedBy,
});

@Injectable()
export class CompaniesTypeOrmRepository implements ICompaniesRepository {
  constructor(@InjectRepository(CompanyEntity) private readonly repo: Repository<CompanyEntity>) {}
  async findById(id: string): Promise<Company | null> {
    const e = await this.repo.findOne({ where: { id: id } });
    return e ? mapEntity(e) : null;
    // (If you need tenant scoping, add it here.)
  }

  async findPage(p: NormalizedPagination): Promise<PageResult<Company>> {
    const qb = this.repo.createQueryBuilder('w')
      .orderBy('w.created', 'ASC').addOrderBy('w.id', 'ASC')
      .skip(p.offset).take(p.limit);

    const [rows, total] = await qb.getManyAndCount();
    return { items: rows.map(mapEntity), total };
  }

  async searchByNameFragment(p: NormalizedPagination, q: string): Promise<PageResult<Company>> {
    const qb = this.repo.createQueryBuilder('w')
      .where('w.name ILIKE :q', { q: `%${q}%` })
      .orderBy('w.created', 'ASC').addOrderBy('w.id', 'ASC')
      .skip(p.offset).take(p.limit);

    const [rows, total] = await qb.getManyAndCount();
    return { items: rows.map(mapEntity), total };
  }

  async create(entity: Omit<Company, 'id'>): Promise<Company> {
    const saved = await this.repo.save(this.repo.create(entity));
    return mapEntity(saved);
  }

  async update(id: string, patch: Partial<Company>): Promise<Company> {
    await this.repo.update({ id }, patch);
    const updated = await this.repo.findOneOrFail({ where: { id } });
    return mapEntity(updated);
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete({ id });
  }
}
