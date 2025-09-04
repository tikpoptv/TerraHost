const axios = require('axios');

class NextcloudService {
  constructor() {
    this.baseUrl = process.env.NEXTCLOUD_URL || 'http://localhost:8080';
    this.username = process.env.NEXTCLOUD_USERNAME || 'admin';
    this.password = process.env.NEXTCLOUD_PASSWORD || 'password';
    
    // Create axios instance with basic auth
    this.client = axios.create({
      baseURL: this.baseUrl,
      auth: {
        username: this.username,
        password: this.password
      },
      timeout: 300000, // 5 minutes timeout for large files
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });
  }

  // Get user's files path dynamically
  getUserFilesPath() {
    return `/remote.php/dav/files/${this.username}`;
  }

  // Get TerraHost folder path
  getTerraHostPath() {
    return `${this.getUserFilesPath()}/TerraHost`;
  }

  // Test connection to Nextcloud
  async testConnection() {
    try {
      const response = await this.client.get('/ocs/v1.php/cloud/capabilities');
      return {
        success: true,
        data: {
          connected: true,
          version: response.data?.ocs?.data?.version?.string || 'Unknown',
          message: 'Successfully connected to Nextcloud'
        }
      };
    } catch (error) {
      console.error('Nextcloud connection test failed:', error.message);
      return {
        success: false,
        error: `Failed to connect to Nextcloud: ${error.message}`
      };
    }
  }

  // Create directory in Nextcloud
  async createDirectory(dirPath) {
    try {
      // Always create directories under TerraHost folder
      const fullPath = `${this.getTerraHostPath()}${dirPath}`;
      
      const response = await this.client.request({
        method: 'MKCOL',
        url: fullPath,
        headers: {
          'Depth': '0'
        }
      });

      return {
        success: true,
        data: {
          path: fullPath,
          message: 'Directory created successfully'
        }
      };
    } catch (error) {
      // Directory might already exist, which is fine
      if (error.response?.status === 405) {
        return {
          success: true,
          data: {
            path: `${this.getTerraHostPath()}${dirPath}`,
            message: 'Directory already exists'
          }
        };
      }
      
      console.error('Failed to create directory:', error.message);
      return {
        success: false,
        error: `Failed to create directory: ${error.message}`
      };
    }
  }

  // Upload file to Nextcloud
  async uploadFile(fileBuffer, filename, remotePath = '') {
    try {
      // Ensure directory exists
      if (remotePath) {
        const dirResult = await this.createDirectory(remotePath);
        if (!dirResult.success) {
          return dirResult;
        }
      }

      const fullPath = `${this.getTerraHostPath()}${remotePath}/${filename}`;
      
      // Upload file using PUT method
      const response = await this.client.put(fullPath, fileBuffer, {
        headers: {
          'Content-Type': 'image/tiff',
          'Content-Length': fileBuffer.length
        }
      });

      if (response.status === 201 || response.status === 204) {
        return {
          success: true,
          data: {
            remotePath: fullPath,
            filename,
            size: fileBuffer.length,
            message: 'File uploaded to Nextcloud successfully'
          }
        };
      } else {
        return {
          success: false,
          error: `Upload failed with status: ${response.status}`
        };
      }

    } catch (error) {
      console.error('Nextcloud upload failed:', error.message);
      return {
        success: false,
        error: `Failed to upload to Nextcloud: ${error.message}`
      };
    }
  }

  // Get file info from Nextcloud
  async getFileInfo(remotePath) {
    try {
      const fullPath = `${this.getTerraHostPath()}${remotePath}`;
      
      const response = await this.client.request({
        method: 'PROPFIND',
        url: fullPath,
        headers: {
          'Depth': '0'
        },
        data: `<?xml version="1.0" encoding="utf-8" ?>
               <propfind xmlns="DAV:">
                 <prop>
                   <getcontentlength/>
                   <getlastmodified/>
                   <getcontenttype/>
                   <resourcetype/>
                 </prop>
               </propfind>`
      });

      return {
        success: true,
        data: {
          exists: true,
          path: fullPath,
          response: response.data
        }
      };
    } catch (error) {
      if (error.response?.status === 404) {
        return {
          success: true,
          data: {
            exists: false,
            path: `${this.getTerraHostPath()}${remotePath}`
          }
        };
      }
      
      return {
        success: false,
        error: `Failed to get file info: ${error.message}`
      };
    }
  }

