#!/bin/bash

# TerraHost Database Update Script
# Updates existing database with new migrations without losing data

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}📋 Loading database configuration from .env file...${NC}"

# Load environment variables from .env file
if [ -f ".env" ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    echo -e "${YELLOW}⚠️  .env file not found, using defaults${NC}"
fi

# Database configuration with defaults
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-terrahost}
DB_USER=${DB_USER:-postgres}

# Set PGPASSWORD for non-interactive use
export PGPASSWORD=${DB_PASSWORD:-password}

echo -e "${BLUE}🔄 TerraHost Database Update${NC}"
echo "=================================="
echo -e "${YELLOW}📝 This will update the existing database with new migrations${NC}"
echo
echo "Database Information:"
echo "  Host: $DB_HOST"
echo "  Port: $DB_PORT"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo

# Function to run SQL and check result
run_sql() {
    local sql="$1"
    local description="$2"
    
    echo -e "${BLUE}🔧 $description${NC}"
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "$sql" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Success${NC}"
        return 0
    else
        echo -e "${RED}❌ Failed${NC}"
        return 1
    fi
}

# Function to check if migration exists
check_migration_exists() {
    local migration_file="$1"
    
    local count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c \
        "SELECT COUNT(*) FROM migrations WHERE filename = '$migration_file';" 2>/dev/null | xargs)
    
    if [ "$count" -gt 0 ]; then
        return 0  # Migration exists
    else
        return 1  # Migration doesn't exist
    fi
}

# Function to run single migration
run_migration() {
    local migration_file="$1"
    local migration_path="migrations/$migration_file"
    
    if [ ! -f "$migration_path" ]; then
        echo -e "${RED}❌ Migration file not found: $migration_path${NC}"
        return 1
    fi
    
    if check_migration_exists "$migration_file"; then
        echo -e "${YELLOW}⏭️  Migration $migration_file already applied, skipping${NC}"
        return 0
    fi
    
    echo -e "${BLUE}📄 Running migration: $migration_file${NC}"
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$migration_path"; then
        echo -e "${GREEN}✅ Migration $migration_file completed${NC}"
        return 0
    else
        echo -e "${RED}❌ Migration $migration_file failed${NC}"
        return 1
    fi
}

echo -e "${BLUE}🔍 Checking PostgreSQL connection...${NC}"
if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${RED}❌ Cannot connect to PostgreSQL database${NC}"
    echo "Please check your database configuration and ensure PostgreSQL is running."
    exit 1
fi
echo -e "${GREEN}✅ PostgreSQL connection successful${NC}"

echo
echo -e "${BLUE}🔄 Checking for new migrations...${NC}"

# Check and run migrations in order
migrations=(
    "001_init_database.sql"
    "002_create_users.sql"
    "003_create_file_management.sql"
    "004_create_processing_system.sql"
    "005_create_system_monitoring.sql"
    "006_add_pixel_data_storage.sql"
    "007_add_soft_delete_activation.sql"
)

new_migrations_count=0

for migration in "${migrations[@]}"; do
    if ! check_migration_exists "$migration"; then
        echo -e "${YELLOW}📝 New migration found: $migration${NC}"
        ((new_migrations_count++))
    fi
done

if [ $new_migrations_count -eq 0 ]; then
    echo -e "${GREEN}✅ Database is up to date. No new migrations to apply.${NC}"
    echo
    echo -e "${BLUE}📊 Current migration status:${NC}"
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c \
        "SELECT filename, description, executed_at FROM migrations ORDER BY executed_at;"
    exit 0
fi

echo
echo -e "${YELLOW}⚠️  Found $new_migrations_count new migration(s) to apply${NC}"
echo
read -p "Do you want to continue with the database update? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}🚫 Database update cancelled${NC}"
    exit 0
fi

echo
echo -e "${BLUE}🚀 Starting database update...${NC}"

# Create backup notification
echo -e "${YELLOW}💾 Recommendation: Create a database backup before proceeding${NC}"
echo "   pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER $DB_NAME > backup_$(date +%Y%m%d_%H%M%S).sql"
echo
read -p "Continue without backup? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}🚫 Database update cancelled${NC}"
    echo -e "${BLUE}💡 Please create a backup and run this script again${NC}"
    exit 0
fi

echo
echo -e "${BLUE}🔄 Applying new migrations...${NC}"

# Apply new migrations
for migration in "${migrations[@]}"; do
    if ! check_migration_exists "$migration"; then
        if ! run_migration "$migration"; then
            echo -e "${RED}❌ Migration failed: $migration${NC}"
            echo -e "${RED}🚫 Database update stopped${NC}"
            exit 1
        fi
    fi
done

echo
echo -e "${GREEN}🎉 Database update completed successfully!${NC}"
echo "=============================================="
echo
echo -e "${BLUE}📊 Final migration status:${NC}"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c \
    "SELECT filename, description, executed_at FROM migrations ORDER BY executed_at;"

echo
echo -e "${GREEN}✅ Your database is now up to date!${NC}"
echo
echo "Next steps:"
echo "  1. Restart your application if needed"
echo "  2. Test the new features"
echo "  3. Check application logs for any issues"
echo
