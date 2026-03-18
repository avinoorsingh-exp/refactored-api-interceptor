
import { ConflictException, BadRequestException } from '@nestjs/common';

export interface DatabaseError extends Error {
  code?: string;
  constraint?: string;
  detail?: string;
  table?: string;
  column?: string;
  schema?: string;
}

export class DatabaseErrorHandler {
  /**
   * Check if error is a PostgreSQL error
   */
  static isDatabaseError(error: any): error is DatabaseError {
    return error && typeof error.code === 'string' && error.code.startsWith('23');
  }

  /**
   * Check if error is a unique constraint violation
   */
  static isUniqueViolation(error: any): boolean {
    return this.isDatabaseError(error) && error.code === '23505';
  }

  /**
   * Check if error is a foreign key violation
   */
  static isForeignKeyViolation(error: any): boolean {
    return this.isDatabaseError(error) && error.code === '23503';
  }

  /**
   * Check if error is a not null violation
   */
  static isNotNullViolation(error: any): boolean {
    return this.isDatabaseError(error) && error.code === '23502';
  }

  /**
   * Extract field name from constraint name
   * Example: 'orders_email_key' -> 'email'
   * Example: 'users_username_unique' -> 'username'
   */
  static extractFieldFromConstraint(constraintName: string, tableName?: string): string {
    if (!constraintName) return 'unknown';

    // Remove table name prefix if present
    let field = constraintName;
    if (tableName) {
      field = field.replace(new RegExp(`^${tableName}_`, 'i'), '');
    }

    // Remove common suffixes
    field = field.replace(/_key$/i, '');
    field = field.replace(/_unique$/i, '');
    field = field.replace(/_idx$/i, '');
    field = field.replace(/_pkey$/i, '');

    return field;
  }

  /**
   * Extract value from detail message
   * Example: 'Key (email)=(john@example.com) already exists.' -> 'john@example.com'
   */
  static extractValueFromDetail(detail: string): string | null {
    const match = detail.match(/\(([^)]+)\)=\(([^)]+)\)/);
    return match ? match[2] : null;
  }

  /**
   * Parse composite key fields from detail
   * Example: 'Key (listing_id, modification_timestamp)=(123, 2024-01-01) already exists.'
   * Returns: ['listing_id', 'modification_timestamp']
   */
  static extractCompositeFields(detail: string): string[] {
    const match = detail.match(/\(([^)]+)\)=/);
    if (!match) return [];
    
    return match[1].split(',').map(f => f.trim());
  }

  /**
   * Create a user-friendly error message
   */
  static createFriendlyMessage(error: DatabaseError): string {
    const { code, constraint, detail, table } = error;

    if (code === '23505') {
      const field = this.extractFieldFromConstraint(constraint || '', table);
      const value = detail ? this.extractValueFromDetail(detail) : null;
      
      if (value) {
        return `A record with ${field} '${value}' already exists`;
      }
      
      return `A record with this ${field} already exists`;
    }

    if (code === '23503') {
      return 'Referenced record does not exist';
    }

    if (code === '23502') {
      const field = error.column || 'field';
      return `${field} is required`;
    }

    return 'Database constraint violation';
  }

  /**
   * Transform database error to appropriate HTTP exception
   */
  static toHttpException(error: DatabaseError): Error {
    const message = this.createFriendlyMessage(error);
    const { code, constraint, table } = error;

    if (code === '23505') {
      return new ConflictException({
        statusCode: 409,
        message,
        error: 'Conflict',
        details: {
          code,
          constraint,
          table,
        },
      });
    }

    if (code === '23503' || code === '23502') {
      return new BadRequestException({
        statusCode: 400,
        message,
        error: 'Bad Request',
        details: {
          code,
          constraint,
          table,
        },
      });
    }

    // Unknown database error - let it bubble as 500
    return error;
  }
}