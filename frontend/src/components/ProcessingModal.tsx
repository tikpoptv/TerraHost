'use client';

import { useState, useEffect } from 'react';
import { GeoTIFFFile } from '@/services/fileService';
import fileService from '@/services/fileService';
import toast from 'react-hot-toast';

interface ProcessingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProcessingComplete?: () => void;
}

export default function ProcessingModal({ isOpen, onClose, onProcessingComplete }: ProcessingModalProps) {
  const [unprocessedFiles, setUnprocessedFiles] = useState<GeoTIFFFile[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [processingFiles, setProcessingFiles] = useState<Set<string>>(new Set());
  const [completedFiles, setCompletedFiles] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  // Load unprocessed files when modal opens and prevent body scroll
  useEffect(() => {
    if (isOpen) {
      loadUnprocessedFiles();
      toast.success('Processing modal opened');
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    } else {
      // Restore body scroll when modal is closed
      document.body.style.overflow = 'unset';
    }

    // Cleanup function to restore scroll when component unmounts
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Load files that haven't been processed yet
  const loadUnprocessedFiles = async () => {
    try {
      setIsLoading(true);
      
      // Add minimum loading time for smooth UX
      const [response] = await Promise.all([
        fileService.getUserFiles({ 
          page: 1, 
          limit: 100,
          session_status: 'not_started'
        }),
        new Promise(resolve => setTimeout(resolve, 1500)) // 1.5 seconds minimum loading
      ]);
      
      if (response.success && response.data) {
        setUnprocessedFiles(response.data.files || []);
        console.log('📊 Unprocessed files loaded:', response.data.files?.length || 0);
        toast.success(`Loaded ${response.data.files?.length || 0} unprocessed files`);
      } else {
        setUnprocessedFiles([]);
        toast.error('Failed to load unprocessed files');
      }
    } catch (error) {
      console.error('Failed to load unprocessed files:', error);
      setUnprocessedFiles([]);
      toast.error('Error loading unprocessed files');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle file selection
  const handleFileSelect = (fileId: string) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(fileId)) {
      newSelected.delete(fileId);
      toast.success('File deselected');
    } else {
      newSelected.add(fileId);
      toast.success('File selected');
    }
    setSelectedFiles(newSelected);
  };

  // Handle select all
  const handleSelectAll = () => {
    if (selectedFiles.size === unprocessedFiles.length) {
      setSelectedFiles(new Set());
      toast.success('All files deselected');
    } else {
      setSelectedFiles(new Set(unprocessedFiles.map(f => f.id)));
      toast.success(`All ${unprocessedFiles.length} files selected`);
    }
  };

  // Process single file
  const processSingleFile = async (fileId: string) => {
    try {
      // Add to processing set
      setProcessingFiles(prev => new Set(prev).add(fileId));
      
      // Start processing
      const result = await fileService.processGeoTIFF(fileId);
      console.log('Processing started for file:', fileId, result);
      
      // Show success toast for starting processing
      toast.success(`Processing started for ${fileId.substring(0, 8)}...`);
      
      // Start polling for status
      pollProcessingStatus(fileId);
    } catch (error) {
      console.error('Process file error:', error);
      toast.error(`Failed to start processing for ${fileId.substring(0, 8)}...`);
      setProcessingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(fileId);
        return newSet;
      });
    }
  };

  // Poll processing status
  const pollProcessingStatus = async (fileId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const status = await fileService.getProcessingStatus(fileId);
        
        if (status.processingStatus === 'completed') {
          // Processing completed
          setProcessingFiles(prev => {
            const newSet = new Set(prev);
            newSet.delete(fileId);
            return newSet;
          });
          setCompletedFiles(prev => new Set(prev).add(fileId));
          clearInterval(pollInterval);
          
          // Show success toast
          toast.success(`Processing completed for ${fileId.substring(0, 8)}...`);
          
          // Remove from unprocessed files
          setUnprocessedFiles(prev => prev.filter(f => f.id !== fileId));
          
          // Call callback if provided
          if (onProcessingComplete) {
            onProcessingComplete();
          }
        } else if (status.processingStatus === 'not_started') {
          // Processing failed
          setProcessingFiles(prev => {
            const newSet = new Set(prev);
            newSet.delete(fileId);
            return newSet;
          });
          clearInterval(pollInterval);
          toast.error(`Processing failed for ${fileId.substring(0, 8)}...`);
        }
        // Continue polling if still in progress
      } catch (error) {
        console.error('Error polling status:', error);
        clearInterval(pollInterval);
        setProcessingFiles(prev => {
          const newSet = new Set(prev);
          newSet.delete(fileId);
          return newSet;
        });
        toast.error(`Error checking status for ${fileId.substring(0, 8)}...`);
      }
    }, 2000); // Poll every 2 seconds

    // Cleanup after 5 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
      setProcessingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(fileId);
        return newSet;
      });
      toast.error(`Processing timeout for ${fileId.substring(0, 8)}...`);
    }, 5 * 60 * 1000);
  };

  // Handle start processing
  const handleStartProcessing = async () => {
    if (selectedFiles.size === 0) return;
    
    // Show initial toast
    toast.success(`Starting processing for ${selectedFiles.size} files...`);
    
    // Process files one by one (queue)
    const fileIds = Array.from(selectedFiles);
    
    for (const fileId of fileIds) {
      await processSingleFile(fileId);
      // Small delay between files to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Clear selection after starting all
    setSelectedFiles(new Set());
    toast.success(`Processing started for all ${fileIds.length} files!`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-white/30 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">🚀 Processing Management</h2>
            <p className="text-gray-600 mt-1">Select files to process</p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                loadUnprocessedFiles();
                toast.success('Processing files refreshed');
              }}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              title="Refresh Files"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button
              onClick={() => {
                onClose();
                toast.success('Processing modal closed');
              }}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              title="Close Modal"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {isLoading ? (
            <div className="space-y-4">
              {/* Skeleton Loading */}
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="animate-pulse">
                  <div className="flex items-center p-4 bg-gray-100 rounded-lg border border-gray-200">
                    <div className="w-4 h-4 bg-gray-200 rounded mr-4"></div>
                    <div className="w-10 h-10 bg-gray-200 rounded-lg mr-4"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-48"></div>
                      <div className="h-3 bg-gray-200 rounded w-32"></div>
                    </div>
                  </div>
                </div>
              ))}
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            </div>
          ) : unprocessedFiles.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No files to process</h3>
              <p className="text-gray-500">All files have been processed</p>
            </div>
          ) : (
            <>
              {/* Summary */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-blue-900">Summary</h3>
                    <p className="text-sm text-blue-700">
                      Found {unprocessedFiles.length} unprocessed files
                      {selectedFiles.size > 0 && ` • ${selectedFiles.size} selected`}
                      {processingFiles.size > 0 && ` • ${processingFiles.size} processing`}
                      {completedFiles.size > 0 && ` • ${completedFiles.size} completed`}
                    </p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={handleSelectAll}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {selectedFiles.size === unprocessedFiles.length ? 'Deselect All' : 'Select All'}
                    </button>
                    {selectedFiles.size > 0 && (
                      <button
                        onClick={handleStartProcessing}
                        disabled={processingFiles.size > 0}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                      >
                        Start Processing {selectedFiles.size} Files
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* File List */}
              <div className="space-y-3">
                {unprocessedFiles.map((file) => {
                  const isProcessing = processingFiles.has(file.id);
                  const isCompleted = completedFiles.has(file.id);
                  
                  return (
                    <div
                      key={file.id}
                      className={`flex items-center p-4 rounded-lg border transition-colors ${
                        isCompleted ? 'bg-green-50 border-green-200' :
                        isProcessing ? 'bg-blue-50 border-blue-200' :
                        selectedFiles.has(file.id) ? 'bg-blue-50 border-blue-200' :
                        'bg-gray-50 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedFiles.has(file.id)}
                        onChange={() => handleFileSelect(file.id)}
                        disabled={isProcessing || isCompleted}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
                      />
                      
                      <div className="ml-4 flex-1">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">{file.original_filename}</h4>
                            <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
                              <span>Size: {formatFileSize(file.file_size)}</span>
                              <span>Uploaded: {formatDateTime(file.created_at)}</span>
                              {isCompleted ? (
                                <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                                  Completed
                                </span>
                              ) : isProcessing ? (
                                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                                  Processing...
                                </span>
                              ) : (
                                <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs">
                                  Pending
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper functions
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
