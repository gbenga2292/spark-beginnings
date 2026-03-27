import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  Asset, Waybill, AssetCategory, AssetType, AssetStatus, WaybillStatus, WaybillType, 
  Checkout, MaintenanceAsset, MaintenanceSession, MaintenanceLogType, ServiceStatus 
} from '../types';

interface OperationsContextType {
  assets: Asset[];
  waybills: Waybill[];
  checkouts: Checkout[];
  maintenanceAssets: MaintenanceAsset[];
  maintenanceSessions: MaintenanceSession[];
  
  // Asset methods
  addAsset: (asset: Omit<Asset, 'id' | 'availableQuantity'>) => void;
  bulkAddAssets: (assets: Omit<Asset, 'id' | 'availableQuantity'>[]) => void;
  updateAsset: (id: string, updates: Partial<Asset>) => void;
  deleteAsset: (id: string) => void;
  restockAssets: (items: { assetId: string, quantity: number, totalCost: number }[]) => void;
  
  // Waybill methods
  createWaybill: (waybill: Omit<Waybill, 'id' | 'status'>) => void;
  updateWaybillStatus: (id: string, status: WaybillStatus) => void;
  deleteWaybill: (id: string) => void;

  // Checkout methods
  addCheckout: (checkout: Omit<Checkout, 'id' | 'status' | 'checkoutDate' | 'returnedQuantity'>) => void;
  updateCheckoutStatus: (id: string, updates: Partial<Checkout>) => void;
  deleteCheckout: (id: string) => void;

  // Maintenance methods
  logMaintenance: (session: Omit<MaintenanceSession, 'id'>) => void;
  updateMaintenanceAsset: (id: string, updates: Partial<MaintenanceAsset>) => void;
  
  // Analytics
  getAssetAnalytics: () => any;
  getSiteAnalytics: (siteId: string) => any;
  getMaintenanceStats: () => any;
}

const OperationsContext = createContext<OperationsContextType | undefined>(undefined);

const initialAssets: Asset[] = [
  { id: '1', name: '6" Dewatering Pump', category: 'dewatering', type: 'equipment', quantity: 15, availableQuantity: 12, reservedQuantity: 2, missingQuantity: 0, damagedQuantity: 1, usedQuantity: 0, unitOfMeasurement: 'units', status: 'active', condition: 'good', location: 'Store A' },
  { id: '2', name: 'Submersible Pump 2"', category: 'dewatering', type: 'equipment', quantity: 30, availableQuantity: 28, reservedQuantity: 1, missingQuantity: 0, damagedQuantity: 0, usedQuantity: 1, unitOfMeasurement: 'units', status: 'active', condition: 'fair', location: 'Site B' },
  { id: '3', name: 'Reflective Vests', category: 'ppe', type: 'consumable', quantity: 500, availableQuantity: 450, reservedQuantity: 20, missingQuantity: 5, damagedQuantity: 2, usedQuantity: 23, unitOfMeasurement: 'pcs', status: 'active', condition: 'good', location: 'Main Store' },
  { id: '4', name: '2-Inch clips', category: 'dewatering', type: 'tools', quantity: 1015, availableQuantity: 517, reservedQuantity: 498, missingQuantity: 0, damagedQuantity: 0, usedQuantity: 0, unitOfMeasurement: 'pcs', status: 'active', condition: 'good', location: 'store' },
];

const initialWaybills: Waybill[] = [
  { 
    id: 'WB009', 
    type: 'waybill', 
    status: 'outstanding', 
    siteId: 'site-ark', 
    siteName: 'Ark Villa (ITB)', 
    driverName: 'Collins Akpagu', 
    vehicle: 'L200', 
    issueDate: '2026-03-25T10:00:00Z', 
    items: [
      { assetId: 'e1', assetName: 'Elbow', quantity: 1 },
      { assetId: 'e2', assetName: 'Malleable Iron', quantity: 1 }
    ] 
  },
  { 
    id: 'RB007', 
    type: 'return', 
    status: 'outstanding', 
    siteId: 'site-ark', 
    siteName: 'Ark Villa', 
    driverName: 'Collins Akpagu', 
    vehicle: 'SIENNA', 
    issueDate: '2026-03-17T14:30:00Z', 
    items: [{ assetId: 'j1', assetName: 'Jetting Stem', quantity: 1 }] 
  },
];

const initialCheckouts: Checkout[] = [
  { 
    id: 'CH001', 
    assetId: '4', 
    assetName: 'Spanner size 10', 
    quantity: 1, 
    returnedQuantity: 0, 
    employeeId: 'emp1', 
    employeeName: 'Thomas Lifu', 
    checkoutDate: '2026-03-02T09:00:00Z', 
    returnInDays: 7, 
    status: 'outstanding' 
  },
  { 
    id: 'CH002', 
    assetId: '2', 
    assetName: 'Water Seal for 2" and 3" pumps', 
    quantity: 2, 
    returnedQuantity: 1, 
    employeeId: 'emp2', 
    employeeName: 'Shodunke Abayomi', 
    checkoutDate: '2026-02-19T11:00:00Z', 
    returnInDays: 14, 
    status: 'outstanding' 
  },
];

