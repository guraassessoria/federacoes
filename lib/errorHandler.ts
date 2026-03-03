export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// some environments may not have zod types available to the compiler, so use dynamic require
// declare require to avoid TS errors
declare var require: any;

export function handleApiError(error: unknown) {
  console.error('API Error:', error);

  if (error instanceof AppError) {
    return {
      status: error.statusCode,
      body: {
        error: error.message,
        code: error.code,
      },
    };
  }

  try {
    const { ZodError } = require('zod');
    if (error instanceof ZodError) {
      return {
        status: 400,
        body: {
          error: 'Validation error',
          details: (error as any).errors,
        },
      };
    }
  } catch (_e) {
    // zod not available or not an error
  }

  return {
    status: 500,
    body: {
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    },
  };
}
