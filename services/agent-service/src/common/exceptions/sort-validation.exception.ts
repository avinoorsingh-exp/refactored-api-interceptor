
import { HttpStatus } from '@nestjs/common';
import { DomainException } from './domain.exception.js';

export class SortValidationException extends DomainException {
  constructor(
    public readonly field: string,
    public readonly direction?: string,
    public readonly validationError?: string,
  ) {
    super(
      validationError || `Invalid sort field: ${field}`,
      HttpStatus.BAD_REQUEST,
      {
        field,
        direction,
      },
    );
  }
}