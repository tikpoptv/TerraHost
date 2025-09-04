'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuthCheck } from '@/hooks/useAuthCheck';
import FileUploadModal from '@/components/FileUploadModal';
import ProcessingModal from '@/components/ProcessingModal';
import TokenManagementModal from '@/components/TokenManagementModal';
import fileService, { GeoTIFFFile, FileListResponse } from '@/services/fileService';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const { checkAuth, isChecking, lastChecked } = useAuthCheck();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  
  // File management state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isProcessingModalOpen, setIsProcessingModalOpen] = useState(false);
  const [isTokenManagementModalOpen, setIsTokenManagementModalOpen] = useState(false);
  const [files, setFiles] = useState<GeoTIFFFile[]>([]);
  const [fileStats, setFileStats] = useState({
    totalFiles: 0,
    totalSize: 0,
    completedFiles: 0,
    processingFiles: 0,
    processedFiles: 0
  });
  const [isLoadingFiles, setIsLoadingFiles] = useState(true);

  // Processing state
  const [processingFiles, setProcessingFiles] = useState<Set<string>>(new Set());
  const [processedFiles, setProcessedFiles] = useState<Set<string>>(new Set());

  const handleLogout = async () => {
    if (isLoggingOut) return; // Prevent double-click
    
    setIsLoggingOut(true);
    
    try {
      await logout();
      // AuthProvider will handle redirect when auth state changes
    } catch (error) {
      console.error('Logout failed:', error);
      // AuthProvider will still handle redirect after logout method clears local storage
    }
  };

  const handleCheckAuth = async () => {
    await checkAuth();
  };

  // Load user files
  const loadUserFiles = async () => {
    try {
      setIsLoadingFiles(true);
      const response = await fileService.getUserFiles({ page: 1, limit: 50 });
      
      if (response.success && response.data) {
        setFiles(response.data.files);
        
        // Calculate stats
        const totalSize = response.data.files.reduce((sum, file) => sum + file.file_size, 0);
        const completedFiles = response.data.files.filter(file => file.upload_status === 'completed').length;
        const processingFiles = response.data.files.filter(file => file.upload_status === 'processing').length;
        const processedFiles = response.data.files.filter(file => file.upload_status === 'processed').length;
        
        setFileStats({
          totalFiles: response.data.files.length,
          totalSize,
          completedFiles,
          processingFiles,
          processedFiles
        });
      }
    } catch (error) {
      console.error('Failed to load files:', error);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  // Handle upload success
  const handleUploadSuccess = () => {
    loadUserFiles(); // Reload files after successful upload
  };

  // Delete file
  const handleDeleteFile = async (fileId: string) => {
    if (confirm('คุณแน่ใจหรือไม่ที่จะลบไฟล์นี้?')) {
      try {
        const response = await fileService.deleteFile(fileId);
        if (response.success) {
          loadUserFiles(); // Reload files after deletion
        } else {
          alert('ลบไฟล์ล้มเหลว: ' + response.error);
        }
      } catch (error) {
        console.error('Delete file error:', error);
        alert('เกิดข้อผิดพลาดในการลบไฟล์');
      }
    }
  };

  // Process GeoTIFF file
  const handleProcessFile = async (fileId: string) => {
    try {
      // Add to processing set
      setProcessingFiles(prev => new Set(prev).add(fileId));
      
      const result = await fileService.processGeoTIFF(fileId);
      
      // Start polling for status
      pollProcessingStatus(fileId);
    } catch (error) {
      console.error('Process file error:', error);
      alert('เกิดข้อผิดพลาดในการประมวลผล');
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
          setProcessedFiles(prev => new Set(prev).add(fileId));
          clearInterval(pollInterval);
          loadUserFiles(); // Reload to get updated status
        } else if (status.processingStatus === 'not_started') {
          // Processing failed
          setProcessingFiles(prev => {
            const newSet = new Set(prev);
            newSet.delete(fileId);
            return newSet;
          });
          clearInterval(pollInterval);
          alert('การประมวลผลล้มเหลว');
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
    }, 5 * 60 * 1000);
  };

  // View file metadata
  const handleViewMetadata = async (fileId: string) => {
    try {
      const metadata = await fileService.getFileMetadata(fileId);
      // For now, just show alert. You can create a modal later
      alert(`ข้อมูลไฟล์:\nขนาด: ${metadata.spatialMetadata.dimensions.width}x${metadata.spatialMetadata.dimensions.height}\nจำนวน Bands: ${metadata.spatialMetadata.dimensions.bandsCount}`);
    } catch (error) {
      console.error('Error getting metadata:', error);
      alert('ไม่สามารถดึงข้อมูลได้');
    }
  };

  // Load files on component mount
  useEffect(() => {
    loadUserFiles();
  }, []);

  return (
    <ProtectedRoute requireAuth={true}>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-4 gap-4">
              <div className="flex items-center">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">TerraHost Dashboard</h1>
              </div>
              
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 w-full sm:w-auto">
                {/* User Info */}
                {user && (
                  <div className="flex items-center space-x-3 px-3 sm:px-4 py-2 bg-gray-50 rounded-lg border w-full sm:w-auto">
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-sm font-bold">
                        {user.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="text-sm min-w-0 flex-1">
                      <div className="font-medium text-gray-900 truncate">{user.name}</div>
                      <div className="text-gray-500 text-xs">ID: {user.id}</div>
                    </div>
                  </div>
                )}
                
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
                  {lastChecked && (
                    <div className="text-xs sm:text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      เช็คล่าสุด: {new Date(lastChecked).toLocaleTimeString()}
                    </div>
                  )}
                  <button 
                    onClick={handleCheckAuth}
                    disabled={isChecking}
                    className={`px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors w-full sm:w-auto ${
                      isChecking 
                        ? 'bg-gray-400 cursor-not-allowed text-white' 
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {isChecking ? 'กำลังเช็ค...' : '🔍 เช็คสถานะ'}
                  </button>
                  <button 
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className={`px-4 py-2 rounded-md text-xs sm:text-sm font-medium text-white transition-colors w-full sm:w-auto ${
                      isLoggingOut 
                        ? 'bg-gray-400 cursor-not-allowed' 
                        : 'bg-red-600 hover:bg-red-700'
                    }`}
                  >
                    {isLoggingOut ? 'กำลังออกจากระบบ...' : 'ออกจากระบบ'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="bg-gradient-to-br from-gray-50 to-blue-50 min-h-screen">
          <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <div className="space-y-8">
              {/* Welcome Section */}
              <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
                <div className="text-center">
                  <div className="mb-6">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full mb-4">
                      <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                      ยินดีต้อนรับสู่ TerraHost
                    </h2>
                    <p className="text-gray-600 text-lg mb-4">
                      ระบบจัดการข้อมูล GeoTIFF และการประมวลผลข้อมูลดาวเทียม
                    </p>
                    {user && (
                      <div className="mb-4 hidden sm:block">
                        <div className="inline-flex items-center space-x-4 text-sm text-gray-600 bg-gray-50 px-4 py-2 rounded-lg">
                          <span><strong>ID:</strong> {user.id}</span>
                          <span><strong>อีเมล:</strong> {user.email}</span>
                          <span><strong>บทบาท:</strong> {user.role}</span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            user.is_active 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {user.is_active ? 'ใช้งานได้' : 'ไม่ใช้งาน'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              </div>

              {/* GeoTIFF Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                  <div className="flex items-center">
                    <div className="p-3 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl">
                      <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-semibold text-gray-900">ไฟล์ GeoTIFF</h3>
                      <p className="text-3xl font-bold text-blue-600">{fileStats.totalFiles}</p>
                      <p className="text-sm text-gray-500">ไฟล์ที่อัพโหลด</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                  <div className="flex items-center">
                    <div className="p-3 bg-gradient-to-r from-green-500 to-green-600 rounded-xl">
                      <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-semibold text-gray-900">Layer ที่แยก</h3>
                      <p className="text-3xl font-bold text-green-600">{fileStats.completedFiles}</p>
                      <p className="text-sm text-gray-500">ไฟล์ที่ประมวลผลเสร็จ</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                  <div className="flex items-center">
                    <div className="p-3 bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl">
                      <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-semibold text-gray-900">งานประมวลผล</h3>
                      <p className="text-3xl font-bold text-purple-600">{fileStats.processingFiles}</p>
                      <p className="text-sm text-gray-500">งานที่กำลังดำเนินการ</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                  <div className="flex items-center">
                    <div className="p-3 bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl">
                      <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                      </svg>
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-semibold text-gray-900">พื้นที่จัดเก็บ</h3>
                      <p className="text-3xl font-bold text-orange-600">{fileService.formatFileSize(fileStats.totalSize)}</p>
                      <p className="text-sm text-gray-500">พื้นที่ที่ใช้</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                  <div className="flex items-center">
                    <div className="p-3 bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-xl">
                      <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 012 2h2a2 2 0 012-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-semibold text-gray-900">ประมวลผลเสร็จ</h3>
                      <p className="text-3xl font-bold text-indigo-600">{fileStats.processedFiles}</p>
                      <p className="text-sm text-gray-500">ไฟล์ที่แกะข้อมูลแล้ว</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100 mb-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-6">🚀 การดำเนินการด่วน</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <button 
                    onClick={() => setIsUploadModalOpen(true)}
                    className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-6 py-4 rounded-xl font-medium transition-all duration-300 transform hover:scale-105 shadow-lg"
                  >
                    <div className="flex items-center justify-center space-x-2">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <span>อัพโหลด GeoTIFF</span>
                    </div>
                  </button>
                  <button 
                    onClick={() => setIsProcessingModalOpen(true)}
                    className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-6 py-4 rounded-xl font-medium transition-all duration-300 transform hover:scale-105 shadow-lg"
                  >
                    <div className="flex items-center justify-center space-x-2">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826-3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>สร้างงานประมวลผล</span>
                    </div>
                  </button>
                  <button 
                    onClick={() => setIsTokenManagementModalOpen(true)}
                    className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white px-6 py-4 rounded-xl font-medium transition-all duration-300 transform hover:scale-105 shadow-lg"
                  >
                    <div className="flex items-center justify-center space-x-2">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                      <span>จัดการ API Keys</span>
                    </div>
                  </button>
                  <button className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-6 py-4 rounded-xl font-medium transition-all duration-300 transform hover:scale-105 shadow-lg">
                    <div className="flex items-center justify-center space-x-2">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      <span>ดูรายงาน</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* TIFF Files List */}
              <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold text-gray-900">📁 ไฟล์ GeoTIFF ในระบบ</h3>
                  <button 
                    onClick={() => setIsUploadModalOpen(true)}
                    className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-all duration-300 transform hover:scale-105 shadow-lg text-sm"
                  >
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <span>อัพโหลดใหม่</span>
                    </div>
                  </button>
                </div>
                
                {/* Real TIFF Files from Backend */}
                <div className="space-y-4">
                  {isLoadingFiles ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                      <p className="text-gray-500">กำลังโหลดไฟล์...</p>
                    </div>
                  ) : files.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <h4 className="text-lg font-medium text-gray-900 mb-2">ยังไม่มีไฟล์ GeoTIFF</h4>
                      <p className="text-gray-500 mb-4">เริ่มต้นโดยการอัพโหลดไฟล์ GeoTIFF ไฟล์แรกของคุณ</p>
                      <button
                        onClick={() => setIsUploadModalOpen(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                      >
                        อัพโหลดไฟล์แรก
                      </button>
                    </div>
                  ) : (
                    files.map((file) => {
                      const statusInfo = fileService.formatUploadStatus(file.upload_status);
                      return (
                        <div key={file.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
                          <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                            <div>
                              <h4 className="font-medium text-gray-900">{file.original_filename}</h4>
                                                              <p className="text-sm text-gray-500">
                                  ขนาด: {fileService.formatFileSize(file.file_size)} • อัพโหลด: {fileService.formatDateTime(file.created_at)}
                                </p>
                              <div className="flex items-center space-x-2 mt-1">
                                <span className={`px-2 py-1 text-xs rounded-full ${statusInfo.bgColor} ${statusInfo.color}`}>
                                  {statusInfo.text}
                                </span>
                                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                                  {file.filename}
                                </span>
                              </div>
                              
                              {/* Processing Sessions Info */}
                              {file.processing_sessions && file.processing_sessions.length > 0 && (
                                <div className="mt-2">
                                  <div className="inline-flex flex-col px-3 py-2 bg-gray-50 text-gray-700 rounded-lg border border-gray-200 text-xs">
                                    <div className="text-gray-600 mb-2 font-medium">
                                      ไฟล์นี้ผ่านการประมวลผลแล้ว {file.processing_sessions.length} ครั้ง
                                    </div>
                                    <div className="space-y-1">
                                      {file.processing_sessions.map((session, index) => (
                                        <div key={session.session_id} className="inline-flex items-center">
                                          <span className="font-bold text-gray-800 mr-2 bg-gray-100 px-2 py-0.5 rounded-md">
                                            {session.session_id.slice(0, 8)}
                                          </span>
                                          <span className="text-gray-500 mr-2">:</span>
                                          <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${
                                            session.processing_status === 'completed' ? 'bg-green-100 text-green-700' :
                                            session.processing_status === 'processing' ? 'bg-blue-100 text-blue-700' :
                                            session.processing_status === 'failed' ? 'bg-red-100 text-red-700' :
                                            'bg-gray-100 text-gray-700'
                                          }`}>
                                            {session.processing_status === 'completed' ? 'เสร็จสิ้น' :
                                             session.processing_status === 'processing' ? 'กำลังประมวลผล' :
                                             session.processing_status === 'failed' ? 'ล้มเหลว' :
                                             session.processing_status === 'started' ? 'เริ่มต้น' :
                                             session.processing_status}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            {/* View Metadata Button */}
                            {fileService.isProcessingCompleted(file.upload_status) && (
                              <button 
                                onClick={() => handleViewMetadata(file.id)}
                                className="p-2 text-gray-400 hover:text-blue-600 transition-colors" 
                                title="ดูข้อมูลที่แกะออกมา"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              </button>
                            )}

                            {/* Process Button */}
                            {fileService.isReadyForProcessing(file.upload_status) && (
                              <button 
                                onClick={() => handleProcessFile(file.id)}
                                disabled={processingFiles.has(file.id)}
                                className={`p-2 transition-colors ${
                                  processingFiles.has(file.id)
                                    ? 'text-gray-300 cursor-not-allowed'
                                    : 'text-gray-400 hover:text-green-600'
                                }`}
                                title={processingFiles.has(file.id) ? 'กำลังประมวลผล...' : 'เริ่มประมวลผล'}
                              >
                                {processingFiles.has(file.id) ? (
                                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-green-600"></div>
                                ) : (
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826-3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                  </svg>
                                )}
                              </button>
                            )}

                            {/* Processing Status */}
                            {fileService.isProcessingInProgress(file.upload_status) && (
                              <div className="flex items-center space-x-2 px-3 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                                <span>กำลังประมวลผล...</span>
                              </div>
                            )}

                            {/* Completed Status */}
                            {fileService.isProcessingCompleted(file.upload_status) && (
                              <div className="flex items-center space-x-2 px-3 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                <span>ประมวลผลเสร็จแล้ว</span>
                              </div>
                            )}
                            <button 
                              onClick={() => handleDeleteFile(file.id)}
                              className="p-2 text-gray-400 hover:text-red-600 transition-colors" 
                              title="ลบ"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* File Upload Modal */}
      <FileUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUploadSuccess={handleUploadSuccess}
      />

      {/* Processing Modal */}
      <ProcessingModal
        isOpen={isProcessingModalOpen}
        onClose={() => setIsProcessingModalOpen(false)}
        files={files}
        onProcessingComplete={loadUserFiles}
      />

      {/* Token Management Modal */}
      <TokenManagementModal
        isOpen={isTokenManagementModalOpen}
        onClose={() => setIsTokenManagementModalOpen(false)}
      />
    </ProtectedRoute>
  );
}
