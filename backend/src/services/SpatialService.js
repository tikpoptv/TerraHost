const DatabaseService = require('./DatabaseService');

class SpatialService {
  constructor() {
    this.db = DatabaseService;
  }

  /**
   * Query ข้อมูลตามพิกัด (lat, lng)
   * ค้นหาไฟล์ที่มีข้อมูลครอบคลุมพิกัดนั้น
   */
  async queryByCoordinates(lat, lng) {
    try {
      console.log(`🗺️ Querying spatial data for coordinates: ${lat}, ${lng}`);

      // สร้าง PostGIS point จากพิกัด
      const pointQuery = `ST_SetSRID(ST_MakePoint($1, $2), 4326)`;
      
      // Query ไฟล์ที่มีข้อมูลครอบคลุมพิกัดนี้
      const query = `
        SELECT DISTINCT
          gf.id,
          gf.filename,
          gf.original_filename,
          gf.file_size,
          gf.upload_status,
          gf.created_at,
          
          -- Spatial metadata
          sm.width,
          sm.height,
          sm.bands_count,
          sm.coordinate_system,
          sm.extent_geom,
          
          -- Raw metadata (JSONB fields)
          rfm.acquisition_info,
          rfm.sensor_info,
          
          -- Analysis results
          car.vegetation_indices,
          car.water_indices,
          car.soil_urban_indices,
          
          -- Processing info
          ps.status as processing_status,
          ps.session_uuid,
          ps.total_processing_time_ms
          
        FROM geotiff_files gf
        LEFT JOIN spatial_metadata sm ON gf.id = sm.file_id
        LEFT JOIN raw_file_metadata rfm ON gf.id = rfm.file_id
        LEFT JOIN complete_analysis_results car ON gf.id = car.file_id
        LEFT JOIN (
          SELECT DISTINCT ON (file_id) 
            file_id, status, session_uuid, total_processing_time_ms, created_at
          FROM processing_sessions
          ORDER BY file_id, created_at DESC
        ) ps ON gf.id = ps.file_id
        
        WHERE 
          gf.deleted_at IS NULL
          AND gf.upload_status = 'completed'
          AND sm.extent_geom IS NOT NULL
          AND ST_Contains(sm.extent_geom, ${pointQuery})
        
        ORDER BY gf.created_at DESC
      `;

      const result = await this.db.executeQuery(query, [lng, lat]); // PostGIS ใช้ (lng, lat) order

      if (result.success) {
        console.log(`🗺️ Found ${result.data.length} files covering coordinates ${lat}, ${lng}`);
        
        // Check if data found
        if (result.data.length === 0) {
          return {
            success: true,
            data: [],
            message: 'No data found in the system for the specified coordinates',
            coordinates: { lat, lng },
            suggestion: 'Please verify coordinates or expand search area'
          };
        }
        
        // Transform data appropriately
        const processedData = result.data.map(file => ({
          fileId: file.id,
          filename: file.filename,
          originalFilename: file.original_filename,
          fileSize: file.file_size,
          uploadStatus: file.upload_status,
          createdAt: file.created_at,
          
          // Spatial info
          spatial: {
            width: file.width,
            height: file.height,
            bandsCount: file.bands_count,
            coordinateSystem: file.coordinate_system,
            extent: file.extent_geom
          },
          
          // Metadata
          metadata: {
            acquisitionInfo: file.acquisition_info,
            sensorInfo: file.sensor_info
          },
          
          // Analysis
          analysis: {
            vegetationIndices: file.vegetation_indices,
            waterIndices: file.water_indices,
            soilUrbanIndices: file.soil_urban_indices
          },
          
          // Processing
          processing: {
            status: file.processing_status,
            sessionId: file.session_uuid,
            processingTime: file.total_processing_time_ms
          }
        }));

        return {
          success: true,
          data: processedData,
          message: `Found ${result.data.length} files for the specified coordinates`,
          coordinates: { lat, lng }
        };
      }

      return {
        success: false,
        error: result.error || 'Failed to query spatial data'
      };
    } catch (error) {
      console.error('Query by coordinates error:', error);
      return {
        success: false,
        error: `Failed to query by coordinates: ${error.message}`
      };
    }
  }

