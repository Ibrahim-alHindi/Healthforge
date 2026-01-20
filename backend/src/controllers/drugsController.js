const { pool } = require('../config/database');
const { AppError, asyncHandler } = require('../middleware/errorHandler');
const Joi = require('joi');

// Validation schemas
const createDrugSchema = Joi.object({
  code: Joi.string().max(50).required(),
  name: Joi.string().max(255).required(),
  generic_name: Joi.string().max(255).optional(),
  category: Joi.string().valid('antibiotic', 'analgesic', 'cardiovascular', 'diabetes', 'vaccine', 'antiinflammatory', 'antiviral', 'other').required(),
  manufacturer: Joi.string().max(255).optional(),
  dosage_form: Joi.string().max(100).optional(),
  strength: Joi.string().max(100).optional(),
  unit: Joi.string().max(50).required(),
  storage_condition: Joi.string().valid('room_temperature', 'cold_storage', 'frozen').optional(),
  reorder_threshold: Joi.number().integer().min(0).default(100),
  description: Joi.string().optional(),
  requires_prescription: Joi.boolean().default(true),
});

const updateDrugSchema = Joi.object({
  code: Joi.string().max(50).optional(),
  name: Joi.string().max(255).optional(),
  generic_name: Joi.string().max(255).optional(),
  category: Joi.string().valid('antibiotic', 'analgesic', 'cardiovascular', 'diabetes', 'vaccine', 'antiinflammatory', 'antiviral', 'other').optional(),
  manufacturer: Joi.string().max(255).optional(),
  dosage_form: Joi.string().max(100).optional(),
  strength: Joi.string().max(100).optional(),
  unit: Joi.string().max(50).optional(),
  storage_condition: Joi.string().valid('room_temperature', 'cold_storage', 'frozen').optional(),
  reorder_threshold: Joi.number().integer().min(0).optional(),
  description: Joi.string().optional(),
  requires_prescription: Joi.boolean().optional(),
});

