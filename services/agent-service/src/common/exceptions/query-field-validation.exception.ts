import { HttpStatus } from '@nestjs/common';
import { DomainException } from './domain.exception.js';

/**
 * Query operation type for i18n type inference
 */
export type QueryOperationType = 'filter' | 'sort' | 'search';

/**
 * Query Field Validation Exception
 * 
 * Thrown when a query field (filter, sort, or search) is not in the allowed fields list.
 * This is distinct from value validation exceptions (FilterValidationException, etc.)
 * which handle invalid values for valid fields.
 * 
 * Pure data container - ProblemDetailsFilter handles formatting
 */
export class QueryFieldValidationException extends DomainException {
  /**
   * i18n type for internationalization
   */
  public readonly i18nType: string;

  constructor(
    public readonly operationType: QueryOperationType,
    public readonly invalidFields: string[],
    public readonly allowedFields: string[],
    i18nType?: string,
  ) {
    const message = `Invalid ${operationType} fields: ${invalidFields.join(', ')}. Allowed fields: ${allowedFields.join(', ')}`;
    
    super(
      message,
      HttpStatus.BAD_REQUEST,
      {
        operationType,
        invalidFields,
        allowedFields,
      },
    );
    
    this.i18nType = i18nType ?? `entity.validation.${operationType}_field_not_allowed`;
  }
}