  /**
   * Query ข้อมูลทั้งหมดในพื้นที่ (ระบุพิกัดแล้วได้ข้อมูลทั้งหมด)
   * รองรับการฟิลเตอร์ตามวันที่สำหรับ time series analysis
   */
  async queryAllDataInArea(lat, lng, radiusKm, dateFilter = null) {
    try {
      console.log(`🗺️ Querying ALL data in area: center(${lat}, ${lng}), radius: ${radiusKm}km`);

      // สร้าง circle จาก center และ radius
      const circleQuery = `ST_Buffer(ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3 * 1000)::geometry`;
      
      // สร้าง date filter conditions
      let dateFilterConditions = '';
      let queryParams = [lng, lat, radiusKm];
      let paramIndex = 4;
      
      if (dateFilter) {
        if (dateFilter.startDate && dateFilter.endDate) {
          dateFilterConditions = `AND gf.acquisition_date BETWEEN $${paramIndex++} AND $${paramIndex++}`;
          queryParams.push(dateFilter.startDate, dateFilter.endDate);
        } else if (dateFilter.startDate) {
          dateFilterConditions = `AND gf.acquisition_date >= $${paramIndex++}`;
          queryParams.push(dateFilter.startDate);
        } else if (dateFilter.endDate) {
          dateFilterConditions = `AND gf.acquisition_date <= $${paramIndex++}`;
          queryParams.push(dateFilter.endDate);
        }
      }
      
      // Query ข้อมูลทั้งหมดในพื้นที่
      const query = `
        SELECT DISTINCT
          gf.id,
          gf.filename,
          gf.original_filename,
          gf.file_size,
          gf.upload_status,
          gf.created_at,
          gf.acquisition_date,
          
          -- Spatial metadata
          sm.width,
          sm.height,
          sm.bands_count,
          sm.coordinate_system,
          sm.extent_geom,
          sm.resolution_x,
          sm.resolution_y,
          
          -- Raw metadata (JSONB fields) - เพิ่มข้อมูลดิบครบถ้วน
          rfm.gdal_metadata,
          rfm.band_metadata,
          rfm.acquisition_info,
          rfm.sensor_info,
          rfm.processing_info,
          rfm.coordinate_info,
          rfm.quality_info,
          rfm.file_format_info,
          rfm.geotransform,
          rfm.projection_wkt,
          
          -- Analysis results
          car.vegetation_indices,
          car.water_indices,
          car.soil_urban_indices,
          car.thermal_indices,
          car.custom_indices,
          car.band_correlations,
          car.spectral_signatures,
          car.surface_material_hints,
          car.atmospheric_analysis,
          car.rgb_analysis,
          car.spatial_features,
          
          -- Processing info
          ps.status as processing_status,
          ps.session_uuid,
          ps.total_processing_time_ms,
          ps.processing_method,
          ps.python_script_version
          
        FROM geotiff_files gf
        LEFT JOIN spatial_metadata sm ON gf.id = sm.file_id
        LEFT JOIN raw_file_metadata rfm ON gf.id = rfm.file_id
        LEFT JOIN complete_analysis_results car ON gf.id = car.file_id
        LEFT JOIN (
          SELECT DISTINCT ON (file_id) 
            file_id, status, session_uuid, total_processing_time_ms, 
            processing_method, python_script_version, created_at
          FROM processing_sessions
          ORDER BY file_id, created_at DESC
        ) ps ON gf.id = ps.file_id
        
        WHERE 
          gf.deleted_at IS NULL
          AND gf.upload_status = 'completed'
          AND sm.extent_geom IS NOT NULL
          AND ST_Intersects(sm.extent_geom, ${circleQuery})
          ${dateFilterConditions}
        
        ORDER BY gf.acquisition_date DESC, gf.created_at DESC
      `;

      const result = await this.db.executeQuery(query, queryParams);

        // ดึงข้อมูลรายพิกเซลเพิ่มเติมสำหรับแต่ละไฟล์
        if (result.success && result.data.length > 0) {
          for (const file of result.data) {
            // ดึงข้อมูลรายพิกเซลจาก raw_band_data
            const bandDataQuery = `
              SELECT 
                band_number,
                band_description,
                band_type,
                data_type,
                statistics,
                histogram,
                sample_pixels,
                wavelength,
                color_interpretation,
                nodata_value,
                scale_factor,
                band_offset,
                unit_type
              FROM raw_band_data 
              WHERE file_id = $1 
              ORDER BY band_number
            `;
            
            const bandDataResult = await this.db.executeQuery(bandDataQuery, [file.id]);
            file.band_data = bandDataResult.success ? bandDataResult.data : [];
          }
        }

      if (result.success) {
        console.log(`🗺️ Found ${result.data.length} files in area center(${lat}, ${lng}), radius: ${radiusKm}km`);
        
        // ตรวจสอบว่าพบข้อมูลหรือไม่
        if (result.data.length === 0) {
          return {
            success: true,
            data: [],
            message: 'No data found in the specified area',
            area: { center: { lat, lng }, radius: radiusKm },
            suggestion: 'Please expand search radius or check coordinates'
          };
        }

        // สร้าง summary ของข้อมูลทั้งหมด
        const summary = this.createDataSummary(result.data);
        
        // แปลงข้อมูลให้เหมาะสม
        const processedData = result.data.map(file => ({
          fileId: file.id,
          filename: file.filename,
          originalFilename: file.original_filename,
          fileSize: file.file_size,
          uploadStatus: file.upload_status,
          createdAt: file.created_at,
          acquisitionDate: file.acquisition_date, // เพิ่ม acquisition_date สำหรับ time series
          
          // Spatial info
          spatial: {
            width: file.width,
            height: file.height,
            bandsCount: file.bands_count,
            coordinateSystem: file.coordinate_system,
            extent: file.extent_geom,
            resolution: {
              x: file.resolution_x,
              y: file.resolution_y
            }
          },
          
          // Metadata - เพิ่มข้อมูลดิบครบถ้วน
          metadata: {
            acquisitionInfo: file.acquisition_info,
            sensorInfo: file.sensor_info,
            gdalMetadata: file.gdal_metadata,
            bandMetadata: file.band_metadata,
            processingInfo: file.processing_info,
            coordinateInfo: file.coordinate_info,
            qualityInfo: file.quality_info,
            fileFormatInfo: file.file_format_info,
            geotransform: file.geotransform,
            projectionWkt: file.projection_wkt
          },
          
          // Analysis - เพิ่มข้อมูลการวิเคราะห์ครบถ้วน
          analysis: {
            vegetationIndices: file.vegetation_indices,
            waterIndices: file.water_indices,
            soilUrbanIndices: file.soil_urban_indices,
            thermalIndices: file.thermal_indices,
            customIndices: file.custom_indices,
            bandCorrelations: file.band_correlations,
            spectralSignatures: file.spectral_signatures,
            surfaceMaterialHints: file.surface_material_hints,
            atmosphericAnalysis: file.atmospheric_analysis,
            rgbAnalysis: file.rgb_analysis,
            spatialFeatures: file.spatial_features
          },
          
          // ข้อมูลรายพิกเซล - เพิ่มใหม่! (filter ตาม radius)
          pixelData: this.filterPixelsByRadius({
            bands: file.band_data || [],
            totalBands: file.band_data ? file.band_data.length : 0,
            hasSamplePixels: file.band_data ? file.band_data.some(band => band.sample_pixels) : false,
            hasStatistics: file.band_data ? file.band_data.some(band => band.statistics) : false,
            hasHistograms: file.band_data ? file.band_data.some(band => band.histogram) : false
          }, lat, lng, radiusKm),
          
          // Processing
          processing: {
            status: file.processing_status,
            sessionId: file.session_uuid,
            processingTime: file.total_processing_time_ms,
            method: file.processing_method,
            scriptVersion: file.python_script_version
          }
        }));

        // สร้าง time series summary ถ้ามี date filter
        let timeSeriesSummary = null;
        if (dateFilter) {
          timeSeriesSummary = this.createTimeSeriesSummary(result.data, dateFilter);
        }

        return {
          success: true,
          data: processedData,
          message: `Found ${result.data.length} files in the specified area`,
          area: { center: { lat, lng }, radius: radiusKm },
          dateFilter: dateFilter,
          summary: summary,
          timeSeriesSummary: timeSeriesSummary
        };
      }

      return {
        success: false,
        error: result.error || 'Failed to query all data in area'
      };
    } catch (error) {
      console.error('Query all data in area error:', error);
      return {
        success: false,
        error: `Failed to query all data in area: ${error.message}`
      };
    }
  }

