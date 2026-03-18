import { HttpStatus } from '@nestjs/common';
import { DomainException } from './domain.exception.js';

/**
 * Filter Validation Exception
 * 
 * Thrown when a filter fails validation against field constraints.
 * Includes i18n type for internationalization support.
 * 
 * Pure data container - ProblemDetailsFilter handles formatting
 */
export class FilterValidationException extends DomainException {
  /**
   * i18n type for internationalization (e.g., 'agent.filter.invalid_operator')
   */
  public readonly i18nType: string;

  constructor(
    public readonly field: string,
    public readonly operator: string,
    public readonly value: any,
    public readonly validationError: string,
    i18nType?: string,
  ) {
    super(
      validationError,
      HttpStatus.BAD_REQUEST,
      {
        field,
        operator,
        value,
      },
    );
    // Default i18n type based on error type, or use provided one
    this.i18nType = i18nType ?? FilterValidationException.inferI18nType(operator);
  }

  /**
   * Infer i18n type from operator
   */
  private static inferI18nType(operator: string): string {
    const validOperators = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'nin', 'like', 'ilike'];
    if (!validOperators.includes(operator)) {
      return 'agent.filter.invalid_operator';
    }
    return 'agent.filter.invalid_value';
  }
}