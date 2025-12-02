/**
 * Error Handling Utilities
 */

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const handleError = (error: any, req: any, res: any, next: any) => {
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      success: false,
      error: error.message,
    });
  }

  console.error('Unhandled error:', error);
  return res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
};