  /**
   * คำนวณระยะทางระหว่างสองจุด (Haversine formula)
   */
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // รัศมีโลกในหน่วยกิโลเมตร
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * แปลงองศาเป็นเรเดียน
   */
  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Filter พิกัดที่อยู่ใน radius
   */
  filterPixelsByRadius(pixelData, centerLat, centerLng, radiusKm) {
    if (!pixelData || !pixelData.bands) {
      return pixelData;
    }

    const filteredBands = pixelData.bands.map(band => {
      if (!band.sample_pixels || !band.sample_pixels.samples) {
        return band;
      }

      const filteredSamples = band.sample_pixels.samples.filter(pixel => {
        if (!pixel.geo_x || !pixel.geo_y) {
          return false;
        }
        
        const distance = this.calculateDistance(centerLat, centerLng, pixel.geo_y, pixel.geo_x);
        return distance <= radiusKm;
      });

      return {
        ...band,
        sample_pixels: {
          ...band.sample_pixels,
          samples: filteredSamples,
          sample_count: filteredSamples.length
        }
      };
    });

    return {
      ...pixelData,
      bands: filteredBands
    };
  }

  /**
   * สร้าง time series summary สำหรับการวิเคราะห์ตามเวลา
   */
  createTimeSeriesSummary(files, dateFilter) {
    const timeSeries = {
      dateRange: {
        startDate: dateFilter.startDate || null,
        endDate: dateFilter.endDate || null,
        totalDays: 0
      },
      filesByDate: {},
      filesByMonth: {},
      filesByYear: {},
      temporalCoverage: {
        totalFiles: files.length,
        uniqueDates: 0,
        dateGaps: [],
        averageFilesPerDate: 0
      },
      seasonalDistribution: {
        spring: 0,
        summer: 0,
        autumn: 0,
        winter: 0
      }
    };

    // คำนวณ total days
    if (dateFilter.startDate && dateFilter.endDate) {
      const start = new Date(dateFilter.startDate);
      const end = new Date(dateFilter.endDate);
      timeSeries.dateRange.totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    }

    // จัดกลุ่มไฟล์ตามวันที่
    files.forEach(file => {
      if (file.acquisition_date) {
        const date = new Date(file.acquisition_date);
        const dateStr = file.acquisition_date;
        const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const yearStr = date.getFullYear().toString();

        // ตามวันที่
        if (!timeSeries.filesByDate[dateStr]) {
          timeSeries.filesByDate[dateStr] = [];
        }
        timeSeries.filesByDate[dateStr].push(file);

        // ตามเดือน
        if (!timeSeries.filesByMonth[monthStr]) {
          timeSeries.filesByMonth[monthStr] = [];
        }
        timeSeries.filesByMonth[monthStr].push(file);

        // ตามปี
        if (!timeSeries.filesByYear[yearStr]) {
          timeSeries.filesByYear[yearStr] = [];
        }
        timeSeries.filesByYear[yearStr].push(file);

        // ตามฤดูกาล
        const month = date.getMonth() + 1;
        if (month >= 3 && month <= 5) {
          timeSeries.seasonalDistribution.spring++;
        } else if (month >= 6 && month <= 8) {
          timeSeries.seasonalDistribution.summer++;
        } else if (month >= 9 && month <= 11) {
          timeSeries.seasonalDistribution.autumn++;
        } else {
          timeSeries.seasonalDistribution.winter++;
        }
      }
    });

    // คำนวณ temporal coverage
    timeSeries.temporalCoverage.uniqueDates = Object.keys(timeSeries.filesByDate).length;
    timeSeries.temporalCoverage.averageFilesPerDate = 
      timeSeries.temporalCoverage.uniqueDates > 0 ? 
      (files.length / timeSeries.temporalCoverage.uniqueDates).toFixed(2) : 0;

    return timeSeries;
  }

