import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Base Domain Exception
 * 
 * Pure data container - does NOT format as Problem Details
 * The ProblemDetailsFilter handles formatting
 * 
 * All domain exceptions should extend this class and provide:
 * - message: Human-readable error message
 * - status: HTTP status code
 * - context: Additional context for the error
 * - i18nType (optional): Internationalization type for client translation
 */
export abstract class DomainException extends HttpException {
  public readonly context: Record<string, any>;

  constructor(
    message: string,
    status: HttpStatus,
    context?: Record<string, any>,
  ) {
    super(message, status);
    this.context = context || {};
  }

  /**
   * Get exception context for formatting
   */
  getContext(): Record<string, any> {
    return this.context;
  }

  /**
   * Get i18n type for internationalization (override in subclasses)
   */
  getI18nType(): string | undefined {
    return (this as any).i18nType;
  }
}