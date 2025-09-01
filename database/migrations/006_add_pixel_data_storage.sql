-- TerraHost Database Migration 006: Add Pixel Data Storage
-- Description: Add tables to store individual pixel values for spatial queries
-- Author: TerraHost Team
-- Date: 2025-08-31

-- Pixel data storage for extracted values
CREATE TABLE pixel_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    layer_id UUID NOT NULL REFERENCES spatial_layers(id) ON DELETE CASCADE,
    
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

-- Aggregated pixel data for performance (grid-based)
CREATE TABLE pixel_grid_summary (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    layer_id UUID NOT NULL REFERENCES spatial_layers(id) ON DELETE CASCADE,
    
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

-- Time-series data for temporal analysis
CREATE TABLE pixel_time_series (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    location GEOMETRY(POINT, 4326) NOT NULL,
    
    -- Reference to source data
    file_id UUID NOT NULL REFERENCES geotiff_files(id) ON DELETE CASCADE,
    layer_id UUID NOT NULL REFERENCES spatial_layers(id) ON DELETE CASCADE,
    
    -- Temporal information
    acquisition_date DATE NOT NULL, -- When the satellite image was taken
    season VARCHAR(20), -- 'spring', 'summer', 'autumn', 'winter'
    
    -- Values at this location and time
    band_values JSONB NOT NULL,
    computed_indices JSONB,
    land_cover_class VARCHAR(100),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Spatial analysis results cache
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

-- Indexes for spatial and temporal queries
CREATE INDEX idx_pixel_data_layer_id ON pixel_data(layer_id);
CREATE INDEX idx_pixel_data_location ON pixel_data USING GIST(location);
CREATE INDEX idx_pixel_data_pixel_coords ON pixel_data(pixel_x, pixel_y);
CREATE INDEX idx_pixel_data_classification ON pixel_data(land_cover_class);

CREATE INDEX idx_pixel_grid_layer_id ON pixel_grid_summary(layer_id);
CREATE INDEX idx_pixel_grid_cell ON pixel_grid_summary USING GIST(grid_cell);
CREATE INDEX idx_pixel_grid_size ON pixel_grid_summary(grid_size_meters);
CREATE INDEX idx_pixel_grid_class ON pixel_grid_summary(dominant_class);

CREATE INDEX idx_pixel_time_series_location ON pixel_time_series USING GIST(location);
CREATE INDEX idx_pixel_time_series_date ON pixel_time_series(acquisition_date);
CREATE INDEX idx_pixel_time_series_file_id ON pixel_time_series(file_id);
CREATE INDEX idx_pixel_time_series_layer_id ON pixel_time_series(layer_id);
CREATE INDEX idx_pixel_time_series_season ON pixel_time_series(season);

CREATE INDEX idx_spatial_analysis_bbox ON spatial_analysis_cache USING GIST(query_bbox);
CREATE INDEX idx_spatial_analysis_type ON spatial_analysis_cache(analysis_type);
CREATE INDEX idx_spatial_analysis_expires ON spatial_analysis_cache(expires_at);
CREATE INDEX idx_spatial_analysis_cache_key ON spatial_analysis_cache(cache_key);

-- Function to clean expired cache
CREATE OR REPLACE FUNCTION clean_expired_spatial_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM spatial_analysis_cache WHERE expires_at < CURRENT_TIMESTAMP;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE pixel_data IS 'Individual pixel values extracted from GeoTIFF layers';
COMMENT ON TABLE pixel_grid_summary IS 'Aggregated pixel statistics in grid cells for performance';
COMMENT ON TABLE pixel_time_series IS 'Time-series data for temporal analysis';
COMMENT ON TABLE spatial_analysis_cache IS 'Cache for expensive spatial analysis results';

COMMENT ON COLUMN pixel_data.band_values IS 'Raw band values: {"band_1": 120, "band_2": 45, "band_3": 200}';
COMMENT ON COLUMN pixel_data.computed_indices IS 'Vegetation indices: {"ndvi": 0.65, "ndwi": 0.23}';
COMMENT ON COLUMN pixel_grid_summary.band_statistics IS 'Per-band stats: {"band_1": {"min": 10, "max": 200, "mean": 120}}';

-- Insert migration record
INSERT INTO migrations (filename, description, checksum) 
VALUES ('006_add_pixel_data_storage.sql', 'Add pixel data storage for spatial queries', 'pixel_006');
