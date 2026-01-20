// Custom error class
class AppError extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Async handler wrapper
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Global error handler
const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Log error for debugging
  console.error('Error:', {
    message: err.message,
    statusCode: err.statusCode,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });

  // Log error in audit_logs if user is authenticated
  if (req.user) {
    const { pool } = require('../config/database');
    pool.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, changes, ip_address, user_agent, status, error_message) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        req.user.id,
        req.method + ' ' + req.path,
        'error',
        JSON.stringify({ body: req.body, params: req.params }),
        req.ip || req.connection.remoteAddress,
        req.get('user-agent'),
        'error',
        err.message,
      ]
    ).catch(logErr => console.error('Audit log error:', logErr));
  }

  // Send error response
  res.status(err.statusCode).json({
    status: err.status,
    error: err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = {
  AppError,
  asyncHandler,
  errorHandler,
};
