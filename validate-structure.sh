#!/bin/bash

# HealthForge Structure Validation Script

echo "🏥 HealthForge - Structure Validation"
echo "===================================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

errors=0
warnings=0

check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} $1"
    else
        echo -e "${RED}✗${NC} $1 - MISSING"
        ((errors++))
    fi
}

check_dir() {
    if [ -d "$1" ]; then
        echo -e "${GREEN}✓${NC} $1/"
    else
        echo -e "${RED}✗${NC} $1/ - MISSING"
        ((errors++))
    fi
}

echo "📁 Checking Database Files..."
check_file "database/schema.sql"
echo ""

echo "📁 Checking Backend Structure..."
check_dir "backend"
check_dir "backend/src"
check_dir "backend/src/config"
check_dir "backend/src/middleware"
check_dir "backend/src/controllers"
check_dir "backend/src/routes"
check_file "backend/package.json"
check_file "backend/Dockerfile"
check_file "backend/.env.example"
check_file "backend/src/server.js"
check_file "backend/src/config/database.js"
check_file "backend/src/middleware/auth.js"
check_file "backend/src/middleware/auditLog.js"
check_file "backend/src/middleware/errorHandler.js"
check_file "backend/src/controllers/authController.js"
check_file "backend/src/controllers/drugsController.js"
check_file "backend/src/controllers/inventoryController.js"
check_file "backend/src/controllers/alertsController.js"
check_file "backend/src/controllers/dashboardController.js"
check_file "backend/src/controllers/shipmentController.js"
check_file "backend/src/controllers/consumptionController.js"
check_file "backend/src/routes/index.js"
check_file "backend/src/routes/authRoutes.js"
check_file "backend/src/routes/drugRoutes.js"
check_file "backend/src/routes/inventoryRoutes.js"
check_file "backend/src/routes/alertRoutes.js"
check_file "backend/src/routes/dashboardRoutes.js"
check_file "backend/src/routes/shipmentRoutes.js"
check_file "backend/src/routes/consumptionRoutes.js"
echo ""

echo "📁 Checking Frontend Structure..."
check_dir "frontend"
check_dir "frontend/src"
check_dir "frontend/src/app"
check_dir "frontend/src/components"
check_dir "frontend/src/contexts"
check_dir "frontend/src/lib"
check_dir "frontend/src/types"
check_file "frontend/package.json"
check_file "frontend/Dockerfile"
check_file "frontend/.env.local.example"
check_file "frontend/tsconfig.json"
check_file "frontend/tailwind.config.js"
check_file "frontend/next.config.js"
check_file "frontend/postcss.config.js"
check_file "frontend/src/app/layout.tsx"
check_file "frontend/src/app/page.tsx"
check_file "frontend/src/app/globals.css"
check_file "frontend/src/app/login/page.tsx"
check_file "frontend/src/app/dashboard/admin/page.tsx"
check_file "frontend/src/app/dashboard/hospital/page.tsx"
check_file "frontend/src/app/dashboard/warehouse/page.tsx"
check_file "frontend/src/components/Navbar.tsx"
check_file "frontend/src/components/DashboardCard.tsx"
check_file "frontend/src/components/AlertBadge.tsx"
check_file "frontend/src/contexts/AuthContext.tsx"
check_file "frontend/src/lib/api.ts"
check_file "frontend/src/lib/utils.ts"
check_file "frontend/src/types/index.ts"
echo ""

echo "📁 Checking Docker Configuration..."
check_file "docker-compose.yml"
echo ""

echo "📁 Checking Documentation..."
check_file "README.md"
check_file ".gitignore"
echo ""

echo "===================================="
if [ $errors -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed!${NC}"
    echo ""
    echo "Structure is complete. Ready for deployment!"
    exit 0
else
    echo -e "${RED}✗ Found $errors error(s)${NC}"
    echo ""
    echo "Please fix the missing files/directories before deployment."
    exit 1
fi
