const { pool } = require('../config/database');
const { AppError, asyncHandler } = require('../middleware/errorHandler');
const Joi = require('joi');

// Validation schema
const logConsumptionSchema = Joi.object({
  hospital_id: Joi.string().uuid().required(),
  drug_id: Joi.string().uuid().required(),
  batch_number: Joi.string().max(100).required(),
  quantity: Joi.number().integer().min(1).required(),
  patient_id: Joi.string().max(100).optional(),
  prescription_number: Joi.string().max(100).optional(),
  department: Joi.string().max(100).optional(),
  notes: Joi.string().optional(),
});

// Log drug consumption (dispensing)
exports.logConsumption = asyncHandler(async (req, res) => {
  const { error } = logConsumptionSchema.validate(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }

  const {
    hospital_id,
    drug_id,
    batch_number,
    quantity,
    patient_id,
    prescription_number,
    department,
    notes,
  } = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Check if inventory exists and has sufficient quantity
    const inventoryCheck = await client.query(
      `SELECT id, available_quantity, unit_cost FROM inventory 
       WHERE drug_id = $1 AND batch_number = $2 AND location_type = 'hospital' 
       AND location_id = $3 AND deleted_at IS NULL`,
      [drug_id, batch_number, hospital_id]
    );

    if (inventoryCheck.rows.length === 0) {
      throw new AppError('Drug batch not found in hospital inventory', 404);
    }

    const inventory = inventoryCheck.rows[0];

    if (inventory.available_quantity < quantity) {
      throw new AppError(
        `Insufficient quantity available. Requested: ${quantity}, Available: ${inventory.available_quantity}`,
        400
      );
    }

    // Log consumption
    const consumptionResult = await client.query(
      `INSERT INTO consumption_logs (hospital_id, drug_id, batch_number, quantity, patient_id,
                                     prescription_number, dispensed_by, department, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, hospital_id, drug_id, batch_number, quantity, patient_id,
                 prescription_number, department, created_at`,
      [hospital_id, drug_id, batch_number, quantity, patient_id, prescription_number,
       req.user.id, department, notes]
    );

    // Reduce inventory quantity
    await client.query(
      `UPDATE inventory 
       SET quantity = quantity - $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [quantity, inventory.id]
    );

    // Create inventory transaction
    await client.query(
      `INSERT INTO inventory_transactions (drug_id, batch_number, transaction_type, quantity,
                                          from_location_type, from_location_id, reference_type, reference_id,
                                          unit_cost, notes, performed_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [drug_id, batch_number, 'stock_out', quantity, 'hospital', hospital_id,
       'consumption', consumptionResult.rows[0].id, inventory.unit_cost,
       `Dispensed to ${patient_id || 'patient'}`, req.user.id]
    );

    await client.query('COMMIT');

    // Get drug details for response
    const drugResult = await client.query(
      'SELECT code, name, unit FROM drugs WHERE id = $1',
      [drug_id]
    );

    res.status(201).json({
      message: 'Consumption logged successfully',
      consumption: {
        ...consumptionResult.rows[0],
        drug_code: drugResult.rows[0].code,
        drug_name: drugResult.rows[0].name,
        drug_unit: drugResult.rows[0].unit,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// Get consumption logs with filters
exports.getConsumptionLogs = asyncHandler(async (req, res) => {
  const {
    hospital_id = '',
    drug_id = '',
    department = '',
    from_date = '',
    to_date = '',
    page = 1,
    limit = 50,
  } = req.query;

  const offset = (page - 1) * limit;
  let queryParams = [];
  let whereConditions = [];
  let paramIndex = 1;

  // Filter by hospital
  if (hospital_id) {
    whereConditions.push(`c.hospital_id = $${paramIndex}`);
    queryParams.push(hospital_id);
    paramIndex++;
  }

  // Filter by drug
  if (drug_id) {
    whereConditions.push(`c.drug_id = $${paramIndex}`);
    queryParams.push(drug_id);
    paramIndex++;
  }

  // Filter by department
  if (department) {
    whereConditions.push(`c.department = $${paramIndex}`);
    queryParams.push(department);
    paramIndex++;
  }

  // Filter by date range
  if (from_date) {
    whereConditions.push(`c.created_at >= $${paramIndex}::date`);
    queryParams.push(from_date);
    paramIndex++;
  }

  if (to_date) {
    whereConditions.push(`c.created_at <= $${paramIndex}::date + INTERVAL '1 day'`);
    queryParams.push(to_date);
    paramIndex++;
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

  // Get total count
  const countResult = await pool.query(
    `SELECT COUNT(*) FROM consumption_logs c ${whereClause}`,
    queryParams
  );
  const totalItems = parseInt(countResult.rows[0].count);

  // Get consumption logs with related data
  const result = await pool.query(
    `SELECT 
       c.id, c.hospital_id, c.drug_id, c.batch_number, c.quantity,
       c.patient_id, c.prescription_number, c.department, c.notes, c.created_at,
       d.code as drug_code, d.name as drug_name, d.unit as drug_unit, d.category,
       h.name as hospital_name,
       u.full_name as dispensed_by_name
     FROM consumption_logs c
     INNER JOIN drugs d ON c.drug_id = d.id
     INNER JOIN hospitals h ON c.hospital_id = h.id
     INNER JOIN users u ON c.dispensed_by = u.id
     ${whereClause}
     ORDER BY c.created_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...queryParams, limit, offset]
  );

  res.json({
    consumptionLogs: result.rows,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalItems / limit),
      totalItems,
      itemsPerPage: parseInt(limit),
    },
  });
});

// Get consumption summary
exports.getConsumptionSummary = asyncHandler(async (req, res) => {
  const {
    hospital_id = '',
    from_date = '',
    to_date = '',
    group_by = 'drug', // 'drug', 'department', 'date'
  } = req.query;

  let queryParams = [];
  let whereConditions = [];
  let paramIndex = 1;

  // Filter by hospital
  if (hospital_id) {
    whereConditions.push(`c.hospital_id = $${paramIndex}`);
    queryParams.push(hospital_id);
    paramIndex++;
  }

  // Filter by date range
  if (from_date) {
    whereConditions.push(`c.created_at >= $${paramIndex}::date`);
    queryParams.push(from_date);
    paramIndex++;
  }

  if (to_date) {
    whereConditions.push(`c.created_at <= $${paramIndex}::date + INTERVAL '1 day'`);
    queryParams.push(to_date);
    paramIndex++;
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

  let query;
  let orderBy;

  switch (group_by) {
    case 'drug':
      query = `
        SELECT 
          c.drug_id,
          d.code as drug_code,
          d.name as drug_name,
          d.unit as drug_unit,
          d.category,
          SUM(c.quantity) as total_quantity,
          COUNT(*) as transaction_count,
          COUNT(DISTINCT c.hospital_id) as hospital_count,
          COUNT(DISTINCT c.department) as department_count
        FROM consumption_logs c
        INNER JOIN drugs d ON c.drug_id = d.id
        ${whereClause}
        GROUP BY c.drug_id, d.code, d.name, d.unit, d.category
      `;
      orderBy = 'ORDER BY total_quantity DESC';
      break;

    case 'department':
      query = `
        SELECT 
          c.department,
          COUNT(DISTINCT c.drug_id) as unique_drugs,
          SUM(c.quantity) as total_quantity,
          COUNT(*) as transaction_count
        FROM consumption_logs c
        ${whereClause}
        AND c.department IS NOT NULL
        GROUP BY c.department
      `;
      orderBy = 'ORDER BY total_quantity DESC';
      break;

    case 'date':
      query = `
        SELECT 
          DATE(c.created_at) as date,
          COUNT(DISTINCT c.drug_id) as unique_drugs,
          SUM(c.quantity) as total_quantity,
          COUNT(*) as transaction_count
        FROM consumption_logs c
        ${whereClause}
        GROUP BY DATE(c.created_at)
      `;
      orderBy = 'ORDER BY date DESC';
      break;

    default:
      throw new AppError('Invalid group_by parameter. Use "drug", "department", or "date"', 400);
  }

  const result = await pool.query(`${query} ${orderBy}`, queryParams);

  res.json({
    summary: result.rows,
    groupedBy: group_by,
  });
});
