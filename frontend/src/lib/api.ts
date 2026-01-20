import axios from 'axios';
import type {
  LoginCredentials,
  RegisterData,
  AuthResponse,
  User,
  AdminDashboard,
  HospitalDashboard,
  WarehouseDashboard,
  Alert,
  ApiResponse,
  Drug,
  Inventory,
  StockSummary,
  Shipment,
  ConsumptionLog,
} from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

// Create axios instance
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle 401
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear local storage and redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/auth/login', credentials);
    return response.data;
  },

  register: async (data: RegisterData): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/auth/register', data);
    return response.data;
  },

  getProfile: async (): Promise<{ user: User }> => {
    const response = await apiClient.get<{ user: User }>('/auth/profile');
    return response.data;
  },
};

// Dashboard API
export const dashboardAPI = {
  getAdminDashboard: async (): Promise<AdminDashboard> => {
    const response = await apiClient.get<AdminDashboard>('/dashboard/admin');
    return response.data;
  },

  getHospitalDashboard: async (hospitalId?: string): Promise<HospitalDashboard> => {
    const response = await apiClient.get<HospitalDashboard>('/dashboard/hospital', {
      params: { hospital_id: hospitalId },
    });
    return response.data;
  },

  getWarehouseDashboard: async (warehouseId?: string): Promise<WarehouseDashboard> => {
    const response = await apiClient.get<WarehouseDashboard>('/dashboard/warehouse', {
      params: { warehouse_id: warehouseId },
    });
    return response.data;
  },
};

// Alerts API
export const alertsAPI = {
  getAlerts: async (params?: {
    type?: string;
    severity?: string;
    status?: string;
    location_type?: string;
    location_id?: string;
  }): Promise<{ alerts: Alert[] }> => {
    const response = await apiClient.get<{ alerts: Alert[] }>('/alerts', { params });
    return response.data;
  },

  acknowledgeAlert: async (id: string): Promise<{ alert: Alert }> => {
    const response = await apiClient.patch<{ alert: Alert }>(`/alerts/${id}/acknowledge`);
    return response.data;
  },

  resolveAlert: async (id: string, resolution_notes: string): Promise<{ alert: Alert }> => {
    const response = await apiClient.patch<{ alert: Alert }>(`/alerts/${id}/resolve`, {
      resolution_notes,
    });
    return response.data;
  },

  generateAlerts: async (): Promise<{ message: string; created_count: number }> => {
    const response = await apiClient.post<{ message: string; created_count: number }>('/alerts/generate');
    return response.data;
  },
};

// Drugs API
export const drugsAPI = {
  getDrugs: async (params?: {
    page?: number;
    per_page?: number;
    search?: string;
    category?: string;
  }): Promise<ApiResponse<{ drugs: Drug[] }>> => {
    const response = await apiClient.get<ApiResponse<{ drugs: Drug[] }>>('/drugs', { params });
    return response.data;
  },

  getDrugById: async (id: string): Promise<{ drug: Drug }> => {
    const response = await apiClient.get<{ drug: Drug }>(`/drugs/${id}`);
    return response.data;
  },

  createDrug: async (data: Partial<Drug>): Promise<{ drug: Drug }> => {
    const response = await apiClient.post<{ drug: Drug }>('/drugs', data);
    return response.data;
  },

  updateDrug: async (id: string, data: Partial<Drug>): Promise<{ drug: Drug }> => {
    const response = await apiClient.patch<{ drug: Drug }>(`/drugs/${id}`, data);
    return response.data;
  },

  deleteDrug: async (id: string): Promise<{ message: string }> => {
    const response = await apiClient.delete<{ message: string }>(`/drugs/${id}`);
    return response.data;
  },
};

// Inventory API
export const inventoryAPI = {
  getInventory: async (params?: {
    location_type?: string;
    location_id?: string;
    drug_id?: string;
    low_stock?: boolean;
    near_expiry?: boolean;
  }): Promise<{ inventory: Inventory[] }> => {
    const response = await apiClient.get<{ inventory: Inventory[] }>('/inventory', { params });
    return response.data;
  },

  getInventorySummary: async (params?: {
    location_type?: string;
    location_id?: string;
  }): Promise<{ summary: StockSummary[] }> => {
    const response = await apiClient.get<{ summary: StockSummary[] }>('/inventory/summary', { params });
    return response.data;
  },

  stockIn: async (data: {
    drug_id: string;
    batch_number: string;
    quantity: number;
    location_type: string;
    location_id: string;
    manufacturing_date: string;
    expiry_date: string;
    unit_cost?: number;
    reference_type?: string;
    reference_id?: string;
    notes?: string;
  }): Promise<{ message: string; inventory: Inventory }> => {
    const response = await apiClient.post<{ message: string; inventory: Inventory }>('/inventory/stock-in', data);
    return response.data;
  },

  stockOut: async (data: {
    drug_id: string;
    batch_number: string;
    quantity: number;
    location_type: string;
    location_id: string;
    reference_type?: string;
    reference_id?: string;
    notes?: string;
  }): Promise<{ message: string }> => {
    const response = await apiClient.post<{ message: string }>('/inventory/stock-out', data);
    return response.data;
  },

  transfer: async (data: {
    drug_id: string;
    batch_number: string;
    quantity: number;
    from_location_type: string;
    from_location_id: string;
    to_location_type: string;
    to_location_id: string;
    notes?: string;
  }): Promise<{ message: string }> => {
    const response = await apiClient.post<{ message: string }>('/inventory/transfer', data);
    return response.data;
  },
};

// Shipments API
export const shipmentsAPI = {
  getShipments: async (params?: {
    status?: string;
    destination_type?: string;
    destination_id?: string;
  }): Promise<{ shipments: Shipment[] }> => {
    const response = await apiClient.get<{ shipments: Shipment[] }>('/shipments', { params });
    return response.data;
  },

  updateShipmentStatus: async (id: string, status: string): Promise<{ shipment: Shipment }> => {
    const response = await apiClient.patch<{ shipment: Shipment }>(`/shipments/${id}/status`, { status });
    return response.data;
  },
};

// Consumption API
export const consumptionAPI = {
  logConsumption: async (data: {
    hospital_id: string;
    drug_id: string;
    batch_number: string;
    quantity: number;
    patient_id?: string;
    prescription_number?: string;
    department?: string;
    notes?: string;
  }): Promise<{ message: string; consumption: ConsumptionLog }> => {
    const response = await apiClient.post<{ message: string; consumption: ConsumptionLog }>('/consumption', data);
    return response.data;
  },

  getConsumptionLogs: async (params?: {
    hospital_id?: string;
    drug_id?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<{ logs: ConsumptionLog[] }> => {
    const response = await apiClient.get<{ logs: ConsumptionLog[] }>('/consumption', { params });
    return response.data;
  },
};

export default apiClient;
