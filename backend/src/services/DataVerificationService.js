const DatabaseService = require('./DatabaseService');

class DataVerificationService {
  constructor() {
    this.db = DatabaseService;
  }

  // ตรวจสอบว่าข้อมูลถูกรีดครบหรือไม่
  async verifyCompleteExtraction(fileId) {
    try {
      console.log(`🔍 Verifying complete data extraction for file: ${fileId}`);
      
      const verification = {
        fileId,
        isComplete: false,
        extractedData: {},
        missingData: [],
        verificationDetails: {},
        timestamp: new Date().toISOString()
      };

      // 1. ตรวจสอบ file status
      const fileStatus = await this._checkFileStatus(fileId);
      verification.extractedData.fileStatus = fileStatus;
      
      if (fileStatus.status !== 'processed') {
        verification.missingData.push('File not processed yet');
        return verification;
      }

      // 2. ตรวจสอบ spatial_metadata
      const spatialMetadata = await this._checkSpatialMetadata(fileId);
      verification.extractedData.spatialMetadata = spatialMetadata;
      
      // 3. ตรวจสอบความครบถ้วนของข้อมูลใน spatial_metadata
      const spatialCompleteness = await this._verifySpatialDataCompleteness(spatialMetadata.data);
      verification.verificationDetails.spatialCompleteness = spatialCompleteness;
      
      // 4. ตรวจสอบ band data
      const bandVerification = await this._verifyBandData(spatialMetadata.data);
      verification.verificationDetails.bandVerification = bandVerification;
      
      // 5. ตรวจสอบ geometry data
      const geometryVerification = await this._verifyGeometryData(spatialMetadata.data);
      verification.verificationDetails.geometryVerification = geometryVerification;
      
      // 6. ตรวจสอบ computed indices
      const indicesVerification = await this._verifyComputedIndices(spatialMetadata.data);
      verification.verificationDetails.indicesVerification = indicesVerification;

      // รวมผลการตรวจสอบ
      verification.isComplete = this._calculateOverallCompleteness(verification.verificationDetails);
      verification.missingData = this._identifyMissingData(verification.verificationDetails);

      console.log(`✅ Verification completed for file: ${fileId}`);
      console.log(`📊 Completeness: ${verification.isComplete ? 'COMPLETE' : 'INCOMPLETE'}`);
      
      return verification;

    } catch (error) {
      console.error('❌ Error verifying data extraction:', error);
      return {
        fileId,
        isComplete: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // ตรวจสอบสถานะไฟล์
  async _checkFileStatus(fileId) {
    const query = `
      SELECT id, filename, original_filename, upload_status, 
             processed_at, created_at, updated_at
      FROM geotiff_files 
      WHERE id = $1
    `;
    
    const result = await this.db.executeQuery(query, [fileId]);
    
    if (result.data.length === 0) {
      return { exists: false, status: 'not_found' };
    }
    
    const file = result.data[0];
    return {
      exists: true,
      status: file.upload_status,
      filename: file.filename,
      originalFilename: file.original_filename,
      processedAt: file.processed_at,
      createdAt: file.created_at,
      updatedAt: file.updated_at
    };
  }

  // ตรวจสอบ spatial metadata
  async _checkSpatialMetadata(fileId) {
    const query = `
      SELECT sm.*, 
             gf.filename, gf.original_filename
      FROM spatial_metadata sm
      JOIN geotiff_files gf ON sm.file_id = gf.id
      WHERE sm.file_id = $1
    `;
    
    const result = await this.db.executeQuery(query, [fileId]);
    
    return {
      exists: result.data.length > 0,
      count: result.data.length,
      data: result.data.length > 0 ? result.data[0] : null
    };
  }

  // ตรวจสอบความครบถ้วนของข้อมูล spatial
  async _verifySpatialDataCompleteness(spatialData) {
    if (!spatialData) {
      return {
        complete: false,
        score: 0,
        details: { error: 'No spatial data found' }
      };
    }

    const checks = {
      dimensions: {
        width: spatialData.width !== null && spatialData.width > 0,
        height: spatialData.height !== null && spatialData.height > 0,
        bandsCount: spatialData.bands_count !== null && spatialData.bands_count > 0
      },
      spatialReference: {
        coordinateSystem: spatialData.coordinate_system !== null,
        geotransform: spatialData.geotransform !== null && Array.isArray(spatialData.geotransform) && spatialData.geotransform.length === 6,
        extentGeometry: spatialData.extent_geom !== null
      },
      resolution: {
        resolutionX: spatialData.resolution_x !== null && spatialData.resolution_x > 0,
        resolutionY: spatialData.resolution_y !== null && spatialData.resolution_y > 0
      },
      statistics: {
        bandStatistics: spatialData.band_statistics !== null
      }
    };

    const totalChecks = this._countNestedChecks(checks);
    const passedChecks = this._countPassedChecks(checks);
    
    return {
      complete: passedChecks === totalChecks,
      score: Math.round((passedChecks / totalChecks) * 100),
      passedChecks,
      totalChecks,
      details: checks
    };
  }

  // ตรวจสอบ band data
  async _verifyBandData(spatialData) {
    if (!spatialData || !spatialData.band_statistics) {
      return {
        complete: false,
        score: 0,
        details: { error: 'No band statistics found' }
      };
    }

    let bandStats;
    try {
      bandStats = typeof spatialData.band_statistics === 'string' 
        ? JSON.parse(spatialData.band_statistics) 
        : spatialData.band_statistics;
    } catch (error) {
      return {
        complete: false,
        score: 0,
        details: { error: 'Invalid band statistics JSON' }
      };
    }

    if (!Array.isArray(bandStats)) {
      return {
        complete: false,
        score: 0,
        details: { error: 'Band statistics is not an array' }
      };
    }

    const expectedBands = spatialData.bands_count || 0;
    const actualBands = bandStats.length;
    
    const bandChecks = bandStats.map((band, index) => {
      return {
        bandIndex: index + 1,
        hasStatistics: band.statistics !== undefined,
        hasMin: band.statistics?.min !== undefined,
        hasMax: band.statistics?.max !== undefined,
        hasMean: band.statistics?.mean !== undefined,
        hasStd: band.statistics?.std !== undefined,
        hasValidPixels: band.statistics?.valid_pixels !== undefined,
        hasTotalPixels: band.statistics?.total_pixels !== undefined,
        hasDataType: band.data_type !== undefined,
        hasColorInterpretation: band.color_interpretation !== undefined
      };
    });

    const totalBandChecks = bandChecks.length * 9; // 9 checks per band
    const passedBandChecks = bandChecks.reduce((sum, band) => {
      return sum + Object.values(band).filter(v => v === true).length - 1; // -1 for bandIndex
    }, 0);

    return {
      complete: actualBands === expectedBands && totalBandChecks > 0 && passedBandChecks === totalBandChecks,
      score: totalBandChecks > 0 ? Math.round((passedBandChecks / totalBandChecks) * 100) : 0,
      expectedBands,
      actualBands,
      bandChecks,
      passedBandChecks,
      totalBandChecks
    };
  }

  // ตรวจสอบ geometry data
  async _verifyGeometryData(spatialData) {
    if (!spatialData) {
      return {
        complete: false,
        score: 0,
        details: { error: 'No spatial data found' }
      };
    }

    const checks = {
      hasExtentGeometry: spatialData.extent_geom !== null,
      hasValidGeotransform: spatialData.geotransform !== null && Array.isArray(spatialData.geotransform) && spatialData.geotransform.length === 6,
      hasCoordinateSystem: spatialData.coordinate_system !== null,
      hasResolution: spatialData.resolution_x !== null && spatialData.resolution_y !== null
    };

    // ตรวจสอบว่า extent_geom เป็น valid geometry หรือไม่
    if (spatialData.extent_geom) {
      try {
        const geometryCheck = await this.db.executeQuery(
          'SELECT ST_IsValid($1::geometry) as is_valid, ST_GeometryType($1::geometry) as geom_type',
          [spatialData.extent_geom]
        );
        
        if (geometryCheck.data.length > 0) {
          checks.isValidGeometry = geometryCheck.data[0].is_valid;
          checks.isPolygonType = geometryCheck.data[0].geom_type === 'ST_Polygon';
        }
      } catch (error) {
        checks.geometryValidationError = error.message;
      }
    }

    const totalChecks = Object.keys(checks).length;
    const passedChecks = Object.values(checks).filter(v => v === true).length;

    return {
      complete: passedChecks === totalChecks,
      score: Math.round((passedChecks / totalChecks) * 100),
      passedChecks,
      totalChecks,
      details: checks
    };
  }

  // ตรวจสอบ computed indices
  async _verifyComputedIndices(spatialData) {
    if (!spatialData || !spatialData.band_statistics) {
      return {
        complete: false,
        score: 0,
        details: { error: 'No band statistics to check for indices' }
      };
    }

    let bandStats;
    try {
      bandStats = typeof spatialData.band_statistics === 'string' 
        ? JSON.parse(spatialData.band_statistics) 
        : spatialData.band_statistics;
    } catch (error) {
      return {
        complete: false,
        score: 0,
        details: { error: 'Invalid band statistics JSON' }
      };
    }

    // ตรวจสอบว่ามี computed indices หรือไม่
    const hasComputedIndices = Array.isArray(bandStats) && bandStats.some(band => 
      band.computed_indices || band.rgb_indices || band.vegetation_indices
    );

    // ตรวจสอบ metadata domains ที่อาจมี indices
    const hasMetadata = Array.isArray(bandStats) && bandStats.some(band => 
      band.metadata && Object.keys(band.metadata).length > 0
    );

    return {
      complete: hasComputedIndices || hasMetadata,
      score: hasComputedIndices ? 100 : (hasMetadata ? 50 : 0),
      details: {
        hasComputedIndices,
        hasMetadata,
        bandsWithIndices: Array.isArray(bandStats) ? bandStats.filter(band => 
          band.computed_indices || band.rgb_indices || band.vegetation_indices
        ).length : 0
      }
    };
  }

  // คำนวณความครบถ้วนโดยรวม
  _calculateOverallCompleteness(verificationDetails) {
    const weights = {
      spatialCompleteness: 0.3,
      bandVerification: 0.3,
      geometryVerification: 0.3,
      indicesVerification: 0.1
    };

    let weightedScore = 0;
    let totalWeight = 0;

    for (const [key, weight] of Object.entries(weights)) {
      if (verificationDetails[key] && verificationDetails[key].score !== undefined) {
        weightedScore += verificationDetails[key].score * weight;
        totalWeight += weight;
      }
    }

    const overallScore = totalWeight > 0 ? weightedScore / totalWeight : 0;
    return overallScore >= 90; // ถือว่าครบถ้วนถ้าคะแนนรวม >= 90%
  }

  // ระบุข้อมูลที่หายไป
  _identifyMissingData(verificationDetails) {
    const missing = [];

    if (verificationDetails.spatialCompleteness && !verificationDetails.spatialCompleteness.complete) {
      missing.push('Incomplete spatial metadata');
    }

    if (verificationDetails.bandVerification && !verificationDetails.bandVerification.complete) {
      missing.push('Incomplete band data');
    }

    if (verificationDetails.geometryVerification && !verificationDetails.geometryVerification.complete) {
      missing.push('Invalid or missing geometry data');
    }

    if (verificationDetails.indicesVerification && !verificationDetails.indicesVerification.complete) {
      missing.push('Missing computed indices');
    }

    return missing;
  }

  // นับ nested checks
  _countNestedChecks(obj) {
    let count = 0;
    for (const value of Object.values(obj)) {
      if (typeof value === 'object' && value !== null) {
        count += this._countNestedChecks(value);
      } else {
        count++;
      }
    }
    return count;
  }

  // นับ checks ที่ผ่าน
  _countPassedChecks(obj) {
    let count = 0;
    for (const value of Object.values(obj)) {
      if (typeof value === 'object' && value !== null) {
        count += this._countPassedChecks(value);
      } else if (value === true) {
        count++;
      }
    }
    return count;
  }

  // สร้างรายงานสรุป
  async generateExtractionReport(fileId) {
    const verification = await this.verifyCompleteExtraction(fileId);
    
    const report = {
      fileId,
      extractionStatus: verification.isComplete ? 'COMPLETE' : 'INCOMPLETE',
      overallScore: this._calculateOverallScore(verification.verificationDetails),
      summary: {
        totalDataPoints: this._countTotalDataPoints(verification.extractedData),
        missingItems: verification.missingData.length,
        completionPercentage: this._calculateCompletionPercentage(verification.verificationDetails)
      },
      details: verification.verificationDetails,
      recommendations: this._generateRecommendations(verification),
      timestamp: verification.timestamp
    };

    return report;
  }

  _calculateOverallScore(details) {
    const scores = Object.values(details)
      .filter(detail => detail && detail.score !== undefined)
      .map(detail => detail.score);
    
    return scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  }

  _countTotalDataPoints(extractedData) {
    let count = 0;
    
    if (extractedData.spatialMetadata?.exists) count++;
    if (extractedData.fileStatus?.exists) count++;
    
    return count;
  }

  _calculateCompletionPercentage(details) {
    const scores = Object.values(details)
      .filter(detail => detail && detail.score !== undefined)
      .map(detail => detail.score);
    
    return scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  }

  _generateRecommendations(verification) {
    const recommendations = [];

    if (!verification.isComplete) {
      recommendations.push('File requires re-processing to extract complete data');
      
      if (verification.missingData.includes('Incomplete spatial metadata')) {
        recommendations.push('Re-run spatial metadata extraction');
      }
      
      if (verification.missingData.includes('Incomplete band data')) {
        recommendations.push('Re-extract band statistics and properties');
      }
      
      if (verification.missingData.includes('Invalid or missing geometry data')) {
        recommendations.push('Verify file coordinate system and extent');
      }
      
      if (verification.missingData.includes('Missing computed indices')) {
        recommendations.push('Calculate vegetation and spectral indices');
      }
    } else {
      recommendations.push('Data extraction is complete - file can be safely processed further');
    }

    return recommendations;
  }
}

module.exports = DataVerificationService;
