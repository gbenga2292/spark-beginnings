import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Asset, Waybill, AssetCategory, AssetType, AssetStatus, WaybillStatus, WaybillType } from '../types';

interface OperationsContextType {
  assets: Asset[];
  waybills: Waybill[];
  
  // Asset methods
  addAsset: (asset: Omit<Asset, 'id' | 'availableQuantity'>) => void;
  updateAsset: (id: string, updates: Partial<Asset>) => void;
  deleteAsset: (id: string) => void;
  
  // Waybill methods
  createWaybill: (waybill: Omit<Waybill, 'id' | 'status'>) => void;
  updateWaybillStatus: (id: string, status: WaybillStatus) => void;
  deleteWaybill: (id: string) => void;
  
  // Analytics
  getAssetAnalytics: () => any;
  getSiteAnalytics: (siteId: string) => any;
}

const OperationsContext = createContext<OperationsContextType | undefined>(undefined);

const initialAssets: Asset[] = [
  { id: '1', name: '6" Dewatering Pump', category: 'dewatering', type: 'equipment', quantity: 15, availableQuantity: 12, unitOfMeasurement: 'units', status: 'active', condition: 'good' },
  { id: '2', name: 'Submersible Pump 2"', category: 'dewatering', type: 'equipment', quantity: 30, availableQuantity: 28, unitOfMeasurement: 'units', status: 'active', condition: 'fair' },
  { id: '3', name: 'Reflective Vests', category: 'ppe', type: 'consumable', quantity: 500, availableQuantity: 450, unitOfMeasurement: 'pcs', status: 'active', condition: 'good' },
];

const initialWaybills: Waybill[] = [
  { 
    id: 'WB-001', 
    type: 'waybill', 
    status: 'sent_to_site', 
    siteId: 'site-a', 
    siteName: 'Port Harcourt Refinery', 
    driverName: 'John Doe', 
    vehicle: 'Toyota Hiace (Lagos-123)', 
    issueDate: new Date().toISOString(), 
    items: [{ assetId: '1', assetName: '6" Dewatering Pump', quantity: 2 }] 
  },
  { 
    id: 'RT-001', 
    type: 'return', 
    status: 'outstanding', 
    siteId: 'site-b', 
    siteName: 'Dangote Refinery', 
    driverName: 'Umar Sani', 
    vehicle: 'Man Diesel (Kano-456)', 
    issueDate: new Date().toISOString(), 
    items: [{ assetId: '2', assetName: 'Submersible Pump 2"', quantity: 5 }] 
  },
];

export const OperationsProvider = ({ children }: { children: ReactNode }) => {
  const [assets, setAssets] = useState<Asset[]>(initialAssets);
  const [waybills, setWaybills] = useState<Waybill[]>(initialWaybills);

  const addAsset = (asset: Omit<Asset, 'id' | 'availableQuantity'>) => {
    const newAsset: Asset = {
      ...asset,
      id: Math.random().toString(36).substr(2, 9),
      availableQuantity: asset.quantity,
    };
    setAssets(prev => [...prev, newAsset]);
  };

  const updateAsset = (id: string, updates: Partial<Asset>) => {
    setAssets(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
  };

  const deleteAsset = (id: string) => {
    setAssets(prev => prev.filter(a => a.id !== id));
  };

  const createWaybill = (waybill: Omit<Waybill, 'id' | 'status'>) => {
    const newWaybill: Waybill = {
      ...waybill,
      id: `WB-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
      status: 'outstanding',
    };
    setWaybills(prev => [...prev, newWaybill]);
  };

  const updateWaybillStatus = (id: string, status: WaybillStatus) => {
    setWaybills(prev => prev.map(w => w.id === id ? { ...w, status } : w));
  };

  const deleteWaybill = (id: string) => {
    setWaybills(prev => prev.filter(w => w.id !== id));
  };

  const getAssetAnalytics = () => {
    // Basic stats for dashboard
    return {
      totalAssets: assets.length,
      activeWaybills: waybills.filter(w => w.status === 'outstanding' || w.status === 'sent_to_site').length,
      categoriesCount: assets.reduce((acc, a) => ({ ...acc, [a.category]: (acc[a.category] || 0) + 1 }), {} as Record<string, number>),
    };
  };

  const getSiteAnalytics = (siteId: string) => {
    const siteWaybills = waybills.filter(w => w.siteId === siteId);
    return {
      waybillsCount: siteWaybills.length,
      currentAssets: siteWaybills.flatMap(w => w.items).reduce((acc, item) => {
        const existing = acc.find(a => a.assetId === item.assetId);
        if (existing) existing.quantity += item.quantity;
        else acc.push({ ...item });
        return acc;
      }, [] as { assetId: string, assetName: string, quantity: number }[]),
    };
  };

  return (
    <OperationsContext.Provider value={{
      assets,
      waybills,
      addAsset,
      updateAsset,
      deleteAsset,
      createWaybill,
      updateWaybillStatus,
      deleteWaybill,
      getAssetAnalytics,
      getSiteAnalytics,
    }}>
      {children}
    </OperationsContext.Provider>
  );
};

export const useOperations = () => {
  const context = useContext(OperationsContext);
  if (!context) throw new Error('useOperations must be used within an OperationsProvider');
  return context;
};
