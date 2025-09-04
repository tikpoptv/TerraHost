-- TerraHost Database Update: Add acquisition_date to geotiff_files
-- Description: เพิ่มฟิลด์ acquisition_date สำหรับเก็บวันที่ถ่ายภาพจาก GeoTIFF
-- Author: TerraHost Team
-- Date: 2025-01-02

-- เพิ่มฟิลด์ acquisition_date ในตาราง geotiff_files
ALTER TABLE geotiff_files ADD COLUMN IF NOT EXISTS acquisition_date DATE;

-- เพิ่ม comment สำหรับฟิลด์ใหม่
COMMENT ON COLUMN geotiff_files.acquisition_date IS 'วันที่ถ่ายภาพจาก GeoTIFF metadata (YYYY-MM-DD)';

-- สร้าง index สำหรับฟิลด์ acquisition_date เพื่อประสิทธิภาพในการค้นหา
CREATE INDEX IF NOT EXISTS idx_geotiff_files_acquisition_date ON geotiff_files(acquisition_date);

-- แสดงผลลัพธ์
SELECT 
    'acquisition_date' as column_name,
    'ADDED' as status,
    'Date field for GeoTIFF acquisition date' as description;

-- แสดงโครงสร้างตาราง geotiff_files หลังจากเพิ่มฟิลด์
\d geotiff_files;
