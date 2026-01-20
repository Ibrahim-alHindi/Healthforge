-- HealthForge Database Schema
-- PostgreSQL 15+ with complete drug inventory and supply chain management

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pgcrypto for bcrypt
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE user_role AS ENUM ('admin', 'vendor', 'warehouse_manager', 'hospital_admin', 'pharmacist', 'auditor');
CREATE TYPE drug_category AS ENUM ('antibiotic', 'analgesic', 'cardiovascular', 'diabetes', 'vaccine', 'antiinflammatory', 'antiviral', 'other');
CREATE TYPE storage_condition AS ENUM ('room_temperature', 'cold_storage', 'frozen');
CREATE TYPE po_status AS ENUM ('draft', 'submitted', 'approved', 'rejected', 'completed', 'cancelled');
CREATE TYPE shipment_status AS ENUM ('pending', 'dispatched', 'in_transit', 'delivered', 'cancelled');
CREATE TYPE transaction_type AS ENUM ('stock_in', 'stock_out', 'transfer', 'adjustment', 'expiry', 'damage');
CREATE TYPE location_type AS ENUM ('warehouse', 'hospital');
CREATE TYPE alert_type AS ENUM ('low_stock', 'near_expiry', 'shipment_delay', 'consumption_spike', 'quality_issue');
CREATE TYPE alert_severity AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE alert_status AS ENUM ('active', 'acknowledged', 'resolved', 'dismissed');

-- ============================================================================
-- TABLES
-- ============================================================================

-- Users table with role-based access
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role user_role NOT NULL,
    phone VARCHAR(20),
    warehouse_id UUID,
    hospital_id UUID,
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Drugs master data
CREATE TABLE drugs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    generic_name VARCHAR(255),
    category drug_category NOT NULL,
    manufacturer VARCHAR(255),
    dosage_form VARCHAR(100),
    strength VARCHAR(100),
    unit VARCHAR(50) NOT NULL,
    storage_condition storage_condition DEFAULT 'room_temperature',
    reorder_threshold INTEGER NOT NULL DEFAULT 100,
    description TEXT,
    requires_prescription BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CHECK (reorder_threshold >= 0)
);

-- Vendors
CREATE TABLE vendors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    address TEXT,
    city VARCHAR(100),
    country VARCHAR(100),
    rating DECIMAL(3,2) DEFAULT 0.00,
    performance_score DECIMAL(5,2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CHECK (rating >= 0 AND rating <= 5),
    CHECK (performance_score >= 0)
);

-- Warehouses
CREATE TABLE warehouses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    location VARCHAR(255) NOT NULL,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100),
    capacity INTEGER,
    has_cold_storage BOOLEAN DEFAULT false,
    cold_storage_capacity INTEGER,
    manager_id UUID,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CHECK (capacity >= 0),
    CHECK (cold_storage_capacity >= 0)
);

-- Hospitals
CREATE TABLE hospitals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100),
    bed_capacity INTEGER,
    primary_warehouse_id UUID,
    contact_person VARCHAR(255),
    phone VARCHAR(20),
    email VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CHECK (bed_capacity >= 0)
);

-- Purchase Orders
CREATE TABLE purchase_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    po_number VARCHAR(50) UNIQUE NOT NULL,
    vendor_id UUID NOT NULL,
    destination_type location_type NOT NULL,
    destination_id UUID NOT NULL,
    status po_status DEFAULT 'draft',
    order_date DATE NOT NULL,
    expected_delivery_date DATE,
    total_amount DECIMAL(15,2) DEFAULT 0.00,
    notes TEXT,
    created_by UUID NOT NULL,
    approved_by UUID,
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CHECK (total_amount >= 0)
);

-- Purchase Order Items
CREATE TABLE purchase_order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    po_id UUID NOT NULL,
    drug_id UUID NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(15,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CHECK (quantity > 0),
    CHECK (unit_price >= 0)
);

