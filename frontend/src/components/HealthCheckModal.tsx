'use client';

import { useState } from 'react';
import Modal from './Modal';
import { useHealthCheck } from '@/hooks/useHealthCheck';

interface HealthCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function HealthCheckModal({ isOpen, onClose }: HealthCheckModalProps) {
  const { isHealthy, isLoading, error, retry } = useHealthCheck(false); // Don't auto-start
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    setIsRetrying(true);
    const success = await retry();
    setIsRetrying(false);
    
    if (success) {
      onClose(); // Close modal if health check succeeds
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center space-x-2">
          <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.860-.833-2.63 0L3.184 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <span>Backend Connection Error</span>
        </div>
      }
      showCloseButton={true}
    >
      <div className="space-y-4">
        {/* Error Message */}
        <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3">
          <div className="flex items-center space-x-2">
            <svg className="w-4 h-4 text-red-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            <p className="text-red-200 text-sm font-medium">
              Unable to connect to Backend API
            </p>
          </div>
          {error && (
            <p className="text-red-300 text-xs mt-1">
              <strong>Details:</strong> {error}
            </p>
          )}
        </div>

        {/* Instructions */}
        <div className="text-gray-300 text-sm space-y-2">
          <div className="flex items-center space-x-2">
            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="font-medium">Troubleshooting Steps:</p>
          </div>
          <ul className="list-disc list-inside space-y-1 text-xs text-gray-400">
            <li>Verify Backend Server is running</li>
            <li>Check API URL in .env.local: <code className="bg-gray-700 px-1 rounded">NEXT_PUBLIC_API_URL</code></li>
            <li>Verify CORS configuration</li>
            <li>Check network connectivity</li>
          </ul>
        </div>

        {/* Health Status */}
        <div className="flex items-center space-x-2 text-sm">
          {isHealthy ? (
            <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          <span className="text-gray-300">
            Status: {isHealthy ? 'Connected' : 'Disconnected'}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-3 pt-2">
          <button
            onClick={handleRetry}
            disabled={isLoading || isRetrying}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors"
          >
            {isLoading || isRetrying ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>Checking...</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Retry Connection</span>
              </div>
            )}
          </button>
          
          <button
            onClick={onClose}
            className="flex-1 bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </Modal>
  );
}
