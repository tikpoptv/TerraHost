-- TerraHost Database Migration 009: Add Processing Traceability & Cross-References
-- Description: Add processing session tracking and cross-references between all processing tables
-- Author: TerraHost Team  
-- Date: 2025-01-02

-- Create processing session table for complete traceability
CREATE TABLE processing_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID NOT NULL REFERENCES geotiff_files(id) ON DELETE CASCADE,
    
    -- Session identification
    session_uuid UUID NOT NULL DEFAULT uuid_generate_v4(),
    session_start_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    session_end_time TIMESTAMP,
    
    -- Processing context
    user_id UUID NOT NULL,
    processing_trigger VARCHAR(50) DEFAULT 'user_request', -- 'user_request', 'auto_retry', 'batch_process'
    
    -- Original file tracking
    original_filename TEXT NOT NULL,
    original_file_path TEXT,
    original_file_size BIGINT,
    original_checksum VARCHAR(64),
    
    -- Processing status
    status VARCHAR(20) NOT NULL DEFAULT 'started', -- 'started', 'processing', 'completed', 'failed'
    progress_percentage INTEGER DEFAULT 0,
    
    -- Processing details
    python_script_version VARCHAR(50),
    processing_method VARCHAR(100),
    extraction_steps JSONB, -- Step-by-step processing log
    
    -- Error handling
    error_message TEXT,
    error_stack TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- Performance metrics
    total_processing_time_ms INTEGER,
    python_execution_time_ms INTEGER,
    database_save_time_ms INTEGER,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add processing_session_id to all processing tables for complete traceability
ALTER TABLE spatial_metadata 
ADD COLUMN processing_session_id UUID REFERENCES processing_sessions(id) ON DELETE SET NULL;

ALTER TABLE raw_file_metadata 
ADD COLUMN processing_session_id UUID REFERENCES processing_sessions(id) ON DELETE SET NULL;

ALTER TABLE raw_band_data 
ADD COLUMN processing_session_id UUID REFERENCES processing_sessions(id) ON DELETE SET NULL;

ALTER TABLE complete_analysis_results 
ADD COLUMN processing_session_id UUID REFERENCES processing_sessions(id) ON DELETE SET NULL;

ALTER TABLE extraction_summary 
ADD COLUMN processing_session_id UUID REFERENCES processing_sessions(id) ON DELETE SET NULL;

-- Create processing steps tracking table
CREATE TABLE processing_steps_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    processing_session_id UUID NOT NULL REFERENCES processing_sessions(id) ON DELETE CASCADE,
    
    -- Step identification
    step_order INTEGER NOT NULL,
    step_name VARCHAR(100) NOT NULL,
    step_description TEXT,
    
    -- Step timing
    step_start_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    step_end_time TIMESTAMP,
    step_duration_ms INTEGER,
    
    -- Step results
    step_status VARCHAR(20) NOT NULL DEFAULT 'started', -- 'started', 'completed', 'failed', 'skipped'
    step_output JSONB, -- Results or data from this step
    error_message TEXT,
    
    -- Resource usage
    memory_usage_mb INTEGER,
    cpu_usage_percent INTEGER,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create data relationship tracking table
CREATE TABLE data_relationships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    processing_session_id UUID NOT NULL REFERENCES processing_sessions(id) ON DELETE CASCADE,
    
    -- Source and target data identification
    source_table VARCHAR(50) NOT NULL,
    source_record_id UUID NOT NULL,
    target_table VARCHAR(50) NOT NULL,
    target_record_id UUID NOT NULL,
    
    -- Relationship details
    relationship_type VARCHAR(50) NOT NULL, -- 'derived_from', 'calculated_from', 'sampled_from', 'aggregated_from'
    relationship_description TEXT,
    transformation_method VARCHAR(100),
    
    -- Data lineage
    data_source_path TEXT, -- Path to source data (e.g., 'band_1.statistics.mean')
    calculation_formula TEXT, -- Formula used for calculation
    sample_method VARCHAR(50), -- For sampled data
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create comprehensive data quality tracking
CREATE TABLE data_quality_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    processing_session_id UUID NOT NULL REFERENCES processing_sessions(id) ON DELETE CASCADE,
    
    -- Quality assessment
    overall_quality_score INTEGER, -- 0-110 points
    completeness_percentage DOUBLE PRECISION,
    accuracy_score INTEGER,
    consistency_score INTEGER,
    
    -- Data completeness by category
    spatial_data_completeness DOUBLE PRECISION,
    metadata_completeness DOUBLE PRECISION,
    band_data_completeness DOUBLE PRECISION,
    analysis_completeness DOUBLE PRECISION,
    
    -- Quality issues found
    missing_fields JSONB,
    data_anomalies JSONB,
    validation_warnings JSONB,
    
    -- Recommendations
    improvement_suggestions JSONB,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for performance
CREATE INDEX idx_processing_sessions_file_id ON processing_sessions(file_id);
CREATE INDEX idx_processing_sessions_user_id ON processing_sessions(user_id);
CREATE INDEX idx_processing_sessions_session_uuid ON processing_sessions(session_uuid);
CREATE INDEX idx_processing_sessions_status ON processing_sessions(status);
CREATE INDEX idx_processing_sessions_start_time ON processing_sessions(session_start_time);