-- Shipments
CREATE TABLE shipments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shipment_number VARCHAR(50) UNIQUE NOT NULL,
    po_id UUID,
    vendor_id UUID NOT NULL,
    source_type location_type,
    source_id UUID,
    destination_type location_type NOT NULL,
    destination_id UUID NOT NULL,
    status shipment_status DEFAULT 'pending',
    dispatch_date DATE,
    expected_delivery_date DATE,
    actual_delivery_date DATE,
    tracking_number VARCHAR(100),
    carrier VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Shipment Items
CREATE TABLE shipment_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shipment_id UUID NOT NULL,
    drug_id UUID NOT NULL,
    batch_number VARCHAR(100) NOT NULL,
    quantity INTEGER NOT NULL,
    manufacturing_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    unit_price DECIMAL(10,2),
    received_quantity INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CHECK (quantity > 0),
    CHECK (received_quantity >= 0),
    CHECK (received_quantity <= quantity),
    CHECK (expiry_date > manufacturing_date)
);

-- Inventory (batch-wise tracking)
CREATE TABLE inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    drug_id UUID NOT NULL,
    batch_number VARCHAR(100) NOT NULL,
    location_type location_type NOT NULL,
    location_id UUID NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    reserved_quantity INTEGER NOT NULL DEFAULT 0,
    available_quantity INTEGER GENERATED ALWAYS AS (quantity - reserved_quantity) STORED,
    manufacturing_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    unit_cost DECIMAL(10,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (drug_id, batch_number, location_type, location_id),
    CHECK (quantity >= 0),
    CHECK (reserved_quantity >= 0),
    CHECK (reserved_quantity <= quantity),
    CHECK (expiry_date > manufacturing_date)
);

-- Inventory Transactions (complete audit trail)
CREATE TABLE inventory_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    drug_id UUID NOT NULL,
    batch_number VARCHAR(100) NOT NULL,
    transaction_type transaction_type NOT NULL,
    quantity INTEGER NOT NULL,
    from_location_type location_type,
    from_location_id UUID,
    to_location_type location_type,
    to_location_id UUID,
    reference_type VARCHAR(50),
    reference_id UUID,
    unit_cost DECIMAL(10,2),
    notes TEXT,
    performed_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CHECK (quantity > 0)
);

-- Consumption Logs (drug dispensing records)
CREATE TABLE consumption_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hospital_id UUID NOT NULL,
    drug_id UUID NOT NULL,
    batch_number VARCHAR(100) NOT NULL,
    quantity INTEGER NOT NULL,
    patient_id VARCHAR(100),
    prescription_number VARCHAR(100),
    dispensed_by UUID NOT NULL,
    department VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CHECK (quantity > 0)
);

-- Alerts
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type alert_type NOT NULL,
    severity alert_severity NOT NULL,
    status alert_status DEFAULT 'active',
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    location_type location_type,
    location_id UUID,
    threshold_value DECIMAL(15,2),
    current_value DECIMAL(15,2),
    acknowledged_by UUID,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Audit Logs (comprehensive system audit trail)
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    changes JSONB,
    ip_address INET,
    user_agent TEXT,
    status VARCHAR(20) DEFAULT 'success',
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Vendor Performance Logs
CREATE TABLE vendor_performance_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_id UUID NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(10,2) NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- System Configuration
CREATE TABLE system_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    data_type VARCHAR(20) NOT NULL,
    description TEXT,
    updated_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================================

ALTER TABLE users ADD CONSTRAINT fk_users_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id);
ALTER TABLE users ADD CONSTRAINT fk_users_hospital FOREIGN KEY (hospital_id) REFERENCES hospitals(id);

ALTER TABLE warehouses ADD CONSTRAINT fk_warehouses_manager FOREIGN KEY (manager_id) REFERENCES users(id);

ALTER TABLE hospitals ADD CONSTRAINT fk_hospitals_warehouse FOREIGN KEY (primary_warehouse_id) REFERENCES warehouses(id);

ALTER TABLE purchase_orders ADD CONSTRAINT fk_po_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id);
ALTER TABLE purchase_orders ADD CONSTRAINT fk_po_created_by FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE purchase_orders ADD CONSTRAINT fk_po_approved_by FOREIGN KEY (approved_by) REFERENCES users(id);

