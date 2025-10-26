import { Request, Response, NextFunction } from 'express'
import { ValidationError } from 'express-validator'

interface CustomError extends Error {
  statusCode?: number
  code?: number
  keyValue?: Record<string, any>
  errors?: Record<string, any>
}

export const errorHandler = (
  err: CustomError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let error = { ...err }
  error.message = err.message

  // Log error
  console.error('❌ Error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  })

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found'
    error = { message, statusCode: 404 } as CustomError
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0]
    const message = `${field} already exists`
    error = { message, statusCode: 400 } as CustomError
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors || {})
      .map((val: any) => val.message)
      .join(', ')
    error = { message, statusCode: 400 } as CustomError
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token'
    error = { message, statusCode: 401 } as CustomError
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired'
    error = { message, statusCode: 401 } as CustomError
  }

  // Rate limit error
  if (err.message && err.message.includes('Too many requests')) {
    error = { message: err.message, statusCode: 429 } as CustomError
  }

  res.status(error.statusCode || 500).json({
    success: false,
    error: error.message || 'Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  })
}
