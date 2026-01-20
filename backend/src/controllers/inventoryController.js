const { pool } = require('../config/database');
const { AppError, asyncHandler } = require('../middleware/errorHandler');
const Joi = require('joi');

// Validation schemas
const stockInSchema = Joi.object({
  drug_id: Joi.string().uuid().required(),
  batch_number: Joi.string().max(100).required(),
  location_type: Joi.string().valid('warehouse', 'hospital').required(),
  location_id: Joi.string().uuid().required(),
  quantity: Joi.number().integer().min(1).required(),
  manufacturing_date: Joi.date().required(),
  expiry_date: Joi.date().greater(Joi.ref('manufacturing_date')).required(),
  unit_cost: Joi.number().min(0).optional(),
  reference_type: Joi.string().max(50).optional(),
  reference_id: Joi.string().uuid().optional(),
  notes: Joi.string().optional(),
});

const stockOutSchema = Joi.object({
  drug_id: Joi.string().uuid().required(),
  batch_number: Joi.string().max(100).required(),
  location_type: Joi.string().valid('warehouse', 'hospital').required(),
  location_id: Joi.string().uuid().required(),
  quantity: Joi.number().integer().min(1).required(),
  reference_type: Joi.string().max(50).optional(),
  reference_id: Joi.string().uuid().optional(),
  notes: Joi.string().optional(),
});

const transferSchema = Joi.object({
  drug_id: Joi.string().uuid().required(),
  batch_number: Joi.string().max(100).required(),
  from_location_type: Joi.string().valid('warehouse', 'hospital').required(),
  from_location_id: Joi.string().uuid().required(),
  to_location_type: Joi.string().valid('warehouse', 'hospital').required(),
  to_location_id: Joi.string().uuid().required(),
  quantity: Joi.number().integer().min(1).required(),
  notes: Joi.string().optional(),
});