  /**
   * สร้าง summary ของข้อมูลทั้งหมด
   */
  createDataSummary(files) {
    const summary = {
      totalFiles: files.length,
      fileTypes: {},
      sensors: {},
      dateRange: { earliest: null, latest: null },
      spatialCoverage: { totalArea: 0, averageResolution: 0 },
      analysisCoverage: {
        hasVegetationIndices: 0,
        hasWaterIndices: 0,
        hasSoilUrbanIndices: 0,
        hasThermalIndices: 0,
        hasSpectralAnalysis: 0,
        hasAtmosphericAnalysis: 0,
        hasRgbAnalysis: 0,
        hasSpatialFeatures: 0
      },
      pixelDataCoverage: {
        totalBands: 0,
        hasSamplePixels: 0,
        hasStatistics: 0,
        hasHistograms: 0,
        hasWavelength: 0,
        hasColorInterpretation: 0
      }
    };

    files.forEach(file => {
      // File types
      const fileType = file.original_filename.split('.').pop() || 'unknown';
      summary.fileTypes[fileType] = (summary.fileTypes[fileType] || 0) + 1;

      // Sensors
      if (file.sensor_info && file.sensor_info.detected_sensor) {
        const sensor = file.sensor_info.detected_sensor;
        summary.sensors[sensor] = (summary.sensors[sensor] || 0) + 1;
      }

      // Date range
      if (file.created_at) {
        const fileDate = new Date(file.created_at);
        if (!summary.dateRange.earliest || fileDate < summary.dateRange.earliest) {
          summary.dateRange.earliest = fileDate;
        }
        if (!summary.dateRange.latest || fileDate > summary.dateRange.latest) {
          summary.dateRange.latest = fileDate;
        }
      }

      // Analysis coverage
      if (file.vegetation_indices) summary.analysisCoverage.hasVegetationIndices++;
      if (file.water_indices) summary.analysisCoverage.hasWaterIndices++;
      if (file.soil_urban_indices) summary.analysisCoverage.hasSoilUrbanIndices++;
      if (file.thermal_indices) summary.analysisCoverage.hasThermalIndices++;
      if (file.spectral_signatures) summary.analysisCoverage.hasSpectralAnalysis++;
      if (file.atmospheric_analysis) summary.analysisCoverage.hasAtmosphericAnalysis++;
      if (file.rgb_analysis) summary.analysisCoverage.hasRgbAnalysis++;
      if (file.spatial_features) summary.analysisCoverage.hasSpatialFeatures++;
      
      // Pixel data coverage
      if (file.band_data && Array.isArray(file.band_data)) {
        summary.pixelDataCoverage.totalBands += file.band_data.length;
        
        file.band_data.forEach(band => {
          if (band.sample_pixels) summary.pixelDataCoverage.hasSamplePixels++;
          if (band.statistics) summary.pixelDataCoverage.hasStatistics++;
          if (band.histogram) summary.pixelDataCoverage.hasHistograms++;
          if (band.wavelength) summary.pixelDataCoverage.hasWavelength++;
          if (band.color_interpretation) summary.pixelDataCoverage.hasColorInterpretation++;
        });
      }
    });

    return summary;
  }

