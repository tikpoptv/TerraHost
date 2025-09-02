'use client';

import React from 'react';

interface ConfigErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ConfigErrorBoundaryProps {
  children: React.ReactNode;
}

export default class ConfigErrorBoundary extends React.Component<
  ConfigErrorBoundaryProps,
  ConfigErrorBoundaryState
> {
  constructor(props: ConfigErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ConfigErrorBoundaryState {
    if (error.message.includes('Environment configuration errors') || 
        error.message.includes('NEXT_PUBLIC_API_URL')) {
      return { hasError: true, error };
    }
    return { hasError: false, error: null };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (error.message.includes('Environment configuration errors') || 
        error.message.includes('NEXT_PUBLIC_API_URL')) {
      console.error('Environment configuration error:', error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center space-x-3 mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.860-.833-2.63 0L3.184 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <h1 className="text-xl font-bold text-red-800">Configuration Error</h1>
            </div>
            
            <div className="space-y-4">
              <p className="text-red-700">
                The application cannot start due to missing environment variables:
              </p>
              
              <div className="bg-red-100 border border-red-300 rounded p-3">
                <code className="text-sm text-red-800 break-words">
                  {this.state.error.message}
                </code>
              </div>
              
              <div className="space-y-2">
                <h3 className="font-semibold text-gray-800">Required Environment Variables:</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• <code className="bg-gray-100 px-1 rounded">NEXT_PUBLIC_API_URL</code> - Backend API URL</li>
                  <li>• <code className="bg-gray-100 px-1 rounded">NODE_ENV</code> - Environment mode</li>
                </ul>
              </div>
              
              <div className="border-t pt-4">
                <h3 className="font-semibold text-gray-800 mb-2">For Deployment:</h3>
                <p className="text-sm text-gray-600">
                  Set <code className="bg-gray-100 px-1 rounded">NEXT_PUBLIC_API_URL</code> to your backend API URL
                  (e.g., https://api.terrahost.riffai.org) in your deployment environment.
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
