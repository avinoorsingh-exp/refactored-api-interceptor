import { Filterable, Sortable, getFilterableFields, getSortableFields, getFilterableFieldsConfig } from './searchable-decorators.js';
import { StateEntity } from '../entities/core/state.entity.js';
import { AuditableEntity } from '../entities/core/auditable.entity.js';

describe('Decorator inheritance chain traversal', () => {
  describe('getFilterableFields', () => {
    it('should recognize isActive field from StateEntity as filterable', () => {
      const fields = getFilterableFields(StateEntity);
      expect(fields).toContain('isActive');
    });

    it('should recognize modifiedBy field from parent AuditableEntity as filterable', () => {
      const fields = getFilterableFields(StateEntity);
      expect(fields).toContain('modifiedBy');
    });

    it('should recognize created field from parent AuditableEntity as filterable', () => {
      const fields = getFilterableFields(StateEntity);
      expect(fields).toContain('created');
    });

    it('should recognize lastModified field from parent AuditableEntity as filterable', () => {
      const fields = getFilterableFields(StateEntity);
      expect(fields).toContain('lastModified');
    });

    it('should recognize all StateEntity filterable fields including inherited ones', () => {
      const fields = getFilterableFields(StateEntity);
      // Fields from StateEntity
      expect(fields).toContain('id');
      expect(fields).toContain('name');
      expect(fields).toContain('code');
      expect(fields).toContain('isActive');
      expect(fields).toContain('email');
      expect(fields).toContain('signatureDistributionEmail');
      expect(fields).toContain('regionId');
      expect(fields).toContain('countryId');
      // Fields from parent AuditableEntity
      expect(fields).toContain('created');
      expect(fields).toContain('lastModified');
      expect(fields).toContain('modifiedBy');
    });
  });

  describe('getSortableFields', () => {
    it('should recognize modifiedBy field from parent AuditableEntity as sortable', () => {
      const fields = getSortableFields(StateEntity);
      expect(fields).toContain('modifiedBy');
    });

    it('should recognize created field from parent AuditableEntity as sortable', () => {
      const fields = getSortableFields(StateEntity);
      expect(fields).toContain('created');
    });

    it('should recognize lastModified field from parent AuditableEntity as sortable', () => {
      const fields = getSortableFields(StateEntity);
      expect(fields).toContain('lastModified');
    });
  });

  describe('getFilterableFieldsConfig', () => {
    it('should return config for inherited fields', () => {
      const config = getFilterableFieldsConfig(StateEntity);
      // Should have config for fields from both StateEntity and parent classes
      expect(config.size).toBeGreaterThan(0);
    });
  });
});