// Get inventory with filters
exports.getInventory = asyncHandler(async (req, res) => {
  const { 
    location_type = '',
    location_id = '',
    drug_id = '',
    low_stock = false,
    page = 1,
    limit = 50,
  } = req.query;

  const offset = (page - 1) * limit;
  let queryParams = [];
  let whereConditions = ['i.deleted_at IS NULL'];
  let paramIndex = 1;

  // Filter by location type
  if (location_type) {
    whereConditions.push(`i.location_type = $${paramIndex}`);
    queryParams.push(location_type);
    paramIndex++;
  }

  // Filter by location ID
  if (location_id) {
    whereConditions.push(`i.location_id = $${paramIndex}`);
    queryParams.push(location_id);
    paramIndex++;
  }

  // Filter by drug ID
  if (drug_id) {
    whereConditions.push(`i.drug_id = $${paramIndex}`);
    queryParams.push(drug_id);
    paramIndex++;
  }

  const whereClause = whereConditions.join(' AND ');

  // Get inventory with drug details and location names
  let query = `
    SELECT i.id, i.drug_id, i.batch_number, i.location_type, i.location_id,
           i.quantity, i.reserved_quantity, i.available_quantity,
           i.manufacturing_date, i.expiry_date, i.unit_cost,
           d.code as drug_code, d.name as drug_name, d.unit as drug_unit,
           d.reorder_threshold, d.category, d.storage_condition,
           CASE 
             WHEN i.location_type = 'warehouse' THEN w.name
             WHEN i.location_type = 'hospital' THEN h.name
           END as location_name,
           CASE 
             WHEN i.expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN true
             ELSE false
           END as near_expiry,
           CASE 
             WHEN i.available_quantity <= d.reorder_threshold THEN true
             ELSE false
           END as low_stock_alert
    FROM inventory i
    INNER JOIN drugs d ON i.drug_id = d.id
    LEFT JOIN warehouses w ON i.location_type = 'warehouse' AND i.location_id = w.id
    LEFT JOIN hospitals h ON i.location_type = 'hospital' AND i.location_id = h.id
    WHERE ${whereClause}
  `;

  // Filter for low stock alerts
  if (low_stock === 'true' || low_stock === true) {
    query += ` AND i.available_quantity <= d.reorder_threshold`;
  }

  // Get total count
  const countResult = await pool.query(
    `SELECT COUNT(*) FROM (${query}) as count_query`,
    queryParams
  );
  const totalItems = parseInt(countResult.rows[0].count);

  // Get paginated inventory
  query += ` ORDER BY d.name ASC, i.expiry_date ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  const result = await pool.query(query, [...queryParams, limit, offset]);

  res.json({
    inventory: result.rows,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalItems / limit),
      totalItems,
      itemsPerPage: parseInt(limit),
    },
  });
});

// Get inventory summary (aggregated by drug)
exports.getInventorySummary = asyncHandler(async (req, res) => {
  const { location_type = '', location_id = '' } = req.query;

  let queryParams = [];
  let whereConditions = ['i.deleted_at IS NULL'];
  let paramIndex = 1;

  if (location_type) {
    whereConditions.push(`i.location_type = $${paramIndex}`);
    queryParams.push(location_type);
    paramIndex++;
  }

  if (location_id) {
    whereConditions.push(`i.location_id = $${paramIndex}`);
    queryParams.push(location_id);
    paramIndex++;
  }

  const whereClause = whereConditions.join(' AND ');

  const result = await pool.query(
    `SELECT 
       i.drug_id,
       d.code as drug_code,
       d.name as drug_name,
       d.unit as drug_unit,
       d.category,
       d.reorder_threshold,
       SUM(i.quantity) as total_quantity,
       SUM(i.reserved_quantity) as total_reserved,
       SUM(i.available_quantity) as total_available,
       COUNT(DISTINCT i.batch_number) as batch_count,
       MIN(i.expiry_date) as earliest_expiry,
       CASE 
         WHEN SUM(i.available_quantity) <= d.reorder_threshold THEN true
         ELSE false
       END as low_stock_alert
     FROM inventory i
     INNER JOIN drugs d ON i.drug_id = d.id
     WHERE ${whereClause}
     GROUP BY i.drug_id, d.code, d.name, d.unit, d.category, d.reorder_threshold
     ORDER BY d.name ASC`,
    queryParams
  );

  res.json({
    summary: result.rows,
  });
});

// Stock in (receive stock)
exports.stockIn = asyncHandler(async (req, res) => {
  const { error } = stockInSchema.validate(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }

  const {
    drug_id,
    batch_number,
    location_type,
    location_id,
    quantity,
    manufacturing_date,
    expiry_date,
    unit_cost,
    reference_type,
    reference_id,
    notes,
  } = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Check if inventory record exists
    const existingInventory = await client.query(
      `SELECT id, quantity FROM inventory 
       WHERE drug_id = $1 AND batch_number = $2 AND location_type = $3 AND location_id = $4 AND deleted_at IS NULL`,
      [drug_id, batch_number, location_type, location_id]
    );

    let inventoryResult;

    if (existingInventory.rows.length > 0) {
      // Update existing inventory
      inventoryResult = await client.query(
        `UPDATE inventory 
         SET quantity = quantity + $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING id, drug_id, batch_number, location_type, location_id, quantity, available_quantity`,
        [quantity, existingInventory.rows[0].id]
      );
    } else {
      // Create new inventory record
      inventoryResult = await client.query(
        `INSERT INTO inventory (drug_id, batch_number, location_type, location_id, quantity, 
                                manufacturing_date, expiry_date, unit_cost)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, drug_id, batch_number, location_type, location_id, quantity, available_quantity`,
        [drug_id, batch_number, location_type, location_id, quantity, manufacturing_date, expiry_date, unit_cost]
      );
    }

    // Create inventory transaction
    await client.query(
      `INSERT INTO inventory_transactions (drug_id, batch_number, transaction_type, quantity,
                                          to_location_type, to_location_id, reference_type, reference_id,
                                          unit_cost, notes, performed_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [drug_id, batch_number, 'stock_in', quantity, location_type, location_id, 
       reference_type, reference_id, unit_cost, notes, req.user.id]
    );

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Stock received successfully',
      inventory: inventoryResult.rows[0],
    });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// Stock out (remove stock)
