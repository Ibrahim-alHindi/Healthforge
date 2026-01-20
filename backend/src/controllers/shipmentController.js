const { pool } = require('../config/database');
const { AppError, asyncHandler } = require('../middleware/errorHandler');
const Joi = require('joi');

// Validation schema
const updateStatusSchema = Joi.object({
  status: Joi.string().valid('pending', 'dispatched', 'in_transit', 'delivered', 'cancelled').required(),
  dispatch_date: Joi.date().optional(),
  actual_delivery_date: Joi.date().optional(),
  notes: Joi.string().optional(),
});

// Get shipments with filters
exports.getShipments = asyncHandler(async (req, res) => {
  const {
    status = '',
    vendor_id = '',
    destination_type = '',
    destination_id = '',
    source_type = '',
    source_id = '',
    from_date = '',
    to_date = '',
    page = 1,
    limit = 20,
  } = req.query;

  const offset = (page - 1) * limit;
  let queryParams = [];
  let whereConditions = ['s.deleted_at IS NULL'];
  let paramIndex = 1;

  // Filter by status
  if (status) {
    whereConditions.push(`s.status = $${paramIndex}`);
    queryParams.push(status);
    paramIndex++;
  }

  // Filter by vendor
  if (vendor_id) {
    whereConditions.push(`s.vendor_id = $${paramIndex}`);
    queryParams.push(vendor_id);
    paramIndex++;
  }

  // Filter by destination type
  if (destination_type) {
    whereConditions.push(`s.destination_type = $${paramIndex}`);
    queryParams.push(destination_type);
    paramIndex++;
  }

  // Filter by destination ID
  if (destination_id) {
    whereConditions.push(`s.destination_id = $${paramIndex}`);
    queryParams.push(destination_id);
    paramIndex++;
  }

  // Filter by source type
  if (source_type) {
    whereConditions.push(`s.source_type = $${paramIndex}`);
    queryParams.push(source_type);
    paramIndex++;
  }

  // Filter by source ID
  if (source_id) {
    whereConditions.push(`s.source_id = $${paramIndex}`);
    queryParams.push(source_id);
    paramIndex++;
  }

  // Filter by date range (created_at)
  if (from_date) {
    whereConditions.push(`s.created_at >= $${paramIndex}::date`);
    queryParams.push(from_date);
    paramIndex++;
  }

  if (to_date) {
    whereConditions.push(`s.created_at <= $${paramIndex}::date + INTERVAL '1 day'`);
    queryParams.push(to_date);
    paramIndex++;
  }

  const whereClause = whereConditions.join(' AND ');

  // Get total count
  const countResult = await pool.query(
    `SELECT COUNT(*) FROM shipments s WHERE ${whereClause}`,
    queryParams
  );
  const totalItems = parseInt(countResult.rows[0].count);

  // Get shipments with related data
  const result = await pool.query(
    `SELECT 
       s.id, s.shipment_number, s.po_id, s.vendor_id, s.status,
       s.dispatch_date, s.expected_delivery_date, s.actual_delivery_date,
       s.tracking_number, s.carrier, s.notes, s.created_at, s.updated_at,
       v.name as vendor_name, v.contact_person as vendor_contact,
       CASE 
         WHEN s.source_type = 'warehouse' THEN sw.name
         WHEN s.source_type = 'hospital' THEN sh.name
       END as source_name,
       CASE 
         WHEN s.destination_type = 'warehouse' THEN dw.name
         WHEN s.destination_type = 'hospital' THEN dh.name
       END as destination_name,
       (SELECT COUNT(*) FROM shipment_items WHERE shipment_id = s.id) as item_count,
       (SELECT SUM(quantity) FROM shipment_items WHERE shipment_id = s.id) as total_quantity
     FROM shipments s
     INNER JOIN vendors v ON s.vendor_id = v.id
     LEFT JOIN warehouses sw ON s.source_type = 'warehouse' AND s.source_id = sw.id
     LEFT JOIN hospitals sh ON s.source_type = 'hospital' AND s.source_id = sh.id
     LEFT JOIN warehouses dw ON s.destination_type = 'warehouse' AND s.destination_id = dw.id
     LEFT JOIN hospitals dh ON s.destination_type = 'hospital' AND s.destination_id = dh.id
     WHERE ${whereClause}
     ORDER BY s.created_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...queryParams, limit, offset]
  );

  res.json({
    shipments: result.rows,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalItems / limit),
      totalItems,
      itemsPerPage: parseInt(limit),
    },
  });
});

// Get shipment by ID with items
exports.getShipmentById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Get shipment details
  const shipmentResult = await pool.query(
    `SELECT 
       s.id, s.shipment_number, s.po_id, s.vendor_id, s.status,
       s.source_type, s.source_id, s.destination_type, s.destination_id,
       s.dispatch_date, s.expected_delivery_date, s.actual_delivery_date,
       s.tracking_number, s.carrier, s.notes, s.created_at, s.updated_at,
       v.name as vendor_name, v.contact_person as vendor_contact, v.phone as vendor_phone,
       CASE 
         WHEN s.source_type = 'warehouse' THEN sw.name
         WHEN s.source_type = 'hospital' THEN sh.name
       END as source_name,
       CASE 
         WHEN s.destination_type = 'warehouse' THEN dw.name
         WHEN s.destination_type = 'hospital' THEN dh.name
       END as destination_name
     FROM shipments s
     INNER JOIN vendors v ON s.vendor_id = v.id
     LEFT JOIN warehouses sw ON s.source_type = 'warehouse' AND s.source_id = sw.id
     LEFT JOIN hospitals sh ON s.source_type = 'hospital' AND s.source_id = sh.id
     LEFT JOIN warehouses dw ON s.destination_type = 'warehouse' AND s.destination_id = dw.id
     LEFT JOIN hospitals dh ON s.destination_type = 'hospital' AND s.destination_id = dh.id
     WHERE s.id = $1 AND s.deleted_at IS NULL`,
    [id]
  );

  if (shipmentResult.rows.length === 0) {
    throw new AppError('Shipment not found', 404);
  }

  // Get shipment items
  const itemsResult = await pool.query(
    `SELECT 
       si.id, si.drug_id, si.batch_number, si.quantity,
       si.manufacturing_date, si.expiry_date, si.unit_price,
       d.code as drug_code, d.name as drug_name, d.unit as drug_unit, d.category
     FROM shipment_items si
     INNER JOIN drugs d ON si.drug_id = d.id
     WHERE si.shipment_id = $1
     ORDER BY d.name ASC`,
    [id]
  );

  res.json({
    shipment: {
      ...shipmentResult.rows[0],
      items: itemsResult.rows,
    },
  });
});

// Update shipment status
exports.updateShipmentStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { error } = updateStatusSchema.validate(req.body);
  
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }

  const { status, dispatch_date, actual_delivery_date, notes } = req.body;

  // Check if shipment exists
  const existingShipment = await pool.query(
    'SELECT id, status, destination_type, destination_id FROM shipments WHERE id = $1 AND deleted_at IS NULL',
    [id]
  );

  if (existingShipment.rows.length === 0) {
    throw new AppError('Shipment not found', 404);
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Build dynamic update query
    const updateFields = ['status = $1', 'updated_at = CURRENT_TIMESTAMP'];
    const queryParams = [status];
    let paramIndex = 2;

    if (dispatch_date) {
      updateFields.push(`dispatch_date = $${paramIndex}`);
      queryParams.push(dispatch_date);
      paramIndex++;
    }

    if (actual_delivery_date) {
      updateFields.push(`actual_delivery_date = $${paramIndex}`);
      queryParams.push(actual_delivery_date);
      paramIndex++;
    }

    if (notes) {
      updateFields.push(`notes = $${paramIndex}`);
      queryParams.push(notes);
      paramIndex++;
    }

    queryParams.push(id);

    // Update shipment
    const result = await client.query(
      `UPDATE shipments 
       SET ${updateFields.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, shipment_number, status, dispatch_date, expected_delivery_date, actual_delivery_date, updated_at`,
      queryParams
    );

    // If status changed to 'delivered', update inventory
    if (status === 'delivered' && existingShipment.rows[0].status !== 'delivered') {
      // Get shipment items
      const itemsResult = await client.query(
        `SELECT drug_id, batch_number, quantity, manufacturing_date, expiry_date, unit_price
         FROM shipment_items
         WHERE shipment_id = $1`,
        [id]
      );

      const destination = existingShipment.rows[0];

      // Process each shipment item
      for (const item of itemsResult.rows) {
        // Check if inventory record exists
        const inventoryCheck = await client.query(
          `SELECT id FROM inventory 
           WHERE drug_id = $1 AND batch_number = $2 AND location_type = $3 AND location_id = $4 AND deleted_at IS NULL`,
          [item.drug_id, item.batch_number, destination.destination_type, destination.destination_id]
        );

        if (inventoryCheck.rows.length > 0) {
          // Update existing inventory
          await client.query(
            `UPDATE inventory 
             SET quantity = quantity + $1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [item.quantity, inventoryCheck.rows[0].id]
          );
        } else {
          // Create new inventory record
          await client.query(
            `INSERT INTO inventory (drug_id, batch_number, location_type, location_id, quantity,
                                    manufacturing_date, expiry_date, unit_cost)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [item.drug_id, item.batch_number, destination.destination_type, destination.destination_id,
             item.quantity, item.manufacturing_date, item.expiry_date, item.unit_price]
          );
        }

        // Create inventory transaction
        await client.query(
          `INSERT INTO inventory_transactions (drug_id, batch_number, transaction_type, quantity,
                                              to_location_type, to_location_id, reference_type, reference_id,
                                              unit_cost, performed_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [item.drug_id, item.batch_number, 'stock_in', item.quantity,
           destination.destination_type, destination.destination_id, 'shipment', id,
           item.unit_price, req.user.id]
        );
      }
    }

    await client.query('COMMIT');

    res.json({
      message: 'Shipment status updated successfully',
      shipment: result.rows[0],
    });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});
