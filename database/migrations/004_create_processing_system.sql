-- TerraHost Database Migration 004: Processing System
-- Description: Create layer processing and job management tables
-- Author: TerraHost Team
-- Date: 2025-08-31

-- Processing job configurations
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

-- Processing jobs queue
CREATE TABLE processing_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID NOT NULL REFERENCES geotiff_files(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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

-- Job results and outputs
CREATE TABLE job_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES processing_jobs(id) ON DELETE CASCADE,
    
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

-- Extracted spatial layers
CREATE TABLE spatial_layers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID NOT NULL REFERENCES geotiff_files(id) ON DELETE CASCADE,
    job_id UUID REFERENCES processing_jobs(id) ON DELETE CASCADE,
    result_id UUID REFERENCES job_results(id) ON DELETE CASCADE,
    
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

-- Spatial features extracted from layers
CREATE TABLE spatial_features (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    layer_id UUID NOT NULL REFERENCES spatial_layers(id) ON DELETE CASCADE,
    
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

-- Indexes for performance
CREATE INDEX idx_processing_jobs_file_id ON processing_jobs(file_id);
CREATE INDEX idx_processing_jobs_user_id ON processing_jobs(user_id);
CREATE INDEX idx_processing_jobs_status ON processing_jobs(status);
CREATE INDEX idx_processing_jobs_priority ON processing_jobs(priority, created_at);
CREATE INDEX idx_processing_jobs_type ON processing_jobs(job_type);

CREATE INDEX idx_job_results_job_id ON job_results(job_id);
CREATE INDEX idx_job_results_type ON job_results(result_type);

CREATE INDEX idx_spatial_layers_file_id ON spatial_layers(file_id);
CREATE INDEX idx_spatial_layers_job_id ON spatial_layers(job_id);
CREATE INDEX idx_spatial_layers_type ON spatial_layers(layer_type);
CREATE INDEX idx_spatial_layers_extent ON spatial_layers USING GIST(extent_geom);

CREATE INDEX idx_spatial_features_layer_id ON spatial_features(layer_id);
CREATE INDEX idx_spatial_features_geometry ON spatial_features USING GIST(geometry);
CREATE INDEX idx_spatial_features_type ON spatial_features(feature_type);
CREATE INDEX idx_spatial_features_class ON spatial_features(class_id);

-- Comments
COMMENT ON TABLE processing_configs IS 'Reusable processing configuration templates';
COMMENT ON TABLE processing_jobs IS 'Queue and tracking for background processing jobs';
COMMENT ON TABLE job_results IS 'Output files and results from processing jobs';
COMMENT ON TABLE spatial_layers IS 'Individual layers extracted from GeoTIFF files';
COMMENT ON TABLE spatial_features IS 'Individual spatial features detected in layers';

-- Insert migration record
INSERT INTO migrations (filename, description, checksum) 
VALUES ('004_create_processing_system.sql', 'Create processing system and spatial layers tables', 'processing_004');
