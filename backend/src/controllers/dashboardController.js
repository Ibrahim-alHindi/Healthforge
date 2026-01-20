const { pool } = require('../config/database');
const { AppError, asyncHandler } = require('../middleware/errorHandler');

// Get admin dashboard data
exports.getAdminDashboard = asyncHandler(async (req, res) => {
  // Total counts
  const countsResult = await pool.query(
    `SELECT 
       (SELECT COUNT(*) FROM hospitals WHERE deleted_at IS NULL) as total_hospitals,
       (SELECT COUNT(*) FROM warehouses WHERE deleted_at IS NULL) as total_warehouses,
       (SELECT COUNT(*) FROM drugs WHERE deleted_at IS NULL) as total_drugs,
       (SELECT COUNT(*) FROM vendors WHERE deleted_at IS NULL) as total_vendors,
       (SELECT COUNT(*) FROM shipments WHERE status IN ('pending', 'dispatched', 'in_transit') AND deleted_at IS NULL) as active_shipments,
       (SELECT COUNT(*) FROM alerts WHERE status IN ('active', 'acknowledged')) as active_alerts`
  );

  // 30-day consumption trend
  const consumptionTrendResult = await pool.query(
    `SELECT 
       DATE(created_at) as date,
       SUM(quantity) as total_quantity,
       COUNT(DISTINCT drug_id) as unique_drugs
     FROM consumption_logs
     WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
     GROUP BY DATE(created_at)
     ORDER BY date ASC`
  );

  // Top 10 consumed drugs (last 30 days)
  const topDrugsResult = await pool.query(
    `SELECT 
       d.id, d.code, d.name, d.category, d.unit,
       SUM(c.quantity) as total_consumed,
       COUNT(DISTINCT c.hospital_id) as hospital_count
     FROM consumption_logs c
     INNER JOIN drugs d ON c.drug_id = d.id
     WHERE c.created_at >= CURRENT_DATE - INTERVAL '30 days'
     GROUP BY d.id, d.code, d.name, d.category, d.unit
     ORDER BY total_consumed DESC
     LIMIT 10`
  );

  // Vendor performance (delivery success rate)
  const vendorPerformanceResult = await pool.query(
    `SELECT 
       v.id, v.name, v.contact_person, v.rating,
       COUNT(s.id) as total_shipments,
       COUNT(CASE WHEN s.status = 'delivered' THEN 1 END) as delivered_shipments,
       COUNT(CASE WHEN s.status = 'delivered' AND s.actual_delivery_date <= s.expected_delivery_date THEN 1 END) as on_time_deliveries,
       ROUND(
         CAST(COUNT(CASE WHEN s.status = 'delivered' AND s.actual_delivery_date <= s.expected_delivery_date THEN 1 END) AS NUMERIC) / 
         NULLIF(COUNT(CASE WHEN s.status = 'delivered' THEN 1 END), 0) * 100, 
         2
       ) as on_time_percentage
     FROM vendors v
     LEFT JOIN shipments s ON v.id = s.vendor_id AND s.deleted_at IS NULL
     WHERE v.deleted_at IS NULL
     GROUP BY v.id, v.name, v.contact_person, v.rating
     ORDER BY on_time_percentage DESC NULLS LAST, v.rating DESC
     LIMIT 10`
  );

  // Stock value by category
  const stockValueResult = await pool.query(
    `SELECT 
       d.category,
       COUNT(DISTINCT d.id) as drug_count,
       SUM(i.quantity) as total_quantity,
       SUM(i.quantity * COALESCE(i.unit_cost, 0)) as total_value
     FROM inventory i
     INNER JOIN drugs d ON i.drug_id = d.id
     WHERE i.deleted_at IS NULL
     GROUP BY d.category
     ORDER BY total_value DESC`
  );

  // Critical alerts summary
  const alertsSummaryResult = await pool.query(
    `SELECT 
       type,
       severity,
       COUNT(*) as count
     FROM alerts
     WHERE status IN ('active', 'acknowledged')
     GROUP BY type, severity
     ORDER BY 
       CASE severity 
         WHEN 'critical' THEN 1
         WHEN 'high' THEN 2
         WHEN 'medium' THEN 3
         WHEN 'low' THEN 4
       END,
       type`
  );

  res.json({
    summary: countsResult.rows[0],
    consumptionTrend: consumptionTrendResult.rows,
    topDrugs: topDrugsResult.rows,
    vendorPerformance: vendorPerformanceResult.rows,
    stockValue: stockValueResult.rows,
    alertsSummary: alertsSummaryResult.rows,
  });
});