CREATE INDEX idx_processing_steps_session_id ON processing_steps_log(processing_session_id);
CREATE INDEX idx_processing_steps_order ON processing_steps_log(processing_session_id, step_order);

CREATE INDEX idx_data_relationships_session_id ON data_relationships(processing_session_id);
CREATE INDEX idx_data_relationships_source ON data_relationships(source_table, source_record_id);
CREATE INDEX idx_data_relationships_target ON data_relationships(target_table, target_record_id);

CREATE INDEX idx_data_quality_session_id ON data_quality_metrics(processing_session_id);

-- Add foreign key indexes on processing_session_id columns
CREATE INDEX idx_spatial_metadata_session ON spatial_metadata(processing_session_id);
CREATE INDEX idx_raw_file_metadata_session ON raw_file_metadata(processing_session_id);
CREATE INDEX idx_raw_band_data_session ON raw_band_data(processing_session_id);
CREATE INDEX idx_complete_analysis_session ON complete_analysis_results(processing_session_id);
CREATE INDEX idx_extraction_summary_session ON extraction_summary(processing_session_id);

-- Add unique constraints
ALTER TABLE processing_sessions ADD CONSTRAINT uk_processing_session_file UNIQUE(file_id, session_uuid);
ALTER TABLE data_quality_metrics ADD CONSTRAINT uk_quality_metrics_session UNIQUE(processing_session_id);

-- Add triggers for updating timestamps
CREATE OR REPLACE FUNCTION update_processing_session_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_processing_session_timestamp
    BEFORE UPDATE ON processing_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_processing_session_timestamp();

-- Comments for documentation
COMMENT ON TABLE processing_sessions IS 'Complete tracking of each GeoTIFF processing session';
COMMENT ON TABLE processing_steps_log IS 'Detailed log of each processing step';
COMMENT ON TABLE data_relationships IS 'Tracking relationships and lineage between data records';
COMMENT ON TABLE data_quality_metrics IS 'Comprehensive quality assessment for each processing session';

COMMENT ON COLUMN processing_sessions.session_uuid IS 'Unique identifier for this processing session';
COMMENT ON COLUMN processing_sessions.extraction_steps IS 'JSON log of processing steps and their outcomes';
COMMENT ON COLUMN data_relationships.relationship_type IS 'Type of relationship: derived_from, calculated_from, sampled_from, aggregated_from';
COMMENT ON COLUMN data_quality_metrics.overall_quality_score IS 'Overall quality score (0-110 points)';

-- Create view for easy querying of complete processing information
CREATE VIEW processing_session_summary AS
SELECT 
    ps.id as session_id,
    ps.session_uuid,
    ps.file_id,
    gf.filename,
    gf.original_filename,
    ps.status as processing_status,
    ps.session_start_time,
    ps.session_end_time,
    ps.total_processing_time_ms,
    
    -- Data existence checks
    CASE WHEN sm.id IS NOT NULL THEN true ELSE false END as has_spatial_data,
    CASE WHEN rfm.id IS NOT NULL THEN true ELSE false END as has_raw_metadata,
    CASE WHEN COUNT(rbd.id) > 0 THEN true ELSE false END as has_band_data,
    CASE WHEN car.id IS NOT NULL THEN true ELSE false END as has_analysis_results,
    CASE WHEN es.id IS NOT NULL THEN true ELSE false END as has_summary,
    
    -- Quality metrics
    dqm.overall_quality_score,
    dqm.completeness_percentage,
    
    -- Processing steps count
    (SELECT COUNT(*) FROM processing_steps_log WHERE processing_session_id = ps.id) as total_steps,
    (SELECT COUNT(*) FROM processing_steps_log WHERE processing_session_id = ps.id AND step_status = 'completed') as completed_steps,
    
    -- Data relationships count
    (SELECT COUNT(*) FROM data_relationships WHERE processing_session_id = ps.id) as total_relationships

FROM processing_sessions ps
LEFT JOIN geotiff_files gf ON ps.file_id = gf.id
LEFT JOIN spatial_metadata sm ON gf.id = sm.file_id AND sm.processing_session_id = ps.id
LEFT JOIN raw_file_metadata rfm ON gf.id = rfm.file_id AND rfm.processing_session_id = ps.id
LEFT JOIN raw_band_data rbd ON gf.id = rbd.file_id AND rbd.processing_session_id = ps.id
LEFT JOIN complete_analysis_results car ON gf.id = car.file_id AND car.processing_session_id = ps.id
LEFT JOIN extraction_summary es ON gf.id = es.file_id AND es.processing_session_id = ps.id
LEFT JOIN data_quality_metrics dqm ON ps.id = dqm.processing_session_id
GROUP BY 
    ps.id, ps.session_uuid, ps.file_id, gf.filename, gf.original_filename,
    ps.status, ps.session_start_time, ps.session_end_time, ps.total_processing_time_ms,
    sm.id, rfm.id, car.id, es.id, dqm.overall_quality_score, dqm.completeness_percentage;

COMMENT ON VIEW processing_session_summary IS 'Complete overview of processing sessions with data existence and quality metrics';