const initialMaintenanceAssets: MaintenanceAsset[] = [
  { id: 'MA001', name: 'New 3" Jetting Pump Pm&t', category: 'machine', site: 'Fleet', lastServiceDate: '2026-02-18', nextServiceDate: '2026-04-20', serviceIntervalMonths: 2, status: 'ok', pattern: 'Standard', totalMaintenanceRecords: 0, isActive: true },
  { id: 'MA002', name: 'Surface Water pump 10HP', category: 'machine', site: 'Fleet', lastServiceDate: '2026-02-18', nextServiceDate: '2026-04-18', serviceIntervalMonths: 2, status: 'ok', pattern: 'Standard', totalMaintenanceRecords: 0, isActive: true },
  { id: 'MA003', name: 'Submersible pump', category: 'machine', site: 'Fleet', lastServiceDate: '2026-02-18', nextServiceDate: '2026-04-18', serviceIntervalMonths: 2, status: 'ok', pattern: 'Standard', totalMaintenanceRecords: 0, isActive: true },
  { id: 'MA004', name: 'Jetting Pump', category: 'machine', site: 'Fleet', lastServiceDate: '2026-02-18', nextServiceDate: '2026-04-18', serviceIntervalMonths: 2, status: 'ok', pattern: 'Standard', totalMaintenanceRecords: 0, isActive: true },
  { id: 'MA005', name: 'Dewatering Pump 745', category: 'machine', site: 'Fleet', lastServiceDate: '2026-02-18', nextServiceDate: '2026-04-18', serviceIntervalMonths: 2, status: 'ok', pattern: 'Standard', totalMaintenanceRecords: 0, isActive: true },
  { id: 'MA006', name: 'Dewatering Pump 736', category: 'machine', site: 'Fleet', lastServiceDate: '2026-02-18', nextServiceDate: '2026-04-18', serviceIntervalMonths: 2, status: 'ok', pattern: 'Standard', totalMaintenanceRecords: 0, isActive: true },
  { id: 'MA007', name: 'Dewatering Pump 735', category: 'machine', site: 'Fleet', lastServiceDate: '2026-02-18', nextServiceDate: '2026-04-18', serviceIntervalMonths: 2, status: 'ok', pattern: 'Standard', totalMaintenanceRecords: 0, isActive: true },
  
  { id: 'VA001', name: 'BENZ', serialNumber: 'FKJ35HT', category: 'vehicle', site: 'Fleet', lastServiceDate: '2026-02-18', nextServiceDate: '2026-04-18', serviceIntervalMonths: 2, status: 'ok', pattern: '24/7', totalMaintenanceRecords: 0, isActive: true },
  { id: 'VA002', name: 'TUNDRA', serialNumber: 'FST831HS', category: 'vehicle', site: 'Fleet', lastServiceDate: '2026-02-18', nextServiceDate: '2026-04-18', serviceIntervalMonths: 2, status: 'ok', pattern: '24/7', totalMaintenanceRecords: 0, isActive: true },
  { id: 'VA003', name: 'HIAB', serialNumber: 'SMK637YF', category: 'vehicle', site: 'Fleet', lastServiceDate: '2026-02-18', nextServiceDate: '2026-04-18', serviceIntervalMonths: 2, status: 'ok', pattern: '24/7', totalMaintenanceRecords: 0, isActive: true },
  { id: 'VA004', name: 'SIENNA', serialNumber: 'SK382KS', category: 'vehicle', site: 'Fleet', lastServiceDate: '2026-02-18', nextServiceDate: '2026-04-18', serviceIntervalMonths: 2, status: 'ok', pattern: '24/7', totalMaintenanceRecords: 0, isActive: true },
  { id: 'VA005', name: 'L200', serialNumber: 'L200-29', category: 'vehicle', site: 'Fleet', lastServiceDate: '2026-02-18', nextServiceDate: '2026-04-18', serviceIntervalMonths: 2, status: 'ok', pattern: '24/7', totalMaintenanceRecords: 0, isActive: true },
];