  /**
   * Query ข้อมูลในพื้นที่ (polygon)
   */
  async queryByPolygon(polygonWkt) {
    try {
      console.log(`🗺️ Querying spatial data for polygon: ${polygonWkt}`);

      const query = `
        SELECT DISTINCT
          gf.id,
          gf.filename,
          gf.original_filename,
          gf.upload_status,
          gf.created_at,
          sm.extent_geom,
          sm.bands_count
        FROM geotiff_files gf
        LEFT JOIN spatial_metadata sm ON gf.id = sm.file_id
        WHERE 
          gf.deleted_at IS NULL
          AND gf.upload_status = 'completed'
          AND sm.extent_geom IS NOT NULL
          AND ST_Intersects(sm.extent_geom, ST_GeomFromText($1, 4326))
        ORDER BY gf.created_at DESC
      `;

      const result = await this.db.executeQuery(query, [polygonWkt]);

      if (result.success) {
        // Check if data found
        if (result.data.length === 0) {
          return {
            success: true,
            data: [],
            message: 'No data found in the system for the specified area',
            area: 'polygon',
            suggestion: 'Please verify area boundaries or expand search scope'
          };
        }
        
        return {
          success: true,
          data: result.data,
          message: `Found ${result.data.length} files for the specified area`,
          area: 'polygon'
        };
      }

      return {
        success: false,
        error: result.error || 'Failed to query polygon data'
      };
    } catch (error) {
      console.error('Query by polygon error:', error);
      return {
        success: false,
        error: `Failed to query by polygon: ${error.message}`
      };
    }
  }

