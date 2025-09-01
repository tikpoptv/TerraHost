-- TerraHost Database Seed Data
-- Description: Insert initial data for development and testing
-- Author: TerraHost Team
-- Date: 2025-08-31

-- Insert default system configurations
INSERT INTO system_configs (key, value, value_type, description, is_public) VALUES
('max_file_size_mb', '1024', 'number', 'Maximum file upload size in MB', true),
('allowed_file_types', '["image/tiff", "image/geotiff"]', 'json', 'Allowed MIME types for upload', true),
('max_concurrent_jobs', '5', 'number', 'Maximum concurrent processing jobs', false),
('default_storage_type', 'local', 'string', 'Default storage backend', false),
('session_timeout_hours', '24', 'number', 'User session timeout in hours', false),
('enable_thumbnails', 'true', 'boolean', 'Generate thumbnails for uploaded files', true),
('thumbnail_size', '256', 'number', 'Thumbnail size in pixels', true),
('cache_expiry_days', '30', 'number', 'Cache expiry time in days', false);

-- Insert default storage configuration
INSERT INTO file_storage (name, storage_type, config, is_default, is_active) VALUES
('Local Storage', 'local', '{"base_path": "/app/storage/uploads", "max_size_gb": 100}', true, true);

-- Insert default processing configurations
INSERT INTO processing_configs (name, job_type, description, parameters) VALUES
('Basic Layer Extraction', 'layer_extraction', 'Extract individual bands as separate layers', 
 '{"extract_all_bands": true, "generate_thumbnails": true, "compute_statistics": true}'),

('RGB Composite', 'layer_extraction', 'Create RGB composite from bands 1,2,3',
 '{"bands": [1,2,3], "output_format": "png", "enhance_contrast": true}'),

('NDVI Analysis', 'analysis', 'Calculate Normalized Difference Vegetation Index',
 '{"red_band": 3, "nir_band": 4, "output_format": "geotiff", "compute_histogram": true}'),

('Thumbnail Generation', 'thumbnail_generation', 'Generate web-friendly thumbnails',
 '{"size": 256, "format": "jpeg", "quality": 85}');

-- Insert default admin user (password: 'admin123' - change in production!)
INSERT INTO users (email, password_hash, name, role, is_active, email_verified) VALUES
('admin@terrahost.com', '$2b$12$LQv3c1yqBwEHjBOyPW5YGu4cNzCrKzU3XH7i9VwR5YbP8mP6L3qXy', 'System Administrator', 'admin', true, true);

-- Insert sample notification types for the admin user
INSERT INTO notifications (user_id, type, title, message) VALUES
((SELECT id FROM users WHERE email = 'admin@terrahost.com'), 
 'system_alert', 
 'Welcome to TerraHost', 
 'System setup completed successfully. You can now start uploading GeoTIFF files.');

\echo 'Seed data inserted successfully!';
