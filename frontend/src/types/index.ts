// User types
export type UserRole = 'admin' | 'vendor' | 'warehouse_manager' | 'hospital_admin' | 'pharmacist' | 'auditor';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  warehouse_id?: string;
  hospital_id?: string;
  warehouse_name?: string;
  hospital_name?: string;
  is_active: boolean;
  last_login_at?: string;
  created_at: string;
}

// Drug types
export type DrugCategory = 'antibiotic' | 'analgesic' | 'cardiovascular' | 'diabetes' | 'vaccine' | 'antiinflammatory' | 'antiviral' | 'other';
export type StorageCondition = 'room_temperature' | 'cold_storage' | 'frozen';

export interface Drug {
  id: string;
  code: string;
  name: string;
  generic_name?: string;
  category: DrugCategory;
  manufacturer?: string;
  dosage_form?: string;
  strength?: string;
  unit: string;
  storage_condition: StorageCondition;
  reorder_threshold: number;
  description?: string;
  requires_prescription: boolean;
  created_at: string;
  updated_at: string;
}

// Inventory types
export type LocationType = 'warehouse' | 'hospital';

export interface Inventory {
  id: string;
  drug_id: string;
  drug_code?: string;
  drug_name?: string;
  batch_number: string;
  location_type: LocationType;
  location_id: string;
  location_name?: string;
  quantity: number;
  reserved_quantity: number;
  available_quantity: number;
  manufacturing_date: string;
  expiry_date: string;
  unit_cost?: number;
  days_to_expiry?: number;
  is_low_stock?: boolean;
  is_near_expiry?: boolean;
}

export interface StockSummary {
  drug_id: string;
  drug_code: string;
  drug_name: string;
  category: DrugCategory;
  unit: string;
  total_quantity: number;
  total_reserved: number;
  total_available: number;
  nearest_expiry: string;
  batch_count: number;
}

// Alert types
export type AlertType = 'low_stock' | 'near_expiry' | 'shipment_delay' | 'consumption_spike' | 'quality_issue';
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';
export type AlertStatus = 'active' | 'acknowledged' | 'resolved' | 'dismissed';

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  message: string;
  entity_type?: string;
  entity_id?: string;
  location_type?: LocationType;
  location_id?: string;
  location_name?: string;
  threshold_value?: number;
  current_value?: number;
  acknowledged_by?: string;
  acknowledged_at?: string;
  resolved_by?: string;
  resolved_at?: string;
  resolution_notes?: string;
  created_at: string;
  updated_at: string;
}

// Dashboard types
export interface DashboardCard {
  title: string;
  value: number | string;
  icon: string;
  color: string;
  subtitle?: string;
  trend?: {
    value: number;
    direction: 'up' | 'down';
  };
}

export interface ConsumptionTrend {
  date: string;
  quantity: number;
}

export interface TopDrug {
  drug_name: string;
  total_consumed: number;
  unit: string;
}

export interface VendorPerformance {
  vendor_id: string;
  vendor_name: string;
  rating: number;
  performance_score: number;
  total_orders: number;
  on_time_delivery: number;
}

export interface AdminDashboard {
  overview: {
    total_hospitals: number;
    total_warehouses: number;
    total_drugs: number;
    total_vendors: number;
    active_shipments: number;
    active_alerts: number;
  };
  consumption_trend: ConsumptionTrend[];
  top_drugs: TopDrug[];
  vendor_performance: VendorPerformance[];
  stock_value_by_category: {
    category: string;
    total_value: number;
  }[];
  critical_alerts: Alert[];
}

export interface HospitalDashboard {
  overview: {
    total_stock_value: number;
    low_stock_items: number;
    near_expiry_items: number;
    todays_consumption: number;
  };
  low_stock_items: StockSummary[];
  consumption_trend: ConsumptionTrend[];
  near_expiry_items: Inventory[];
  alerts: Alert[];
}

export interface WarehouseDashboard {
  overview: {
    total_stock_value: number;
    incoming_shipments: number;
    near_expiry_items: number;
    total_drugs: number;
  };
  incoming_shipments: any[];
  recent_transactions: any[];
  near_expiry_items: Inventory[];
  alerts: Alert[];
}

// Shipment types
export type ShipmentStatus = 'pending' | 'dispatched' | 'in_transit' | 'delivered' | 'cancelled';

export interface Shipment {
  id: string;
  shipment_number: string;
  po_id?: string;
  vendor_id: string;
  vendor_name?: string;
  source_type?: LocationType;
  source_id?: string;
  destination_type: LocationType;
  destination_id: string;
  destination_name?: string;
  status: ShipmentStatus;
  dispatch_date?: string;
  expected_delivery_date?: string;
  actual_delivery_date?: string;
  tracking_number?: string;
  carrier?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// Consumption types
export interface ConsumptionLog {
  id: string;
  hospital_id: string;
  hospital_name?: string;
  drug_id: string;
  drug_name?: string;
  batch_number: string;
  quantity: number;
  patient_id?: string;
  prescription_number?: string;
  dispensed_by: string;
  dispensed_by_name?: string;
  department?: string;
  notes?: string;
  created_at: string;
}

// API Response types
export interface ApiResponse<T = any> {
  data?: T;
  message?: string;
  error?: string;
  pagination?: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

// Auth types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  full_name: string;
  role: UserRole;
  phone?: string;
  warehouse_id?: string;
  hospital_id?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  message: string;
}
