# TerraHost Database Documentation

## 📋 Overview
TerraHost ใช้ PostgreSQL + PostGIS สำหรับจัดการข้อมูล GeoTIFF และการประมวลผลข้อมูลเชิงพื้นที่ ฐานข้อมูลออกแบบมาเพื่อรองรับการอัพโหลด แยก layer และวิเคราะห์ข้อมูลดาวเทียม

## 🗂️ Database Structure

### **📁 Migration Files**

| File | Purpose | Description |
|------|---------|-------------|
| `001_init_database.sql` | ตั้งค่าเริ่มต้น | เปิดใช้ PostGIS, สร้าง enum types, ตาราง migrations |
| `002_create_users.sql` | จัดการผู้ใช้ | Authentication, authorization, sessions, API keys |
| `003_create_file_management.sql` | จัดการไฟล์ | อัพโหลด GeoTIFF, metadata เชิงพื้นที่ |
| `004_create_processing_system.sql` | ระบบประมวลผล | Job queue, layer extraction, spatial features |
| `005_create_system_monitoring.sql` | ติดตามระบบ | Monitoring, analytics, audit logs |
| `006_add_pixel_data_storage.sql` | เก็บข้อมูล pixel | Pixel values, time series, spatial analysis |
| `007_add_soft_delete_activation.sql` | Soft Delete & Activation | Soft delete, activation tracking, session management |

---

## 📊 Tables by Category

### 🔐 **User Management** (Migration 002)

#### `users`
- **Purpose**: ข้อมูลผู้ใช้และการ authentication
- **Key Fields**: `email`, `password_hash`, `role`, `is_active`
- **Features**: Role-based access (admin/user/viewer), soft delete, activation tracking
- **Soft Delete**: `deleted_at`, `deleted_by`, `activated_at`, `deactivated_at`

#### `user_sessions`
- **Purpose**: JWT sessions และ device tracking
- **Key Fields**: `token_hash`, `device_info`, `expires_at`, `is_active`
- **Features**: Multi-device support, session expiry, session deactivation
- **Soft Delete**: `deleted_at`, `deactivated_at`, `deactivated_reason`

#### `api_keys`
- **Purpose**: API keys สำหรับ programmatic access
- **Key Fields**: `key_hash`, `permissions[]`, `is_active`
- **Features**: Granular permissions, usage tracking

---

### 📁 **File Management** (Migration 003)

#### `file_storage`
- **Purpose**: กำหนดค่า storage backends
- **Key Fields**: `storage_type`, `config`, `is_default`
- **Supports**: Local, S3, NextCloud

#### `geotiff_files`
- **Purpose**: รีจิสตรี่ไฟล์ GeoTIFF ที่อัพโหลด
- **Key Fields**: `filename`, `file_path`, `file_size`, `upload_status`
- **Features**: Chunked upload, progress tracking, checksums

#### `file_uploads`
- **Purpose**: ติดตาม chunked upload sessions
- **Key Fields**: `upload_session_id`, `chunk_size`, `uploaded_chunks`
- **Features**: Resume uploads, validation, expiry

#### `spatial_metadata`
- **Purpose**: ข้อมูล spatial จาก GeoTIFF headers
- **Key Fields**: `width`, `height`, `bands_count`, `extent_geom`
- **Features**: CRS conversion, statistics per band

---

### ⚙️ **Processing System** (Migration 004)

#### `processing_configs`
- **Purpose**: เทมเพลต configuration สำหรับ jobs
- **Key Fields**: `job_type`, `parameters`, `is_active`
- **Features**: Reusable configs, parameter templates

#### `processing_jobs`
- **Purpose**: Queue และติดตาม background jobs
- **Key Fields**: `job_type`, `status`, `priority`, `progress`
- **Features**: Priority queue, resource tracking, logs

#### `job_results`
- **Purpose**: ผลลัพธ์จาก processing jobs
- **Key Fields**: `result_type`, `output_path`, `metadata`
- **Features**: Multiple output formats, download URLs

#### `spatial_layers`
- **Purpose**: Layers ที่แยกออกมาจาก GeoTIFF
- **Key Fields**: `layer_name`, `band_index`, `layer_type`, `extent_geom`
- **Features**: Band mapping, statistics, thumbnails

