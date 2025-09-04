#!/bin/bash

# TerraHost Database Update Script - Migration 008
# Description: Apply migration 008 for comprehensive raw data storage
# Usage: ./update_database_008.sh [environment]

set -e  # Exit on any error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATION_FILE="$PROJECT_ROOT/database/migrations/008_add_comprehensive_raw_data_storage.sql"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default environment
ENVIRONMENT="${1:-development}"

echo -e "${BLUE}🚀 TerraHost Database Update - Migration 008${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Load environment variables from .env file if exists (same as other scripts)
SCRIPT_DIR="$(dirname "$0")"
ENV_FILE="$SCRIPT_DIR/../.env"

if [ -f "$ENV_FILE" ]; then
    echo -e "${YELLOW}📋 Loading database configuration from .env file...${NC}"
    export $(grep -v '^#' "$ENV_FILE" | xargs)
else
    echo -e "${YELLOW}⚠️  .env file not found, using defaults${NC}"
fi

# Configuration with fallback defaults (same as other scripts)
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-terrahost}
DB_USER=${DB_USER:-postgres}
DB_PASSWORD=${DB_PASSWORD:-password}

echo -e "${BLUE}📊 Database Configuration:${NC}"
echo "   Host: $DB_HOST"
echo "   Port: $DB_PORT"
echo "   Database: $DB_NAME"
echo "   User: $DB_USER"
echo ""

# Check if migration file exists
if [ ! -f "$MIGRATION_FILE" ]; then
    echo -e "${RED}❌ Migration file not found: $MIGRATION_FILE${NC}"
    exit 1
fi

# Function to execute SQL
execute_sql() {
    local sql_file="$1"
    echo -e "${YELLOW}🔄 Executing: $(basename "$sql_file")${NC}"
    
    PGPASSWORD=$DB_PASSWORD psql \
        -h $DB_HOST \
        -p $DB_PORT \
        -U $DB_USER \
        -d $DB_NAME \
        -f $sql_file
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Success${NC}"
    else
        echo -e "${RED}❌ Failed${NC}"
        exit 1
    fi
}

# Function to check if migration already applied
check_migration_applied() {
    local migration_name="008_add_comprehensive_raw_data_storage"
    
    echo -e "${YELLOW}🔍 Checking if migration already applied...${NC}"
    
    local check_sql="
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'raw_file_metadata' 
        AND table_schema = 'public'
    );
    "
    
    local result=$(PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "$check_sql" | xargs)
    
    if [ "$result" = "t" ]; then
        echo -e "${YELLOW}⚠️  Migration appears to be already applied (raw_file_metadata table exists)${NC}"
        read -p "Do you want to continue anyway? This will fail if tables already exist. (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo -e "${BLUE}🚫 Migration cancelled by user${NC}"
            exit 0
        fi
    else
        echo -e "${GREEN}✅ Migration not yet applied, proceeding...${NC}"
    fi
}

# Function to backup database (optional)
backup_database() {
    echo -e "${YELLOW}💾 Creating database backup...${NC}"
    
    local backup_file="$PROJECT_ROOT/database/backups/backup_before_migration_008_$(date +%Y%m%d_%H%M%S).sql"
    mkdir -p "$(dirname "$backup_file")"
    
    if PGPASSWORD=$DB_PASSWORD pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" > "$backup_file"; then
        echo -e "${GREEN}✅ Backup created: $backup_file${NC}"
    else
        echo -e "${RED}❌ Backup failed, but continuing...${NC}"
    fi
}

# Function to verify migration
verify_migration() {
    echo -e "${YELLOW}🔍 Verifying migration...${NC}"
    
    local verify_sql="
    SELECT 
        expected_tables.table_name,
        CASE 
            WHEN t.table_name IS NOT NULL THEN '✅ Created'
            ELSE '❌ Missing'
        END as status
    FROM (VALUES 
        ('raw_file_metadata'),
        ('raw_band_data'),
        ('complete_analysis_results'),
        ('extraction_summary')
    ) AS expected_tables(table_name)
    LEFT JOIN information_schema.tables t ON t.table_name = expected_tables.table_name
    AND t.table_schema = 'public';
    "
    
    echo -e "${BLUE}📋 Migration Verification Results:${NC}"
    PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "$verify_sql"
}

# Main execution
main() {
    echo -e "${YELLOW}🏁 Starting migration process...${NC}"
    echo ""
    
    # Step 1: Check if already applied
    check_migration_applied
    
    # Step 2: Create backup (optional)
    read -p "Do you want to create a backup before migration? (Y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        backup_database
    fi
    
    # Step 3: Execute migration
    echo -e "${YELLOW}🚀 Applying Migration 008...${NC}"
    execute_sql "$MIGRATION_FILE"
    
    # Step 4: Verify migration
    verify_migration
    
    echo ""
    echo -e "${GREEN}🎉 Migration 008 completed successfully!${NC}"
    echo -e "${GREEN}✅ Raw data storage tables are now available${NC}"
    echo ""
    echo -e "${BLUE}📋 New Tables Created:${NC}"
    echo "   • raw_file_metadata - Complete GDAL metadata storage"
    echo "   • raw_band_data - Band statistics and pixel samples"
    echo "   • complete_analysis_results - All computed indices"
    echo "   • compressed_pixel_storage - Pixel data tiles"
    echo "   • extraction_summary - Processing summaries"
    echo ""
    echo -e "${YELLOW}🔧 Next Steps:${NC}"
    echo "   1. Restart your application server"
    echo "   2. Test file upload and processing"
    echo "   3. Verify raw data storage is working"
    echo ""
}

# Error handling
trap 'echo -e "${RED}❌ Migration failed!${NC}"; exit 1' ERR

# Execute main function
main

echo -e "${GREEN}✨ Database update complete!${NC}"