// Get all drugs with pagination, search, and filters
exports.getDrugs = asyncHandler(async (req, res) => {
  const { 
    page = 1, 
    limit = 20, 
    search = '', 
    category = '',
    storage_condition = '',
  } = req.query;

  const offset = (page - 1) * limit;
  let queryParams = [];
  let whereConditions = ['deleted_at IS NULL'];
  let paramIndex = 1;

  // Search by name or code
  if (search) {
    whereConditions.push(`(name ILIKE $${paramIndex} OR code ILIKE $${paramIndex} OR generic_name ILIKE $${paramIndex})`);
    queryParams.push(`%${search}%`);
    paramIndex++;
  }

  // Filter by category
  if (category) {
    whereConditions.push(`category = $${paramIndex}`);
    queryParams.push(category);
    paramIndex++;
  }

  // Filter by storage condition
  if (storage_condition) {
    whereConditions.push(`storage_condition = $${paramIndex}`);
    queryParams.push(storage_condition);
    paramIndex++;
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

  // Get total count
  const countResult = await pool.query(
    `SELECT COUNT(*) FROM drugs ${whereClause}`,
    queryParams
  );
  const totalItems = parseInt(countResult.rows[0].count);

  // Get paginated drugs
  const result = await pool.query(
    `SELECT id, code, name, generic_name, category, manufacturer, dosage_form, 
            strength, unit, storage_condition, reorder_threshold, description, 
            requires_prescription, created_at, updated_at
     FROM drugs 
     ${whereClause}
     ORDER BY name ASC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...queryParams, limit, offset]
  );

  res.json({
    drugs: result.rows,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalItems / limit),
      totalItems,
      itemsPerPage: parseInt(limit),
    },
  });
});

// Get drug by ID
exports.getDrugById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await pool.query(
    `SELECT id, code, name, generic_name, category, manufacturer, dosage_form, 
            strength, unit, storage_condition, reorder_threshold, description, 
            requires_prescription, created_at, updated_at
     FROM drugs 
     WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );

  if (result.rows.length === 0) {
    throw new AppError('Drug not found', 404);
  }

  res.json({
    drug: result.rows[0],
  });
});

// Create new drug (admin only)
exports.createDrug = asyncHandler(async (req, res) => {
  const { error } = createDrugSchema.validate(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }

  const {
    code,
    name,
    generic_name,
    category,
    manufacturer,
    dosage_form,
    strength,
    unit,
    storage_condition,
    reorder_threshold,
    description,
    requires_prescription,
  } = req.body;

  // Check if drug code already exists
  const existingDrug = await pool.query(
    'SELECT id FROM drugs WHERE code = $1 AND deleted_at IS NULL',
    [code]
  );

  if (existingDrug.rows.length > 0) {
    throw new AppError('Drug with this code already exists', 409);
  }

  // Create drug
  const result = await pool.query(
    `INSERT INTO drugs (code, name, generic_name, category, manufacturer, dosage_form, 
                        strength, unit, storage_condition, reorder_threshold, description, 
                        requires_prescription)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING id, code, name, generic_name, category, manufacturer, dosage_form, 
               strength, unit, storage_condition, reorder_threshold, description, 
               requires_prescription, created_at`,
    [code, name, generic_name, category, manufacturer, dosage_form, strength, unit, 
     storage_condition, reorder_threshold, description, requires_prescription]
  );

  res.status(201).json({
    message: 'Drug created successfully',
    drug: result.rows[0],
  });
});

// Update drug (admin only)
exports.updateDrug = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { error } = updateDrugSchema.validate(req.body);
  
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }

  // Check if drug exists
  const existingDrug = await pool.query(
    'SELECT id FROM drugs WHERE id = $1 AND deleted_at IS NULL',
    [id]
  );

  if (existingDrug.rows.length === 0) {
    throw new AppError('Drug not found', 404);
  }

  // Check if new code conflicts with existing drug
  if (req.body.code) {
    const codeConflict = await pool.query(
      'SELECT id FROM drugs WHERE code = $1 AND id != $2 AND deleted_at IS NULL',
      [req.body.code, id]
    );

    if (codeConflict.rows.length > 0) {
      throw new AppError('Drug with this code already exists', 409);
    }
  }

  // Build dynamic update query
  const updateFields = [];
  const queryParams = [];
  let paramIndex = 1;

  const allowedFields = [
    'code', 'name', 'generic_name', 'category', 'manufacturer', 'dosage_form',
    'strength', 'unit', 'storage_condition', 'reorder_threshold', 'description',
    'requires_prescription'
  ];

  allowedFields.forEach(field => {
    if (req.body[field] !== undefined) {
      updateFields.push(`${field} = $${paramIndex}`);
      queryParams.push(req.body[field]);
      paramIndex++;
    }
  });

  if (updateFields.length === 0) {
    throw new AppError('No valid fields to update', 400);
  }

  updateFields.push('updated_at = CURRENT_TIMESTAMP');
  queryParams.push(id);

  const result = await pool.query(
    `UPDATE drugs 
     SET ${updateFields.join(', ')}
     WHERE id = $${paramIndex}
     RETURNING id, code, name, generic_name, category, manufacturer, dosage_form, 
               strength, unit, storage_condition, reorder_threshold, description, 
               requires_prescription, updated_at`,
    queryParams
  );

  res.json({
    message: 'Drug updated successfully',
    drug: result.rows[0],
  });
});

// Soft delete drug (admin only)
exports.deleteDrug = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if drug exists
  const existingDrug = await pool.query(
    'SELECT id FROM drugs WHERE id = $1 AND deleted_at IS NULL',
    [id]
  );

  if (existingDrug.rows.length === 0) {
    throw new AppError('Drug not found', 404);
  }

  // Soft delete
  await pool.query(
    'UPDATE drugs SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
    [id]
  );

  res.json({
    message: 'Drug deleted successfully',
  });
});
