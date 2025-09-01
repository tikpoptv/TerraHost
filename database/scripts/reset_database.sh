#!/bin/bash
# TerraHost Database Reset Script
# Description: Drop and recreate database from scratch
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

echo -e "${RED}⚠️  TerraHost Database Reset${NC}"
echo "=========================="
echo -e "${RED}⚠️  WARNING: This will DESTROY all data in the database!${NC}"
echo ""

# Confirmation prompt
read -p "Are you sure you want to reset the database? (type 'yes' to confirm): " confirm
if [ "$confirm" != "yes" ]; then
    echo -e "${YELLOW}❌ Database reset cancelled${NC}"
    exit 0
fi

echo ""
echo -e "${YELLOW}🔍 Checking PostgreSQL connection...${NC}"
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "SELECT version();" > /dev/null 2>&1

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Cannot connect to PostgreSQL${NC}"
    exit 1
fi

echo -e "${GREEN}✅ PostgreSQL connection successful${NC}"

# Terminate active connections to the database
echo -e "${YELLOW}🔌 Terminating active connections...${NC}"
PGPASSWORD=$DB_PASSWORD psql \
    -h $DB_HOST \
    -p $DB_PORT \
    -U $DB_USER \
    -d postgres \
    -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$DB_NAME';" > /dev/null 2>&1 || true

# Drop database
echo -e "${YELLOW}🗑️  Dropping database...${NC}"
PGPASSWORD=$DB_PASSWORD psql \
    -h $DB_HOST \
    -p $DB_PORT \
    -U $DB_USER \
    -d postgres \
    -c "DROP DATABASE IF EXISTS $DB_NAME;"

echo -e "${GREEN}✅ Database dropped successfully${NC}"

# Ask for setup option
echo ""
echo "What would you like to do next?"
echo "1) Setup clean database (migrations only)"
echo "2) Setup database with seed data"
echo "3) Exit without recreating"
echo ""

read -p "Choose option (1/2/3): " option

case $option in
    1)
        echo -e "${GREEN}🔄 Setting up clean database...${NC}"
        ./database/scripts/setup_database_clean.sh
        ;;
    2)
        echo -e "${GREEN}🔄 Setting up database with seed data...${NC}"
        ./database/scripts/setup_database.sh
        ;;
    3)
        echo -e "${YELLOW}👋 Exiting without recreating database${NC}"
        exit 0
        ;;
    *)
        echo -e "${RED}❌ Invalid option${NC}"
        exit 1
        ;;
esac
