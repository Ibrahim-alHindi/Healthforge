const { pool } = require('../config/database');
const { AppError, asyncHandler } = require('../middleware/errorHandler');
const Joi = require('joi');

// Validation schema
const resolveAlertSchema = Joi.object({
  resolution_notes: Joi.string().required(),
});

// Get alerts with filters
exports.getAlerts = asyncHandler(async (req, res) => {
  const {
    role = '',
    location_type = '',
    location_id = '',
    type = '',
    severity = '',
    status = 'active',
    page = 1,
    limit = 50,
  } = req.query;

  const offset = (page - 1) * limit;
  let queryParams = [];
  let whereConditions = [];
  let paramIndex = 1;

  // Filter by alert type
  if (type) {
    whereConditions.push(`a.type = $${paramIndex}`);
    queryParams.push(type);
    paramIndex++;
  }

  // Filter by severity
  if (severity) {
    whereConditions.push(`a.severity = $${paramIndex}`);
    queryParams.push(severity);
    paramIndex++;
  }

  // Filter by status
  if (status) {
    whereConditions.push(`a.status = $${paramIndex}`);
    queryParams.push(status);
    paramIndex++;
  }

  // Filter by location type
  if (location_type) {
    whereConditions.push(`a.location_type = $${paramIndex}`);
    queryParams.push(location_type);
    paramIndex++;
  }

  // Filter by location ID
  if (location_id) {
    whereConditions.push(`a.location_id = $${paramIndex}`);
    queryParams.push(location_id);
    paramIndex++;
  }

  // Role-based filtering
  if (role && req.user) {
    if (role === 'hospital_admin' || role === 'pharmacist') {
      whereConditions.push(`(a.location_type = 'hospital' AND a.location_id = $${paramIndex})`);
      queryParams.push(req.user.hospital_id);
      paramIndex++;
    } else if (role === 'warehouse_manager') {
      whereConditions.push(`(a.location_type = 'warehouse' AND a.location_id = $${paramIndex})`);
      queryParams.push(req.user.warehouse_id);
      paramIndex++;
    }
    // Admin and auditor can see all alerts
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

  // Get total count
  const countResult = await pool.query(
    `SELECT COUNT(*) FROM alerts a ${whereClause}`,
    queryParams
  );
  const totalItems = parseInt(countResult.rows[0].count);

  // Get alerts with related information
  const result = await pool.query(
    `SELECT 
       a.id, a.type, a.severity, a.status, a.title, a.message,
       a.entity_type, a.entity_id, a.location_type, a.location_id,
       a.threshold_value, a.current_value,
       a.acknowledged_by, a.acknowledged_at,
       a.resolved_by, a.resolved_at, a.resolution_notes,
       a.created_at, a.updated_at,
       CASE 
         WHEN a.location_type = 'warehouse' THEN w.name
         WHEN a.location_type = 'hospital' THEN h.name
       END as location_name,
       u1.full_name as acknowledged_by_name,
       u2.full_name as resolved_by_name
     FROM alerts a
     LEFT JOIN warehouses w ON a.location_type = 'warehouse' AND a.location_id = w.id
     LEFT JOIN hospitals h ON a.location_type = 'hospital' AND a.location_id = h.id
     LEFT JOIN users u1 ON a.acknowledged_by = u1.id
     LEFT JOIN users u2 ON a.resolved_by = u2.id
     ${whereClause}
     ORDER BY 
       CASE a.severity 
         WHEN 'critical' THEN 1
         WHEN 'high' THEN 2
         WHEN 'medium' THEN 3
         WHEN 'low' THEN 4
       END,
       a.created_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...queryParams, limit, offset]
  );

  res.json({
    alerts: result.rows,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalItems / limit),
      totalItems,
      itemsPerPage: parseInt(limit),
    },
  });
});

// Acknowledge alert
exports.acknowledgeAlert = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if alert exists and is active
  const alertCheck = await pool.query(
    'SELECT id, status FROM alerts WHERE id = $1',
    [id]
  );

  if (alertCheck.rows.length === 0) {
    throw new AppError('Alert not found', 404);
  }

  if (alertCheck.rows[0].status !== 'active') {
    throw new AppError('Alert is not active', 400);
  }

  // Update alert status
  const result = await pool.query(
    `UPDATE alerts 
     SET status = 'acknowledged', 
         acknowledged_by = $1, 
         acknowledged_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $2
     RETURNING id, type, severity, status, title, acknowledged_by, acknowledged_at`,
    [req.user.id, id]
  );

  res.json({
    message: 'Alert acknowledged successfully',
    alert: result.rows[0],
  });
});

// Resolve alert
exports.resolveAlert = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { error } = resolveAlertSchema.validate(req.body);
  
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }

  const { resolution_notes } = req.body;

  // Check if alert exists
  const alertCheck = await pool.query(
    'SELECT id, status FROM alerts WHERE id = $1',
    [id]
  );

  if (alertCheck.rows.length === 0) {
    throw new AppError('Alert not found', 404);
  }

  if (alertCheck.rows[0].status === 'resolved') {
    throw new AppError('Alert is already resolved', 400);
  }

  // Update alert status
  const result = await pool.query(
    `UPDATE alerts 
     SET status = 'resolved', 
         resolved_by = $1, 
         resolved_at = CURRENT_TIMESTAMP,
         resolution_notes = $2,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $3
     RETURNING id, type, severity, status, title, resolved_by, resolved_at, resolution_notes`,
    [req.user.id, resolution_notes, id]
  );

  res.json({
    message: 'Alert resolved successfully',
    alert: result.rows[0],
  });
});

// Generate alerts for various conditions
exports.generateAlerts = asyncHandler(async (req, res) => {
  const client = await pool.connect();
  const alertsCreated = [];

  try {
    await client.query('BEGIN');

    // 1. Low stock alerts
    const lowStockResult = await client.query(
      `SELECT 
         i.drug_id, i.location_type, i.location_id,
         d.name as drug_name, d.code as drug_code, d.reorder_threshold,
         SUM(i.available_quantity) as total_available,
         CASE 
           WHEN i.location_type = 'warehouse' THEN w.name
           WHEN i.location_type = 'hospital' THEN h.name
         END as location_name
       FROM inventory i
       INNER JOIN drugs d ON i.drug_id = d.id
       LEFT JOIN warehouses w ON i.location_type = 'warehouse' AND i.location_id = w.id
       LEFT JOIN hospitals h ON i.location_type = 'hospital' AND i.location_id = h.id
       WHERE i.deleted_at IS NULL
       GROUP BY i.drug_id, i.location_type, i.location_id, d.name, d.code, d.reorder_threshold, w.name, h.name
       HAVING SUM(i.available_quantity) <= d.reorder_threshold`
    );

    for (const item of lowStockResult.rows) {
      // Check if alert already exists
      const existingAlert = await client.query(
        `SELECT id FROM alerts 
         WHERE type = 'low_stock' 
         AND entity_id = $1 
         AND location_type = $2 
         AND location_id = $3 
         AND status IN ('active', 'acknowledged')`,
        [item.drug_id, item.location_type, item.location_id]
      );

      if (existingAlert.rows.length === 0) {
        const severity = item.total_available === 0 ? 'critical' : 
                        item.total_available <= item.reorder_threshold * 0.5 ? 'high' : 'medium';

        const alertResult = await client.query(
          `INSERT INTO alerts (type, severity, title, message, entity_type, entity_id, 
                              location_type, location_id, threshold_value, current_value)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING id, type, severity, title`,
          [
            'low_stock',
            severity,
            `Low Stock: ${item.drug_name}`,
            `${item.drug_name} (${item.drug_code}) at ${item.location_name} is below reorder threshold. Available: ${item.total_available}, Threshold: ${item.reorder_threshold}`,
            'drug',
            item.drug_id,
            item.location_type,
            item.location_id,
            item.reorder_threshold,
            item.total_available
          ]
        );
        alertsCreated.push(alertResult.rows[0]);
      }
    }

    // 2. Near expiry alerts (within 30 days)
    const nearExpiryResult = await client.query(
      `SELECT 
         i.id, i.drug_id, i.batch_number, i.location_type, i.location_id, i.expiry_date, i.quantity,
         d.name as drug_name, d.code as drug_code,
         CASE 
           WHEN i.location_type = 'warehouse' THEN w.name
           WHEN i.location_type = 'hospital' THEN h.name
         END as location_name
       FROM inventory i
       INNER JOIN drugs d ON i.drug_id = d.id
       LEFT JOIN warehouses w ON i.location_type = 'warehouse' AND i.location_id = w.id
       LEFT JOIN hospitals h ON i.location_type = 'hospital' AND i.location_id = h.id
       WHERE i.deleted_at IS NULL 
       AND i.expiry_date <= CURRENT_DATE + INTERVAL '30 days'
       AND i.expiry_date > CURRENT_DATE
       AND i.quantity > 0`
    );

    for (const item of nearExpiryResult.rows) {
      // Check if alert already exists
      const existingAlert = await client.query(
        `SELECT id FROM alerts 
         WHERE type = 'near_expiry' 
         AND entity_id = $1 
         AND status IN ('active', 'acknowledged')
         AND message LIKE $2`,
        [item.id, `%${item.batch_number}%`]
      );

      if (existingAlert.rows.length === 0) {
        const daysUntilExpiry = Math.ceil((new Date(item.expiry_date) - new Date()) / (1000 * 60 * 60 * 24));
        const severity = daysUntilExpiry <= 7 ? 'critical' : 
                        daysUntilExpiry <= 14 ? 'high' : 'medium';

        const alertResult = await client.query(
          `INSERT INTO alerts (type, severity, title, message, entity_type, entity_id, 
                              location_type, location_id, current_value)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING id, type, severity, title`,
          [
            'near_expiry',
            severity,
            `Near Expiry: ${item.drug_name}`,
            `${item.drug_name} (${item.drug_code}) batch ${item.batch_number} at ${item.location_name} expires in ${daysUntilExpiry} days. Quantity: ${item.quantity}`,
            'inventory',
            item.id,
            item.location_type,
            item.location_id,
            daysUntilExpiry
          ]
        );
        alertsCreated.push(alertResult.rows[0]);
      }
    }

    // 3. Shipment delay alerts (expected delivery date passed)
    const delayedShipmentsResult = await client.query(
      `SELECT 
         s.id, s.shipment_number, s.expected_delivery_date, s.destination_type, s.destination_id,
         CASE 
           WHEN s.destination_type = 'warehouse' THEN w.name
           WHEN s.destination_type = 'hospital' THEN h.name
         END as destination_name,
         v.name as vendor_name
       FROM shipments s
       INNER JOIN vendors v ON s.vendor_id = v.id
       LEFT JOIN warehouses w ON s.destination_type = 'warehouse' AND s.destination_id = w.id
       LEFT JOIN hospitals h ON s.destination_type = 'hospital' AND s.destination_id = h.id
       WHERE s.status IN ('pending', 'dispatched', 'in_transit')
       AND s.expected_delivery_date < CURRENT_DATE
       AND s.deleted_at IS NULL`
    );

    for (const shipment of delayedShipmentsResult.rows) {
      // Check if alert already exists
      const existingAlert = await client.query(
        `SELECT id FROM alerts 
         WHERE type = 'shipment_delay' 
         AND entity_id = $1 
         AND status IN ('active', 'acknowledged')`,
        [shipment.id]
      );

      if (existingAlert.rows.length === 0) {
        const daysDelayed = Math.ceil((new Date() - new Date(shipment.expected_delivery_date)) / (1000 * 60 * 60 * 24));
        const severity = daysDelayed > 7 ? 'high' : 'medium';

        const alertResult = await client.query(
          `INSERT INTO alerts (type, severity, title, message, entity_type, entity_id, 
                              location_type, location_id, current_value)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING id, type, severity, title`,
          [
            'shipment_delay',
            severity,
            `Shipment Delayed: ${shipment.shipment_number}`,
            `Shipment ${shipment.shipment_number} from ${shipment.vendor_name} to ${shipment.destination_name} is delayed by ${daysDelayed} days`,
            'shipment',
            shipment.id,
            shipment.destination_type,
            shipment.destination_id,
            daysDelayed
          ]
        );
        alertsCreated.push(alertResult.rows[0]);
      }
    }

    // 4. Consumption spike alerts (50% increase from 7-day average)
    const consumptionSpikesResult = await client.query(
      `WITH consumption_stats AS (
         SELECT 
           c.hospital_id, c.drug_id,
           AVG(CASE WHEN c.created_at >= CURRENT_DATE - INTERVAL '14 days' 
                    AND c.created_at < CURRENT_DATE - INTERVAL '7 days' 
                    THEN c.quantity ELSE NULL END) as avg_previous_week,
           SUM(CASE WHEN c.created_at >= CURRENT_DATE - INTERVAL '7 days' 
                    THEN c.quantity ELSE 0 END) as current_week_total,
           d.name as drug_name, d.code as drug_code,
           h.name as hospital_name
         FROM consumption_logs c
         INNER JOIN drugs d ON c.drug_id = d.id
         INNER JOIN hospitals h ON c.hospital_id = h.id
         WHERE c.created_at >= CURRENT_DATE - INTERVAL '14 days'
         GROUP BY c.hospital_id, c.drug_id, d.name, d.code, h.name
       )
       SELECT *
       FROM consumption_stats
       WHERE avg_previous_week IS NOT NULL
       AND current_week_total > avg_previous_week * 1.5`
    );

    for (const spike of consumptionSpikesResult.rows) {
      // Check if alert already exists
      const existingAlert = await client.query(
        `SELECT id FROM alerts 
         WHERE type = 'consumption_spike' 
         AND entity_id = $1 
         AND location_id = $2
         AND status IN ('active', 'acknowledged')
         AND created_at >= CURRENT_DATE - INTERVAL '7 days'`,
        [spike.drug_id, spike.hospital_id]
      );

      if (existingAlert.rows.length === 0) {
        const increasePercent = Math.round(((spike.current_week_total - spike.avg_previous_week) / spike.avg_previous_week) * 100);

        const alertResult = await client.query(
          `INSERT INTO alerts (type, severity, title, message, entity_type, entity_id, 
                              location_type, location_id, threshold_value, current_value)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING id, type, severity, title`,
          [
            'consumption_spike',
            'medium',
            `Consumption Spike: ${spike.drug_name}`,
            `${spike.drug_name} (${spike.drug_code}) consumption at ${spike.hospital_name} increased by ${increasePercent}% this week`,
            'drug',
            spike.drug_id,
            'hospital',
            spike.hospital_id,
            spike.avg_previous_week,
            spike.current_week_total
          ]
        );
        alertsCreated.push(alertResult.rows[0]);
      }
    }

    await client.query('COMMIT');

    res.json({
      message: `Successfully generated ${alertsCreated.length} alerts`,
      alerts: alertsCreated,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});
