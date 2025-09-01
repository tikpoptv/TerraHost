-- TerraHost Database Migration 001: Initialize Database
-- Description: Create base database structure with PostGIS extension
-- Author: TerraHost Team
-- Date: 2025-08-31

-- Enable PostGIS extension for spatial data
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create migrations tracking table
CREATE TABLE IF NOT EXISTS migrations (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL UNIQUE,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    checksum VARCHAR(64),
    description TEXT
);

-- Insert this migration record
INSERT INTO migrations (filename, description, checksum) 
VALUES ('001_init_database.sql', 'Initialize database with PostGIS', 'init_001');

-- Create enum types
CREATE TYPE user_role AS ENUM ('admin', 'user', 'viewer');
CREATE TYPE upload_status AS ENUM ('pending', 'uploading', 'processing', 'completed', 'failed');
CREATE TYPE job_status AS ENUM ('queued', 'running', 'completed', 'failed', 'cancelled');
CREATE TYPE job_type AS ENUM ('layer_extraction', 'format_conversion', 'analysis', 'thumbnail_generation');

COMMENT ON TYPE user_role IS 'User permission levels';
COMMENT ON TYPE upload_status IS 'File upload and processing status';
COMMENT ON TYPE job_status IS 'Processing job status';
COMMENT ON TYPE job_type IS 'Types of processing jobs available';