// Get hospital dashboard data
exports.getHospitalDashboard = asyncHandler(async (req, res) => {
  const { hospital_id } = req.query;

  // Validate hospital_id
  if (!hospital_id) {
    throw new AppError('Hospital ID is required', 400);
  }

  // Stock summary
  const stockSummaryResult = await pool.query(
    `SELECT 
       COUNT(DISTINCT i.drug_id) as total_drugs,
       SUM(i.quantity) as total_quantity,
       SUM(i.available_quantity) as available_quantity,
       COUNT(CASE WHEN i.available_quantity <= d.reorder_threshold THEN 1 END) as low_stock_count,
       COUNT(CASE WHEN i.expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 1 END) as near_expiry_count
     FROM inventory i
     INNER JOIN drugs d ON i.drug_id = d.id
     WHERE i.location_type = 'hospital' 
     AND i.location_id = $1 
     AND i.deleted_at IS NULL`,
    [hospital_id]
  );

  // Low stock items
  const lowStockResult = await pool.query(
    `SELECT 
       d.id, d.code, d.name, d.category, d.unit, d.reorder_threshold,
       SUM(i.available_quantity) as available_quantity
     FROM inventory i
     INNER JOIN drugs d ON i.drug_id = d.id
     WHERE i.location_type = 'hospital' 
     AND i.location_id = $1 
     AND i.deleted_at IS NULL
     GROUP BY d.id, d.code, d.name, d.category, d.unit, d.reorder_threshold
     HAVING SUM(i.available_quantity) <= d.reorder_threshold
     ORDER BY (SUM(i.available_quantity)::FLOAT / NULLIF(d.reorder_threshold, 0)) ASC
     LIMIT 10`,
    [hospital_id]
  );

  // Today's consumption
  const todayConsumptionResult = await pool.query(
    `SELECT 
       d.id, d.code, d.name, d.category, d.unit,
       SUM(c.quantity) as quantity_consumed,
       COUNT(*) as transaction_count
     FROM consumption_logs c
     INNER JOIN drugs d ON c.drug_id = d.id
     WHERE c.hospital_id = $1 
     AND DATE(c.created_at) = CURRENT_DATE
     GROUP BY d.id, d.code, d.name, d.category, d.unit
     ORDER BY quantity_consumed DESC
     LIMIT 10`,
    [hospital_id]
  );

  // Weekly consumption trend (last 7 days)
  const weeklyTrendResult = await pool.query(
    `SELECT 
       DATE(created_at) as date,
       SUM(quantity) as total_quantity,
       COUNT(DISTINCT drug_id) as unique_drugs,
       COUNT(*) as transaction_count
     FROM consumption_logs
     WHERE hospital_id = $1 
     AND created_at >= CURRENT_DATE - INTERVAL '7 days'
     GROUP BY DATE(created_at)
     ORDER BY date ASC`,
    [hospital_id]
  );

  // Near expiry items (next 30 days)
  const nearExpiryResult = await pool.query(
    `SELECT 
       d.id, d.code, d.name, d.category, d.unit,
       i.batch_number, i.expiry_date, i.quantity,
       EXTRACT(DAY FROM (i.expiry_date - CURRENT_DATE)) as days_until_expiry
     FROM inventory i
     INNER JOIN drugs d ON i.drug_id = d.id
     WHERE i.location_type = 'hospital' 
     AND i.location_id = $1 
     AND i.expiry_date <= CURRENT_DATE + INTERVAL '30 days'
     AND i.expiry_date > CURRENT_DATE
     AND i.quantity > 0
     AND i.deleted_at IS NULL
     ORDER BY i.expiry_date ASC
     LIMIT 10`,
    [hospital_id]
  );

  // Active alerts for this hospital
  const alertsResult = await pool.query(
    `SELECT 
       id, type, severity, title, message, created_at
     FROM alerts
     WHERE location_type = 'hospital' 
     AND location_id = $1 
     AND status IN ('active', 'acknowledged')
     ORDER BY 
       CASE severity 
         WHEN 'critical' THEN 1
         WHEN 'high' THEN 2
         WHEN 'medium' THEN 3
         WHEN 'low' THEN 4
       END,
       created_at DESC
     LIMIT 10`,
    [hospital_id]
  );

  // Department-wise consumption (last 30 days)
  const departmentConsumptionResult = await pool.query(
    `SELECT 
       department,
       COUNT(DISTINCT drug_id) as unique_drugs,
       SUM(quantity) as total_quantity,
       COUNT(*) as transaction_count
     FROM consumption_logs
     WHERE hospital_id = $1 
     AND created_at >= CURRENT_DATE - INTERVAL '30 days'
     AND department IS NOT NULL
     GROUP BY department
     ORDER BY total_quantity DESC`,
    [hospital_id]
  );

  res.json({
    stockSummary: stockSummaryResult.rows[0],
    lowStockItems: lowStockResult.rows,
    todayConsumption: todayConsumptionResult.rows,
    weeklyTrend: weeklyTrendResult.rows,
    nearExpiryItems: nearExpiryResult.rows,
    alerts: alertsResult.rows,
    departmentConsumption: departmentConsumptionResult.rows,
  });
});

