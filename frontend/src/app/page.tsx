'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        // มี auth → ไป dashboard
        console.log('🏠 Authenticated user, redirecting to dashboard');
        router.push('/dashboard');
      } else {
        // ไม่มี auth → ไป login
        console.log('🏠 Unauthenticated user, redirecting to login');
        router.push('/login');
      }
    }
  }, [isAuthenticated, isLoading, router]);

  // Show loading during redirect
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
        <p className="text-gray-600">กำลังเปลี่ยนเส้นทาง...</p>
      </div>
    </div>
  );
}
