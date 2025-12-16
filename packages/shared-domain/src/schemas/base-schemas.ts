// packages/@trupryce/shared-domain/src/validation/schemas/base-schemas.ts

import { z } from 'zod';

/**
 * Trimmed string schema
 * Automatically trims leading/trailing whitespace
 */
export const trimmedString = () => 
  z.string().transform((val) => val.trim());

/**
 * Optional trimmed string
 */
export const trimmedStringOptional = () =>
  z.string().optional().transform((val) => val?.trim());

/**
 * Trimmed string with min length
 */
export const trimmedStringMin = (min: number, message?: string) =>
  z.string()
    .transform((val) => val.trim())
    .pipe(
      z.string().min(min, message || `Must be at least ${min} characters after trimming`)
    );

/**
 * Alternative: Validate on trimmed value in refine
 */
export const trimmedStringMinAlt = (min: number, message?: string) =>
  z.string()
    .transform((val) => val.trim())
    .refine(
      (val) => val.length >= min,
      { message: message || `Must be at least ${min} characters after trimming` }
    );

/**
 * Non-empty trimmed string
 * Rejects strings that are empty after trimming
 */
export const nonEmptyString = (message?: string) =>
  z.string()
    .transform((val) => val.trim())
    .pipe(
      z.string().min(1, message || 'Cannot be empty or only whitespace')
    );

/**
 * Trimmed string with max length
 */
export const trimmedStringMax = (max: number, message?: string) =>
  z.string()
    .transform((val) => val.trim())
    .pipe(
      z.string().max(max, message || `Must be at most ${max} characters`)
    );

/**
 * Trimmed string with min and max length
 */
export const trimmedStringMinMax = (
  min: number,
  max: number,
  message?: string
) =>
  z.string()
    .transform((val) => val.trim())
    .pipe(
      z.string()
        .min(min, message || `Must be between ${min} and ${max} characters`)
        .max(max, message || `Must be between ${min} and ${max} characters`)
    );

/**
 * Email (always trimmed and lowercased)
 */
export const emailString = (message?: string) =>
  z.string()
    .transform((val) => val.trim().toLowerCase())
    .pipe(
      z.string().email(message || 'Invalid email format')
    );

/**
 * URL (trimmed)
 */
export const urlString = (message?: string) =>
  z.string()
    .transform((val) => val.trim())
    .pipe(
      z.string().url(message || 'Invalid URL format')
    );

/**
 * Regex pattern with trim
 */
export const trimmedStringPattern = (pattern: RegExp, message?: string) =>
  z.string()
    .transform((val) => val.trim())
    .pipe(
      z.string().regex(pattern, message || 'Invalid format')
    );

/**
 * Enum with trim (for string enums)
 */
export const trimmedEnum = <T extends string>(
  values: readonly [T, ...T[]],
  message?: string
) =>
  z.string()
    .transform((val) => val.trim() as T)
    .pipe(
      z.enum(values, {
        errorMap: () => ({ 
          message: message || `Must be one of: ${values.join(', ')}` 
        })
      })
    );

/**
 * Alphanumeric only (trimmed)
 */
export const alphanumericString = (message?: string) =>
  z.string()
    .transform((val) => val.trim())
    .pipe(
      z.string().regex(
        /^[a-zA-Z0-9]+$/,
        message || 'Must contain only letters and numbers'
      )
    );

/**
 * Numeric string (trimmed, can be parsed to number)
 */
export const numericString = (message?: string) =>
  z.string()
    .transform((val) => val.trim())
    .pipe(
      z.string().regex(
        /^\d+$/,
        message || 'Must contain only digits'
      )
    );

/**
 * ZIP code (US 5-digit, trimmed)
 */
export const zipCodeString = (message?: string) =>
  z.string()
    .transform((val) => val.trim())
    .pipe(
      z.string().regex(
        /^\d{5}$/,
        message || 'Must be a valid 5-digit ZIP code'
      )
    );

/**
 * ZIP+4 code (US format, trimmed)
 */
export const zipPlus4String = (message?: string) =>
  z.string()
    .transform((val) => val.trim())
    .pipe(
      z.string().regex(
        /^\d{5}-?\d{4}$/,
        message || 'Must be a valid ZIP+4 code (12345-6789)'
      )
    );

/**
 * Phone number (US format, trimmed)
 */
export const phoneString = (message?: string) =>
  z.string()
    .transform((val) => val.trim())
    .pipe(
      z.string().regex(
        /^(\+1[-.]?)?\(?([0-9]{3})\)?[-.]?([0-9]{3})[-.]?([0-9]{4})$/,
        message || 'Must be a valid US phone number'
      )
    );

/**
 * Lifecycle status string (trimmed and lowercased)
 * Converts input to lowercase before enum validation
 * Use with .pipe() to validate against enum values
 * 
 * @example
 * const OfficeLifecycleStatus = lifecycleString().pipe(
 *   z.enum(['new', 'pending', 'active', 'inactive'])
 * );
 */
export const lifecycleString = () =>
  z.string()
    .transform((val) => val.trim().toLowerCase());

/**
 * Lifecycle enum with lowercase transformation
 * Automatically lowercases input before validating against enum values
 * 
 * @example
 * const OfficeLifecycleStatus = lifecycleEnum(
 *   ['new', 'pending', 'active', 'inactive'],
 *   'Invalid office lifecycle status'
 * );
 */
export const lifecycleEnum = <T extends string>(
  values: readonly [T, ...T[]],
  message?: string
) =>
  z.string()
    .transform((val) => val.trim().toLowerCase() as T)
    .pipe(
      z.enum(values, {
        errorMap: () => ({
          message: message || `Must be one of: ${values.join(', ')}`
        })
      })
    );

