-- Add 'processed' to upload_status ENUM
-- สำหรับฐานข้อมูลที่มีอยู่แล้ว

BEGIN;

-- เพิ่ม 'processed' เข้าไปใน upload_status ENUM
ALTER TYPE upload_status ADD VALUE 'processed';

-- อัพเดท comment
COMMENT ON TYPE upload_status IS 'File upload and processing status: pending, uploading, processing, completed, processed, failed';

COMMIT;

-- ตรวจสอบว่าเพิ่มสำเร็จ (รันใน transaction แยก)
SELECT unnest(enum_range(NULL::upload_status)) as available_statuses;

-- แสดงข้อมูลไฟล์ที่มี upload_status ปัจจุบัน
SELECT 
    upload_status, 
    COUNT(*) as count
FROM geotiff_files 
GROUP BY upload_status 
ORDER BY upload_status;