#### `spatial_features`
- **Purpose**: Features ที่ detect ได้จาก layers
- **Key Fields**: `geometry`, `feature_type`, `confidence_score`
- **Features**: AI classification, PostGIS geometry

---

### 📈 **System Monitoring** (Migration 005)

#### `system_health`
- **Purpose**: เมตริกส์การทำงานของระบบ
- **Key Fields**: `cpu_usage_percent`, `memory_usage_percent`, `active_connections`
- **Features**: Real-time monitoring, performance tracking

#### `usage_stats`
- **Purpose**: สถิติการใช้งานของผู้ใช้
- **Key Fields**: `files_uploaded`, `api_calls_count`, `processing_time_seconds`
- **Features**: Daily aggregation, resource usage tracking

#### `audit_logs`
- **Purpose**: Security และ activity audit trail
- **Key Fields**: `action`, `resource_type`, `ip_address`, `success`
- **Features**: Full audit trail, security monitoring

#### `system_configs`
- **Purpose**: การตั้งค่าระบบ
- **Key Fields**: `key`, `value`, `value_type`, `is_public`
- **Features**: Runtime configuration, type safety

#### `cache_metadata`
- **Purpose**: จัดการ cache สำหรับ performance
- **Key Fields**: `cache_key`, `cache_type`, `hit_count`, `expires_at`
- **Features**: Cache optimization, automatic cleanup

#### `notifications`
- **Purpose**: ระบบแจ้งเตือนผู้ใช้
- **Key Fields**: `type`, `title`, `message`, `is_read`
- **Features**: Job notifications, system alerts

---

### 🗑️ **Soft Delete & Activation** (Migration 007)

#### **Soft Delete Features**
- **Purpose**: ลบข้อมูลโดยไม่ลบจริง เพื่อให้สามารถกู้คืนได้
- **Tables**: `users`, `user_sessions`, `geotiff_files`, `processing_jobs`, `spatial_layers`, `pixel_data`
- **Key Fields**: `deleted_at`, `deleted_by`
- **Features**: Data recovery, audit trail, cascade soft delete

#### **Activation Tracking**
- **Purpose**: ติดตามการเปิด/ปิดใช้งานบัญชีและ sessions
- **Tables**: `users`, `user_sessions`
- **Key Fields**: `activated_at`, `activated_by`, `deactivated_at`, `deactivated_by`, `deactivated_reason`
- **Features**: Account activation, session management, admin control

#### **Helper Functions**
```sql
-- เปิดใช้งานบัญชี
SELECT activate_user('user_uuid', 'admin_uuid');

-- ปิดใช้งานบัญชี  
SELECT deactivate_user('user_uuid', 'admin_uuid', 'Policy violation');

-- Soft delete ผู้ใช้และข้อมูลที่เกี่ยวข้อง
SELECT soft_delete_user('user_uuid', 'admin_uuid', 'Account closed');
```

---

### 🎯 **Pixel Data Storage** (Migration 006)

#### `pixel_data`
- **Purpose**: เก็บค่า pixel แต่ละจุด
- **Key Fields**: `location`, `band_values`, `computed_indices`, `land_cover_class`
- **Features**: Multi-band values, vegetation indices, AI classification

#### `pixel_grid_summary`
- **Purpose**: สรุปข้อมูล pixel ตาม grid cells
- **Key Fields**: `grid_cell`, `grid_size_meters`, `band_statistics`, `dominant_class`
- **Features**: Performance optimization, aggregated statistics

#### `pixel_time_series`
- **Purpose**: ข้อมูล time series สำหรับ temporal analysis
- **Key Fields**: `acquisition_date`, `season`, `band_values`
- **Features**: Change detection, seasonal analysis

#### `spatial_analysis_cache`
- **Purpose**: Cache ผลลัพธ์การวิเคราะห์เชิงพื้นที่
- **Key Fields**: `query_bbox`, `analysis_type`, `result_data`, `cache_key`
- **Features**: Expensive query caching, TTL management

---

