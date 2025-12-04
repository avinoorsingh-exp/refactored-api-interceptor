import { QueryParams } from "@exprealty/shared-domain"
import { Repository } from "typeorm/browser/repository/Repository.js";

export interface IRepository<T, ID = string> {
    findAll(params: QueryParams): Promise<{ items: T[]; total: number }>
    findById(id: ID): Promise<T | null>
    create(data: Partial<T>): Promise<T>
    update(id: ID, data: Partial<T>): Promise<T>
    delete(id: ID): Promise<void>
}
