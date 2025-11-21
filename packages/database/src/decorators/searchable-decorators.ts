
import 'reflect-metadata';

const SEARCHABLE_FIELDS_KEY = Symbol('searchableFields');
const FILTERABLE_FIELDS_KEY = Symbol('filterableFields');
const SORTABLE_FIELDS_KEY = Symbol('sortableFields');

export function Searchable() {
  return function (target: any, propertyKey: string) {
    const existingFields = Reflect.getMetadata(SEARCHABLE_FIELDS_KEY, target.constructor) || [];
    Reflect.defineMetadata(
      SEARCHABLE_FIELDS_KEY,
      [...existingFields, propertyKey],
      target.constructor
    );
  };
}

export function Filterable() {
  return function (target: any, propertyKey: string) {
    const existingFields = Reflect.getMetadata(FILTERABLE_FIELDS_KEY, target.constructor) || [];
    Reflect.defineMetadata(
      FILTERABLE_FIELDS_KEY,
      [...existingFields, propertyKey],
      target.constructor
    );
  };
}

export function Sortable() {
  return function (target: any, propertyKey: string) {
    const existingFields = Reflect.getMetadata(SORTABLE_FIELDS_KEY, target.constructor) || [];
    Reflect.defineMetadata(
      SORTABLE_FIELDS_KEY,
      [...existingFields, propertyKey],
      target.constructor
    );
  };
}

export function getSearchableFields(target: any): string[] {
  return Reflect.getMetadata(SEARCHABLE_FIELDS_KEY, target) || [];
}

export function getFilterableFields(target: any): string[] {
  return Reflect.getMetadata(FILTERABLE_FIELDS_KEY, target) || [];
}

export function getSortableFields(target: any): string[] {
  return Reflect.getMetadata(SORTABLE_FIELDS_KEY, target) || [];
}