-- TerraHost Database Migration 003: File Management
-- Description: Create GeoTIFF file management and storage tables
-- Author: TerraHost Team
-- Date: 2025-08-31

-- File storage configurations
CREATE TABLE file_storage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    storage_type VARCHAR(50) NOT NULL, -- 'local', 's3', 'nextcloud'
    config JSONB NOT NULL, -- Storage-specific configuration
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Main GeoTIFF files registry
CREATE TABLE geotiff_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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

-- File upload tracking
CREATE TABLE file_uploads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID REFERENCES geotiff_files(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
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

-- Spatial metadata extracted from GeoTIFF
CREATE TABLE spatial_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID NOT NULL REFERENCES geotiff_files(id) ON DELETE CASCADE,
    
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

-- Indexes for performance
CREATE INDEX idx_geotiff_files_user_id ON geotiff_files(user_id);
CREATE INDEX idx_geotiff_files_status ON geotiff_files(upload_status);
CREATE INDEX idx_geotiff_files_created_at ON geotiff_files(created_at);
CREATE INDEX idx_geotiff_files_filename ON geotiff_files(filename);

CREATE INDEX idx_file_uploads_user_id ON file_uploads(user_id);
CREATE INDEX idx_file_uploads_session ON file_uploads(upload_session_id);
CREATE INDEX idx_file_uploads_expires ON file_uploads(expires_at);

CREATE INDEX idx_spatial_metadata_file_id ON spatial_metadata(file_id);
CREATE INDEX idx_spatial_metadata_extent ON spatial_metadata USING GIST(extent_geom);

-- Triggers
CREATE TRIGGER update_geotiff_files_updated_at 
    BEFORE UPDATE ON geotiff_files 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE file_storage IS 'Storage backend configurations (local, cloud, etc.)';
COMMENT ON TABLE geotiff_files IS 'Registry of uploaded GeoTIFF files';
COMMENT ON TABLE file_uploads IS 'Chunked upload session tracking';
COMMENT ON TABLE spatial_metadata IS 'Spatial and raster metadata extracted from GeoTIFF files';

-- Insert migration record
INSERT INTO migrations (filename, description, checksum) 
VALUES ('003_create_file_management.sql', 'Create file management and spatial metadata tables', 'files_003');
