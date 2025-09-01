-- TerraHost Database Migration 005: System Monitoring & Analytics
-- Description: Create system monitoring, logging, and analytics tables
-- Author: TerraHost Team
-- Date: 2025-08-31

-- System health monitoring
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

-- Usage statistics
CREATE TABLE usage_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
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

-- Audit logs
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
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

-- System configurations
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

-- Cache metadata for performance optimization
CREATE TABLE cache_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cache_key VARCHAR(255) NOT NULL UNIQUE,
    cache_type VARCHAR(100) NOT NULL, -- 'thumbnail', 'statistics', 'query_result'
    
    -- Cache details
    file_path TEXT,
    file_size BIGINT,
    checksum VARCHAR(64),
    
    -- Related resources
    related_file_id UUID REFERENCES geotiff_files(id) ON DELETE CASCADE,
    related_job_id UUID REFERENCES processing_jobs(id) ON DELETE CASCADE,
    
    -- Cache management
    hit_count BIGINT DEFAULT 0,
    last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notification system
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
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

-- Indexes for performance
CREATE INDEX idx_system_health_timestamp ON system_health(timestamp);

CREATE INDEX idx_usage_stats_user_id ON usage_stats(user_id);
CREATE INDEX idx_usage_stats_date ON usage_stats(date);
CREATE INDEX idx_usage_stats_user_date ON usage_stats(user_id, date);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_ip ON audit_logs(ip_address);

CREATE INDEX idx_system_configs_key ON system_configs(key);
CREATE INDEX idx_system_configs_public ON system_configs(is_public);

CREATE INDEX idx_cache_metadata_key ON cache_metadata(cache_key);
CREATE INDEX idx_cache_metadata_type ON cache_metadata(cache_type);
CREATE INDEX idx_cache_metadata_expires ON cache_metadata(expires_at);
CREATE INDEX idx_cache_metadata_file_id ON cache_metadata(related_file_id);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = false;

-- Triggers
CREATE TRIGGER update_usage_stats_updated_at 
    BEFORE UPDATE ON usage_stats 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_configs_updated_at 
    BEFORE UPDATE ON system_configs 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE system_health IS 'System performance and health monitoring metrics';
COMMENT ON TABLE usage_stats IS 'User activity and resource usage statistics';
COMMENT ON TABLE audit_logs IS 'Security and activity audit trail';
COMMENT ON TABLE system_configs IS 'Application configuration settings';
COMMENT ON TABLE cache_metadata IS 'Cache management and optimization';
COMMENT ON TABLE notifications IS 'User notifications and alerts';

-- Insert migration record
INSERT INTO migrations (filename, description, checksum) 
VALUES ('005_create_system_monitoring.sql', 'Create system monitoring and analytics tables', 'monitoring_005');