ALTER TABLE purchase_order_items ADD CONSTRAINT fk_poi_po FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE;
ALTER TABLE purchase_order_items ADD CONSTRAINT fk_poi_drug FOREIGN KEY (drug_id) REFERENCES drugs(id);

ALTER TABLE shipments ADD CONSTRAINT fk_shipments_po FOREIGN KEY (po_id) REFERENCES purchase_orders(id);
ALTER TABLE shipments ADD CONSTRAINT fk_shipments_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id);

ALTER TABLE shipment_items ADD CONSTRAINT fk_si_shipment FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON DELETE CASCADE;
ALTER TABLE shipment_items ADD CONSTRAINT fk_si_drug FOREIGN KEY (drug_id) REFERENCES drugs(id);

ALTER TABLE inventory ADD CONSTRAINT fk_inventory_drug FOREIGN KEY (drug_id) REFERENCES drugs(id);

ALTER TABLE inventory_transactions ADD CONSTRAINT fk_it_drug FOREIGN KEY (drug_id) REFERENCES drugs(id);
ALTER TABLE inventory_transactions ADD CONSTRAINT fk_it_performed_by FOREIGN KEY (performed_by) REFERENCES users(id);

ALTER TABLE consumption_logs ADD CONSTRAINT fk_cl_hospital FOREIGN KEY (hospital_id) REFERENCES hospitals(id);
ALTER TABLE consumption_logs ADD CONSTRAINT fk_cl_drug FOREIGN KEY (drug_id) REFERENCES drugs(id);
ALTER TABLE consumption_logs ADD CONSTRAINT fk_cl_dispensed_by FOREIGN KEY (dispensed_by) REFERENCES users(id);

ALTER TABLE alerts ADD CONSTRAINT fk_alerts_acknowledged_by FOREIGN KEY (acknowledged_by) REFERENCES users(id);
ALTER TABLE alerts ADD CONSTRAINT fk_alerts_resolved_by FOREIGN KEY (resolved_by) REFERENCES users(id);

ALTER TABLE audit_logs ADD CONSTRAINT fk_audit_logs_user FOREIGN KEY (user_id) REFERENCES users(id);

ALTER TABLE vendor_performance_logs ADD CONSTRAINT fk_vpl_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE;