  /**
   * Query ข้อมูลในพื้นที่ (circle)
   */
  async queryByCircle(centerLat, centerLng, radiusKm) {
    try {
      console.log(`🗺️ Querying spatial data for circle: center(${centerLat}, ${centerLng}), radius: ${radiusKm}km`);

      // สร้าง circle จาก center และ radius
      const circleQuery = `ST_Buffer(ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3 * 1000)::geometry`;
      
      const query = `
        SELECT DISTINCT
          gf.id,
          gf.filename,
          gf.original_filename,
          gf.upload_status,
          gf.created_at,
          sm.extent_geom,
          sm.bands_count
        FROM geotiff_files gf
        LEFT JOIN spatial_metadata sm ON gf.id = sm.file_id
        WHERE 
          gf.deleted_at IS NULL
          AND gf.upload_status = 'completed'
          AND sm.extent_geom IS NOT NULL
          AND ST_Intersects(sm.extent_geom, ${circleQuery})
        ORDER BY gf.created_at DESC
      `;

      const result = await this.db.executeQuery(query, [centerLng, centerLat, radiusKm]);

      if (result.success) {
        // Check if data found
        if (result.data.length === 0) {
          return {
            success: true,
            data: [],
            message: 'No data found in the system for the specified area',
            area: 'circle',
            center: { lat: centerLat, lng: centerLng },
            radius: radiusKm,
            suggestion: 'Please expand radius or verify center coordinates'
          };
        }
        
        return {
          success: true,
          data: result.data,
          message: `Found ${result.data.length} files for the specified area`,
          area: 'circle',
          center: { lat: centerLat, lng: centerLng },
          radius: radiusKm
        };
      }

      return {
        success: false,
        error: result.error || 'Failed to query circle data'
      };
    } catch (error) {
      console.error('Query by circle error:', error);
      return {
        success: false,
        error: `Failed to query by circle: ${error.message}`
      };
    }
  }

  /**
   * Get spatial metadata ของไฟล์
   */
  async getFileSpatialMetadata(fileId) {
    try {
      console.log(`🗺️ Getting spatial metadata for file: ${fileId}`);

      const query = `
        SELECT 
          gf.id,
          gf.filename,
          gf.original_filename,
          gf.file_size,
          gf.upload_status,
          
          -- Spatial metadata
          sm.width,
          sm.height,
          sm.bands_count,
          sm.coordinate_system,
          sm.extent_geom,
          sm.resolution_x,
          sm.resolution_y,
          
          -- Raw metadata (JSONB fields)
          rfm.acquisition_info,
          rfm.sensor_info,
          
          -- Analysis results
          car.vegetation_indices,
          car.water_indices,
          car.soil_urban_indices,
          car.thermal_indices,
          
          -- Processing info
          ps.status as processing_status,
          ps.session_uuid,
          ps.total_processing_time_ms
          
        FROM geotiff_files gf
        LEFT JOIN spatial_metadata sm ON gf.id = sm.file_id
        LEFT JOIN raw_file_metadata rfm ON gf.id = rfm.file_id
        LEFT JOIN complete_analysis_results car ON gf.id = car.file_id
        LEFT JOIN (
          SELECT DISTINCT ON (file_id) 
            file_id, status, session_uuid, total_processing_time_ms, created_at
          FROM processing_sessions
          ORDER BY file_id, created_at DESC
        ) ps ON gf.id = ps.file_id
        
        WHERE gf.id = $1 AND gf.deleted_at IS NULL
      `;

      const result = await this.db.executeQuery(query, [fileId]);

      if (result.success && result.data.length > 0) {
        const fileData = result.data[0];
        
        return {
          success: true,
          data: {
            fileId: fileData.id,
            filename: fileData.filename,
            originalFilename: fileData.original_filename,
            fileSize: fileData.file_size,
            uploadStatus: fileData.upload_status,
            
            spatial: {
              width: fileData.width,
              height: fileData.height,
              bandsCount: fileData.bands_count,
              coordinateSystem: fileData.coordinate_system,
              extent: fileData.extent_geom,
                          pixelSize: {
              x: fileData.resolution_x,
              y: fileData.resolution_y
            }
            },
            
            metadata: {
              acquisitionInfo: fileData.acquisition_info,
              sensorInfo: fileData.sensor_info
            },
            
            analysis: {
              vegetationIndices: fileData.vegetation_indices,
              waterIndices: fileData.water_indices,
              soilUrbanIndices: fileData.soil_urban_indices,
              thermalIndices: fileData.thermal_indices
            },
            
            processing: {
              status: fileData.processing_status,
              sessionId: fileData.session_uuid,
              processingTime: fileData.total_processing_time_ms
            }
          }
        };
      }

      return {
        success: false,
        error: 'File not found or no spatial metadata available'
      };
    } catch (error) {
      console.error('Get file metadata error:', error);
      return {
        success: false,
        error: `Failed to get file metadata: ${error.message}`
      };
    }
  }

