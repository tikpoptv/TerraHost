'use client';

import { useState, useEffect } from 'react';
import tokenService, { ApiKey, CreateApiKeyRequest } from '@/services/tokenService';
import envConfig from '@/config/env';

interface TokenManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TokenManagementModal({ isOpen, onClose }: TokenManagementModalProps) {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newApiKey, setNewApiKey] = useState<CreateApiKeyRequest>({
    name: '',
    permissions: [],
    expiresAt: ''
  });
  const [isCreating, setIsCreating] = useState(false);
  const [createdApiKey, setCreatedApiKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadApiKeys();
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const loadApiKeys = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await tokenService.getUserApiKeys();
      if (response.success && response.data) {
        setApiKeys(response.data);
      } else {
        setError(response.error || 'Failed to load API keys');
      }
    } catch (error) {
      setError('Failed to load API keys');
      console.error('Error loading API keys:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateApiKey = async () => {
    const nameValidation = tokenService.validateApiKeyName(newApiKey.name);
    if (!nameValidation.isValid) {
      setError(nameValidation.error || 'Invalid name');
      return;
    }

    const permissionsValidation = tokenService.validatePermissions(newApiKey.permissions);
    if (!permissionsValidation.isValid) {
      setError(permissionsValidation.error || 'Invalid permissions');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const response = await tokenService.createApiKey(newApiKey);
      if (response.success && response.data) {
        setCreatedApiKey(response.data.apiKey);
        setNewApiKey({ name: '', permissions: [], expiresAt: '' });
        setShowCreateForm(false);
        loadApiKeys();
      } else {
        setError(response.error || 'Failed to create API key');
      }
    } catch (error) {
      setError('Failed to create API key');
      console.error('Error creating API key:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteApiKey = async (apiKeyId: string) => {
    if (!confirm('Are you sure you want to delete this API key?')) {
      return;
    }

    try {
      const response = await tokenService.deleteApiKey(apiKeyId);
      if (response.success) {
        loadApiKeys();
      } else {
        setError(response.error || 'Failed to delete API key');
      }
    } catch (error) {
      setError('Failed to delete API key');
      console.error('Error deleting API key:', error);
    }
  };

  const handleToggleStatus = async (apiKeyId: string, currentStatus: boolean) => {
    try {
      const response = await tokenService.updateApiKeyStatus(apiKeyId, !currentStatus);
      if (response.success) {
        loadApiKeys();
      } else {
        setError(response.error || 'Failed to update API key status');
      }
    } catch (error) {
      setError('Failed to update API key status');
      console.error('Error updating API key status:', error);
    }
  };

  const handlePermissionToggle = (permission: string) => {
    setNewApiKey(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter(p => p !== permission)
        : [...prev.permissions, permission]
    }));
  };

  const resetForm = () => {
    setNewApiKey({ name: '', permissions: [], expiresAt: '' });
    setShowCreateForm(false);
    setCreatedApiKey(null);
    setError(null);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 backdrop-blur-sm bg-black/20 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">🔑 Manage API Keys</h2>
            <p className="text-gray-600 mt-1">Create and manage API keys for external access</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          <div className="mb-6">
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span>Create New API Key</span>
              </div>
            </button>
          </div>

          {showCreateForm && (
            <div className="bg-gray-50 rounded-lg p-6 mb-6 border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Create New API Key</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    API Key Name *
                  </label>
                  <input
                    type="text"
                    value={newApiKey.name}
                    onChange={(e) => setNewApiKey(prev => ({ ...prev, name: e.target.value }))}
                    placeholder={tokenService.generateSuggestedName()}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Expiration Date (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={newApiKey.expiresAt}
                    onChange={(e) => setNewApiKey(prev => ({ ...prev, expiresAt: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Permissions *
                  </label>
                  <div className="space-y-3">
                    {tokenService.getPermissionGroups().map((group) => {
                      const isDisabled = group.name === 'File Management' || group.name === 'System Management';
                      return (
                        <div key={group.name} className={`border rounded-lg p-4 ${isDisabled ? 'border-gray-300 bg-gray-50' : 'border-gray-200'}`}>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-gray-900">{group.name}</h4>
                            {isDisabled && (
                              <span className="text-xs text-orange-600 bg-orange-100 px-2 py-1 rounded-full">
                                Coming Soon
                              </span>
                            )}
                          </div>
                          {isDisabled && (
                            <p className="text-xs text-gray-500 mb-3">
                              This feature is not yet available for use
                            </p>
                          )}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {group.permissions.map((permission) => {
                              const permissionInfo = tokenService.getAvailablePermissions().find(p => p.value === permission);
                              return (
                                <label key={permission} className={`flex items-start space-x-3 ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                  <input
                                    type="checkbox"
                                    checked={newApiKey.permissions.includes(permission)}
                                    onChange={() => !isDisabled && handlePermissionToggle(permission)}
                                    disabled={isDisabled}
                                    className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:cursor-not-allowed"
                                  />
                                  <div className="flex-1">
                                    <div className="text-sm font-medium text-gray-900">
                                      {permissionInfo?.label || permission}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {permissionInfo?.description}
                                    </div>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center space-x-3 pt-4">
                  <button
                    onClick={handleCreateApiKey}
                    disabled={isCreating}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    {isCreating ? 'Creating...' : 'Create API Key'}
                  </button>
                  <button
                    onClick={resetForm}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {createdApiKey && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <div className="flex items-start space-x-3">
                <svg className="w-6 h-6 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div className="flex-1">
                  <h4 className="font-medium text-green-900 mb-2">API Key Created Successfully!</h4>
                  <p className="text-sm text-green-700 mb-3">
                    Please save this API Key as it will not be shown again
                  </p>
                  
                  <div className="bg-white border border-green-300 rounded-lg p-3 mb-4">
                    <div className="text-xs text-gray-600 mb-1">API Key:</div>
                    <code className="text-sm text-green-800 break-all">{createdApiKey}</code>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                    <div className="text-xs text-blue-600 mb-2 font-medium">📡 How to use this API Key:</div>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-blue-700 font-medium">Example Endpoint:</span>
                        <code className="ml-2 text-blue-800 bg-blue-100 px-2 py-1 rounded text-xs">
                          GET {envConfig.getApiUrl()}/api/spatial/overview
                        </code>
                      </div>
                      <div>
                        <span className="text-blue-700 font-medium">Header:</span>
                        <code className="ml-2 text-blue-800 bg-blue-100 px-2 py-1 rounded text-xs">
                          X-API-Key: {createdApiKey}
                        </code>
                      </div>
                      <div className="text-xs text-blue-600 mt-2">
                        💡 This endpoint requires <code className="bg-blue-100 px-1 rounded">read:files</code> permission
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setCreatedApiKey(null)}
                    className="mt-3 text-sm text-green-600 hover:text-green-800"
                  >
                    Close this message
                  </button>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-start space-x-3">
                <svg className="w-6 h-6 text-red-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm text-red-700">{error}</p>
                  <button
                    onClick={() => setError(null)}
                    className="mt-2 text-sm text-red-600 hover:text-red-800"
                  >
                    Close this message
                  </button>
                </div>
              </div>
            </div>
          )}

          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Your API Keys</h3>
            
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-500">Loading API keys...</p>
              </div>
            ) : apiKeys.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </div>
                <h4 className="text-lg font-medium text-gray-900 mb-2">No API Keys Yet</h4>
                <p className="text-gray-500">Get started by creating your first API Key</p>
              </div>
            ) : (
              <div className="space-y-4">
                {apiKeys.map((apiKey) => (
                  <div key={apiKey.id} className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h4 className="font-medium text-gray-900">{apiKey.name}</h4>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            apiKey.isActive 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {apiKey.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        
                        <div className="mb-3">
                          <div className="text-sm text-gray-600 mb-1">Permissions:</div>
                          <div className="flex flex-wrap gap-2">
                            {apiKey.permissions.map((permission) => (
                              <span
                                key={permission}
                                className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                              >
                                {tokenService.getPermissionLabel(permission)}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-500">
                          <div>
                            <span className="font-medium">Created:</span>
                            <div>{formatDate(apiKey.createdAt)}</div>
                          </div>
                          {apiKey.expiresAt && (
                            <div>
                              <span className="font-medium">Expires:</span>
                              <div>{formatDate(apiKey.expiresAt)}</div>
                            </div>
                          )}
                          {apiKey.lastUsed && (
                            <div>
                              <span className="font-medium">Last Used:</span>
                              <div>{formatDate(apiKey.lastUsed)}</div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 ml-4">
                        <button
                          onClick={() => handleToggleStatus(apiKey.id, apiKey.isActive)}
                          className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                            apiKey.isActive
                              ? 'bg-red-100 text-red-700 hover:bg-red-200'
                              : 'bg-green-100 text-green-700 hover:bg-green-200'
                          }`}
                        >
                          {apiKey.isActive ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          onClick={() => handleDeleteApiKey(apiKey.id)}
                          className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
