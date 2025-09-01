-- TerraHost Database Schema for Draw.io
-- Generated: Mon Sep  1 09:32:42 +07 2025
-- Tables only (no indexes, triggers, or data)

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum types
CREATE TYPE user_role AS ENUM ('admin', 'user', 'viewer');
CREATE TYPE upload_status AS ENUM ('pending', 'uploading', 'processing', 'completed', 'failed');
CREATE TYPE job_status AS ENUM ('queued', 'running', 'completed', 'failed', 'cancelled');
CREATE TYPE job_type AS ENUM ('layer_extraction', 'format_conversion', 'analysis', 'thumbnail_generation');

-- Tables
-- From 001_init_database.sql
CREATE TABLE IF NOT EXISTS migrations (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL UNIQUE,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    checksum VARCHAR(64),
    description TEXT
);

-- From 002_create_users.sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role user_role DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token_hash VARCHAR(255) NOT NULL,
    device_info TEXT,
    ip_address INET,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) NOT NULL UNIQUE,
    permissions TEXT[], -- Array of permissions
    is_active BOOLEAN DEFAULT true,
    last_used TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- From 003_create_file_management.sql
CREATE TABLE file_storage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    storage_type VARCHAR(50) NOT NULL, -- 'local', 's3', 'nextcloud'
    config JSONB NOT NULL, -- Storage-specific configuration
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE geotiff_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    storage_id UUID NOT NULL REFERENCES file_storage(id),
    
    -- File information
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    checksum VARCHAR(64) NOT NULL,
    mime_type VARCHAR(100) DEFAULT 'image/tiff',
    
    -- Status and metadata
    upload_status upload_status DEFAULT 'pending',
    upload_progress INTEGER DEFAULT 0, -- 0-100
    error_message TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP
);

CREATE TABLE file_uploads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Upload details
    upload_session_id VARCHAR(255) NOT NULL,
    chunk_size INTEGER,
    total_chunks INTEGER,
    uploaded_chunks INTEGER DEFAULT 0,
    
    -- Validation
    expected_checksum VARCHAR(64),
    validation_status VARCHAR(50) DEFAULT 'pending',
    validation_errors TEXT[],
    
    -- Timestamps
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours')
);

CREATE TABLE spatial_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Raster dimensions
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    bands_count INTEGER NOT NULL,
    pixel_type VARCHAR(50), -- 'uint8', 'uint16', 'float32', etc.
    
    -- Spatial reference system
    coordinate_system TEXT, -- PROJ string or EPSG code
    geotransform DOUBLE PRECISION[6], -- GeoTransform matrix
    
    -- Spatial extent (using PostGIS geometry)
    extent_geom GEOMETRY(POLYGON, 4326), -- WGS84 bounding box
    
    -- Raster properties
    resolution_x DOUBLE PRECISION,
    resolution_y DOUBLE PRECISION,
    nodata_value DOUBLE PRECISION,
    
    -- Statistics per band
    band_statistics JSONB, -- Array of {min, max, mean, std} per band
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- From 004_create_processing_system.sql
CREATE TABLE processing_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    job_type job_type NOT NULL,
    description TEXT,
    parameters JSONB NOT NULL, -- Default parameters for this config
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE processing_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_id UUID REFERENCES processing_configs(id),
    
    -- Job details
    job_type job_type NOT NULL,
    status job_status DEFAULT 'queued',
    priority INTEGER DEFAULT 5, -- 1 (highest) to 10 (lowest)
    
    -- Processing parameters
    parameters JSONB, -- Job-specific parameters
    
    -- Progress tracking
    progress INTEGER DEFAULT 0, -- 0-100
    step_description TEXT,
    error_message TEXT,
    log_data TEXT,
    
    -- Resource usage
    cpu_time_seconds DOUBLE PRECISION,
    memory_peak_mb INTEGER,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '7 days')
);

CREATE TABLE job_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Result details
    result_type VARCHAR(100) NOT NULL, -- 'layer', 'thumbnail', 'statistics', 'report'
    output_path TEXT,
    output_format VARCHAR(50),
    file_size BIGINT,
    checksum VARCHAR(64),
    
    -- Result metadata
    metadata JSONB,
    preview_url TEXT,
    download_url TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