  /**
   * Search files ในพื้นที่
   */
  async searchFilesInArea({ bbox, timeRange, fileTypes, userId }) {
    try {
      console.log(`🗺️ Searching files in area with filters:`, { bbox, timeRange, fileTypes, userId });

      let whereConditions = ['gf.deleted_at IS NULL'];
      let params = [];
      let paramIndex = 1;

      // BBOX filter
      if (bbox) {
        const [minLng, minLat, maxLng, maxLat] = bbox.split(',').map(Number);
        whereConditions.push(`ST_Intersects(sm.extent_geom, ST_MakeEnvelope($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, 4326))`);
        params.push(minLng, minLat, maxLng, maxLat);
      }

      // Time range filter (using acquisition_info JSONB)
      if (timeRange) {
        const [startDate, endDate] = timeRange.split(',');
        if (startDate && endDate) {
          whereConditions.push(`rfm.acquisition_info->>'acquisition_date' BETWEEN $${paramIndex++} AND $${paramIndex++}`);
          params.push(startDate, endDate);
        }
      }

      // File types filter
      if (fileTypes) {
        const types = fileTypes.split(',');
        const typeConditions = types.map(() => `gf.filename LIKE $${paramIndex++}`).join(' OR ');
        whereConditions.push(`(${typeConditions})`);
        types.forEach(type => params.push(`%${type}%`));
      }

      // User filter (ถ้ามี)
      if (userId) {
        whereConditions.push(`gf.user_id = $${paramIndex++}`);
        params.push(userId);
      }

      const query = `
        SELECT DISTINCT
          gf.id,
          gf.filename,
          gf.original_filename,
          gf.file_size,
          gf.upload_status,
          gf.created_at,
          sm.extent_geom,
          sm.bands_count,
          rfm.acquisition_info,
          rfm.sensor_info
        FROM geotiff_files gf
        LEFT JOIN spatial_metadata sm ON gf.id = sm.file_id
        LEFT JOIN raw_file_metadata rfm ON gf.id = rfm.file_id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY gf.created_at DESC
      `;

      const result = await this.db.executeQuery(query, params);

      if (result.success) {
        // Check if data found
        if (result.data.length === 0) {
          return {
            success: true,
            data: [],
            message: 'No data found in the system for the specified search criteria',
            filters: { bbox, timeRange, fileTypes, userId },
            suggestion: 'Please adjust search criteria or expand area boundaries'
          };
        }
        
        return {
          success: true,
          data: result.data,
          message: `Found ${result.data.length} files for the specified search criteria`,
          filters: { bbox, timeRange, fileTypes, userId }
        };
      }

      return {
        success: false,
        error: result.error || 'Failed to search files'
      };
    } catch (error) {
      console.error('Search files error:', error);
      return {
        success: false,
        error: `Failed to search files: ${error.message}`
      };
    }
  }