ALTER TABLE system_config ADD CONSTRAINT fk_system_config_updated_by FOREIGN KEY (updated_by) REFERENCES users(id);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Users
CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_role ON users(role) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_warehouse ON users(warehouse_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_hospital ON users(hospital_id) WHERE deleted_at IS NULL;

-- Drugs
CREATE INDEX idx_drugs_code ON drugs(code) WHERE deleted_at IS NULL;
CREATE INDEX idx_drugs_category ON drugs(category) WHERE deleted_at IS NULL;
CREATE INDEX idx_drugs_name ON drugs(name) WHERE deleted_at IS NULL;

-- Vendors
CREATE INDEX idx_vendors_code ON vendors(code) WHERE deleted_at IS NULL;
CREATE INDEX idx_vendors_is_active ON vendors(is_active) WHERE deleted_at IS NULL;

-- Warehouses
CREATE INDEX idx_warehouses_code ON warehouses(code) WHERE deleted_at IS NULL;
CREATE INDEX idx_warehouses_is_active ON warehouses(is_active) WHERE deleted_at IS NULL;

-- Hospitals
CREATE INDEX idx_hospitals_code ON hospitals(code) WHERE deleted_at IS NULL;
CREATE INDEX idx_hospitals_is_active ON hospitals(is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_hospitals_warehouse ON hospitals(primary_warehouse_id) WHERE deleted_at IS NULL;

-- Purchase Orders
CREATE INDEX idx_po_number ON purchase_orders(po_number) WHERE deleted_at IS NULL;
CREATE INDEX idx_po_vendor ON purchase_orders(vendor_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_po_status ON purchase_orders(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_po_destination ON purchase_orders(destination_type, destination_id) WHERE deleted_at IS NULL;

-- Shipments
CREATE INDEX idx_shipments_number ON shipments(shipment_number) WHERE deleted_at IS NULL;
CREATE INDEX idx_shipments_po ON shipments(po_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_shipments_status ON shipments(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_shipments_destination ON shipments(destination_type, destination_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_shipments_expected_delivery ON shipments(expected_delivery_date) WHERE deleted_at IS NULL;

-- Inventory
CREATE INDEX idx_inventory_drug ON inventory(drug_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_inventory_location ON inventory(location_type, location_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_inventory_batch ON inventory(batch_number) WHERE deleted_at IS NULL;
CREATE INDEX idx_inventory_expiry ON inventory(expiry_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_inventory_available ON inventory(available_quantity) WHERE deleted_at IS NULL;

-- Inventory Transactions
CREATE INDEX idx_it_drug ON inventory_transactions(drug_id);
CREATE INDEX idx_it_batch ON inventory_transactions(batch_number);
CREATE INDEX idx_it_type ON inventory_transactions(transaction_type);
CREATE INDEX idx_it_from_location ON inventory_transactions(from_location_type, from_location_id);
CREATE INDEX idx_it_to_location ON inventory_transactions(to_location_type, to_location_id);
CREATE INDEX idx_it_created_at ON inventory_transactions(created_at);

-- Consumption Logs
CREATE INDEX idx_cl_hospital ON consumption_logs(hospital_id);
CREATE INDEX idx_cl_drug ON consumption_logs(drug_id);
CREATE INDEX idx_cl_created_at ON consumption_logs(created_at);

-- Alerts
CREATE INDEX idx_alerts_type ON alerts(type);
CREATE INDEX idx_alerts_severity ON alerts(severity);
CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_location ON alerts(location_type, location_id);
CREATE INDEX idx_alerts_created_at ON alerts(created_at);

-- Audit Logs
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to all tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_drugs_updated_at BEFORE UPDATE ON drugs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vendors_updated_at BEFORE UPDATE ON vendors FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_warehouses_updated_at BEFORE UPDATE ON warehouses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_hospitals_updated_at BEFORE UPDATE ON hospitals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON purchase_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_purchase_order_items_updated_at BEFORE UPDATE ON purchase_order_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_shipments_updated_at BEFORE UPDATE ON shipments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_shipment_items_updated_at BEFORE UPDATE ON shipment_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON inventory FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_alerts_updated_at BEFORE UPDATE ON alerts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_system_config_updated_at BEFORE UPDATE ON system_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Current stock view (aggregated by drug and location)
CREATE OR REPLACE VIEW v_current_stock AS
SELECT 
    i.drug_id,
    d.code AS drug_code,
    d.name AS drug_name,
    d.category,
    d.unit,
    i.location_type,
    i.location_id,
    CASE 
        WHEN i.location_type = 'warehouse' THEN w.name
        WHEN i.location_type = 'hospital' THEN h.name
    END AS location_name,
    SUM(i.quantity) AS total_quantity,
    SUM(i.reserved_quantity) AS total_reserved,
    SUM(i.available_quantity) AS total_available,
    MIN(i.expiry_date) AS nearest_expiry,
    COUNT(*) AS batch_count
FROM inventory i
JOIN drugs d ON i.drug_id = d.id
LEFT JOIN warehouses w ON i.location_type = 'warehouse' AND i.location_id = w.id
LEFT JOIN hospitals h ON i.location_type = 'hospital' AND i.location_id = h.id
WHERE i.deleted_at IS NULL 
  AND i.quantity > 0
GROUP BY i.drug_id, d.code, d.name, d.category, d.unit, i.location_type, i.location_id, w.name, h.name;

-- Low stock items view
CREATE OR REPLACE VIEW v_low_stock_items AS
SELECT 
    s.drug_id,
    s.drug_code,
    s.drug_name,
    s.category,
    s.location_type,
    s.location_id,
    s.location_name,
    s.total_available,
    d.reorder_threshold,
    ROUND(((d.reorder_threshold - s.total_available)::DECIMAL / d.reorder_threshold * 100), 2) AS shortage_percentage
FROM v_current_stock s
JOIN drugs d ON s.drug_id = d.id
WHERE s.total_available < d.reorder_threshold
  AND d.deleted_at IS NULL
ORDER BY shortage_percentage DESC;

-- Near expiry items view (within 90 days)
CREATE OR REPLACE VIEW v_near_expiry_items AS
SELECT 
    i.id AS inventory_id,
    i.drug_id,
    d.code AS drug_code,
    d.name AS drug_name,
    d.category,
    i.batch_number,
    i.location_type,
    i.location_id,
    CASE 
        WHEN i.location_type = 'warehouse' THEN w.name
        WHEN i.location_type = 'hospital' THEN h.name
    END AS location_name,
    i.available_quantity,
    i.expiry_date,
    (i.expiry_date - CURRENT_DATE) AS days_to_expiry
FROM inventory i
JOIN drugs d ON i.drug_id = d.id
LEFT JOIN warehouses w ON i.location_type = 'warehouse' AND i.location_id = w.id
LEFT JOIN hospitals h ON i.location_type = 'hospital' AND i.location_id = h.id
WHERE i.deleted_at IS NULL 
  AND i.available_quantity > 0
  AND i.expiry_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '90 days')
ORDER BY i.expiry_date ASC;

-- Delayed shipments view
CREATE OR REPLACE VIEW v_delayed_shipments AS
SELECT 
    s.id,
    s.shipment_number,
    s.status,
    v.name AS vendor_name,
    s.destination_type,
    CASE 
        WHEN s.destination_type = 'warehouse' THEN w.name
        WHEN s.destination_type = 'hospital' THEN h.name
    END AS destination_name,
    s.dispatch_date,
    s.expected_delivery_date,
    (CURRENT_DATE - s.expected_delivery_date) AS days_delayed,
    COUNT(si.id) AS item_count
FROM shipments s
JOIN vendors v ON s.vendor_id = v.id
LEFT JOIN warehouses w ON s.destination_type = 'warehouse' AND s.destination_id = w.id
LEFT JOIN hospitals h ON s.destination_type = 'hospital' AND s.destination_id = h.id
LEFT JOIN shipment_items si ON s.id = si.shipment_id
WHERE s.deleted_at IS NULL
  AND s.status IN ('dispatched', 'in_transit')
  AND s.expected_delivery_date < CURRENT_DATE
GROUP BY s.id, s.shipment_number, s.status, v.name, s.destination_type, w.name, h.name, s.dispatch_date, s.expected_delivery_date
ORDER BY days_delayed DESC;

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- System Configuration
INSERT INTO system_config (key, value, data_type, description) VALUES
('low_stock_threshold_percentage', '20', 'integer', 'Percentage below reorder threshold to trigger low stock alert'),
('near_expiry_days', '90', 'integer', 'Days before expiry to trigger near expiry alert'),
('consumption_spike_multiplier', '2.5', 'decimal', 'Multiplier of average consumption to trigger spike alert'),
('alert_check_interval_minutes', '60', 'integer', 'Minutes between automatic alert generation checks'),
('max_login_attempts', '5', 'integer', 'Maximum failed login attempts before account lock');

-- Admin User (password: Admin@123)
INSERT INTO users (id, email, password_hash, full_name, role, is_active) VALUES
('00000000-0000-0000-0000-000000000001', 'admin@healthforge.gov', crypt('Admin@123', gen_salt('bf', 10)), 'System Administrator', 'admin', true);

-- Warehouses
INSERT INTO warehouses (id, code, name, location, city, state, country, capacity, has_cold_storage, cold_storage_capacity, is_active) VALUES
('10000000-0000-0000-0000-000000000001', 'WH-001', 'Central Medical Warehouse', '123 Industrial Park, Zone A', 'Capital City', 'State A', 'Country', 100000, true, 10000, true),
('10000000-0000-0000-0000-000000000002', 'WH-002', 'Regional Distribution Center', '456 Logistics Hub, Sector B', 'Metro City', 'State B', 'Country', 75000, false, 0, true);

-- Hospitals
INSERT INTO hospitals (id, code, name, address, city, state, country, bed_capacity, primary_warehouse_id, contact_person, phone, email, is_active) VALUES
('20000000-0000-0000-0000-000000000001', 'HSP-001', 'City General Hospital', '789 Healthcare Drive', 'Capital City', 'State A', 'Country', 500, '10000000-0000-0000-0000-000000000001', 'Dr. Sarah Johnson', '+1-555-0101', 'contact@citygeneralhospital.com', true),
('20000000-0000-0000-0000-000000000002', 'HSP-002', 'Metro District Hospital', '321 Medical Center Blvd', 'Metro City', 'State B', 'Country', 300, '10000000-0000-0000-0000-000000000002', 'Dr. Michael Chen', '+1-555-0102', 'contact@metrodistricthospital.com', true);

-- Warehouse Managers
INSERT INTO users (id, email, password_hash, full_name, role, warehouse_id, is_active) VALUES
('00000000-0000-0000-0000-000000000002', 'warehouse1@healthforge.gov', crypt('Warehouse@123', gen_salt('bf', 10)), 'John Smith', 'warehouse_manager', '10000000-0000-0000-0000-000000000001', true),
('00000000-0000-0000-0000-000000000003', 'warehouse2@healthforge.gov', crypt('Warehouse@123', gen_salt('bf', 10)), 'Emily Davis', 'warehouse_manager', '10000000-0000-0000-0000-000000000002', true);

-- Hospital Admins
INSERT INTO users (id, email, password_hash, full_name, role, hospital_id, is_active) VALUES
('00000000-0000-0000-0000-000000000004', 'hospital1@healthforge.gov', crypt('Hospital@123', gen_salt('bf', 10)), 'Dr. Robert Wilson', 'hospital_admin', '20000000-0000-0000-0000-000000000001', true),
('00000000-0000-0000-0000-000000000005', 'hospital2@healthforge.gov', crypt('Hospital@123', gen_salt('bf', 10)), 'Dr. Lisa Anderson', 'hospital_admin', '20000000-0000-0000-0000-000000000002', true);

-- Pharmacists
INSERT INTO users (id, email, password_hash, full_name, role, hospital_id, is_active) VALUES
('00000000-0000-0000-0000-000000000006', 'pharmacist1@healthforge.gov', crypt('Pharma@123', gen_salt('bf', 10)), 'Maria Garcia', 'pharmacist', '20000000-0000-0000-0000-000000000001', true),
('00000000-0000-0000-0000-000000000007', 'pharmacist2@healthforge.gov', crypt('Pharma@123', gen_salt('bf', 10)), 'James Brown', 'pharmacist', '20000000-0000-0000-0000-000000000002', true);

-- Update warehouse managers
UPDATE warehouses SET manager_id = '00000000-0000-0000-0000-000000000002' WHERE id = '10000000-0000-0000-0000-000000000001';
UPDATE warehouses SET manager_id = '00000000-0000-0000-0000-000000000003' WHERE id = '10000000-0000-0000-0000-000000000002';

-- Vendors
INSERT INTO vendors (id, code, name, contact_person, email, phone, address, city, country, rating, performance_score, is_active) VALUES
('30000000-0000-0000-0000-000000000001', 'VND-001', 'PharmaCorp International', 'David Martinez', 'sales@pharmacorp.com', '+1-555-1001', '100 Pharma Plaza', 'Pharma City', 'Country', 4.50, 92.50, true),
('30000000-0000-0000-0000-000000000002', 'VND-002', 'MediSupply Global', 'Susan Lee', 'contact@medisupply.com', '+1-555-1002', '200 Medical Lane', 'Supply Town', 'Country', 4.20, 88.75, true);

-- Vendor User
INSERT INTO users (id, email, password_hash, full_name, role, is_active) VALUES
('00000000-0000-0000-0000-000000000008', 'vendor1@healthforge.gov', crypt('Vendor@123', gen_salt('bf', 10)), 'Richard Thompson', 'vendor', true);

-- Drugs
INSERT INTO drugs (id, code, name, generic_name, category, manufacturer, dosage_form, strength, unit, storage_condition, reorder_threshold, requires_prescription) VALUES
('40000000-0000-0000-0000-000000000001', 'DRG-001', 'Paracetamol', 'Acetaminophen', 'analgesic', 'PharmaCorp International', 'Tablet', '500mg', 'tablets', 'room_temperature', 5000, false),
('40000000-0000-0000-0000-000000000002', 'DRG-002', 'Amoxicillin', 'Amoxicillin Trihydrate', 'antibiotic', 'MediSupply Global', 'Capsule', '250mg', 'capsules', 'room_temperature', 2000, true),
('40000000-0000-0000-0000-000000000003', 'DRG-003', 'Insulin Glargine', 'Insulin Glargine', 'diabetes', 'PharmaCorp International', 'Injection', '100 units/mL', 'vials', 'cold_storage', 500, true),
('40000000-0000-0000-0000-000000000004', 'DRG-004', 'Atorvastatin', 'Atorvastatin Calcium', 'cardiovascular', 'MediSupply Global', 'Tablet', '20mg', 'tablets', 'room_temperature', 3000, true),
('40000000-0000-0000-0000-000000000005', 'DRG-005', 'COVID-19 Vaccine', 'mRNA-based Vaccine', 'vaccine', 'PharmaCorp International', 'Injection', '0.3mL', 'doses', 'frozen', 1000, true);

-- Inventory in Warehouse 1
INSERT INTO inventory (drug_id, batch_number, location_type, location_id, quantity, reserved_quantity, manufacturing_date, expiry_date, unit_cost) VALUES
('40000000-0000-0000-0000-000000000001', 'PARA-2024-001', 'warehouse', '10000000-0000-0000-0000-000000000001', 8000, 0, '2024-01-15', '2026-01-15', 0.05),
('40000000-0000-0000-0000-000000000002', 'AMOX-2024-001', 'warehouse', '10000000-0000-0000-0000-000000000001', 3500, 0, '2024-02-20', '2026-02-20', 0.15),
('40000000-0000-0000-0000-000000000003', 'INSU-2024-001', 'warehouse', '10000000-0000-0000-0000-000000000001', 800, 0, '2024-03-10', '2025-09-10', 25.00),
('40000000-0000-0000-0000-000000000004', 'ATOR-2024-001', 'warehouse', '10000000-0000-0000-0000-000000000001', 4500, 0, '2024-01-25', '2026-01-25', 0.20),
('40000000-0000-0000-0000-000000000005', 'COV-2024-001', 'warehouse', '10000000-0000-0000-0000-000000000001', 1500, 0, '2024-02-01', '2025-08-01', 15.00);

-- Inventory in Warehouse 2
INSERT INTO inventory (drug_id, batch_number, location_type, location_id, quantity, reserved_quantity, manufacturing_date, expiry_date, unit_cost) VALUES
('40000000-0000-0000-0000-000000000001', 'PARA-2024-002', 'warehouse', '10000000-0000-0000-0000-000000000002', 6000, 0, '2024-02-01', '2026-02-01', 0.05),
('40000000-0000-0000-0000-000000000002', 'AMOX-2024-002', 'warehouse', '10000000-0000-0000-0000-000000000002', 2500, 0, '2024-03-05', '2026-03-05', 0.15);

-- Inventory in Hospital 1
INSERT INTO inventory (drug_id, batch_number, location_type, location_id, quantity, reserved_quantity, manufacturing_date, expiry_date, unit_cost) VALUES
('40000000-0000-0000-0000-000000000001', 'PARA-2024-001', 'hospital', '20000000-0000-0000-0000-000000000001', 1500, 50, '2024-01-15', '2026-01-15', 0.05),
('40000000-0000-0000-0000-000000000002', 'AMOX-2024-001', 'hospital', '20000000-0000-0000-0000-000000000001', 800, 20, '2024-02-20', '2026-02-20', 0.15),
('40000000-0000-0000-0000-000000000003', 'INSU-2024-001', 'hospital', '20000000-0000-0000-0000-000000000001', 150, 10, '2024-03-10', '2025-09-10', 25.00),
('40000000-0000-0000-0000-000000000004', 'ATOR-2024-001', 'hospital', '20000000-0000-0000-0000-000000000001', 1000, 30, '2024-01-25', '2026-01-25', 0.20);

-- Inventory in Hospital 2
INSERT INTO inventory (drug_id, batch_number, location_type, location_id, quantity, reserved_quantity, manufacturing_date, expiry_date, unit_cost) VALUES
('40000000-0000-0000-0000-000000000001', 'PARA-2024-002', 'hospital', '20000000-0000-0000-0000-000000000002', 1200, 30, '2024-02-01', '2026-02-01', 0.05),
('40000000-0000-0000-0000-000000000002', 'AMOX-2024-002', 'hospital', '20000000-0000-0000-0000-000000000002', 600, 15, '2024-03-05', '2026-03-05', 0.15),
('40000000-0000-0000-0000-000000000005', 'COV-2024-001', 'hospital', '20000000-0000-0000-0000-000000000002', 200, 5, '2024-02-01', '2025-08-01', 15.00);

-- Sample consumption logs (last 30 days)
INSERT INTO consumption_logs (hospital_id, drug_id, batch_number, quantity, dispensed_by, department, created_at) VALUES
('20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'PARA-2024-001', 150, '00000000-0000-0000-0000-000000000006', 'Emergency', CURRENT_TIMESTAMP - INTERVAL '1 day'),
('20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', 'AMOX-2024-001', 80, '00000000-0000-0000-0000-000000000006', 'Outpatient', CURRENT_TIMESTAMP - INTERVAL '1 day'),
('20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'PARA-2024-001', 120, '00000000-0000-0000-0000-000000000006', 'Emergency', CURRENT_TIMESTAMP - INTERVAL '2 days'),
('20000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', 'PARA-2024-002', 100, '00000000-0000-0000-0000-000000000007', 'Pediatrics', CURRENT_TIMESTAMP - INTERVAL '1 day'),
('20000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000005', 'COV-2024-001', 50, '00000000-0000-0000-0000-000000000007', 'Vaccination', CURRENT_TIMESTAMP - INTERVAL '1 day');

-- Sample alerts
INSERT INTO alerts (type, severity, status, title, message, entity_type, entity_id, location_type, location_id) VALUES
('low_stock', 'high', 'active', 'Low Stock: Insulin Glargine', 'Insulin Glargine stock in City General Hospital is below reorder threshold', 'drug', '40000000-0000-0000-0000-000000000003', 'hospital', '20000000-0000-0000-0000-000000000001'),
('near_expiry', 'medium', 'active', 'Near Expiry: COVID-19 Vaccine', 'COVID-19 Vaccine batch COV-2024-001 will expire in 6 months', 'inventory', NULL, 'warehouse', '10000000-0000-0000-0000-000000000001');

-- Sample vendor performance
INSERT INTO vendor_performance_logs (vendor_id, metric_name, metric_value, period_start, period_end) VALUES
('30000000-0000-0000-0000-000000000001', 'on_time_delivery', 95.50, '2024-01-01', '2024-12-31'),
('30000000-0000-0000-0000-000000000001', 'quality_score', 98.20, '2024-01-01', '2024-12-31'),
('30000000-0000-0000-0000-000000000002', 'on_time_delivery', 92.30, '2024-01-01', '2024-12-31'),
('30000000-0000-0000-0000-000000000002', 'quality_score', 96.80, '2024-01-01', '2024-12-31');

-- ============================================================================
-- GRANT PERMISSIONS (for application user)
-- ============================================================================

-- Create application role if needed
-- CREATE ROLE healthforge_app WITH LOGIN PASSWORD 'your_secure_password';
-- GRANT CONNECT ON DATABASE healthforge TO healthforge_app;
-- GRANT USAGE ON SCHEMA public TO healthforge_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO healthforge_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO healthforge_app;
-- ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO healthforge_app;