export const OperationsProvider = ({ children }: { children: ReactNode }) => {
  const [assets, setAssets] = useState<Asset[]>(initialAssets);
  const [waybills, setWaybills] = useState<Waybill[]>(initialWaybills);
  const [checkouts, setCheckouts] = useState<Checkout[]>(initialCheckouts);
  const [maintenanceAssets, setMaintenanceAssets] = useState<MaintenanceAsset[]>(initialMaintenanceAssets);
  const [maintenanceSessions, setMaintenanceSessions] = useState<MaintenanceSession[]>([]);

  const addAsset = (asset: Omit<Asset, 'id' | 'availableQuantity'>) => {
    const newAsset: Asset = {
      ...asset,
      id: Math.random().toString(36).substr(2, 9),
      availableQuantity: asset.quantity,
    };
    setAssets(prev => [...prev, newAsset]);
  };

  const bulkAddAssets = (newAssetsData: Omit<Asset, 'id' | 'availableQuantity'>[]) => {
    const newAssets: Asset[] = newAssetsData.map(asset => ({
      ...asset,
      id: Math.random().toString(36).substr(2, 9),
      availableQuantity: asset.quantity,
    }));
    setAssets(prev => [...prev, ...newAssets]);
  };

  const updateAsset = (id: string, updates: Partial<Asset>) => {
    setAssets(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
  };

  const deleteAsset = (id: string) => {
    setAssets(prev => prev.filter(a => a.id !== id));
  };

  const restockAssets = (items: { assetId: string, quantity: number, totalCost: number }[]) => {
    setAssets(prev => prev.map(asset => {
      const restockItem = items.find(i => i.assetId === asset.id);
      if (!restockItem) return asset;

      const unitCost = restockItem.totalCost / restockItem.quantity;
      const newRecord = {
        id: Math.random().toString(36).substr(2, 9),
        assetId: asset.id,
        quantity: restockItem.quantity,
        totalCost: restockItem.totalCost,
        unitCost,
        date: new Date().toISOString(),
      };

      return {
        ...asset,
        quantity: asset.quantity + restockItem.quantity,
        availableQuantity: asset.availableQuantity + restockItem.quantity,
        restockHistory: [...(asset.restockHistory || []), newRecord]
      };
    }));
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

  const addCheckout = (checkout: Omit<Checkout, 'id' | 'status' | 'checkoutDate' | 'returnedQuantity'>) => {
    const newCheckout: Checkout = {
      ...checkout,
      id: `CH-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
      status: 'outstanding',
      checkoutDate: new Date().toISOString(),
      returnedQuantity: 0,
    };
    setCheckouts(prev => [newCheckout, ...prev]);
    
    // Update asset quantities
    const asset = assets.find(a => a.id === checkout.assetId);
    if (asset) {
       updateAsset(asset.id, { 
         availableQuantity: asset.availableQuantity - checkout.quantity,
       });
    }
  };

  const updateCheckoutStatus = (id: string, updates: Partial<Checkout>) => {
    setCheckouts(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const deleteCheckout = (id: string) => {
    setCheckouts(prev => prev.filter(c => c.id !== id));
  };

  const logMaintenance = (session: Omit<MaintenanceSession, 'id'>) => {
    const newSession: MaintenanceSession = {
      ...session,
      id: `MS-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
    };
    setMaintenanceSessions(prev => [newSession, ...prev]);
    
    // Update asset total records
    setMaintenanceAssets(prev => prev.map(a => {
      const isIncluded = session.assets.some(as => as.assetId === a.id);
      if (isIncluded) {
        return {
          ...a,
          totalMaintenanceRecords: a.totalMaintenanceRecords + 1,
          lastServiceDate: session.date,
          // Calculate next service date based on interval
          nextServiceDate: new Date(new Date(session.date).setMonth(new Date(session.date).getMonth() + a.serviceIntervalMonths)).toISOString().split('T')[0],
        };
      }
      return a;
    }));
  };

  const updateMaintenanceAsset = (id: string, updates: Partial<MaintenanceAsset>) => {
    setMaintenanceAssets(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
  };

  const getAssetAnalytics = () => {
    // Basic stats for dashboard
    return {
      totalAssets: assets.length,
      activeWaybills: waybills.filter(w => w.status === 'outstanding' || w.status === 'sent_to_site').length,
      activeCheckouts: checkouts.filter(c => c.status === 'outstanding' || c.status === 'partial_returned').length,
      categoriesCount: assets.reduce((acc, a) => ({ ...acc, [a.category]: (acc[a.category] || 0) + 1 }), {} as Record<string, number>),
    };
  };

  const getMaintenanceStats = () => {
    const totalMachines = maintenanceAssets.filter(a => a.category === 'machine').length;
    const totalVehicles = maintenanceAssets.filter(a => a.category === 'vehicle').length;
    const dueSoon = maintenanceAssets.filter(a => a.status === 'due_soon').length;
    const overdue = maintenanceAssets.filter(a => a.status === 'overdue').length;
    
    return {
      totalMachines,
      totalVehicles,
      dueSoon,
      overdue,
      totalActive: maintenanceAssets.filter(a => a.isActive).length,
      statusDistribution: {
        ok: maintenanceAssets.filter(a => a.status === 'ok').length,
        dueSoon,
        overdue
      }
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
      checkouts,
      maintenanceAssets,
      maintenanceSessions,
      addAsset,
      bulkAddAssets,
      updateAsset,
      deleteAsset,
      restockAssets,
      createWaybill,
      updateWaybillStatus,
      deleteWaybill,
      addCheckout,
      updateCheckoutStatus,
      deleteCheckout,
      logMaintenance,
      updateMaintenanceAsset,
      getAssetAnalytics,
      getSiteAnalytics,
      getMaintenanceStats,
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
