'use client';

import { useState, useEffect } from 'react';
import { useHealthCheck } from '@/hooks/useHealthCheck';
import HealthCheckModal from './HealthCheckModal';

interface HealthCheckProviderProps {
  children: React.ReactNode;
  checkOnMount?: boolean;
  periodicCheck?: boolean;
  checkInterval?: number;
}

export default function HealthCheckProvider({ 
  children, 
  checkOnMount = true,
  periodicCheck = false,
  checkInterval = 30000 
}: HealthCheckProviderProps) {
  const [showModal, setShowModal] = useState(false);
  const { isHealthy, isLoading, error } = useHealthCheck(
    checkOnMount, 
    periodicCheck ? checkInterval : 0
  );

  // Show modal when health check fails
  useEffect(() => {
    if (!isLoading && !isHealthy && error) {
      setShowModal(true);
    }
  }, [isHealthy, isLoading, error]);

  const handleCloseModal = () => {
    setShowModal(false);
  };

  return (
    <>
      {children}
      <HealthCheckModal 
        isOpen={showModal} 
        onClose={handleCloseModal} 
      />
    </>
  );
}