  // Download file from Nextcloud
  async downloadFile(remotePath, localFilePath) {
    try {
      const fs = require('fs');
      const path = require('path');
      
      // Ensure local directory exists
      const localDir = path.dirname(localFilePath);
      if (!fs.existsSync(localDir)) {
        fs.mkdirSync(localDir, { recursive: true });
      }
      
      // Convert Nextcloud path to full URL
      let fullPath;
      if (remotePath.startsWith('/remote.php/dav/files/')) {
        // Full Nextcloud path provided
        fullPath = remotePath;
      } else {
        // Relative path, prepend TerraHost path
        fullPath = `${this.getTerraHostPath()}${remotePath}`;
      }
      
      console.log('📥 Downloading from Nextcloud:', fullPath);
      console.log('📁 Saving to local:', localFilePath);
      
      // Download file
      const response = await this.client.get(fullPath, {
        responseType: 'stream'
      });
      
      // Create write stream
      const writer = fs.createWriteStream(localFilePath);
      
      // Pipe response to file
      response.data.pipe(writer);
      
      return new Promise((resolve, reject) => {
        writer.on('finish', () => {
          console.log('✅ File downloaded successfully');
          resolve({
            success: true,
            data: {
              localPath: localFilePath,
              remotePath: fullPath,
              message: 'File downloaded successfully'
            }
          });
        });
        
        writer.on('error', (error) => {
          console.error('❌ Write error:', error);
          reject({
            success: false,
            error: `Failed to write file: ${error.message}`
          });
        });
        
        response.data.on('error', (error) => {
          console.error('❌ Download error:', error);
          reject({
            success: false,
            error: `Failed to download file: ${error.message}`
          });
        });
      });
      
    } catch (error) {
      console.error('❌ Download failed:', error.message);
      return {
        success: false,
        error: `Failed to download file: ${error.message}`
      };
    }
  }

  // Delete file from Nextcloud
  async deleteFile(remotePath) {
    try {
      const fullPath = `${this.getTerraHostPath()}${remotePath}`;
      
      const response = await this.client.delete(fullPath);

      if (response.status === 204) {
        return {
          success: true,
          data: {
            message: 'File deleted from Nextcloud successfully'
          }
        };
      } else {
        return {
          success: false,
          error: `Delete failed with status: ${response.status}`
        };
      }

    } catch (error) {
      console.error('Nextcloud delete failed:', error.message);
      return {
        success: false,
        error: `Failed to delete from Nextcloud: ${error.message}`
      };
    }
  }

  // List files in directory
  async listFiles(remotePath = '') {
    try {
      const fullPath = `${this.getTerraHostPath()}${remotePath}`;
      
      const response = await this.client.request({
        method: 'PROPFIND',
        url: fullPath,
        headers: {
          'Depth': '1'
        },
        data: `<?xml version="1.0" encoding="utf-8" ?>
               <propfind xmlns="DAV:">
                 <prop>
                   <getcontentlength/>
                   <getlastmodified/>
                   <getcontenttype/>
                   <resourcetype/>
                 </prop>
               </propfind>`
      });

      return {
        success: true,
        data: {
          path: fullPath,
          files: this.parseFileList(response.data)
        }
      };

    } catch (error) {
      console.error('Failed to list files:', error.message);
      return {
        success: false,
        error: `Failed to list files: ${error.message}`
      };
    }
  }

  // Parse XML response to get file list
  parseFileList(xmlData) {
    // Simple XML parsing - in production, use proper XML parser
    const files = [];
    const fileMatches = xmlData.match(/<d:response>/g);
    
    if (fileMatches) {
      // Extract basic file info from XML
      // This is a simplified parser - you might want to use xml2js or similar
      const sizeMatches = xmlData.match(/<d:getcontentlength>(\d+)<\/d:getcontentlength>/g);
      const dateMatches = xmlData.match(/<d:getlastmodified>([^<]+)<\/d:getlastmodified>/g);
      
      if (sizeMatches && dateMatches) {
        for (let i = 0; i < sizeMatches.length; i++) {
          const size = sizeMatches[i].match(/\d+/)[0];
          const date = dateMatches[i].match(/>([^<]+)</)[1];
          
          files.push({
            size: parseInt(size),
            lastModified: new Date(date),
            isDirectory: false // Simplified - would need more parsing
          });
        }
      }
    }
    
    return files;
  }

  // Get download URL for file
  getDownloadUrl(remotePath) {
    const fullPath = `${this.getTerraHostPath()}${remotePath}`;
    return `${this.baseUrl}${fullPath}`;
  }

  // Get public share URL (if sharing is enabled)
  async createPublicShare(remotePath, permissions = 'read') {
    try {
      const shareData = {
        path: `${this.getTerraHostPath()}${remotePath}`,
        shareType: 3, // Public link
        permissions: permissions === 'read' ? 1 : 3, // 1=read, 3=read+write
        publicUpload: false
      };

      const response = await this.client.post('/ocs/v1.php/apps/files_sharing/api/v1/shares', shareData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'OCS-APIRequest': 'true'
        }
      });

      if (response.data?.ocs?.data?.url) {
        return {
          success: true,
          data: {
            shareUrl: response.data.ocs.data.url,
            token: response.data.ocs.data.token,
            message: 'Public share created successfully'
          }
        };
      } else {
        return {
          success: false,
          error: 'Failed to create public share'
        };
      }

    } catch (error) {
      console.error('Failed to create public share:', error.message);
      return {
        success: false,
        error: `Failed to create public share: ${error.message}`
      };
    }
  }
}

module.exports = NextcloudService;
