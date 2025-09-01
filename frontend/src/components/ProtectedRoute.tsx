'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean; // true = require login, false = require logout
  redirectTo?: string;
}

export default function ProtectedRoute({ 
  children, 
  requireAuth = true, 
  redirectTo 
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (requireAuth && !isAuthenticated) {
        // Need auth but not authenticated → redirect to login
        const redirect = redirectTo || '/login';
        console.log('🔒 Authentication required, redirecting to:', redirect);
        router.push(redirect);
      } else if (!requireAuth && isAuthenticated) {
        // Need to be logged out but authenticated → redirect to dashboard
        const redirect = redirectTo || '/dashboard';
        console.log('🔓 Already authenticated, redirecting to:', redirect);
        router.push(redirect);
      }
    }
  }, [isAuthenticated, isLoading, requireAuth, redirectTo, router]);

  // Show loading during auth check
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">กำลังตรวจสอบสิทธิ์...</p>
        </div>
      </div>
    );
  }

  // Check if we should render children
  if (requireAuth && !isAuthenticated) {
    // Need auth but not authenticated → don't render
    return null;
  }

  if (!requireAuth && isAuthenticated) {
    // Need to be logged out but authenticated → don't render
    return null;
  }

  // All checks passed, render children
  return <>{children}</>;
}
