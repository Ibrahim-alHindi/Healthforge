const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { AppError, asyncHandler } = require('../middleware/errorHandler');
const Joi = require('joi');

// Validation schemas
const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  full_name: Joi.string().min(2).required(),
  role: Joi.string().valid('admin', 'vendor', 'warehouse_manager', 'hospital_admin', 'pharmacist', 'auditor').required(),
  phone: Joi.string().optional(),
  warehouse_id: Joi.string().uuid().optional(),
  hospital_id: Joi.string().uuid().optional(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

// Register new user
exports.register = asyncHandler(async (req, res) => {
  const { error } = registerSchema.validate(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }

  const { email, password, full_name, role, phone, warehouse_id, hospital_id } = req.body;

  // Check if user already exists
  const existingUser = await pool.query(
    'SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL',
    [email]
  );

  if (existingUser.rows.length > 0) {
    throw new AppError('User with this email already exists', 409);
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 10);

  // Create user
  const result = await pool.query(
    `INSERT INTO users (email, password_hash, full_name, role, phone, warehouse_id, hospital_id) 
     VALUES ($1, $2, $3, $4, $5, $6, $7) 
     RETURNING id, email, full_name, role, warehouse_id, hospital_id, is_active, created_at`,
    [email, passwordHash, full_name, role, phone, warehouse_id, hospital_id]
  );

  const user = result.rows[0];

  // Generate JWT token
  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );

  res.status(201).json({
    message: 'User registered successfully',
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      warehouse_id: user.warehouse_id,
      hospital_id: user.hospital_id,
    },
    token,
  });
});

// Login
exports.login = asyncHandler(async (req, res) => {
  const { error } = loginSchema.validate(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }

  const { email, password } = req.body;

  // Find user
  const result = await pool.query(
    'SELECT id, email, password_hash, full_name, role, warehouse_id, hospital_id, is_active FROM users WHERE email = $1 AND deleted_at IS NULL',
    [email]
  );

  if (result.rows.length === 0) {
    throw new AppError('Invalid email or password', 401);
  }

  const user = result.rows[0];

  if (!user.is_active) {
    throw new AppError('User account is inactive', 401);
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.password_hash);

  if (!isPasswordValid) {
    throw new AppError('Invalid email or password', 401);
  }

  // Update last login
  await pool.query(
    'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
    [user.id]
  );

  // Generate JWT token
  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );

  res.json({
    message: 'Login successful',
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      warehouse_id: user.warehouse_id,
      hospital_id: user.hospital_id,
    },
    token,
  });
});

// Get profile
exports.getProfile = asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT u.id, u.email, u.full_name, u.role, u.phone, u.warehouse_id, u.hospital_id, u.is_active, u.last_login_at, u.created_at,
            w.name as warehouse_name, h.name as hospital_name
     FROM users u
     LEFT JOIN warehouses w ON u.warehouse_id = w.id
     LEFT JOIN hospitals h ON u.hospital_id = h.id
     WHERE u.id = $1 AND u.deleted_at IS NULL`,
    [req.user.id]
  );

  if (result.rows.length === 0) {
    throw new AppError('User not found', 404);
  }

  res.json({
    user: result.rows[0],
  });
});
