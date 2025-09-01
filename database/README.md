# TerraHost Database Setup

Complete database schema and setup scripts for TerraHost geospatial data processing system.

## Database Structure

### Core Tables
- **Users & Authentication**: `users`, `user_sessions`, `api_keys`
- **File Management**: `geotiff_files`, `file_uploads`, `file_storage`, `spatial_metadata`
- **Processing System**: `processing_jobs`, `job_results`, `spatial_layers`, `spatial_features`
- **System Monitoring**: `system_health`, `usage_stats`, `audit_logs`, `notifications`

### Technology Stack
- **PostgreSQL** with **PostGIS** extension for spatial data
- **UUID** primary keys for better scalability
- **JSONB** columns for flexible metadata storage
- **Spatial indexing** for geographic queries
- **Enum types** for status fields

## Setup Scripts

### 1. Fresh Installation (with sample data)
```bash
./database/scripts/setup_database.sh
```
- Creates database and runs all migrations
- Inserts seed data and default admin user
- Ready to use immediately

### 2. Clean Installation (empty database)
```bash
./database/scripts/setup_database_clean.sh
```
- Creates database and runs all migrations
- No seed data - empty tables only
- Requires manual user creation

### 3. Reset Database
```bash
./database/scripts/reset_database.sh
```
- Drops existing database completely
- Offers choice of clean or seeded setup
- **⚠️ WARNING: Destroys all data**

## Environment Variables

Set these environment variables before running setup scripts:

```bash
export DB_HOST=localhost      # Database host
export DB_PORT=5432          # Database port
export DB_NAME=terrahost     # Database name
export DB_USER=postgres      # Database user
export DB_PASSWORD=password  # Database password
```

## Manual Migration

To run migrations manually:

```bash
# Connect to PostgreSQL
psql -h localhost -U postgres -d terrahost

# Run migrations in order
\i database/scripts/run_migrations.sql
```

## Default Credentials

When using `setup_database.sh`, a default admin user is created:

- **Email**: `admin@terrahost.com`
- **Password**: `admin123`

**⚠️ Change this password in production!**

## Database Features

### Spatial Data Support
- PostGIS geometry columns for spatial features
- Spatial indexing (GIST) for performance
- Support for various coordinate systems
- Bounding box and intersection queries

### File Management
- Chunked upload support
- Multiple storage backends (local, S3, NextCloud)
- File validation and checksums
- Metadata extraction from GeoTIFF

### Processing System
- Async job queue with priorities
- Layer extraction and analysis
- Progress tracking and error handling
- Configurable processing templates

### Monitoring & Analytics
- System health metrics
- User usage statistics
- Comprehensive audit logging
- Notification system

## Schema Diagram

```
users ──┐
        ├── geotiff_files ──┐
        │                   ├── spatial_metadata
        │                   ├── processing_jobs ── job_results
        │                   └── spatial_layers ── spatial_features
        ├── user_sessions
        ├── api_keys
        ├── usage_stats
        └── notifications
```

## Migration System

Migrations are tracked in the `migrations` table:
- Each migration has a unique filename and checksum
- Migrations run in sequential order
- Safe to re-run (idempotent operations)

## Performance Considerations

### Indexes
- All foreign keys are indexed
- Spatial columns use GIST indexes
- Frequently queried columns have dedicated indexes
- Composite indexes for common query patterns

### Partitioning
Consider partitioning these tables for large datasets:
- `audit_logs` (by date)
- `usage_stats` (by date)
- `system_health` (by date)

### Maintenance
Regular maintenance tasks:
- `VACUUM ANALYZE` for query optimization
- `REINDEX` for spatial indexes
- Archive old audit logs
- Clean expired cache entries
