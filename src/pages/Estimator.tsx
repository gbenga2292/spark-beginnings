import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LogisticsEstimatorDialog } from './LogisticsEstimatorDialog';
import { useHideLayout } from '@/src/contexts/PageContext';

export default function Estimator() {
  const navigate = useNavigate();

  // Hide the sidebar and header to give it full screen coverage like before
  useHideLayout(true);

  return (
    <div className="fixed inset-0 z-[100] bg-slate-50">
      <div className="w-full h-full p-2">
        <LogisticsEstimatorDialog 
          open={true} 
          onClose={() => navigate(-1)} 
        />
      </div>
    </div>
  );
}
