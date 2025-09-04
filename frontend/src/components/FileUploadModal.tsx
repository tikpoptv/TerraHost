'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from './AuthProvider';
import fileService from '@/services/fileService';

interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: () => void;
}

interface UploadProgress {
  percentage: number;
  status: 'idle' | 'uploading' | 'success' | 'error';
  message: string;
}

export default function FileUploadModal({ isOpen, onClose, onUploadSuccess }: FileUploadModalProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadQueue, setUploadQueue] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    percentage: 0,
    status: 'idle',
    message: ''
  });
  const [isUploading, setIsUploading] = useState(false);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState<{ file: File; status: 'success' | 'error'; message: string; isFilenameError?: boolean }[]>([]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const validFiles: File[] = [];
    const invalidFiles: string[] = [];

    files.forEach(file => {
      // Validate file type
      const validTypes = ['image/tiff', 'image/geotiff'];
      const validExtensions = ['.tiff', '.tif'];
      const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
      
      if (!validTypes.includes(file.type) && !validExtensions.includes(fileExtension)) {
        invalidFiles.push(`${file.name} (Not a GeoTIFF file)`);
        return;
      }

      // Validate file size (500MB limit)
      const maxSize = 500 * 1024 * 1024; // 500MB
      if (file.size > maxSize) {
        invalidFiles.push(`${file.name} (Size exceeds 500MB)`);
        return;
      }

      validFiles.push(file);
    });

    if (invalidFiles.length > 0) {
      setUploadProgress({
        percentage: 0,
        status: 'error',
        message: `Invalid files: ${invalidFiles.join(', ')}`
      });
    }

    if (validFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...validFiles]);
      setUploadProgress({
        percentage: 0,
        status: 'idle',
        message: `Selected ${validFiles.length} files (${(validFiles.reduce((sum, f) => sum + f.size, 0) / (1024 * 1024)).toFixed(2)} MB)`
      });
    }
  };

  const handleUpload = async () => {
    console.log('🚀 handleUpload called');
    console.log('📁 selectedFiles:', selectedFiles);
    console.log('👤 user:', user);
    
    if (selectedFiles.length === 0 || !user) {
      console.log('❌ Validation failed');
      return;
    }

    console.log('✅ Starting upload process');
    setIsUploading(true);
    setUploadQueue([...selectedFiles]);
    setCurrentFileIndex(0);
    setUploadedFiles([]);

    console.log('🔄 Upload queue set:', [...selectedFiles]);
    console.log('📊 Current file index:', 0);

    // Start uploading files one by one - pass selectedFiles directly
    await uploadNextFile([...selectedFiles], 0, []);
  };

  const uploadNextFile = async (files: File[], fileIndex: number, completedFiles: { file: File; status: 'success' | 'error'; message: string }[]) => {
    console.log('🔄 uploadNextFile called');
    console.log('📊 fileIndex:', fileIndex);
    console.log('📁 files.length:', files.length);
    console.log('📁 files:', files);
    
    if (fileIndex >= files.length) {
      console.log('✅ All files uploaded');
      // All files uploaded
      setIsUploading(false);
      setUploadProgress({
        percentage: 100,
        status: 'success',
        message: `Upload completed! ${completedFiles.filter(f => f.status === 'success').length}/${files.length} files successful`
      });

      // Reset form and close modal after success
      setTimeout(() => {
        resetForm();
        onUploadSuccess();
        onClose();
      }, 2000);
      return;
    }

    const currentFile = files[fileIndex];
    console.log('📁 Current file to upload:', currentFile);
    
    setUploadProgress({
      percentage: 0,
      status: 'uploading',
      message: `Uploading file ${currentFileIndex + 1}/${uploadQueue.length}: ${currentFile.name}`
    });

    try {
      console.log('🚀 Starting upload for file:', currentFile.name);
      
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => ({
          ...prev,
          percentage: Math.min(prev.percentage + Math.random() * 20, 90)
        }));
      }, 200);

      console.log('📤 Calling fileService.uploadFile...');
      const response = await fileService.uploadFile(currentFile);
      console.log('📥 Upload response:', response);

      clearInterval(progressInterval);

      // Check actual response
      if (!response) {
        throw new Error('No response received from server');
      }

      if (response.success) {
        console.log('✅ Upload successful for:', currentFile.name);
        
        setUploadedFiles(prev => [...prev, { 
          file: currentFile, 
          status: 'success', 
          message: 'Upload successful' 
        }]);

        setUploadProgress({
          percentage: 100,
          status: 'success',
          message: `Upload successful: ${currentFile.name}`
        });

        // Move to next file after a short delay
        setTimeout(() => {
          console.log('⏭️ Moving to next file...');
          const newCompletedFiles = [...completedFiles, { 
            file: currentFile, 
            status: 'success' as const, 
            message: 'Upload successful' 
          }];
          uploadNextFile(files, fileIndex + 1, newCompletedFiles);
        }, 1000);
      } else {
        console.log('❌ Upload failed for:', currentFile.name, response.error);
        
        // Check clear error
        let errorMessage = 'Upload failed';
        
        if (response.error) {
          errorMessage = response.error;
        }
        
        if (response.details) {
          console.log('Error details:', response.details);
        }
        
        // Stop upload and show error
        clearInterval(progressInterval);
        setIsUploading(false);
        
        setUploadProgress({
          percentage: 0,
          status: 'error',
          message: `Upload failed: ${currentFile.name}`
        });
        
        // Add file to error list
        setUploadedFiles(prev => [...prev, { 
          file: currentFile, 
          status: 'error', 
          message: errorMessage,
          isFilenameError: errorMessage.includes('Invalid filename') || 
                          errorMessage.includes('filename format') ||
                          errorMessage.includes('must have _ separator')
        }]);
        
        // Do not continue
        return;
      }
    } catch (error) {
      console.error('Upload error:', error);
      
      // Check if it's a filename error
      const isFilenameErrorForUpload = error instanceof Error && 
        (error.message.includes('Invalid filename') || 
         error.message.includes('filename format') ||
         error.message.includes('must have _ separator'));

      setUploadedFiles(prev => [...prev, { 
        file: currentFile, 
        status: 'error', 
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        isFilenameError: isFilenameErrorForUpload
      }]);

      // Check if it's a filename error
      const isFilenameError = error instanceof Error && 
        (error.message.includes('Invalid filename') || 
         error.message.includes('filename format') ||
         error.message.includes('must have _ separator'));

      setUploadProgress({
        percentage: 0,
        status: 'error',
        message: isFilenameError 
          ? `Invalid filename: ${currentFile.name}`
          : `Upload failed: ${currentFile.name}`
      });

      // Stop upload when error occurs
      console.log('❌ Stopping upload due to error');
      setIsUploading(false);
      
      // Do not continue, let user fix the issue
      return;
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const files = event.dataTransfer.files;
    if (files.length > 0) {
      // Process the first file from the drop event
      if (fileInputRef.current) {
        fileInputRef.current.files = files;
        handleFileSelect({ target: { files } } as React.ChangeEvent<HTMLInputElement>);
      }
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const resetForm = () => {
    setSelectedFiles([]);
    setUploadQueue([]);
    setCurrentFileIndex(0);
    setUploadedFiles([]);
    setUploadProgress({
      percentage: 0,
      status: 'idle',
      message: ''
    });
    setIsUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    // Cleanup function to restore scroll when component unmounts
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 backdrop-blur-sm bg-black/20 flex items-center justify-center z-50">
      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto border border-white/20">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/20 bg-gradient-to-r from-white/10 to-white/5">
          <h2 className="text-2xl font-bold text-gray-900">Upload GeoTIFF Files</h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 transition-colors p-2 rounded-full hover:bg-white/20"
            disabled={isUploading}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* File Drop Zone */}
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 backdrop-blur-sm ${
              selectedFiles.length > 0
                ? 'border-green-400/60 bg-green-50/80 shadow-lg'
                : 'border-gray-300/60 hover:border-blue-400/80 hover:bg-blue-50/60 hover:shadow-lg'
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            <div className="mb-4">
              <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            
            <div className="mb-4">
              <p className="text-lg font-medium text-gray-900">
                {selectedFiles.length > 0 ? `Selected ${selectedFiles.length} files` : 'Drag files here or click to select files'}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Supports GeoTIFF files (.tiff, .tif) up to 500MB
              </p>
              <p className="text-xs text-blue-600 mt-1 font-medium">
                Filename format: NAME_YYYYMMDD.tif (e.g., MCD18A1_20250605.tif)
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".tiff,.tif,image/tiff,image/geotiff"
              onChange={handleFileSelect}
              className="hidden"
              disabled={isUploading}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-400 disabled:to-gray-500 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 backdrop-blur-sm"
            >
              {selectedFiles.length > 0 ? 'Add Files' : 'Select Files'}
            </button>
          </div>

          {/* Uploaded Files Status */}
          {uploadedFiles.length > 0 && (
            <div className="mt-6 space-y-3">
              <h4 className="font-medium text-gray-900">Upload Status:</h4>
              {uploadedFiles.map((uploadedFile, index) => (
                <div key={index} className={`p-3 rounded-lg border ${
                  uploadedFile.status === 'success' 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-center space-x-2">
                    <span className={`text-sm font-medium ${
                      uploadedFile.status === 'success' ? 'text-green-800' : 'text-red-800'
                    }`}>
                      {uploadedFile.file.name}
                    </span>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      uploadedFile.status === 'success' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {uploadedFile.status === 'success' ? 'Success' : 'Failed'}
                    </span>
                  </div>
                  <p className={`text-xs mt-1 ${
                    uploadedFile.status === 'success' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {uploadedFile.message}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* File Info */}
          {selectedFiles.length > 0 && (
            <div className="mt-6 space-y-3">
              <h4 className="font-medium text-gray-900">Selected Files:</h4>
              {selectedFiles.map((file, index) => (
                <div key={index} className="p-4 bg-white/60 backdrop-blur-sm rounded-lg border border-white/30 shadow-sm hover:shadow-md transition-all duration-200">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-blue-100 to-blue-200 rounded-lg flex items-center justify-center shadow-sm">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{file.name}</h4>
                      <p className="text-sm text-gray-500">
                        Size: {(file.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== index))}
                      className="text-red-500 hover:text-red-700 transition-all duration-200 p-2 rounded-full hover:bg-red-50/80"
                      disabled={isUploading}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Upload Progress */}
          {uploadProgress.status !== 'idle' && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">
                  {uploadProgress.status === 'uploading' ? 'Uploading...' : 
                   uploadProgress.status === 'success' ? 'Upload successful' : 'Upload failed'}
                </span>
                {uploadProgress.status === 'uploading' && (
                  <span className="text-sm text-gray-500">{uploadProgress.percentage.toFixed(0)}%</span>
                )}
              </div>
              
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    uploadProgress.status === 'success' ? 'bg-green-500' :
                    uploadProgress.status === 'error' ? 'bg-red-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${uploadProgress.percentage}%` }}
                />
              </div>
              
              <p className={`text-sm mt-2 ${
                uploadProgress.status === 'success' ? 'text-green-600' :
                uploadProgress.status === 'error' ? 'text-red-600' : 'text-blue-600'
              }`}>
                {uploadProgress.message}
              </p>
              
              {/* Show error details and instructions */}
              {uploadProgress.status === 'error' && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start space-x-2">
                    <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-red-800 mb-1">How to Fix</h4>
                      <ul className="text-xs text-red-700 space-y-1">
                        <li>• Filename must follow format: <code className="bg-red-100 px-1 rounded">NAME_YYYYMMDD.tif</code></li>
                        <li>• Correct example: <code className="bg-red-100 px-1 rounded">MCD18A1_20250605.tif</code></li>
                        <li>• Must have <code className="bg-red-100 px-1 rounded">_</code> separator between filename and date</li>
                        <li>• Date must be in format <code className="bg-red-100 px-1 rounded">YYYYMMDD</code> (e.g., 20250605)</li>
                        <li>• File extension must be <code className="bg-red-100 px-1 rounded">.tif</code> or <code className="bg-red-100 px-1 rounded">.tiff</code></li>
                      </ul>
                      
                      {/* Retry buttons */}
                      <div className="mt-3 flex space-x-2">
                        <button
                          onClick={() => {
                            setUploadProgress({ percentage: 0, status: 'idle', message: '' });
                            setIsUploading(false);
                          }}
                          className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs rounded-md transition-colors"
                        >
                          Clear Error Message
                        </button>
                        <button
                          onClick={() => {
                            setUploadProgress({ percentage: 0, status: 'idle', message: '' });
                            setIsUploading(false);
                            setUploadedFiles([]);
                          }}
                          className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white text-xs rounded-md transition-colors"
                        >
                          Clear All
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Nextcloud Info */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-medium text-blue-800">Storage Information</span>
            </div>
            <p className="text-sm text-blue-700 mt-2">
              Files will be uploaded to Nextcloud in the <code className="bg-blue-100 px-1 rounded">TerraHost/GeoTIFF</code> folder 
              and data will be saved to PostgreSQL database
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-white/20 bg-gradient-to-r from-white/5 to-white/10">
          <button
            onClick={handleClose}
            disabled={isUploading}
            className="px-4 py-2 text-gray-700 bg-white/60 hover:bg-white/80 disabled:bg-white/40 disabled:text-gray-400 rounded-lg font-medium transition-all duration-200 backdrop-blur-sm border border-white/30"
          >
            Cancel
          </button>
          
          <button
            onClick={handleUpload}
            disabled={selectedFiles.length === 0 || isUploading}
            className="px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            {isUploading ? 'Uploading...' : `Upload ${selectedFiles.length} files`}
          </button>
        </div>
      </div>
    </div>
  );
}