## 🔍 **Key Features**

### **Spatial Capabilities**
- ✅ PostGIS geometry support (POINT, POLYGON)
- ✅ Spatial indexing with GIST
- ✅ CRS transformation (WGS84)
- ✅ Spatial queries and analysis

### **Performance Optimization**
- ✅ Comprehensive indexing strategy
- ✅ Grid-based aggregation
- ✅ Query result caching
- ✅ Chunked file uploads

### **Data Processing**
- ✅ Asynchronous job queue
- ✅ Priority-based processing
- ✅ Multi-format output support
- ✅ Progress tracking

### **Monitoring & Analytics**
- ✅ System health metrics
- ✅ User activity tracking
- ✅ Complete audit trail
- ✅ Performance monitoring

---

## 📋 **Enum Types**

```sql
-- User permission levels
user_role: 'admin', 'user', 'viewer'

-- File processing status
upload_status: 'pending', 'uploading', 'processing', 'completed', 'failed'

-- Job management
job_status: 'queued', 'running', 'completed', 'failed', 'cancelled'
job_type: 'layer_extraction', 'format_conversion', 'analysis', 'thumbnail_generation'
```

---

## 🛠️ **Usage Examples**

### **Query pixel values at location**
```sql
SELECT 
    band_values,
    computed_indices->>'ndvi' as ndvi,
    land_cover_class
FROM pixel_data 
WHERE ST_DWithin(location, ST_Point(100.5, 13.7), 10);
```

### **Get land cover statistics for area**
```sql
SELECT 
    dominant_class,
    class_distribution,
    pixel_count
FROM pixel_grid_summary 
WHERE ST_Intersects(grid_cell, ST_MakeEnvelope(100, 13, 101, 14));
```

### **Track processing job progress**
```sql
SELECT 
    job_type,
    status,
    progress,
    step_description
FROM processing_jobs 
WHERE user_id = $user_id 
ORDER BY created_at DESC;
```

---

## 🚀 **Setup Scripts**

| Script | Purpose |
|--------|---------|
| `setup_database.sh` | ตั้งค่าฐานข้อมูลพร้อม seed data |
| `setup_database_clean.sh` | ตั้งค่าฐานข้อมูลเปล่า |
| `reset_database.sh` | รีเซ็ตฐานข้อมูลทั้งหมด |
| `update_database.sh` | **อัพเดทฐานข้อมูลที่รันอยู่** |
| `run_migrations.sql` | รัน migrations ทั้งหมด |
| `seed_data.sql` | ข้อมูลเริ่มต้น (admin user) |

---

## 🔧 **Environment Variables**

```bash
# Database connection
DB_HOST=localhost
DB_PORT=5432
DB_NAME=terrahost
DB_USER=postgres
DB_PASSWORD=password
```

Copy from `.env.example` และปรับค่าตามต้องการ

---

## 📝 **Migration Management**

ตาราง `migrations` ติดตามการรัน migration:
```sql
SELECT filename, executed_at, description 
FROM migrations 
ORDER BY executed_at;
```

สำหรับการเพิ่ม migration ใหม่:
1. สร้างไฟล์ `XXX_description.sql` ใน `migrations/`
2. เพิ่มใน `run_migrations.sql`
3. เพิ่ม migration record ในไฟล์

---

### **📝 Database Updates**

**อัพเดทฐานข้อมูลที่รันอยู่:**
```bash
cd database
./scripts/update_database.sh
```

**ตรวจสอบสถานะ migrations:**
```sql
SELECT filename, description, executed_at 
FROM migrations 
ORDER BY executed_at;
```

**Query ข้อมูลที่ไม่ถูก soft delete:**
```sql
-- ผู้ใช้ที่ยังใช้งานได้
SELECT * FROM users WHERE deleted_at IS NULL AND is_active = true;

-- Sessions ที่ active
SELECT * FROM user_sessions WHERE deleted_at IS NULL AND is_active = true;

-- ไฟล์ที่ยังอยู่
SELECT * FROM geotiff_files WHERE deleted_at IS NULL;
```

---

*Generated: 2025-09-01 | TerraHost Database Schema v1.1*
