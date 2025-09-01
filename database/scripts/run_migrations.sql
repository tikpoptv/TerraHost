-- TerraHost Database Migration Runner
-- Description: Execute all migrations in sequence
-- Author: TerraHost Team
-- Date: 2025-08-31

-- Run migrations in order
\echo 'Starting TerraHost database migrations...'

\echo 'Running migration 001: Initialize database...'
\i migrations/001_init_database.sql

\echo 'Running migration 002: Create users...'
\i migrations/002_create_users.sql

\echo 'Running migration 003: Create file management...'
\i migrations/003_create_file_management.sql

\echo 'Running migration 004: Create processing system...'
\i migrations/004_create_processing_system.sql

\echo 'Running migration 005: Create system monitoring...'
\i migrations/005_create_system_monitoring.sql

\echo 'Running migration 006: Add pixel data storage...'
\i migrations/006_add_pixel_data_storage.sql

\echo 'Running migration 007: Add soft delete and activation tracking...'
\i migrations/007_add_soft_delete_activation.sql

\echo 'Migrations completed successfully!'

-- Show final migration status
SELECT 
    filename,
    description,
    executed_at 
FROM migrations 
ORDER BY executed_at;