  /**
   * File overview - เช็คข้อมูลไฟล์ทั้งหมด
   */
  async getFileOverview() {
    try {
      console.log(`📊 Getting file overview`);

      // 1. จำนวนไฟล์ทั้งหมด
      const totalFilesQuery = `
        SELECT COUNT(*) as total_files
        FROM geotiff_files 
        WHERE deleted_at IS NULL AND upload_status = 'completed'
      `;

      // 2. จำนวนไฟล์ที่มี spatial metadata
      const spatialFilesQuery = `
        SELECT COUNT(*) as spatial_files
        FROM geotiff_files gf
        LEFT JOIN spatial_metadata sm ON gf.id = sm.file_id
        WHERE gf.deleted_at IS NULL 
        AND gf.upload_status = 'completed'
        AND sm.extent_geom IS NOT NULL
      `;

      // 3. จำนวนไฟล์ที่มี analysis results
      const analysisFilesQuery = `
        SELECT COUNT(*) as analysis_files
        FROM geotiff_files gf
        LEFT JOIN complete_analysis_results car ON gf.id = car.file_id
        WHERE gf.deleted_at IS NULL 
        AND gf.upload_status = 'completed'
        AND car.id IS NOT NULL
      `;

      // 4. ข้อมูลตามวันที่
      const dateStatsQuery = `
        SELECT 
          acquisition_date,
          COUNT(*) as file_count,
          MIN(created_at) as first_upload,
          MAX(created_at) as last_upload
        FROM geotiff_files 
        WHERE deleted_at IS NULL 
        AND upload_status = 'completed'
        AND acquisition_date IS NOT NULL
        GROUP BY acquisition_date
        ORDER BY acquisition_date DESC
      `;

      // 5. ขอบเขตพิกัดทั้งหมด
      const spatialBoundsQuery = `
        SELECT 
          ST_AsText(ST_Envelope(ST_Collect(sm.extent_geom))) as total_bounds,
          ST_AsText(ST_Centroid(ST_Collect(sm.extent_geom))) as center_point,
          COUNT(*) as files_with_bounds
        FROM geotiff_files gf
        LEFT JOIN spatial_metadata sm ON gf.id = sm.file_id
        WHERE gf.deleted_at IS NULL 
        AND gf.upload_status = 'completed'
        AND sm.extent_geom IS NOT NULL
      `;

      // 6. ข้อมูลรายไฟล์ (ตัวอย่าง 10 ไฟล์ล่าสุด)
      const recentFilesQuery = `
        SELECT 
          gf.id,
          gf.filename,
          gf.original_filename,
          gf.acquisition_date,
          gf.file_size,
          gf.created_at,
          ST_AsText(sm.extent_geom) as bounds,
          ps.status as processing_status
        FROM geotiff_files gf
        LEFT JOIN spatial_metadata sm ON gf.id = sm.file_id
        LEFT JOIN (
          SELECT DISTINCT ON (file_id) 
            file_id, status, created_at
          FROM processing_sessions
          ORDER BY file_id, created_at DESC
        ) ps ON gf.id = ps.file_id
        WHERE gf.deleted_at IS NULL 
        AND gf.upload_status = 'completed'
        ORDER BY gf.created_at DESC
        LIMIT 10
      `;

      // Execute all queries
      const [totalResult, spatialResult, analysisResult, dateResult, boundsResult, recentResult] = await Promise.all([
        this.db.executeQuery(totalFilesQuery),
        this.db.executeQuery(spatialFilesQuery),
        this.db.executeQuery(analysisFilesQuery),
        this.db.executeQuery(dateStatsQuery),
        this.db.executeQuery(spatialBoundsQuery),
        this.db.executeQuery(recentFilesQuery)
      ]);

      // Process results
      const overview = {
        summary: {
          totalFiles: totalResult.data[0]?.total_files || 0,
          spatialFiles: spatialResult.data[0]?.spatial_files || 0,
          analysisFiles: analysisResult.data[0]?.analysis_files || 0,
          coveragePercentage: {
            spatial: totalResult.data[0]?.total_files > 0 ? 
              ((spatialResult.data[0]?.spatial_files || 0) / totalResult.data[0].total_files * 100).toFixed(1) : 0,
            analysis: totalResult.data[0]?.total_files > 0 ? 
              ((analysisResult.data[0]?.analysis_files || 0) / totalResult.data[0].total_files * 100).toFixed(1) : 0
          }
        },
        dateRange: {
          totalDates: dateResult.data.length,
          dateStats: dateResult.data,
          earliestDate: dateResult.data.length > 0 ? dateResult.data[dateResult.data.length - 1].acquisition_date : null,
          latestDate: dateResult.data.length > 0 ? dateResult.data[0].acquisition_date : null
        },
        spatialCoverage: {
          totalBounds: boundsResult.data[0]?.total_bounds || null,
          centerPoint: boundsResult.data[0]?.center_point || null,
          filesWithBounds: boundsResult.data[0]?.files_with_bounds || 0
        },
        recentFiles: recentResult.data || []
      };

      return {
        success: true,
        data: overview,
        message: `File overview retrieved successfully`
      };

    } catch (error) {
      console.error('Get file overview error:', error);
      return {
        success: false,
        error: `Failed to get file overview: ${error.message}`
      };
    }
  }
}

module.exports = SpatialService;