exports.stockOut = asyncHandler(async (req, res) => {
  const { error } = stockOutSchema.validate(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }

  const {
    drug_id,
    batch_number,
    location_type,
    location_id,
    quantity,
    reference_type,
    reference_id,
    notes,
  } = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Check available quantity
    const inventoryCheck = await client.query(
      `SELECT id, available_quantity, unit_cost FROM inventory 
       WHERE drug_id = $1 AND batch_number = $2 AND location_type = $3 AND location_id = $4 AND deleted_at IS NULL`,
      [drug_id, batch_number, location_type, location_id]
    );

    if (inventoryCheck.rows.length === 0) {
      throw new AppError('Inventory record not found', 404);
    }

    const inventory = inventoryCheck.rows[0];

    if (inventory.available_quantity < quantity) {
      throw new AppError(`Insufficient stock. Available: ${inventory.available_quantity}, Requested: ${quantity}`, 400);
    }

    // Update inventory
    const inventoryResult = await client.query(
      `UPDATE inventory 
       SET quantity = quantity - $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, drug_id, batch_number, location_type, location_id, quantity, available_quantity`,
      [quantity, inventory.id]
    );

    // Create inventory transaction
    await client.query(
      `INSERT INTO inventory_transactions (drug_id, batch_number, transaction_type, quantity,
                                          from_location_type, from_location_id, reference_type, reference_id,
                                          unit_cost, notes, performed_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [drug_id, batch_number, 'stock_out', quantity, location_type, location_id,
       reference_type, reference_id, inventory.unit_cost, notes, req.user.id]
    );

    await client.query('COMMIT');

    res.json({
      message: 'Stock removed successfully',
      inventory: inventoryResult.rows[0],
    });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// Transfer stock between locations
exports.transfer = asyncHandler(async (req, res) => {
  const { error } = transferSchema.validate(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }

  const {
    drug_id,
    batch_number,
    from_location_type,
    from_location_id,
    to_location_type,
    to_location_id,
    quantity,
    notes,
  } = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Check source inventory
    const sourceInventory = await client.query(
      `SELECT id, available_quantity, manufacturing_date, expiry_date, unit_cost FROM inventory 
       WHERE drug_id = $1 AND batch_number = $2 AND location_type = $3 AND location_id = $4 AND deleted_at IS NULL`,
      [drug_id, batch_number, from_location_type, from_location_id]
    );

    if (sourceInventory.rows.length === 0) {
      throw new AppError('Source inventory not found', 404);
    }

    const source = sourceInventory.rows[0];

    if (source.available_quantity < quantity) {
      throw new AppError(`Insufficient stock at source. Available: ${source.available_quantity}, Requested: ${quantity}`, 400);
    }

    // Reduce source inventory
    await client.query(
      `UPDATE inventory 
       SET quantity = quantity - $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [quantity, source.id]
    );

    // Check if destination inventory exists
    const destInventory = await client.query(
      `SELECT id FROM inventory 
       WHERE drug_id = $1 AND batch_number = $2 AND location_type = $3 AND location_id = $4 AND deleted_at IS NULL`,
      [drug_id, batch_number, to_location_type, to_location_id]
    );

    if (destInventory.rows.length > 0) {
      // Update existing destination inventory
      await client.query(
        `UPDATE inventory 
         SET quantity = quantity + $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [quantity, destInventory.rows[0].id]
      );
    } else {
      // Create new destination inventory
      await client.query(
        `INSERT INTO inventory (drug_id, batch_number, location_type, location_id, quantity,
                                manufacturing_date, expiry_date, unit_cost)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [drug_id, batch_number, to_location_type, to_location_id, quantity,
         source.manufacturing_date, source.expiry_date, source.unit_cost]
      );
    }

    // Create inventory transaction
    await client.query(
      `INSERT INTO inventory_transactions (drug_id, batch_number, transaction_type, quantity,
                                          from_location_type, from_location_id, to_location_type, to_location_id,
                                          unit_cost, notes, performed_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [drug_id, batch_number, 'transfer', quantity, from_location_type, from_location_id,
       to_location_type, to_location_id, source.unit_cost, notes, req.user.id]
    );

    await client.query('COMMIT');

    res.json({
      message: 'Stock transferred successfully',
    });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});
