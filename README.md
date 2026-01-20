# 🏥 HealthForge - Drug Inventory & Supply Chain Management System

A production-ready, enterprise-grade drug inventory and supply chain tracking platform for healthcare institutions. This system tracks drugs end-to-end: **Vendor → Warehouse → Hospital → Consumption**.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)
![PostgreSQL](https://img.shields.io/badge/postgresql-15-blue)
![Next.js](https://img.shields.io/badge/next.js-14-black)

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Setup Instructions](#setup-instructions)
- [API Endpoints](#api-endpoints)
- [User Roles](#user-roles)
- [Demo Flow](#demo-flow)
- [Production Checklist](#production-checklist)
- [License](#license)

---

## 🎯 Overview

HealthForge is a comprehensive drug inventory and supply chain management system designed for healthcare institutions. It provides:

- **Real-time inventory tracking** across warehouses and hospitals
- **Batch-wise tracking** with expiry date management
- **Automated alerts** for low stock, near expiry, and shipment delays
- **Complete audit trail** for compliance and accountability
- **Role-based access control** for different user types
- **Analytics dashboards** with consumption trends and performance metrics
- **Transaction-based operations** ensuring data integrity

---

## ✨ Features

### Core Features

- 📦 **Batch-wise Inventory Management** - Track drugs by batch number with expiry dates
- 🚚 **Supply Chain Tracking** - Monitor shipments from vendors to hospitals
- ⚠️ **Automated Alert System** - Low stock, near expiry, shipment delays, consumption spikes
- 📊 **Analytics Dashboards** - Real-time insights for admins, hospitals, and warehouses
- 🔐 **Role-Based Access Control** - 6 user roles with specific permissions
- 📝 **Complete Audit Logs** - Track all mutations with user, timestamp, and changes
- 🔄 **Stock Operations** - Stock in, stock out, transfers with atomic transactions
- 💊 **Drug Dispensing** - Log consumption with automatic inventory reduction
- 📈 **Consumption Analytics** - Trend analysis and spike detection
- 👥 **Vendor Management** - Performance tracking and ratings

### Security Features

- ✅ Bcrypt password hashing (10 rounds)
- ✅ JWT authentication with expiration
- ✅ Parameterized SQL queries (SQL injection prevention)
- ✅ Rate limiting (100 requests/15 minutes)
- ✅ CORS protection
- ✅ Helmet.js security headers
- ✅ Comprehensive audit logging

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                             │
│              Next.js 14 + TypeScript + Tailwind              │
│                      Port 3000                               │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTP/REST
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                       Backend API                            │
│                  Node.js + Express                           │
│                      Port 5000                               │
└───────────────────────────┬─────────────────────────────────┘
                            │ pg (node-postgres)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      PostgreSQL 15                           │
│                  16+ Tables with Views                       │
│                      Port 5432                               │
└─────────────────────────────────────────────────────────────┘
```

### Database Schema

- **16+ Tables**: users, drugs, vendors, warehouses, hospitals, purchase_orders, shipments, inventory, consumption_logs, alerts, audit_logs, etc.
- **4 Views**: v_current_stock, v_low_stock_items, v_near_expiry_items, v_delayed_shipments
- **ENUMs**: user_role, drug_category, shipment_status, alert_type, alert_severity, etc.
- **Constraints**: Foreign keys, CHECK constraints, unique indexes
- **Triggers**: Auto-update timestamps
- **Generated Columns**: available_quantity = quantity - reserved_quantity

---

## 🛠️ Tech Stack

### Backend
- **Node.js** 18+ - JavaScript runtime
- **Express** - Web framework
- **PostgreSQL** 15 - Database
- **pg** - PostgreSQL client
- **bcrypt** - Password hashing
- **jsonwebtoken** - JWT authentication
- **joi** - Input validation
- **cors** - CORS middleware
- **helmet** - Security headers
- **morgan** - HTTP logging
- **express-rate-limit** - Rate limiting
- **compression** - Response compression

### Frontend
- **Next.js** 14 - React framework (App Router)
- **React** 18 - UI library
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Axios** - HTTP client
- **Recharts** - Charts library
- **date-fns** - Date utilities
- **lucide-react** - Icons

### DevOps
- **Docker** - Containerization
- **Docker Compose** - Multi-container orchestration
- **PostgreSQL** - Database with persistent volumes

---

## 🚀 Quick Start

### Prerequisites

- Docker Desktop installed
- Docker Compose installed
- Ports 3000, 5000, and 5432 available

### One-Command Deployment

```bash
# Clone the repository
git clone <repository-url>
cd Healthforge

# Start all services
docker-compose up -d

# Wait for services to be healthy (about 60 seconds)
docker-compose ps

# Access the application
open http://localhost:3000
```

### Demo Credentials

```
Admin Account:
Email: admin@healthforge.gov
Password: Admin@123

Hospital Admin:
Email: hospital1@healthforge.gov
Password: Hospital@123

Warehouse Manager:
Email: warehouse1@healthforge.gov
Password: Warehouse@123

Pharmacist:
Email: pharmacist1@healthforge.gov
Password: Pharma@123
```

---

## 📖 Setup Instructions

### Option 1: Docker Deployment (Recommended)

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Healthforge
   ```

2. **Start services**
   ```bash
   docker-compose up -d
   ```

3. **Check service health**
   ```bash
   docker-compose ps
   docker-compose logs -f
   ```

4. **Access the application**
   - Frontend: http://localhost:3000
   - Backend: http://localhost:5000/api/v1/health
   - Database: localhost:5432

5. **Stop services**
   ```bash
   docker-compose down
   ```

### Option 2: Manual Setup

#### Database Setup

1. **Install PostgreSQL 15**
   ```bash
   # Ubuntu/Debian
   sudo apt-get install postgresql-15
   
   # macOS
   brew install postgresql@15
   ```

2. **Create database**
   ```bash
   createdb healthforge
   ```

3. **Run schema**
   ```bash
   psql -d healthforge -f database/schema.sql
   ```

#### Backend Setup

1. **Navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

4. **Start backend**
   ```bash
   npm start
   # Or for development
   npm run dev
   ```

#### Frontend Setup

1. **Navigate to frontend directory**
   ```bash
   cd frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.local.example .env.local
   # Edit .env.local with your backend URL
   ```

4. **Build and start**
   ```bash
   npm run build
   npm start
   # Or for development
   npm run dev
   ```

---

## 🔌 API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login
- `GET /api/v1/auth/profile` - Get current user profile

### Drugs
- `GET /api/v1/drugs` - List drugs (paginated, searchable)
- `GET /api/v1/drugs/:id` - Get drug by ID
- `POST /api/v1/drugs` - Create drug (admin only)
- `PATCH /api/v1/drugs/:id` - Update drug (admin only)
- `DELETE /api/v1/drugs/:id` - Soft delete drug (admin only)

### Inventory
- `GET /api/v1/inventory` - Get inventory (filtered)
- `GET /api/v1/inventory/summary` - Get stock summary
- `POST /api/v1/inventory/stock-in` - Receive stock
- `POST /api/v1/inventory/stock-out` - Remove stock
- `POST /api/v1/inventory/transfer` - Transfer between locations

### Alerts
- `GET /api/v1/alerts` - Get alerts (role-filtered)
- `PATCH /api/v1/alerts/:id/acknowledge` - Acknowledge alert
- `PATCH /api/v1/alerts/:id/resolve` - Resolve alert
- `POST /api/v1/alerts/generate` - Generate alerts

### Dashboards
- `GET /api/v1/dashboard/admin` - Admin dashboard data
- `GET /api/v1/dashboard/hospital` - Hospital dashboard data
- `GET /api/v1/dashboard/warehouse` - Warehouse dashboard data

### Shipments
- `GET /api/v1/shipments` - List shipments
- `GET /api/v1/shipments/:id` - Get shipment details
- `PATCH /api/v1/shipments/:id/status` - Update shipment status

### Consumption
- `POST /api/v1/consumption` - Log drug dispensing
- `GET /api/v1/consumption` - Get consumption logs
- `GET /api/v1/consumption/summary` - Get consumption summary

---

## 👥 User Roles

| Role | Permissions | Dashboard |
|------|-------------|-----------|
| **Admin** | Full system access, manage all entities | National overview with analytics |
| **Vendor** | View and update shipments | Shipment tracking |
| **Warehouse Manager** | Manage warehouse inventory, shipments | Warehouse operations |
| **Hospital Admin** | Manage hospital inventory, consumption | Hospital overview |
| **Pharmacist** | Dispense drugs, view inventory | Hospital consumption |
| **Auditor** | View-only access to all data | Audit reports |

---

## 🎬 3-Minute Demo Flow

1. **Login as Admin**
   - Email: `admin@healthforge.gov`
   - Password: `Admin@123`
   - View national dashboard with 6 KPI cards

2. **Explore Dashboard Features**
   - View 30-day consumption trends (LineChart)
   - See top 10 consumed drugs (BarChart)
   - Check vendor performance table
   - Review critical alerts

3. **Check Alerts**
   - See active low stock alerts
   - Acknowledge an alert
   - View alert details

4. **Test Different Roles**
   - Logout and login as hospital admin
   - View hospital-specific dashboard
   - Check low stock items
   - View consumption logs

5. **Verify Data Integrity**
   - All data comes from PostgreSQL
   - Charts display real consumption data
   - Alerts are generated from actual inventory

---

## ✅ Production Checklist

### Security
- [ ] Change JWT_SECRET to a strong random string
- [ ] Change database password
- [ ] Enable HTTPS/TLS
- [ ] Configure firewall rules
- [ ] Enable database connection encryption
- [ ] Set up rate limiting per user
- [ ] Implement API key authentication for external systems
- [ ] Regular security audits

### Performance
- [ ] Set up database connection pooling
- [ ] Configure database indexes
- [ ] Enable response compression
- [ ] Set up CDN for static assets
- [ ] Implement caching (Redis)
- [ ] Configure database query optimization

### Monitoring
- [ ] Set up application logging (Winston, Bunyan)
- [ ] Configure error tracking (Sentry)
- [ ] Set up uptime monitoring
- [ ] Configure database backup schedule
- [ ] Set up alerts for critical errors
- [ ] Monitor database performance

### Deployment
- [ ] Set up CI/CD pipeline
- [ ] Configure environment variables
- [ ] Set up database migrations
- [ ] Configure backup and recovery
- [ ] Set up load balancing
- [ ] Configure auto-scaling

### Documentation
- [ ] API documentation (Swagger/OpenAPI)
- [ ] User manual
- [ ] Admin guide
- [ ] Deployment guide
- [ ] Disaster recovery plan

---

## 📄 License

MIT License - See LICENSE file for details

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

## 📧 Support

For support and questions, please open an issue in the repository.

---

**Built with ❤️ for Healthcare** 🏥