// Get warehouse dashboard data
exports.getWarehouseDashboard = asyncHandler(async (req, res) => {
  const { warehouse_id } = req.query;

  // Validate warehouse_id
  if (!warehouse_id) {
    throw new AppError('Warehouse ID is required', 400);
  }

  // Stock summary
  const stockSummaryResult = await pool.query(
    `SELECT 
       COUNT(DISTINCT i.drug_id) as total_drugs,
       SUM(i.quantity) as total_quantity,
       SUM(i.available_quantity) as available_quantity,
       SUM(i.reserved_quantity) as reserved_quantity,
       COUNT(CASE WHEN i.available_quantity <= d.reorder_threshold THEN 1 END) as low_stock_count,
       COUNT(CASE WHEN i.expiry_date <= CURRENT_DATE + INTERVAL '60 days' THEN 1 END) as near_expiry_count,
       SUM(i.quantity * COALESCE(i.unit_cost, 0)) as total_stock_value
     FROM inventory i
     INNER JOIN drugs d ON i.drug_id = d.id
     WHERE i.location_type = 'warehouse' 
     AND i.location_id = $1 
     AND i.deleted_at IS NULL`,
    [warehouse_id]
  );

  // Incoming shipments
  const incomingShipmentsResult = await pool.query(
    `SELECT 
       s.id, s.shipment_number, s.status, s.expected_delivery_date, s.dispatch_date,
       v.name as vendor_name,
       COUNT(si.id) as item_count,
       SUM(si.quantity) as total_quantity
     FROM shipments s
     INNER JOIN vendors v ON s.vendor_id = v.id
     LEFT JOIN shipment_items si ON s.id = si.shipment_id
     WHERE s.destination_type = 'warehouse' 
     AND s.destination_id = $1
     AND s.status IN ('pending', 'dispatched', 'in_transit')
     AND s.deleted_at IS NULL
     GROUP BY s.id, s.shipment_number, s.status, s.expected_delivery_date, s.dispatch_date, v.name
     ORDER BY s.expected_delivery_date ASC
     LIMIT 10`,
    [warehouse_id]
  );

  // Recent transactions (last 7 days)
  const recentTransactionsResult = await pool.query(
    `SELECT 
       it.id, it.transaction_type, it.quantity, it.created_at,
       d.code as drug_code, d.name as drug_name, d.unit,
       it.batch_number,
       CASE 
         WHEN it.from_location_type = 'warehouse' THEN w1.name
         WHEN it.from_location_type = 'hospital' THEN h1.name
       END as from_location_name,
       CASE 
         WHEN it.to_location_type = 'warehouse' THEN w2.name
         WHEN it.to_location_type = 'hospital' THEN h2.name
       END as to_location_name,
       u.full_name as performed_by_name
     FROM inventory_transactions it
     INNER JOIN drugs d ON it.drug_id = d.id
     INNER JOIN users u ON it.performed_by = u.id
     LEFT JOIN warehouses w1 ON it.from_location_type = 'warehouse' AND it.from_location_id = w1.id
     LEFT JOIN hospitals h1 ON it.from_location_type = 'hospital' AND it.from_location_id = h1.id
     LEFT JOIN warehouses w2 ON it.to_location_type = 'warehouse' AND it.to_location_id = w2.id
     LEFT JOIN hospitals h2 ON it.to_location_type = 'hospital' AND it.to_location_id = h2.id
     WHERE (it.from_location_id = $1 OR it.to_location_id = $1)
     AND it.created_at >= CURRENT_DATE - INTERVAL '7 days'
     ORDER BY it.created_at DESC
     LIMIT 20`,
    [warehouse_id]
  );

  // Near expiry items (next 60 days for warehouse)
  const nearExpiryResult = await pool.query(
    `SELECT 
       d.id, d.code, d.name, d.category, d.unit,
       i.batch_number, i.expiry_date, i.quantity, i.available_quantity,
       EXTRACT(DAY FROM (i.expiry_date - CURRENT_DATE)) as days_until_expiry
     FROM inventory i
     INNER JOIN drugs d ON i.drug_id = d.id
     WHERE i.location_type = 'warehouse' 
     AND i.location_id = $1 
     AND i.expiry_date <= CURRENT_DATE + INTERVAL '60 days'
     AND i.expiry_date > CURRENT_DATE
     AND i.quantity > 0
     AND i.deleted_at IS NULL
     ORDER BY i.expiry_date ASC
     LIMIT 10`,
    [warehouse_id]
  );

  // Stock by category
  const stockByCategoryResult = await pool.query(
    `SELECT 
       d.category,
       COUNT(DISTINCT d.id) as drug_count,
       SUM(i.quantity) as total_quantity,
       SUM(i.available_quantity) as available_quantity,
       SUM(i.quantity * COALESCE(i.unit_cost, 0)) as total_value
     FROM inventory i
     INNER JOIN drugs d ON i.drug_id = d.id
     WHERE i.location_type = 'warehouse' 
     AND i.location_id = $1 
     AND i.deleted_at IS NULL
     GROUP BY d.category
     ORDER BY total_value DESC`,
    [warehouse_id]
  );

  // Active alerts for this warehouse
  const alertsResult = await pool.query(
    `SELECT 
       id, type, severity, title, message, created_at
     FROM alerts
     WHERE location_type = 'warehouse' 
     AND location_id = $1 
     AND status IN ('active', 'acknowledged')
     ORDER BY 
       CASE severity 
         WHEN 'critical' THEN 1
         WHEN 'high' THEN 2
         WHEN 'medium' THEN 3
         WHEN 'low' THEN 4
       END,
       created_at DESC
     LIMIT 10`,
    [warehouse_id]
  );

  res.json({
    stockSummary: stockSummaryResult.rows[0],
    incomingShipments: incomingShipmentsResult.rows,
    recentTransactions: recentTransactionsResult.rows,
    nearExpiryItems: nearExpiryResult.rows,
    stockByCategory: stockByCategoryResult.rows,
    alerts: alertsResult.rows,
  });
});
