import { NextResponse } from "next/server";
import { logger, createErrorResponse, ERROR_TYPES, type APIErrorResponse } from "../utils/logger";

/**
 * Handle API errors consistently
 */
export function handleAPIError(error: unknown, contextOrStatus?: string | number, status: number = 500): NextResponse<APIErrorResponse> {
  // Default error response
  let errorType: keyof typeof ERROR_TYPES = "INTERNAL_ERROR";
  let message = "An unexpected error occurred";
  let responseStatus = status;
  let details: Record<string, unknown> | undefined;

  // Handle if contextOrStatus is a number (for backward compatibility)
  const context = typeof contextOrStatus === 'string' ? contextOrStatus : undefined;
  if (typeof contextOrStatus === 'number') {
    responseStatus = contextOrStatus;
  }

  // Log the error
  logger.error(`API Error${context ? ` in ${context}` : ""}`, error instanceof Error ? error : new Error(String(error)), {
    context,
  });

  // Handle known error types
  if (error instanceof Error) {
    message = error.message;
    details = {
      name: error.name,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    };
  }

  // Handle specific error types by checking error message or custom error types
  if (error instanceof TypeError) {
    errorType = "VALIDATION_ERROR";
    responseStatus = 400;
  }

  // Create and return error response
  const { response } = createErrorResponse(ERROR_TYPES[errorType], message, details, responseStatus);
  return NextResponse.json(response, { status: responseStatus });
}

/**
 * Handle validation errors
 */
export function handleValidationError(message: string, details?: Record<string, unknown>): NextResponse<APIErrorResponse> {
  logger.warn(`Validation error: ${message}`, details);

  const { response } = createErrorResponse(ERROR_TYPES.VALIDATION_ERROR, message, details, 400);
  return NextResponse.json(response, { status: 400 });
}

/**
 * Handle not found errors
 */
export function handleNotFoundError(resource: string, id: string): NextResponse<APIErrorResponse> {
  const message = `${resource} not found: ${id}`;
  logger.warn(message, { resource, id });

  const { response } = createErrorResponse(ERROR_TYPES.NOT_FOUND, message, { resource, id }, 404);
  return NextResponse.json(response, { status: 404 });
}

/**
 * Handle conflict errors
 */
export function handleConflictError(message: string, details?: Record<string, unknown>): NextResponse<APIErrorResponse> {
  logger.warn(`Conflict error: ${message}`, details);

  const { response } = createErrorResponse(ERROR_TYPES.CONFLICT, message, details, 409);
  return NextResponse.json(response, { status: 409 });
}

/**
 * Handle unauthorized errors
 */
export function handleUnauthorizedError(message: string = "Unauthorized"): NextResponse<APIErrorResponse> {
  logger.warn(`Unauthorized access: ${message}`);

  const { response } = createErrorResponse(ERROR_TYPES.UNAUTHORIZED, message, undefined, 401);
  return NextResponse.json(response, { status: 401 });
}

/**
 * Handle forbidden errors
 */
export function handleForbiddenError(message: string = "Forbidden"): NextResponse<APIErrorResponse> {
  logger.warn(`Forbidden access: ${message}`);

  const { response } = createErrorResponse(ERROR_TYPES.FORBIDDEN, message, undefined, 403);
  return NextResponse.json(response, { status: 403 });
}

/**
 * Wrap async API route handlers with error handling
 */
export function withErrorHandler(
  handler: () => Promise<NextResponse>,
  context?: string
): Promise<NextResponse> {
  return handler().catch((error) => handleAPIError(error, context));
}

/**
 * Success response helper
 */
export function handleSuccess<T>(data: T, status: number = 200): NextResponse<T> {
  return NextResponse.json(data, { status });
}

/**
 * Created response helper (201)
 */
export function handleCreated<T>(data: T): NextResponse<T> {
  return NextResponse.json(data, { status: 201 });
}
