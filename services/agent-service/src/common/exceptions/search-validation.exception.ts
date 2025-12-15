import { HttpStatus } from '@nestjs/common';
import { DomainException } from './domain.exception.js';

/**
 * Validation constraints that caused the error
 */
export interface SearchValidationConstraints {
  min?: number | Date;
  max?: number | Date;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  enum?: any[];
}

/**
 * Search Validation Exception
 * 
 * Thrown when a search term fails validation against field constraints.
 * Includes i18n type for internationalization support.
 * 
 * Pure data container - ProblemDetailsFilter handles formatting
 */
export class SearchValidationException extends DomainException {
  /**
   * i18n type for internationalization (e.g., 'agent.search.out_of_range')
   */
  public readonly i18nType: string;

  constructor(
    public readonly field: string,
    public readonly searchTerm: string,
    public readonly validationError: string,
    public readonly validation?: SearchValidationConstraints,
    i18nType?: string,
  ) {
    super(
      validationError,
      HttpStatus.BAD_REQUEST,
      {
        field,
        searchTerm,
        validation,
      },
    );
    // Default i18n type based on validation type, or use provided one
    this.i18nType = i18nType ?? SearchValidationException.inferI18nType(field, validation);
  }

  /**
   * Infer i18n type from field and validation constraints
   */
  private static inferI18nType(field: string, validation?: SearchValidationConstraints): string {
    if (!validation) {
      return 'agent.search.invalid_value';
    }
    // Check if min/max are present (even if undefined, the keys exist for range errors)
    if ('min' in validation || 'max' in validation) {
      return 'agent.search.out_of_range';
    }
    if (validation.minLength !== undefined || validation.maxLength !== undefined) {
      return 'agent.search.invalid_length';
    }
    if (validation.pattern !== undefined) {
      return 'agent.search.invalid_format';
    }
    if (validation.enum !== undefined) {
      return 'agent.search.invalid_enum';
    }
    return 'agent.search.validation_failed';
  }
}