CREATE TABLE spatial_layers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Layer information
    layer_name VARCHAR(255) NOT NULL,
    band_index INTEGER, -- Which band this layer was extracted from
    layer_type VARCHAR(100), -- 'rgb', 'ndvi', 'elevation', 'classification'
    
    -- Spatial properties
    geometry_type VARCHAR(50), -- 'raster', 'vector', 'point_cloud'
    coordinate_system TEXT,
    extent_geom GEOMETRY(POLYGON, 4326),
    
    -- Layer statistics
    pixel_count BIGINT,
    unique_values INTEGER,
    statistics JSONB, -- Min, max, mean, std, histogram
    
    -- File references
    file_path TEXT,
    thumbnail_path TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE spatial_features (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Feature geometry (PostGIS)
    geometry GEOMETRY NOT NULL,
    
    -- Feature properties
    properties JSONB,
    feature_type VARCHAR(100), -- 'building', 'road', 'water', 'vegetation'
    confidence_score DOUBLE PRECISION, -- AI confidence (0-1)
    
    -- Classification/analysis results
    class_id INTEGER,
    class_name VARCHAR(255),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- From 005_create_system_monitoring.sql
CREATE TABLE system_health (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- System metrics
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    cpu_usage_percent DOUBLE PRECISION,
    memory_usage_percent DOUBLE PRECISION,
    disk_usage_percent DOUBLE PRECISION,
    
    -- Database metrics
    active_connections INTEGER,
    slow_queries_count INTEGER,
    database_size_mb BIGINT,
    
    -- Application metrics
    active_users INTEGER,
    processing_jobs_running INTEGER,
    processing_jobs_queued INTEGER,
    api_requests_per_minute INTEGER,
    
    -- Storage metrics
    total_files BIGINT,
    total_storage_gb DOUBLE PRECISION,
    
    -- Response times (milliseconds)
    avg_api_response_time DOUBLE PRECISION,
    avg_processing_time DOUBLE PRECISION
);

CREATE TABLE usage_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Activity tracking
    date DATE DEFAULT CURRENT_DATE,
    
    -- File operations
    files_uploaded INTEGER DEFAULT 0,
    files_downloaded INTEGER DEFAULT 0,
    files_processed INTEGER DEFAULT 0,
    total_upload_size_mb BIGINT DEFAULT 0,
    
    -- API usage
    api_calls_count INTEGER DEFAULT 0,
    api_errors_count INTEGER DEFAULT 0,
    
    -- Processing usage
    processing_time_seconds BIGINT DEFAULT 0,
    processing_jobs_success INTEGER DEFAULT 0,
    processing_jobs_failed INTEGER DEFAULT 0,
    
    -- Session info
    login_count INTEGER DEFAULT 0,
    session_duration_minutes BIGINT DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Action details
    action VARCHAR(255) NOT NULL, -- 'login', 'upload', 'download', 'delete', 'process'
    resource_type VARCHAR(100), -- 'file', 'job', 'user', 'system'
    resource_id UUID,
    
    -- Request details
    ip_address INET,
    user_agent TEXT,
    api_endpoint TEXT,
    http_method VARCHAR(10),
    
    -- Result
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    
    -- Additional context
    metadata JSONB,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE system_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(255) NOT NULL UNIQUE,
    value TEXT,
    value_type VARCHAR(50) DEFAULT 'string', -- 'string', 'number', 'boolean', 'json'
    description TEXT,
    is_public BOOLEAN DEFAULT false, -- Can be read by non-admin users
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE cache_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cache_key VARCHAR(255) NOT NULL UNIQUE,
    cache_type VARCHAR(100) NOT NULL, -- 'thumbnail', 'statistics', 'query_result'
    
    -- Cache details
    file_path TEXT,
    file_size BIGINT,
    checksum VARCHAR(64),
    
    -- Related resources
    
    -- Cache management
    hit_count BIGINT DEFAULT 0,
    last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Notification details
    type VARCHAR(100) NOT NULL, -- 'job_completed', 'job_failed', 'storage_warning', 'system_alert'
    title VARCHAR(255) NOT NULL,
    message TEXT,
    
    -- Related resources
    related_type VARCHAR(100), -- 'job', 'file', 'system'
    related_id UUID,
    
    -- Status
    is_read BOOLEAN DEFAULT false,
    is_sent BOOLEAN DEFAULT false,
    sent_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- From 006_add_pixel_data_storage.sql
CREATE TABLE pixel_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Spatial location
    location GEOMETRY(POINT, 4326) NOT NULL, -- WGS84 coordinates
    pixel_x INTEGER NOT NULL, -- Pixel column in original raster
    pixel_y INTEGER NOT NULL, -- Pixel row in original raster
    
    -- Multi-band values stored as JSONB for flexibility
    band_values JSONB NOT NULL, -- {"band_1": 120, "band_2": 45, "band_3": 200, ...}
    
    -- Computed indices (NDVI, NDWI, etc.)
    computed_indices JSONB, -- {"ndvi": 0.65, "ndwi": 0.23, "evi": 0.45}
    
    -- Classification results
    land_cover_class VARCHAR(100), -- 'forest', 'water', 'urban', 'agriculture'
    classification_confidence DOUBLE PRECISION, -- AI confidence (0-1)
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE pixel_grid_summary (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Grid cell definition
    grid_cell GEOMETRY(POLYGON, 4326) NOT NULL, -- Grid cell boundary
    grid_size_meters INTEGER NOT NULL, -- Grid cell size (e.g., 10m, 30m, 100m)
    
    -- Aggregated statistics per band
    band_statistics JSONB NOT NULL, -- {"band_1": {"min": 10, "max": 200, "mean": 120, "count": 100}}
    
    -- Dominant land cover in this grid cell
    dominant_class VARCHAR(100),
    class_distribution JSONB, -- {"forest": 0.6, "water": 0.3, "urban": 0.1}
    
    -- Computed indices statistics
    indices_statistics JSONB, -- {"ndvi": {"min": 0.1, "max": 0.8, "mean": 0.45}}
    
    pixel_count INTEGER NOT NULL, -- Number of pixels in this grid cell
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE pixel_time_series (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    location GEOMETRY(POINT, 4326) NOT NULL,
    
    -- Reference to source data
    
    -- Temporal information
    acquisition_date DATE NOT NULL, -- When the satellite image was taken
    season VARCHAR(20), -- 'spring', 'summer', 'autumn', 'winter'
    
    -- Values at this location and time
    band_values JSONB NOT NULL,
    computed_indices JSONB,
    land_cover_class VARCHAR(100),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE spatial_analysis_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Query parameters (for cache key)
    query_bbox GEOMETRY(POLYGON, 4326) NOT NULL, -- Bounding box of query
    analysis_type VARCHAR(100) NOT NULL, -- 'vegetation_health', 'change_detection', 'classification'
    parameters JSONB, -- Analysis parameters used
    
    -- Results
    result_data JSONB NOT NULL, -- Analysis results
    result_geometry GEOMETRY, -- Optional spatial result
    
    -- Cache management
    cache_key VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '1 hour'),
    hit_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

