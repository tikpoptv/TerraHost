-- TerraHost Database Migration 008: Comprehensive Raw Data Storage
-- Description: Add comprehensive storage for ALL raw data before file deletion
-- Author: TerraHost Team  
-- Date: 2025-01-02

-- Raw file metadata storage (เก็บ metadata ดิบทั้งหมด)
CREATE TABLE raw_file_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID NOT NULL REFERENCES geotiff_files(id) ON DELETE CASCADE,
    
    -- Complete metadata dump from GDAL
    gdal_metadata JSONB NOT NULL, -- Raw GDAL metadata ทั้งหมด
    band_metadata JSONB NOT NULL, -- Metadata ของแต่ละ band
    
    -- Sensor information  
    sensor_info JSONB, -- Parsed sensor detection results
    acquisition_info JSONB, -- วันที่ถ่าย, sun angle, etc.
    processing_info JSONB, -- Level of processing
    coordinate_info JSONB, -- Coordinate system details
    quality_info JSONB, -- Quality flags, cloud cover, etc.
    
    -- Technical specifications
    file_format_info JSONB, -- Driver, compression, etc.
    geotransform DOUBLE PRECISION[6], -- Exact geotransform
    projection_wkt TEXT, -- Complete WKT projection
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Raw band data storage (เก็บข้อมูล pixel ดิบ)
CREATE TABLE raw_band_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID NOT NULL REFERENCES geotiff_files(id) ON DELETE CASCADE,
    
    -- Band information
    band_number INTEGER NOT NULL,
    band_description TEXT,
    band_type VARCHAR(50), -- 'dsr', 'red', 'green', 'blue', 'nir', etc.
    data_type VARCHAR(50), -- 'Float32', 'UInt16', etc.
    
    -- Statistical data (complete)
    statistics JSONB NOT NULL, -- {min, max, mean, std, median, q25, q75, etc.}
    histogram JSONB, -- Complete histogram data {bins: [], counts: []}
    
    -- Pixel value samples (for reconstruction)
    sample_pixels JSONB, -- Sample of actual pixel values with coordinates
    
    -- Band-specific metadata
    wavelength DOUBLE PRECISION, -- Wavelength if available
    color_interpretation VARCHAR(50),
    nodata_value DOUBLE PRECISION,
    scale_factor DOUBLE PRECISION,
    band_offset DOUBLE PRECISION,
    unit_type VARCHAR(50),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Complete analysis results storage
CREATE TABLE complete_analysis_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID NOT NULL REFERENCES geotiff_files(id) ON DELETE CASCADE,
    
    -- All computed indices
    vegetation_indices JSONB, -- NDVI, SAVI, EVI, RVI, GNDVI
    water_indices JSONB, -- NDWI, MNDWI, WRI
    soil_urban_indices JSONB, -- NDBI, BSI
    thermal_indices JSONB, -- Temperature analysis
    custom_indices JSONB, -- All ratio indices
    
    -- Spectral analysis results
    band_correlations JSONB, -- All band correlation coefficients
    spectral_signatures JSONB, -- Spectral curve analysis
    surface_material_hints JSONB, -- Material classification results
    atmospheric_analysis JSONB, -- Atmospheric effects
    
    -- RGB analysis
    rgb_analysis JSONB, -- Brightness, saturation, hue analysis
    
    -- Spatial analysis
    spatial_features JSONB, -- Geometry shapes and spatial features
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Raw pixel values compressed storage (เก็บ pixel values จริง)
CREATE TABLE compressed_pixel_storage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID NOT NULL REFERENCES geotiff_files(id) ON DELETE CASCADE,
    band_number INTEGER NOT NULL,
    
    -- Spatial grid information
    tile_x INTEGER NOT NULL, -- Tile column
    tile_y INTEGER NOT NULL, -- Tile row  
    tile_size INTEGER NOT NULL, -- Tile size (e.g., 256x256)
    
    -- Compressed pixel data
    pixel_data BYTEA, -- Compressed binary pixel data
    compression_method VARCHAR(50) DEFAULT 'gzip', -- Compression used
    original_size INTEGER, -- Original size before compression
    compressed_size INTEGER, -- Size after compression
    
    -- Spatial bounds of this tile
    tile_bounds GEOMETRY(POLYGON, 4326),
    
    -- Data integrity
    checksum VARCHAR(64), -- MD5 of compressed data
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Full extraction summary (สรุปรวมทั้งหมด)
CREATE TABLE extraction_summary (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID NOT NULL REFERENCES geotiff_files(id) ON DELETE CASCADE,
    
    -- Extraction metadata
    extraction_timestamp TIMESTAMP NOT NULL,
    extractor_version VARCHAR(50),
    extraction_method VARCHAR(100),
    
    -- Completeness metrics
    total_bands_extracted INTEGER,
    total_indices_calculated INTEGER,
    total_pixels_processed BIGINT,
    valid_pixel_ratio DOUBLE PRECISION,
    
    -- Quality metrics
    extraction_quality_score INTEGER, -- 0-110 points
    data_completeness_percentage DOUBLE PRECISION,
    has_sensor_detection BOOLEAN,
    has_spectral_analysis BOOLEAN,
    
    -- Data volumes
    raw_metadata_size INTEGER, -- Size of metadata in bytes
    raw_band_data_size BIGINT, -- Size of band data
    compressed_pixel_data_size BIGINT, -- Size of pixel storage
    total_storage_size BIGINT, -- Total size in database
    
    -- Original file info (for reference)
    original_filename TEXT,
    original_file_size BIGINT,
    original_checksum VARCHAR(64),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_raw_file_metadata_file_id ON raw_file_metadata(file_id);
CREATE INDEX idx_raw_band_data_file_id ON raw_band_data(file_id);
CREATE INDEX idx_raw_band_data_band_number ON raw_band_data(file_id, band_number);
CREATE INDEX idx_complete_analysis_file_id ON complete_analysis_results(file_id);
CREATE INDEX idx_compressed_pixel_file_band ON compressed_pixel_storage(file_id, band_number);
CREATE INDEX idx_compressed_pixel_spatial ON compressed_pixel_storage USING GIST(tile_bounds);
CREATE INDEX idx_extraction_summary_file_id ON extraction_summary(file_id);
CREATE INDEX idx_extraction_summary_timestamp ON extraction_summary(extraction_timestamp);

-- Add constraints
ALTER TABLE raw_band_data ADD CONSTRAINT uk_raw_band_data_file_band UNIQUE(file_id, band_number);
ALTER TABLE complete_analysis_results ADD CONSTRAINT uk_complete_analysis_file UNIQUE(file_id);
ALTER TABLE extraction_summary ADD CONSTRAINT uk_extraction_summary_file UNIQUE(file_id);

-- Comments for documentation
COMMENT ON TABLE raw_file_metadata IS 'Complete metadata storage before file deletion';
COMMENT ON TABLE raw_band_data IS 'Statistical and sample data for each band';
COMMENT ON TABLE complete_analysis_results IS 'All computed indices and analysis results';
COMMENT ON TABLE compressed_pixel_storage IS 'Compressed pixel values for data reconstruction';
COMMENT ON TABLE extraction_summary IS 'Summary of extraction process and data volumes';
