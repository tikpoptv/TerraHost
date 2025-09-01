'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useAuthCheck } from '@/hooks/useAuthCheck';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function DashboardPage() {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { isAuthenticated, user, logout } = useAuth();
  const { isChecking, lastChecked, checkAuth } = useAuthCheck();

  // Check auth status on mount (only once)
  useEffect(() => {
    if (isAuthenticated && !lastChecked) {
      console.log('🔍 Performing initial auth check...');
      checkAuth();
    }
  }, [isAuthenticated, lastChecked, checkAuth]);

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

  return (
    <ProtectedRoute requireAuth={true}>
      {/* Dashboard content */}
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">TerraHost Dashboard</h1>
              {user && (
                <p className="text-sm text-gray-600 mt-1">
                  ยินดีต้อนรับ, {user.name} ({user.role})
                </p>
              )}
            </div>
            <div className="flex items-center space-x-4">
              {user && (
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{user.name}</p>
                  <p className="text-xs text-gray-500">
                    {user.email}
                    {lastChecked && (
                      <span className="block text-green-600">
                        เช็คล่าสุด: {lastChecked.toLocaleTimeString('th-TH')}
                      </span>
                    )}
                  </p>
                </div>
              )}
              <button 
                onClick={checkAuth}
                disabled={isChecking}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
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
                className={`px-4 py-2 rounded-md text-sm font-medium text-white transition-colors ${
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
      </header>

      <main>
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="border-4 border-dashed border-gray-200 rounded-lg h-96 p-6">
              <div className="text-center">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                  ยินดีต้อนรับสู่ TerraHost
                </h2>
                <p className="text-gray-600 mb-8">
                  คุณได้เข้าสู่ระบบเรียบร้อยแล้ว! นี่คือหน้า Dashboard ของคุณ
                </p>
                
                {/* User Info Section */}
                <div className="bg-white p-6 rounded-lg shadow-sm border mb-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-3">ข้อมูลผู้ใช้</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-sm">
                        <span className="text-gray-600">ชื่อ:</span>
                        <span className="ml-2 font-medium">{user?.name}</span>
                      </p>
                      <p className="text-sm">
                        <span className="text-gray-600">อีเมล:</span>
                        <span className="ml-2 font-medium">{user?.email}</span>
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm">
                        <span className="text-gray-600">บทบาท:</span>
                        <span className="ml-2 font-medium">{user?.role}</span>
                      </p>
                      <p className="text-sm">
                        <span className="text-gray-600">เซสชัน ID:</span>
                        <span className="ml-2 font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                          {typeof window !== 'undefined' ? localStorage.getItem('auth_session')?.substring(0, 8) + '...' : 'Loading...'}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                  <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-lg font-medium text-gray-900 mb-2">เซิร์ฟเวอร์</h3>
                    <p className="text-3xl font-bold text-blue-600">0</p>
                    <p className="text-sm text-gray-500">เซิร์ฟเวอร์ที่ใช้งาน</p>
                  </div>
                  
                  <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-lg font-medium text-gray-900 mb-2">โดเมน</h3>
                    <p className="text-3xl font-bold text-green-600">0</p>
                    <p className="text-sm text-gray-500">โดเมนที่จัดการ</p>
                  </div>
                  
                  <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-lg font-medium text-gray-900 mb-2">แบนด์วิดท์</h3>
                    <p className="text-3xl font-bold text-purple-600">0 GB</p>
                    <p className="text-sm text-gray-500">ใช้งานในเดือนนี้</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
    </ProtectedRoute>
  );
}
