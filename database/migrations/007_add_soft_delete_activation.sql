-- TerraHost Database Migration 007: Add Soft Delete and Activation Tracking
-- Description: Add soft delete and activation tracking columns to relevant tables
-- Author: TerraHost Team
-- Date: 2025-09-01

-- Add activation tracking to user_sessions
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMP NULL;
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS deactivated_reason VARCHAR(255) NULL;

-- Add soft delete to user_sessions
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;

-- Add activation tracking to api_keys
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;

-- Add soft delete to files and related tables
ALTER TABLE geotiff_files ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;
ALTER TABLE geotiff_files ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id);

ALTER TABLE file_uploads ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;

-- Add soft delete to processing jobs
ALTER TABLE processing_jobs ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;
ALTER TABLE processing_jobs ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id);

ALTER TABLE job_results ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;

ALTER TABLE spatial_layers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;
ALTER TABLE spatial_layers ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id);

ALTER TABLE spatial_features ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;

-- Add soft delete to pixel data
ALTER TABLE pixel_data ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;
ALTER TABLE pixel_grid_summary ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;
ALTER TABLE pixel_time_series ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;

-- Add activation tracking to users (additional fields)
ALTER TABLE users ADD COLUMN IF NOT EXISTS activated_at TIMESTAMP NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS activated_by UUID REFERENCES users(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMP NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deactivated_by UUID REFERENCES users(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS deactivated_reason VARCHAR(255) NULL;

-- Add soft delete to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id);

-- Create indexes for soft delete queries
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);
CREATE INDEX IF NOT EXISTS idx_users_is_active_deleted ON users(is_active, deleted_at);

CREATE INDEX IF NOT EXISTS idx_user_sessions_active_deleted ON user_sessions(is_active, deleted_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_deleted_at ON user_sessions(deleted_at);

CREATE INDEX IF NOT EXISTS idx_geotiff_files_deleted_at ON geotiff_files(deleted_at);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_deleted_at ON processing_jobs(deleted_at);
CREATE INDEX IF NOT EXISTS idx_spatial_layers_deleted_at ON spatial_layers(deleted_at);

-- Function to soft delete user and related data
CREATE OR REPLACE FUNCTION soft_delete_user(user_uuid UUID, deleted_by_uuid UUID, reason TEXT DEFAULT NULL)
RETURNS BOOLEAN AS $$
BEGIN
    -- Soft delete user
    UPDATE users 
    SET deleted_at = CURRENT_TIMESTAMP,
        deleted_by = deleted_by_uuid,
        is_active = false,
        deactivated_at = CURRENT_TIMESTAMP,
        deactivated_by = deleted_by_uuid,
        deactivated_reason = reason
    WHERE id = user_uuid AND deleted_at IS NULL;
    
    -- Deactivate user sessions
    UPDATE user_sessions 
    SET is_active = false,
        deactivated_at = CURRENT_TIMESTAMP,
        deactivated_reason = 'User deleted'
    WHERE user_id = user_uuid AND is_active = true;
    
    -- Soft delete user's files
    UPDATE geotiff_files
    SET deleted_at = CURRENT_TIMESTAMP,
        deleted_by = deleted_by_uuid
    WHERE user_id = user_uuid AND deleted_at IS NULL;
    
    -- Soft delete user's jobs
    UPDATE processing_jobs
    SET deleted_at = CURRENT_TIMESTAMP,
        deleted_by = deleted_by_uuid
    WHERE user_id = user_uuid AND deleted_at IS NULL;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Function to activate user account
CREATE OR REPLACE FUNCTION activate_user(user_uuid UUID, activated_by_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE users 
    SET is_active = true,
        activated_at = CURRENT_TIMESTAMP,
        activated_by = activated_by_uuid,
        deactivated_at = NULL,
        deactivated_by = NULL,
        deactivated_reason = NULL
    WHERE id = user_uuid AND deleted_at IS NULL;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to deactivate user account
CREATE OR REPLACE FUNCTION deactivate_user(user_uuid UUID, deactivated_by_uuid UUID, reason TEXT DEFAULT NULL)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE users 
    SET is_active = false,
        deactivated_at = CURRENT_TIMESTAMP,
        deactivated_by = deactivated_by_uuid,
        deactivated_reason = reason
    WHERE id = user_uuid AND deleted_at IS NULL;
    
    -- Deactivate active sessions
    UPDATE user_sessions 
    SET is_active = false,
        deactivated_at = CURRENT_TIMESTAMP,
        deactivated_reason = reason
    WHERE user_id = user_uuid AND is_active = true;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON COLUMN users.activated_at IS 'When user account was activated';
COMMENT ON COLUMN users.activated_by IS 'Who activated the user account';
COMMENT ON COLUMN users.deactivated_at IS 'When user account was deactivated';
COMMENT ON COLUMN users.deactivated_by IS 'Who deactivated the user account';
COMMENT ON COLUMN users.deleted_at IS 'Soft delete timestamp';
COMMENT ON COLUMN users.deleted_by IS 'Who soft deleted the user';

COMMENT ON COLUMN user_sessions.is_active IS 'Whether session is currently active';
COMMENT ON COLUMN user_sessions.deactivated_at IS 'When session was deactivated';
COMMENT ON COLUMN user_sessions.deleted_at IS 'Soft delete timestamp for session';

COMMENT ON FUNCTION soft_delete_user IS 'Soft delete user and cascade to related data';
COMMENT ON FUNCTION activate_user IS 'Activate user account';
COMMENT ON FUNCTION deactivate_user IS 'Deactivate user account and sessions';

-- Insert migration record
INSERT INTO migrations (filename, description, checksum) 
VALUES ('007_add_soft_delete_activation.sql', 'Add soft delete and activation tracking', 'soft_delete_007');
