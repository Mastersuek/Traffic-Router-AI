/**
 * Utility functions for error handling
 */

/**
 * Safely extracts error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  return String(error)
}

/**
 * Safely extracts error stack from unknown error type
 */
export function getErrorStack(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.stack
  }
  return undefined
}

/**
 * Creates a standardized error object from unknown error
 */
export function normalizeError(error: unknown): Error {
  if (error instanceof Error) {
    return error
  }
  return new Error(getErrorMessage(error))
}