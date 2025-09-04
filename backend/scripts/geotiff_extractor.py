#!/usr/bin/env python3
"""
Dynamic GeoTIFF Extractor
รีดข้อมูล GeoTIFF ให้หมดแบบ dynamic ไม่ fix schema
"""

import sys
import json
import os
import datetime
import numpy as np
from osgeo import gdal, osr
import rasterio
from rasterio.features import shapes
from rasterio.warp import transform_bounds
import warnings
warnings.filterwarnings('ignore')

def safe_json_serialize(obj):
    """Convert NaN, Infinity to null for JSON compatibility"""
    if isinstance(obj, float):
        if str(obj) == 'nan' or str(obj) == 'inf' or str(obj) == '-inf':
            return None
        return obj
    elif isinstance(obj, dict):
        return {k: safe_json_serialize(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [safe_json_serialize(item) for item in obj]
    elif isinstance(obj, tuple):
        return tuple(safe_json_serialize(item) for item in obj)
    elif hasattr(obj, 'item'):  # numpy scalar
        try:
            val = obj.item()
            if isinstance(val, float) and (str(val) == 'nan' or str(val) == 'inf' or str(val) == '-inf'):
                return None
            return val
        except:
            return str(obj)
    else:
        return obj

class DynamicGeoTIFFExtractor:
    def __init__(self, file_path):
        self.file_path = file_path
        self.dataset = None
        self.extracted_data = {}
        
    def extract_everything(self):
        """รีดข้อมูล GeoTIFF ให้หมดแบบ dynamic"""
        try:
            # เปิดไฟล์ GeoTIFF
            self.dataset = gdal.Open(self.file_path)
            if self.dataset is None:
                raise Exception(f"Cannot open file: {self.file_path}")
            
            # เริ่มรีดข้อมูล (เพิ่มข้อมูลดิบสำหรับการเก็บถาวร)
            raw_data = {
                "file_info": self._extract_file_info(),
                "raster_info": self._extract_raster_info(),
                "spatial_info": self._extract_spatial_info(),
                "band_data": self._extract_all_bands(),
                "metadata": self._extract_all_metadata(),
                "computed_indices": self._compute_all_indices(),
                "spatial_features": self._detect_spatial_features(),
                "statistics": self._calculate_comprehensive_stats(),
                
                # RAW DATA FOR PERMANENT STORAGE (ข้อมูลดิบสำหรับเก็บถาวร)
                "raw_storage": {
                    "complete_metadata": self._extract_complete_metadata_for_storage(),
                    "pixel_samples": self._extract_pixel_samples(),
                    "compressed_bands": self._prepare_compressed_band_data(),
                    "reconstruction_info": self._get_reconstruction_metadata()
                },
                
                "extraction_timestamp": str(datetime.datetime.now()),
                "extractor_version": "1.0.1-with-raw-storage"
            }
            
            # Clean data for JSON serialization
            self.extracted_data = safe_json_serialize(raw_data)
            return self.extracted_data
            
        except Exception as e:
            error_data = {
                "error": str(e),
                "file_path": self.file_path,
                "extraction_timestamp": str(datetime.datetime.now())
            }
            return safe_json_serialize(error_data)
        finally:
            if self.dataset:
                self.dataset = None
    
    def _extract_file_info(self):
        """รีดข้อมูลไฟล์พื้นฐาน"""
        file_stat = os.stat(self.file_path)
        return {
            "filename": os.path.basename(self.file_path),
            "file_path": self.file_path,
            "file_size_bytes": file_stat.st_size,
            "file_size_mb": round(file_stat.st_size / (1024*1024), 2),
            "file_created": str(datetime.datetime.fromtimestamp(file_stat.st_ctime)),
            "file_modified": str(datetime.datetime.fromtimestamp(file_stat.st_mtime)),
            "file_accessed": str(datetime.datetime.fromtimestamp(file_stat.st_atime))
        }
    
    def _extract_raster_info(self):
        """รีดข้อมูล raster พื้นฐาน"""
        return {
            "width": self.dataset.RasterXSize,
            "height": self.dataset.RasterYSize,
            "bands_count": self.dataset.RasterCount,
            "driver": self.dataset.GetDriver().ShortName,
            "driver_long_name": self.dataset.GetDriver().LongName,
            "raster_type": "GeoTIFF"
        }
    
    def _extract_spatial_info(self):
        """รีดข้อมูลเชิงพื้นที่"""
        # Geotransform
        geotransform = self.dataset.GetGeoTransform()
        
        # Projection
        projection = self.dataset.GetProjection()
        srs = osr.SpatialReference()
        srs.ImportFromWkt(projection)
        
        # EPSG code
        epsg_code = None
        if srs.GetAttrValue('AUTHORITY', 0) == 'EPSG':
            epsg_code = srs.GetAttrValue('AUTHORITY', 1)
        
        # Bounding box
        x_min = geotransform[0]
        y_max = geotransform[3]
        x_max = x_min + self.dataset.RasterXSize * geotransform[1]
        y_min = y_max + self.dataset.RasterYSize * geotransform[5]
        
        # Resolution
        resolution_x = abs(geotransform[1])
        resolution_y = abs(geotransform[5])
        
        return {
            "geotransform": {
                "x0": geotransform[0],  # Top left X
                "y0": geotransform[3],  # Top left Y
                "pixel_width": geotransform[1],
                "pixel_height": geotransform[5],
                "skew_x": geotransform[2],
                "skew_y": geotransform[4]
            },
            "projection": {
                "wkt": projection,
                "epsg_code": epsg_code,
                "proj4": srs.ExportToProj4() if srs.ExportToProj4() else None,
                "name": srs.GetName(),
                "authority": srs.GetAttrValue('AUTHORITY', 0)
            },
            "bounding_box": {
                "x_min": x_min,
                "y_min": y_min,
                "x_max": x_max,
                "y_max": y_max,
                "center_x": (x_min + x_max) / 2,
                "center_y": (y_min + y_max) / 2
            },
            "resolution": {
                "x_meters": resolution_x,
                "y_meters": resolution_y,
                "units": "meters" if epsg_code and int(epsg_code) >= 3000 else "degrees"
            },
            "area_sq_meters": abs((x_max - x_min) * (y_max - y_min))
        }
    
    def _extract_all_bands(self):
        """รีดข้อมูลทุก band แบบ dynamic"""
        bands_data = []
        
        for i in range(self.dataset.RasterCount):
            band = self.dataset.GetRasterBand(i + 1)
            
            # อ่านข้อมูล band
            data = band.ReadAsArray()
            
            # ข้อมูลพื้นฐานของ band
            band_info = {
                "band_index": i + 1,
                "band_number": band.GetBand(),
                "data_type": gdal.GetDataTypeName(band.DataType),
                "block_size": band.GetBlockSize(),
                "color_interpretation": gdal.GetColorInterpretationName(band.GetColorInterpretation()),
                "nodata_value": band.GetNoDataValue(),
                "scale": band.GetScale(),
                "offset": band.GetOffset(),
                "unit_type": band.GetUnitType(),
                "description": band.GetDescription(),
                "metadata": band.GetMetadata()
            }
            
            # สถิติของ band - แก้ไขการตรวจหา NoData
            nodata_value = band.GetNoDataValue()
            
            # ถ้าไม่มี nodata value ที่กำหนดไว้ ให้ลองหาค่าที่น่าจะเป็น nodata
            if nodata_value is None:
                # ตรวจหาค่าที่เป็นไปได้ว่าเป็น nodata (0, -9999, NaN, etc.)
                unique_values = np.unique(data)
                if len(unique_values) > 1:
                    # ถ้ามีค่า 0 เป็นจำนวนมาก อาจเป็น nodata
                    zero_count = np.sum(data == 0)
                    total_pixels = data.size
                    if zero_count > total_pixels * 0.5:  # ถ้า 0 มากกว่า 50%
                        nodata_value = 0
                    # ตรวจหาค่า -9999 (common nodata value)
                    elif -9999 in unique_values:
                        nodata_value = -9999
                    # ตรวจหา NaN
                    elif np.any(np.isnan(data)):
                        valid_data = data[~np.isnan(data)]
                    else:
                        valid_data = data
                else:
                    valid_data = data
            
            # ใช้ nodata value ที่หาได้
            if nodata_value is not None:
                valid_data = data[data != nodata_value]
            elif 'valid_data' not in locals():
                valid_data = data
            
            if len(valid_data) > 0:
                band_info["statistics"] = {
                    "min": float(np.min(valid_data)),
                    "max": float(np.max(valid_data)),
                    "mean": float(np.mean(valid_data)),
                    "std": float(np.std(valid_data)),
                    "median": float(np.median(valid_data)),
                    "q25": float(np.percentile(valid_data, 25)),
                    "q75": float(np.percentile(valid_data, 75)),
                    "valid_pixels": int(len(valid_data)),
                    "total_pixels": int(data.size),
                    "nodata_pixels": int(data.size - len(valid_data))
                }
                
                # Histogram (ถ้าข้อมูลไม่ใหญ่เกินไป)
                if len(valid_data) <= 1000000:  # 1M pixels
                    try:
                        hist, bins = np.histogram(valid_data, bins=min(256, len(np.unique(valid_data))))
                        band_info["histogram"] = {
                            "counts": hist.tolist(),
                            "bins": bins.tolist(),
                            "bin_count": len(bins)
                        }
                    except:
                        pass
            else:
                band_info["statistics"] = {
                    "min": None, "max": None, "mean": None, "std": None,
                    "median": None, "q25": None, "q75": None,
                    "valid_pixels": 0, "total_pixels": int(data.size), "nodata_pixels": int(data.size)
                }
            
            bands_data.append(band_info)
        
        return bands_data
    
    def _extract_all_metadata(self):
        """รีด metadata ทั้งหมดที่มีแบบ DYNAMIC และ parse ข้อมูล sensor"""
        metadata = {}
        
        # Dataset metadata
        for domain in self.dataset.GetMetadataDomainList():
            if domain:
                metadata[domain] = self.dataset.GetMetadata(domain)
            else:
                metadata["default"] = self.dataset.GetMetadata()
        
        # Band metadata
        band_metadata = {}
        for i in range(self.dataset.RasterCount):
            band = self.dataset.GetRasterBand(i + 1)
            band_metadata[f"band_{i+1}"] = band.GetMetadata()
        metadata["bands"] = band_metadata
        
        # Parse และสกัดข้อมูลสำคัญ
        parsed_metadata = self._parse_sensor_metadata(metadata)
        metadata["parsed_info"] = parsed_metadata
        
        return metadata
    
    def _parse_sensor_metadata(self, metadata):
        """Parse metadata เพื่อหาข้อมูล sensor และ acquisition อัตโนมัติ"""
        parsed = {
            "sensor_info": {},
            "acquisition_info": {},
            "processing_info": {},
            "coordinate_info": {},
            "quality_info": {}
        }
        
        # รวม metadata ทั้งหมดเพื่อค้นหา
        all_metadata = {}
        for domain, data in metadata.items():
            if isinstance(data, dict):
                all_metadata.update(data)
        
        # Sensor Detection Patterns
        sensor_patterns = {
            "landsat": ["landsat", "oli", "tirs", "etm", "tm"],
            "sentinel": ["sentinel", "msi", "s2a", "s2b"],
            "modis": ["modis", "terra", "aqua"],
            "spot": ["spot", "hrvir"],
            "aster": ["aster"],
            "worldview": ["worldview", "quickbird", "geoeye"],
            "rapideye": ["rapideye"],
            "planetscope": ["planetscope"],
            "custom": ["solar", "radiation", "dsr", "direct", "diffuse"]
        }
        
        # ตรวจหา sensor
        detected_sensor = None
        for sensor, keywords in sensor_patterns.items():
            for key, value in all_metadata.items():
                if any(keyword in str(key).lower() or keyword in str(value).lower() for keyword in keywords):
                    detected_sensor = sensor
                    break
            if detected_sensor:
                break
        
        parsed["sensor_info"]["detected_sensor"] = detected_sensor
        
        # สกัดข้อมูลตามหมวดหมู่
        for key, value in all_metadata.items():
            key_lower = str(key).lower()
            value_str = str(value).lower()
            
            # Acquisition Information
            if any(keyword in key_lower for keyword in ["date", "time", "acquisition"]):
                parsed["acquisition_info"][key] = value
            elif any(keyword in key_lower for keyword in ["sun", "solar", "azimuth", "elevation", "zenith"]):
                parsed["acquisition_info"][key] = value
            elif any(keyword in key_lower for keyword in ["cloud", "quality", "qa"]):
                parsed["quality_info"][key] = value
                
            # Sensor Specific
            elif any(keyword in key_lower for keyword in ["sensor", "platform", "satellite", "instrument"]):
                parsed["sensor_info"][key] = value
            elif any(keyword in key_lower for keyword in ["band", "wavelength", "spectral"]):
                parsed["sensor_info"][key] = value
                
            # Processing Information  
            elif any(keyword in key_lower for keyword in ["processing", "level", "correction", "calibration"]):
                parsed["processing_info"][key] = value
                
            # Coordinate Information
            elif any(keyword in key_lower for keyword in ["projection", "datum", "ellipsoid", "zone", "coordinate"]):
                parsed["coordinate_info"][key] = value
        
        # ข้อมูลเพิ่มเติมสำหรับ specific sensors
        if detected_sensor:
            parsed["sensor_info"]["capabilities"] = self._get_sensor_capabilities(detected_sensor)
            parsed["sensor_info"]["typical_bands"] = self._get_typical_bands(detected_sensor)
        
        return parsed
    
    def _get_sensor_capabilities(self, sensor):
        """ได้ข้อมูล capabilities ของ sensor แต่ละประเภท"""
        capabilities = {
            "landsat": {
                "spatial_resolution": "15-100m",
                "spectral_bands": "11 bands",
                "revisit_time": "16 days",
                "swath_width": "185km",
                "applications": ["land cover", "agriculture", "forestry", "urban planning"]
            },
            "sentinel": {
                "spatial_resolution": "10-60m", 
                "spectral_bands": "13 bands",
                "revisit_time": "5 days",
                "swath_width": "290km",
                "applications": ["vegetation monitoring", "water quality", "land change"]
            },
            "modis": {
                "spatial_resolution": "250-1000m",
                "spectral_bands": "36 bands", 
                "revisit_time": "1-2 days",
                "swath_width": "2330km",
                "applications": ["climate monitoring", "fire detection", "ocean color"]
            },
            "custom": {
                "data_type": "solar radiation",
                "parameters": ["DSR", "Direct", "Diffuse"],
                "applications": ["solar energy", "agriculture", "climate"]
            }
        }
        return capabilities.get(sensor, {})
    
    def _get_typical_bands(self, sensor):
        """ได้รายชื่อ bands ทั่วไปของแต่ละ sensor"""
        typical_bands = {
            "landsat": ["Coastal", "Blue", "Green", "Red", "NIR", "SWIR1", "SWIR2", "Pan", "Cirrus", "TIR1", "TIR2"],
            "sentinel": ["Coastal", "Blue", "Green", "Red", "Red Edge 1", "Red Edge 2", "Red Edge 3", "NIR", "Red Edge 4", "Water Vapor", "SWIR1", "SWIR2"],
            "modis": ["Red", "NIR", "Blue", "Green", "NIR2", "SWIR1", "SWIR2", "SWIR3", "SWIR4", "SWIR5", "SWIR6", "SWIR7"],
            "custom": ["DSR", "Direct", "Diffuse", "Solar Radiation"]
        }
        return typical_bands.get(sensor, [])
    
    def _compute_all_indices(self):
        """คำนวณ indices ทั้งหมดที่เป็นไปได้แบบ DYNAMIC"""
        indices = {}
        
        try:
            # 1. ตรวจจับประเภท bands อัตโนมัติ
            band_info = self._detect_band_types()
            indices["band_detection"] = band_info
            
            # 2. คำนวณ indices ตามที่มี bands
            all_bands = {}
            for i in range(self.dataset.RasterCount):
                band_data = self.dataset.GetRasterBand(i + 1).ReadAsArray()
                band_name = band_info.get(f"band_{i+1}", {}).get("detected_type", f"band_{i+1}")
                all_bands[band_name] = band_data
            
            # 3. RGB Analysis (ถ้ามี RGB หรือ similar bands)
            rgb_bands = self._find_rgb_bands(all_bands, band_info)
            if rgb_bands:
                indices["rgb"] = self._calculate_rgb_indices(rgb_bands["red"], rgb_bands["green"], rgb_bands["blue"])
            
            # 4. Vegetation Indices (ถ้ามี Red + NIR)
            veg_indices = self._calculate_all_vegetation_indices(all_bands)
            if veg_indices:
                indices["vegetation"] = veg_indices
            
            # 5. Water Indices (ถ้ามี Green + NIR + SWIR)
            water_indices = self._calculate_all_water_indices(all_bands)
            if water_indices:
                indices["water"] = water_indices
            
            # 6. Soil/Urban Indices
            soil_indices = self._calculate_all_soil_indices(all_bands)
            if soil_indices:
                indices["soil"] = soil_indices
            
            # 7. Thermal Analysis (ถ้ามี thermal bands)
            thermal_indices = self._calculate_thermal_indices(all_bands)
            if thermal_indices:
                indices["thermal"] = thermal_indices
            
            # 8. Custom Spectral Indices (based on available bands)
            custom_indices = self._calculate_custom_indices(all_bands)
            if custom_indices:
                indices["custom"] = custom_indices
            
            # 9. Spectral Analysis (wavelength-based analysis)
            spectral_analysis = self._analyze_spectral_signatures(all_bands, band_info)
            if spectral_analysis:
                indices["spectral_analysis"] = spectral_analysis
                
        except Exception as e:
            indices["error"] = f"Failed to calculate indices: {str(e)}"
        
        return indices
    
    def _calculate_rgb_indices(self, red, green, blue):
        """คำนวณ RGB-based indices"""
        try:
            # แก้ไข: ตรวจสอบ data type และ normalize ให้เหมาะสม
            red_data = red.astype(np.float32)
            green_data = green.astype(np.float32)
            blue_data = blue.astype(np.float32)
            
            # Auto-detect data range และ normalize
            red_min, red_max = np.min(red_data), np.max(red_data)
            green_min, green_max = np.min(green_data), np.max(green_data)
            blue_min, blue_max = np.min(blue_data), np.max(blue_data)
            
            # ถ้าค่าอยู่ในช่วง 0-255 แสดงว่าเป็น 8-bit
            if red_max <= 255 and green_max <= 255 and blue_max <= 255:
                red_norm = red_data / 255.0
                green_norm = green_data / 255.0
                blue_norm = blue_data / 255.0
            else:
                # สำหรับ Float32 data ให้ normalize ตาม min-max ของแต่ละ band
                red_norm = (red_data - red_min) / (red_max - red_min) if red_max > red_min else red_data
                green_norm = (green_data - green_min) / (green_max - green_min) if green_max > green_min else green_data
                blue_norm = (blue_data - blue_min) / (blue_max - blue_min) if blue_max > blue_min else blue_data
            
            # Brightness
            brightness = (red_norm + green_norm + blue_norm) / 3.0
            
            # Saturation
            max_rgb = np.maximum(np.maximum(red_norm, green_norm), blue_norm)
            min_rgb = np.minimum(np.minimum(red_norm, green_norm), blue_norm)
            saturation = np.where(max_rgb > 0, (max_rgb - min_rgb) / max_rgb, 0)
            
            # Hue
            hue = np.zeros_like(red_norm)
            delta = max_rgb - min_rgb
            
            # Red is max
            mask = (max_rgb == red_norm) & (delta > 0)
            hue[mask] = ((green_norm[mask] - blue_norm[mask]) / delta[mask]) % 6
            
            # Green is max
            mask = (max_rgb == green_norm) & (delta > 0)
            hue[mask] = ((blue_norm[mask] - red_norm[mask]) / delta[mask]) + 2
            
            # Blue is max
            mask = (max_rgb == blue_norm) & (delta > 0)
            hue[mask] = ((red_norm[mask] - green_norm[mask]) / delta[mask]) + 4
            
            hue = hue * 60  # Convert to degrees
            
            # Remove invalid values (NaN, infinity) before calculating statistics
            valid_mask = np.isfinite(brightness) & np.isfinite(saturation) & np.isfinite(hue)
            
            if np.any(valid_mask):
                valid_brightness = brightness[valid_mask]
                valid_saturation = saturation[valid_mask]
                valid_hue = hue[valid_mask]
                
                return {
                    "brightness": {
                        "mean": float(np.mean(valid_brightness)) if len(valid_brightness) > 0 else None,
                        "std": float(np.std(valid_brightness)) if len(valid_brightness) > 0 else None,
                        "min": float(np.min(valid_brightness)) if len(valid_brightness) > 0 else None,
                        "max": float(np.max(valid_brightness)) if len(valid_brightness) > 0 else None
                    },
                    "saturation": {
                        "mean": float(np.mean(valid_saturation)) if len(valid_saturation) > 0 else None,
                        "std": float(np.std(valid_saturation)) if len(valid_saturation) > 0 else None,
                        "min": float(np.min(valid_saturation)) if len(valid_saturation) > 0 else None,
                        "max": float(np.max(valid_saturation)) if len(valid_saturation) > 0 else None
                    },
                    "hue": {
                        "mean": float(np.mean(valid_hue)) if len(valid_hue) > 0 else None,
                        "std": float(np.std(valid_hue)) if len(valid_hue) > 0 else None,
                        "min": float(np.min(valid_hue)) if len(valid_hue) > 0 else None,
                        "max": float(np.max(valid_hue)) if len(valid_hue) > 0 else None
                    }
                }
            else:
                return {
                    "brightness": {"mean": None, "std": None, "min": None, "max": None},
                    "saturation": {"mean": None, "std": None, "min": None, "max": None},
                    "hue": {"mean": None, "std": None, "min": None, "max": None}
                }
        except Exception as e:
            return {"error": f"RGB calculation failed: {str(e)}"}
    
    def _calculate_vegetation_indices(self, red, nir):
        """คำนวณ vegetation indices"""
        try:
            # Avoid division by zero
            red = red.astype(np.float32)
            nir = nir.astype(np.float32)
            
            # NDVI
            ndvi = np.where((nir + red) > 0, (nir - red) / (nir + red), 0)
            
            # NDWI
            ndwi = np.where((nir + red) > 0, (nir - red) / (nir + red), 0)
            
            # EVI
            evi = np.where((nir + 6 * red - 7.5) > 0, 2.5 * (nir - red) / (nir + 6 * red - 7.5), 0)
            
            return {
                "ndvi": {
                    "mean": float(np.mean(ndvi)),
                    "std": float(np.std(ndvi)),
                    "min": float(np.min(ndvi)),
                    "max": float(np.max(ndvi))
                },
                "ndwi": {
                    "mean": float(np.mean(ndwi)),
                    "std": float(np.std(ndwi)),
                    "min": float(np.min(ndwi)),
                    "max": float(np.max(ndwi))
                },
                "evi": {
                    "mean": float(np.mean(evi)),
                    "std": float(np.std(evi)),
                    "min": float(np.min(evi)),
                    "max": float(np.max(evi))
                }
            }
        except Exception as e:
            return {"error": f"Vegetation indices calculation failed: {str(e)}"}
    
    def _detect_spatial_features(self):
        """Detect spatial features แบบ dynamic"""
        features = {}
        
        try:
            # ใช้ rasterio สำหรับ feature detection
            with rasterio.open(self.file_path) as src:
                # Bounding box
                bbox = transform_bounds(src.crs, 'EPSG:4326', *src.bounds)
                features["bounding_box_wgs84"] = {
                    "west": bbox[0], "south": bbox[1],
                    "east": bbox[2], "north": bbox[3]
                }
                
                # Geometry shapes (ถ้าข้อมูลไม่ใหญ่เกินไป)
                if src.width * src.height <= 1000000:  # 1M pixels
                    try:
                        # อ่านข้อมูล band แรก
                        data = src.read(1)
                        
                        # Generate shapes
                        shapes_gen = shapes(data, transform=src.transform)
                        shapes_list = list(shapes_gen)
                        
                        features["geometry_shapes"] = {
                            "count": len(shapes_list),
                            "shapes": shapes_list[:10]  # เก็บแค่ 10 แรก
                        }
                    except:
                        features["geometry_shapes"] = {"error": "Too large for shape generation"}
                
        except Exception as e:
            features["error"] = f"Feature detection failed: {str(e)}"
        
        return features
    
    def _calculate_comprehensive_stats(self):
        """คำนวณสถิติแบบ comprehensive"""
        stats = {
            "file_summary": {
                "total_pixels": self.dataset.RasterXSize * self.dataset.RasterYSize * self.dataset.RasterCount,
                "total_size_gb": round((self.dataset.RasterXSize * self.dataset.RasterYSize * self.dataset.RasterCount * 4) / (1024**3), 3),
                "aspect_ratio": round(self.dataset.RasterXSize / self.dataset.RasterYSize, 3)
            },
            "processing_info": {
                "extraction_method": "dynamic_comprehensive",
                "processing_time": "real_time",
                "data_quality": "full_extraction"
            }
        }
        
        return stats

    def _detect_band_types(self):
        """ตรวจจับประเภทของ bands อัตโนมัติ DYNAMIC"""
        band_types = {}
        
        for i in range(self.dataset.RasterCount):
            band = self.dataset.GetRasterBand(i + 1)
            band_desc = band.GetDescription().lower()
            band_metadata = band.GetMetadata()
            
            # ตรวจจับจาก description
            detected_type = self._identify_band_type(band_desc, band_metadata, i)
            
            band_types[f"band_{i+1}"] = {
                "band_number": i + 1,
                "description": band.GetDescription(),
                "detected_type": detected_type,
                "wavelength": self._extract_wavelength(band_metadata),
                "metadata": band_metadata
            }
        
        return band_types
    
    def _identify_band_type(self, description, metadata, band_index):
        """ระบุประเภท band จาก description และ metadata"""
        desc = description.lower()
        
        # Common band patterns
        patterns = {
            "blue": ["blue", "b1", "coastal", "443", "480"],
            "green": ["green", "b2", "560", "565"],
            "red": ["red", "b3", "665", "660"],
            "nir": ["nir", "near infrared", "b4", "832", "842"],
            "red_edge": ["red edge", "vegetation red edge", "b5", "b6", "b7", "705", "740", "783"],
            "swir1": ["swir", "swir1", "b6", "b11", "1610", "1565"],
            "swir2": ["swir2", "b7", "b12", "2190", "2200"],
            "thermal": ["thermal", "tir", "lwir", "b10", "b11", "temperature", "1030", "1100", "1200"],
            "pan": ["panchromatic", "pan", "b8"],
            "cirrus": ["cirrus", "b9", "1373"],
            "aerosol": ["aerosol", "coastal aerosol", "443"],
            "dsr": ["dsr", "direct solar radiation", "solar"],
            "direct": ["direct", "direct radiation"],
            "diffuse": ["diffuse", "diffuse radiation"]
        }
        
        # ตรวจสอบ patterns
        for band_type, keywords in patterns.items():
            if any(keyword in desc for keyword in keywords):
                return band_type
        
        # ตรวจสอบจาก wavelength ใน metadata
        wavelength = self._extract_wavelength(metadata)
        if wavelength:
            return self._classify_by_wavelength(wavelength)
        
        # ถ้าไม่เจอ ใช้ position-based guess
        return self._guess_by_position(band_index)
    
    def _extract_wavelength(self, metadata):
        """สกัด wavelength จาก metadata"""
        for key, value in metadata.items():
            key_lower = key.lower()
            if "wavelength" in key_lower or "lambda" in key_lower:
                try:
                    return float(value)
                except:
                    continue
        return None
    
    def _classify_by_wavelength(self, wavelength):
        """จำแนกประเภท band จาก wavelength (nanometers)"""
        if 400 <= wavelength <= 500:
            return "blue"
        elif 500 <= wavelength <= 600:
            return "green"
        elif 600 <= wavelength <= 700:
            return "red"
        elif 700 <= wavelength <= 900:
            return "nir"
        elif 1000 <= wavelength <= 1800:
            return "swir1"
        elif 1800 <= wavelength <= 2500:
            return "swir2"
        elif 8000 <= wavelength <= 15000:
            return "thermal"
        else:
            return f"spectral_{int(wavelength)}nm"
    
    def _guess_by_position(self, band_index):
        """เดาประเภท band จากตำแหน่ง (fallback)"""
        common_orders = {
            0: "blue",
            1: "green", 
            2: "red",
            3: "nir",
            4: "swir1",
            5: "swir2",
            6: "thermal"
        }
        return common_orders.get(band_index, f"band_{band_index+1}")
    
    def _find_rgb_bands(self, all_bands, band_info):
        """หา RGB bands จากที่มี"""
        rgb_mapping = {}
        
        # หา red band
        for band_name, data in all_bands.items():
            band_type = None
            for info in band_info.values():
                if info.get("detected_type") == band_name:
                    band_type = info.get("detected_type")
                    break
            
            if band_type in ["red", "b3"]:
                rgb_mapping["red"] = data
            elif band_type in ["green", "b2"]:
                rgb_mapping["green"] = data
            elif band_type in ["blue", "b1"]:
                rgb_mapping["blue"] = data
        
        # ถ้าไม่เจอ RGB ให้ใช้ 3 bands แรก
        if len(rgb_mapping) < 3:
            band_list = list(all_bands.values())
            if len(band_list) >= 3:
                return {
                    "red": band_list[0],
                    "green": band_list[1], 
                    "blue": band_list[2]
                }
        
        return rgb_mapping if len(rgb_mapping) == 3 else None
    
    def _calculate_all_vegetation_indices(self, all_bands):
        """คำนวณ vegetation indices ทั้งหมดที่เป็นไปได้"""
        indices = {}
        
        # หา bands ที่ต้องใช้
        red = None
        nir = None
        green = None
        swir1 = None
        
        for name, data in all_bands.items():
            if "red" in name.lower() and "edge" not in name.lower():
                red = data
            elif "nir" in name.lower():
                nir = data
            elif "green" in name.lower():
                green = data
            elif "swir" in name.lower():
                swir1 = data
        
        # คำนวณ indices ที่เป็นไปได้
        if red is not None and nir is not None:
            # NDVI
            indices["ndvi"] = self._safe_index_calc(nir, red, lambda n, r: (n - r) / (n + r))
            
            # SAVI (Soil Adjusted Vegetation Index)
            L = 0.5  # soil brightness correction factor
            indices["savi"] = self._safe_index_calc(nir, red, lambda n, r: ((n - r) / (n + r + L)) * (1 + L))
            
            # RVI (Ratio Vegetation Index)
            indices["rvi"] = self._safe_index_calc(nir, red, lambda n, r: n / r)
            
        if red is not None and nir is not None and green is not None:
            # GNDVI (Green NDVI)
            indices["gndvi"] = self._safe_index_calc(nir, green, lambda n, g: (n - g) / (n + g))
            
        if red is not None and nir is not None and swir1 is not None:
            # EVI (Enhanced Vegetation Index)
            indices["evi"] = self._safe_index_calc(nir, red, lambda n, r: 2.5 * (n - r) / (n + 6 * r - 7.5 * swir1 + 1))
        
        return indices if indices else None
    
    def _calculate_all_water_indices(self, all_bands):
        """คำนวณ water indices ทั้งหมด"""
        indices = {}
        
        green = None
        nir = None
        swir1 = None
        swir2 = None
        
        for name, data in all_bands.items():
            if "green" in name.lower():
                green = data
            elif "nir" in name.lower():
                nir = data
            elif "swir1" in name.lower():
                swir1 = data
            elif "swir2" in name.lower():
                swir2 = data
        
        if green is not None and nir is not None:
            # NDWI (Normalized Difference Water Index)
            indices["ndwi"] = self._safe_index_calc(green, nir, lambda g, n: (g - n) / (g + n))
            
        if green is not None and swir1 is not None:
            # MNDWI (Modified NDWI)
            indices["mndwi"] = self._safe_index_calc(green, swir1, lambda g, s: (g - s) / (g + s))
            
        if nir is not None and swir1 is not None:
            # WRI (Water Ratio Index)
            indices["wri"] = self._safe_index_calc(nir, swir1, lambda n, s: n / s)
        
        return indices if indices else None
    
    def _calculate_all_soil_indices(self, all_bands):
        """คำนวณ soil/urban indices"""
        indices = {}
        
        red = None
        nir = None
        swir1 = None
        swir2 = None
        
        for name, data in all_bands.items():
            if "red" in name.lower() and "edge" not in name.lower():
                red = data
            elif "nir" in name.lower():
                nir = data
            elif "swir1" in name.lower():
                swir1 = data
            elif "swir2" in name.lower():
                swir2 = data
        
        if swir1 is not None and nir is not None:
            # NDBI (Normalized Difference Built-up Index)
            indices["ndbi"] = self._safe_index_calc(swir1, nir, lambda s, n: (s - n) / (s + n))
            
        if red is not None and swir1 is not None:
            # BSI (Bare Soil Index)
            indices["bsi"] = self._safe_index_calc(swir1, red, lambda s, r: (s - r) / (s + r))
        
        return indices if indices else None
    
    def _calculate_thermal_indices(self, all_bands):
        """คำนวณ thermal indices"""
        indices = {}
        
        thermal_bands = []
        for name, data in all_bands.items():
            if "thermal" in name.lower() or "tir" in name.lower():
                thermal_bands.append(data)
        
        if thermal_bands:
            # Temperature statistics
            for i, thermal_data in enumerate(thermal_bands):
                indices[f"thermal_band_{i+1}"] = {
                    "mean_temperature": float(np.mean(thermal_data)),
                    "min_temperature": float(np.min(thermal_data)),
                    "max_temperature": float(np.max(thermal_data)),
                    "temp_std": float(np.std(thermal_data))
                }
        
        return indices if indices else None
    
    def _calculate_custom_indices(self, all_bands):
        """คำนวณ custom indices ตาม bands ที่มี"""
        indices = {}
        band_names = list(all_bands.keys())
        
        # สร้าง ratio indices สำหรับทุกคู่ bands
        for i, band1 in enumerate(band_names):
            for j, band2 in enumerate(band_names[i+1:], i+1):
                try:
                    data1 = all_bands[band1]
                    data2 = all_bands[band2]
                    
                    # Simple ratio
                    ratio = self._safe_index_calc(data1, data2, lambda d1, d2: d1 / d2)
                    if ratio is not None:
                        indices[f"{band1}_{band2}_ratio"] = ratio
                        
                    # Normalized difference
                    ndiff = self._safe_index_calc(data1, data2, lambda d1, d2: (d1 - d2) / (d1 + d2))
                    if ndiff is not None:
                        indices[f"{band1}_{band2}_ndiff"] = ndiff
                        
                except Exception:
                    continue
        
        return indices if indices else None
    
    def _safe_index_calc(self, band1, band2, formula):
        """ปลอดภัยในการคำนวณ index"""
        try:
            b1 = band1.astype(np.float32)
            b2 = band2.astype(np.float32)
            
            result = formula(b1, b2)
            
            # กรอง invalid values
            valid_mask = np.isfinite(result)
            if np.any(valid_mask):
                valid_result = result[valid_mask]
                return {
                    "mean": float(np.mean(valid_result)),
                    "std": float(np.std(valid_result)),
                    "min": float(np.min(valid_result)),
                    "max": float(np.max(valid_result)),
                    "valid_pixels": int(np.sum(valid_mask))
                }
            else:
                return None
        except Exception:
            return None
    
    def _analyze_spectral_signatures(self, all_bands, band_info):
        """วิเคราะห์ spectral signatures และ wavelength information"""
        analysis = {
            "spectral_profile": {},
            "wavelength_info": {},
            "band_correlations": {},
            "spectral_indices_summary": {}
        }
        
        try:
            # 1. Spectral Profile Analysis
            band_means = {}
            band_wavelengths = {}
            
            for band_name, data in all_bands.items():
                # คำนวณค่าเฉลี่ยของแต่ละ band
                valid_data = data[np.isfinite(data)]
                if len(valid_data) > 0:
                    band_means[band_name] = float(np.mean(valid_data))
                
                # สกัด wavelength information
                for band_key, info in band_info.items():
                    if info.get("detected_type") == band_name:
                        wavelength = info.get("wavelength")
                        if wavelength:
                            band_wavelengths[band_name] = wavelength
            
            analysis["spectral_profile"]["band_means"] = band_means
            analysis["wavelength_info"]["detected_wavelengths"] = band_wavelengths
            
            # 2. Band Correlation Analysis
            correlations = self._calculate_band_correlations(all_bands)
            analysis["band_correlations"] = correlations
            
            # 3. Spectral Curve Analysis
            if len(band_wavelengths) >= 3:
                spectral_curve = self._analyze_spectral_curve(band_means, band_wavelengths)
                analysis["spectral_curve"] = spectral_curve
            
            # 4. Atmospheric Analysis (ถ้ามี bands ที่เหมาะสม)
            atmospheric = self._analyze_atmospheric_effects(all_bands)
            if atmospheric:
                analysis["atmospheric_analysis"] = atmospheric
            
            # 5. Surface Material Classification Hints
            material_hints = self._classify_surface_materials(band_means, band_wavelengths)
            analysis["surface_material_hints"] = material_hints
            
        except Exception as e:
            analysis["error"] = f"Spectral analysis failed: {str(e)}"
        
        return analysis if any(v for k, v in analysis.items() if k != "error") else None
    
    def _calculate_band_correlations(self, all_bands):
        """คำนวณ correlation ระหว่าง bands"""
        correlations = {}
        band_names = list(all_bands.keys())
        
        for i, band1 in enumerate(band_names):
            for j, band2 in enumerate(band_names[i+1:], i+1):
                try:
                    data1 = all_bands[band1].flatten()
                    data2 = all_bands[band2].flatten()
                    
                    # Remove invalid values
                    mask = np.isfinite(data1) & np.isfinite(data2)
                    if np.sum(mask) > 100:  # Minimum samples
                        corr = np.corrcoef(data1[mask], data2[mask])[0, 1]
                        correlations[f"{band1}_vs_{band2}"] = float(corr)
                except Exception:
                    continue
        
        return correlations
    
    def _analyze_spectral_curve(self, band_means, band_wavelengths):
        """วิเคราะห์ spectral curve"""
        curve_analysis = {}
        
        try:
            # เรียงตาม wavelength
            sorted_bands = sorted(band_wavelengths.items(), key=lambda x: x[1])
            wavelengths = [item[1] for item in sorted_bands]
            reflectances = [band_means.get(item[0], 0) for item in sorted_bands]
            
            if len(wavelengths) >= 3:
                # หา slope ของ spectral curve
                slopes = []
                for i in range(len(wavelengths) - 1):
                    slope = (reflectances[i+1] - reflectances[i]) / (wavelengths[i+1] - wavelengths[i])
                    slopes.append(slope)
                
                curve_analysis["wavelengths"] = wavelengths
                curve_analysis["reflectances"] = reflectances
                curve_analysis["slopes"] = slopes
                curve_analysis["overall_trend"] = "increasing" if sum(slopes) > 0 else "decreasing"
                curve_analysis["steepest_change"] = {
                    "slope": max(slopes, key=abs),
                    "position": slopes.index(max(slopes, key=abs))
                }
        
        except Exception as e:
            curve_analysis["error"] = str(e)
        
        return curve_analysis
    
    def _analyze_atmospheric_effects(self, all_bands):
        """วิเคราะห์ atmospheric effects"""
        atmospheric = {}
        
        try:
            # หา blue band สำหรับ atmospheric scattering analysis
            blue_band = None
            nir_band = None
            
            for name, data in all_bands.items():
                if "blue" in name.lower():
                    blue_band = data
                elif "nir" in name.lower():
                    nir_band = data
            
            if blue_band is not None:
                # Blue band มักจะมี atmospheric effect มาก
                blue_stats = {
                    "mean": float(np.mean(blue_band[np.isfinite(blue_band)])),
                    "std": float(np.std(blue_band[np.isfinite(blue_band)])),
                    "atmospheric_haze_indicator": "high" if np.mean(blue_band[np.isfinite(blue_band)]) > np.std(blue_band[np.isfinite(blue_band)]) * 2 else "low"
                }
                atmospheric["blue_band_analysis"] = blue_stats
            
            if blue_band is not None and nir_band is not None:
                # คำนวณ atmospheric ratio
                ratio = np.mean(blue_band[np.isfinite(blue_band)]) / np.mean(nir_band[np.isfinite(nir_band)])
                atmospheric["blue_nir_ratio"] = float(ratio)
                atmospheric["atmospheric_clarity"] = "clear" if ratio < 0.5 else "hazy"
        
        except Exception:
            pass
        
        return atmospheric if atmospheric else None
    
    def _classify_surface_materials(self, band_means, band_wavelengths):
        """ให้คำแนะนำเกี่ยวกับประเภทพื้นผิว"""
        hints = []
        
        try:
            # วิเคราะห์จาก spectral signature patterns
            red_val = None
            nir_val = None
            swir_val = None
            
            for band, wavelength in band_wavelengths.items():
                mean_val = band_means.get(band, 0)
                
                if 600 <= wavelength <= 700:  # Red
                    red_val = mean_val
                elif 700 <= wavelength <= 900:  # NIR
                    nir_val = mean_val
                elif 1000 <= wavelength <= 2500:  # SWIR
                    swir_val = mean_val
            
            # Vegetation analysis
            if red_val and nir_val:
                if nir_val > red_val * 1.5:
                    hints.append({
                        "material": "healthy_vegetation",
                        "confidence": "high",
                        "reason": "High NIR/Red ratio indicates chlorophyll"
                    })
                elif nir_val < red_val:
                    hints.append({
                        "material": "bare_soil_or_urban",
                        "confidence": "medium", 
                        "reason": "Low NIR/Red ratio"
                    })
            
            # Water analysis
            if nir_val and swir_val and nir_val < swir_val * 0.5:
                hints.append({
                    "material": "water_body",
                    "confidence": "medium",
                    "reason": "Low NIR and SWIR reflectance"
                })
            
            # Overall brightness analysis
            overall_brightness = np.mean(list(band_means.values()))
            if overall_brightness > np.std(list(band_means.values())) * 3:
                hints.append({
                    "material": "bright_surface",
                    "confidence": "low",
                    "reason": "High overall reflectance (sand, concrete, snow)"
                })
        
        except Exception:
            pass
        
        return hints
    
    def _extract_complete_metadata_for_storage(self):
        """สกัด metadata ทั้งหมดสำหรับการเก็บถาวร"""
        complete_metadata = {
            "gdal_metadata": {},
            "band_metadata": {},
            "driver_info": {},
            "geotransform": None,
            "projection": None
        }
        
        try:
            # GDAL Dataset metadata ทั้งหมด
            for domain in self.dataset.GetMetadataDomainList():
                if domain:
                    complete_metadata["gdal_metadata"][domain] = self.dataset.GetMetadata(domain)
                else:
                    complete_metadata["gdal_metadata"]["default"] = self.dataset.GetMetadata()
            
            # Band metadata ทั้งหมด
            for i in range(self.dataset.RasterCount):
                band = self.dataset.GetRasterBand(i + 1)
                complete_metadata["band_metadata"][f"band_{i+1}"] = {
                    "metadata": band.GetMetadata(),
                    "description": band.GetDescription(),
                    "data_type": gdal.GetDataTypeName(band.DataType),
                    "color_interpretation": gdal.GetColorInterpretationName(band.GetColorInterpretation()),
                    "nodata_value": band.GetNoDataValue(),
                    "scale": band.GetScale(),
                    "offset": band.GetOffset(),
                    "unit_type": band.GetUnitType(),
                    "block_size": band.GetBlockSize(),
                    "checksum": band.Checksum() if hasattr(band, 'Checksum') else None
                }
            
            # Driver information
            driver = self.dataset.GetDriver()
            complete_metadata["driver_info"] = {
                "short_name": driver.ShortName,
                "long_name": driver.LongName,
                "creation_options": driver.GetMetadata().get('DMD_CREATIONOPTIONLIST', ''),
                "extensions": driver.GetMetadata().get('DMD_EXTENSIONS', '')
            }
            
            # Geotransform
            complete_metadata["geotransform"] = list(self.dataset.GetGeoTransform())
            
            # Projection
            complete_metadata["projection"] = {
                "wkt": self.dataset.GetProjection(),
                "authority": self.dataset.GetProjection()
            }
            
        except Exception as e:
            complete_metadata["error"] = str(e)
        
        return complete_metadata
    
    def _extract_pixel_samples(self):
        """สกัด pixel samples สำหรับการ reconstruct"""
        samples = {}
        
        try:
            # สุ่ม sample pixels จากแต่ละ band
            sample_size = min(10000, self.dataset.RasterXSize * self.dataset.RasterYSize // 100)  # 1% หรือ 10K pixels
            
            for i in range(self.dataset.RasterCount):
                band = self.dataset.GetRasterBand(i + 1)
                data = band.ReadAsArray()
                
                if data is not None:
                    # สุ่ม coordinates
                    height, width = data.shape
                    num_samples = min(sample_size, height * width)
                    
                    # Random sampling
                    flat_indices = np.random.choice(height * width, num_samples, replace=False)
                    y_coords, x_coords = np.unravel_index(flat_indices, (height, width))
                    
                    # เก็บ samples พร้อม coordinates
                    band_samples = []
                    for j in range(len(x_coords)):
                        x, y = int(x_coords[j]), int(y_coords[j])
                        value = data[y, x]
                        
                        # แปลง pixel coordinates เป็น geo coordinates
                        gt = self.dataset.GetGeoTransform()
                        geo_x = gt[0] + x * gt[1] + y * gt[2]
                        geo_y = gt[3] + x * gt[4] + y * gt[5]
                        
                        band_samples.append({
                            "pixel_x": x,
                            "pixel_y": y,
                            "geo_x": geo_x,
                            "geo_y": geo_y,
                            "value": safe_json_serialize(value)
                        })
                    
                    samples[f"band_{i+1}"] = {
                        "samples": band_samples,
                        "sample_count": len(band_samples),
                        "total_pixels": int(height * width)
                    }
                    
        except Exception as e:
            samples["error"] = str(e)
        
        return samples
    
    def _prepare_compressed_band_data(self):
        """เตรียมข้อมูล band สำหรับ compression"""
        compressed_info = {}
        
        try:
            for i in range(self.dataset.RasterCount):
                band = self.dataset.GetRasterBand(i + 1)
                
                compressed_info[f"band_{i+1}"] = {
                    "data_type": gdal.GetDataTypeName(band.DataType),
                    "size": {
                        "width": self.dataset.RasterXSize,
                        "height": self.dataset.RasterYSize
                    },
                    "compression_ready": True,
                    "estimated_size_bytes": self.dataset.RasterXSize * self.dataset.RasterYSize * self._get_data_type_size(band.DataType),
                    "tile_info": {
                        "optimal_tile_size": 256,  # 256x256 tiles
                        "tiles_x": int(np.ceil(self.dataset.RasterXSize / 256)),
                        "tiles_y": int(np.ceil(self.dataset.RasterYSize / 256))
                    }
                }
                
        except Exception as e:
            compressed_info["error"] = str(e)
        
        return compressed_info
    
    def _get_data_type_size(self, gdal_data_type):
        """ได้ขนาด bytes ของแต่ละ data type"""
        type_sizes = {
            1: 1,   # GDT_Byte
            2: 2,   # GDT_UInt16
            3: 2,   # GDT_Int16
            4: 4,   # GDT_UInt32
            5: 4,   # GDT_Int32
            6: 4,   # GDT_Float32
            7: 8,   # GDT_Float64
        }
        return type_sizes.get(gdal_data_type, 4)  # Default 4 bytes
    
    def _get_reconstruction_metadata(self):
        """ข้อมูลสำหรับ reconstruct ไฟล์"""
        return {
            "original_filename": os.path.basename(self.file_path),
            "original_size_bytes": os.path.getsize(self.file_path),
            "dimensions": {
                "width": self.dataset.RasterXSize,
                "height": self.dataset.RasterYSize,
                "bands": self.dataset.RasterCount
            },
            "geotransform": list(self.dataset.GetGeoTransform()),
            "projection_wkt": self.dataset.GetProjection(),
            "driver": self.dataset.GetDriver().ShortName,
            "creation_options": {
                "compress": "LZW",
                "tiled": "YES",
                "blocksize": 256
            },
            "reconstruction_feasible": True,
            "reconstruction_notes": "Can reconstruct approximate version using stored samples and statistics"
        }

def main():
    if len(sys.argv) != 2:
        print(json.dumps({
            "error": "Usage: python3 geotiff_extractor.py <file_path>",
            "example": "python3 geotiff_extractor.py /path/to/file.tif",
            "extraction_timestamp": str(datetime.datetime.now())
        }, indent=2, default=safe_json_serialize))
        sys.exit(1)
    
    file_path = sys.argv[1]
    
    if not os.path.exists(file_path):
        print(json.dumps({
            "error": f"File not found: {file_path}",
            "file_path": file_path,
            "extraction_timestamp": str(datetime.datetime.now())
        }, indent=2, default=safe_json_serialize))
        sys.exit(1)
    
    # เริ่มรีดข้อมูล
    extractor = DynamicGeoTIFFExtractor(file_path)
    result = extractor.extract_everything()
    
    # ส่งผลลัพธ์กลับเป็น JSON
    print(json.dumps(result, indent=2, default=safe_json_serialize))

if __name__ == "__main__":
    main()
