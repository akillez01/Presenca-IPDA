import { NextFunction, Request, Response } from 'express';

export interface ErrorResponse {
  success: false;
  message: string;
  error?: any;
  timestamp: string;
}

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('❌ Erro:', err);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Erro interno do servidor';

  const response: ErrorResponse = {
    success: false,
    message,
    timestamp: new Date().toISOString(),
  };

  if (process.env.NODE_ENV === 'development') {
    response.error = err;
  }

  res.status(statusCode).json(response);
};
