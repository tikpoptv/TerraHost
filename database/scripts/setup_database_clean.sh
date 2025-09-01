#!/bin/bash
# TerraHost Clean Database Setup Script
# Description: Setup database with migrations only (no seed data)
# Author: TerraHost Team
# Date: 2025-08-31

set -e

# Load environment variables from .env file if exists
SCRIPT_DIR="$(dirname "$0")"
ENV_FILE="$SCRIPT_DIR/../.env"

if [ -f "$ENV_FILE" ]; then
    echo "📋 Loading database configuration from .env file..."
    export $(grep -v '^#' "$ENV_FILE" | xargs)
fi

# Configuration with fallback defaults
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-terrahost}
DB_USER=${DB_USER:-postgres}
DB_PASSWORD=${DB_PASSWORD:-password}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 TerraHost Clean Database Setup${NC}"
echo "=================================="
echo -e "${YELLOW}📝 This will create a clean database without seed data${NC}"

# Function to run SQL file
run_sql() {
    local file=$1
    local description=$2
    echo -e "${YELLOW}📄 $description${NC}"
    
    PGPASSWORD=$DB_PASSWORD psql \
        -h $DB_HOST \
        -p $DB_PORT \
        -U $DB_USER \
        -d $DB_NAME \
        -f $file
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Success${NC}"
    else
        echo -e "${RED}❌ Failed${NC}"
        exit 1
    fi
}

# Check if PostgreSQL is available
echo -e "${YELLOW}🔍 Checking PostgreSQL connection...${NC}"
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "SELECT version();" > /dev/null 2>&1

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Cannot connect to PostgreSQL${NC}"
    echo "Please check your database connection settings:"
    echo "  Host: $DB_HOST"
    echo "  Port: $DB_PORT"
    echo "  User: $DB_USER"
    echo "  Database: $DB_NAME"
    exit 1
fi

echo -e "${GREEN}✅ PostgreSQL connection successful${NC}"

# Create database if it doesn't exist
echo -e "${YELLOW}🗄️  Creating database if not exists...${NC}"
PGPASSWORD=$DB_PASSWORD psql \
    -h $DB_HOST \
    -p $DB_PORT \
    -U $DB_USER \
    -d postgres \
    -c "CREATE DATABASE $DB_NAME;" 2>/dev/null || echo "Database already exists"

# Change to database directory
cd "$(dirname "$0")/.."

# Run migrations only
echo -e "${GREEN}📚 Running database migrations only...${NC}"
run_sql "scripts/run_migrations.sql" "Executing all migrations"

# Show summary
echo ""
echo -e "${GREEN}🎉 Clean database setup completed successfully!${NC}"
echo "=============================================="
echo ""
echo "Database Information:"
echo "  Host: $DB_HOST"
echo "  Port: $DB_PORT"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo ""
echo -e "${YELLOW}📋 Database is ready with empty tables${NC}"
echo ""
echo "Next steps:"
echo "  1. Create your first admin user through the API"
echo "  2. Configure storage settings"
echo "  3. Set up processing configurations"
echo ""
echo "You can now start the TerraHost application."
