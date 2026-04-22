import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  Asset, Waybill, AssetCategory, AssetType, AssetStatus, WaybillStatus, WaybillType, 
  Checkout, MaintenanceAsset, MaintenanceSession, MaintenanceLogType, ServiceStatus,
  Vehicle, VehicleTripLeg, VehicleDocumentType
} from '../types/operations';
import { supabase } from '@/src/integrations/supabase/client';
import { useAppStore } from '../store/appStore';
import { useSetPageTitle } from './PageContext';

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
  updateWaybill: (id: string, updates: Partial<Omit<Waybill, 'id' | 'status'>>) => void;
  updateWaybillStatus: (id: string, status: WaybillStatus, sentToSiteDate?: string, returnConditions?: Record<string, { good: number, damaged: number, missing: number }>) => void;
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

  // Vehicle methods
  vehicles: Vehicle[];
  vehicleTrips: VehicleTripLeg[];
  addVehicle: (vehicle: Omit<Vehicle, 'id' | 'created_at' | 'updated_at'>) => void;
  updateVehicle: (id: string, updates: Partial<Vehicle>) => void;
  deleteVehicle: (id: string) => void;
  addVehicleTripRecords: (logs: any[]) => void;
  updateVehicleTripRecord: (id: string, log: any) => void;
  deleteVehicleTripRecord: (id: string) => void;
  vehicleDocumentTypes: VehicleDocumentType[];
  addVehicleDocumentType: (name: string) => void;
  deleteVehicleDocumentType: (id: string) => void;
  updateVehicleDocument: (vehicleId: string, docTypeName: string, date: string) => void;
}

const OperationsContext = createContext<OperationsContextType | undefined>(undefined);

const initialAssets: Asset[] = [];
const initialWaybills: Waybill[] = [];
const initialCheckouts: Checkout[] = [];

const initialMaintenanceAssets: MaintenanceAsset[] = [];

export const OperationsProvider = ({ children }: { children: ReactNode }) => {
  const [assets, setAssets] = useState<Asset[]>(initialAssets);
  const [waybills, setWaybills] = useState<Waybill[]>(initialWaybills);
  const [checkouts, setCheckouts] = useState<Checkout[]>(initialCheckouts);
  const [maintenanceAssets, setMaintenanceAssets] = useState<MaintenanceAsset[]>(initialMaintenanceAssets);
  const [maintenanceSessions, setMaintenanceSessions] = useState<MaintenanceSession[]>([]);

  const { 
    vehicles, 
    vehicleTrips, 
    vehicleDocumentTypes,
    addVehicle: storeAddVehicle, 
    updateVehicle: storeUpdateVehicle, 
    deleteVehicle: storeDeleteVehicle, 
    addVehicleTripRecords: storeAddVehicleTripRecords,
    updateVehicleTripRecord: storeUpdateVehicleTripRecord,
    deleteVehicleTripRecord: storeDeleteVehicleTripRecord,
    addVehicleDocumentType: storeAddVehicleDocumentType,
    deleteVehicleDocumentType: storeDeleteVehicleDocumentType,
    updateVehicleDocument: storeUpdateVehicleDocument
  } = useAppStore();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [{ data: dbAssets }, { data: dbWaybills }, { data: dbCheckouts }, { data: dbMaintenance }] = await Promise.all([
          supabase.from('assets').select('*'),
          supabase.from('waybills').select('*'),
          supabase.from('quick_checkouts').select('*'),
          supabase.from('maintenance_logs').select('*')
        ]);

        if (dbAssets) {
          setAssets(dbAssets.map((a: any) => ({
            id: a.id,
            name: a.name,
            category: a.category,
            type: a.type || 'equipment',
            quantity: a.quantity,
            availableQuantity: a.available_quantity,
            reservedQuantity: a.reserved_quantity,
            usedQuantity: a.used_count || 0,
            missingQuantity: a.missing_count || 0,
            damagedQuantity: a.damaged_count || 0,
            unitOfMeasurement: a.unit_of_measurement,
            status: a.status,
            location: a.location,
            condition: a.condition,
            description: a.description
          })));
        }

        if (dbWaybills) {
          setWaybills(dbWaybills.map((w: any) => ({
            id: w.id,
            type: w.type,
            status: w.status,
            siteId: w.site_id,
            siteName: w.site_name,
            driverName: w.driver_name,
            vehicle: w.vehicle,
            issueDate: w.issue_date,
            sentToSiteDate: w.sent_to_site_date,
            items: w.items || [],
          })));
        }

        if (dbCheckouts) {
          setCheckouts(dbCheckouts.map((c: any) => ({
            id: c.id,
            employeeId: c.employee_id,
            employeeName: c.employee_name,
            assetId: c.asset_id,
            assetName: c.asset_name,
            quantity: c.quantity,
            status: c.status,
            checkoutDate: c.checkout_date,
            returnInDays: c.return_in_days || 0,
            returnedQuantity: c.returned_quantity,
          })));
        }

        if (dbMaintenance) {
          setMaintenanceSessions(dbMaintenance.map((m: any) => ({
            id: m.id,
            date: m.date,
            type: m.type,
            technician: m.technician || 'Unknown',
            generalRemark: m.general_remark || undefined,
            assets: m.assets || [],
          })));
        }
      } catch (error) {
        console.error("Error fetching operations data:", error);
      }
    };
    fetchData();
  }, []);

  const persistAsset = async (asset: Asset) => {
    await supabase.from('assets').upsert({
      id: asset.id,
      name: asset.name,
      category: asset.category,
      type: asset.type,
      quantity: asset.quantity,
      available_quantity: asset.availableQuantity,
      reserved_quantity: asset.reservedQuantity,
      used_count: asset.usedQuantity,
      missing_count: asset.missingQuantity || 0,
      damaged_count: asset.damagedQuantity || 0,
      unit_of_measurement: asset.unitOfMeasurement,
      status: asset.status,
      location: asset.location,
      condition: asset.condition,
      description: asset.description
    });
  };

  const persistWaybill = async (waybill: Waybill) => {
    await supabase.from('waybills').upsert({
      id: waybill.id,
      type: waybill.type,
      status: waybill.status,
      site_id: waybill.siteId,
      site_name: waybill.siteName,
      driver_name: waybill.driverName,
      vehicle: waybill.vehicle,
      issue_date: waybill.issueDate,
      sent_to_site_date: waybill.sentToSiteDate,
      items: waybill.items
    });
  };

  const persistCheckout = async (checkout: Checkout) => {
    await supabase.from('quick_checkouts').upsert({
      id: checkout.id,
      employee_id: checkout.employeeId,
      employee_name: checkout.employeeName,
      asset_id: checkout.assetId,
      asset_name: checkout.assetName,
      quantity: checkout.quantity,
      status: checkout.status,
      checkout_date: checkout.checkoutDate,
      expected_return_date: checkout.expectedReturnDate,
      returned_quantity: checkout.returnedQuantity
    });
  };

  const persistMaintenance = async (session: MaintenanceSession) => {
    await supabase.from('maintenance_logs').upsert({
      id: session.id,
      date: session.date,
      type: session.type,
      technician: session.technician,
      general_remark: session.generalRemark,
      assets: session.assets
    });
  };

  const addAsset = (asset: Omit<Asset, 'id' | 'availableQuantity'>) => {
    const newAsset: Asset = {
      ...asset,
      id: crypto.randomUUID(),
      availableQuantity: asset.quantity,
      reservedQuantity: 0,
      usedQuantity: 0,
      missingQuantity: 0,
      damagedQuantity: 0,
    };
    setAssets(prev => [...prev, newAsset]);
    persistAsset(newAsset);
  };

  const bulkAddAssets = (newAssetsData: Omit<Asset, 'id' | 'availableQuantity'>[]) => {
    const newAssets: Asset[] = newAssetsData.map(asset => ({
      ...asset,
      id: crypto.randomUUID(),
      availableQuantity: asset.quantity,
      reservedQuantity: 0,
      usedQuantity: 0,
      missingQuantity: 0,
      damagedQuantity: 0,
    }));
    setAssets(prev => [...prev, ...newAssets]);
    
    // Bulk upsert
    supabase.from('operations_assets').upsert(newAssets.map(asset => ({
      id: asset.id,
      name: asset.name,
      category: asset.category,
      type: asset.type,
      quantity: asset.quantity,
      available_quantity: asset.availableQuantity,
      reserved_quantity: asset.reservedQuantity,
      used_quantity: asset.usedQuantity,
      missing_quantity: asset.missingQuantity,
      damaged_quantity: asset.damagedQuantity,
      unit: asset.unitOfMeasurement,
      status: asset.status,
      location: asset.location,
      condition: asset.condition,
      description: asset.description
    }))).then();
  };

  const updateAsset = (id: string, updates: Partial<Asset>) => {
    setAssets(prev => {
      const updated = prev.map(a => a.id === id ? { ...a, ...updates } : a);
      const asset = updated.find(a => a.id === id);
      if (asset) persistAsset(asset);
      return updated;
    });
  };

  const deleteAsset = (id: string) => {
    setAssets(prev => prev.filter(a => a.id !== id));
    supabase.from('operations_assets').delete().eq('id', id).then();
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

    if (waybill.type === 'waybill') {
      setAssets(prev => prev.map(asset => {
        const item = waybill.items.find(i => i.assetId === asset.id);
        if (item) {
          const reservedQuantity = asset.reservedQuantity + item.quantity;
          const missingQuantity = asset.missingQuantity || 0;
          const damagedQuantity = asset.damagedQuantity || 0;
          const usedQuantity = asset.usedQuantity || 0;
          
          const updated: Asset = {
            ...asset,
            reservedQuantity,
            availableQuantity: Math.max(0, asset.quantity - (reservedQuantity + (asset.missingQuantity || 0) + (asset.damagedQuantity || 0) + (asset.usedQuantity || 0))),
          };
          persistAsset(updated);
          return updated;
        }
        return asset;
      }));
    }

    setWaybills(prev => [...prev, newWaybill]);
    persistWaybill(newWaybill);
  };

  const updateWaybillStatus = (id: string, status: WaybillStatus, sentToSiteDate?: string, returnConditions?: Record<string, { good: number, damaged: number, missing: number }>) => {
    setWaybills(prev => {
      const waybill = prev.find(w => w.id === id);
      if (!waybill) return prev;

      if (waybill.type === 'waybill' && status === 'sent_to_site' && waybill.status !== 'sent_to_site') {
        // Items stay in 'Reserved' even when sent to site, as per user requirement.
        // No quantity change needed here.
      }

      if (waybill.type === 'return' && status === 'return_completed' && waybill.status !== 'return_completed') {
        setAssets(assetsPrev => assetsPrev.map(asset => {
          const item = waybill.items.find(i => i.assetId === asset.id);
          if (item) {
            const cond = returnConditions?.[item.assetId] || { good: item.quantity, damaged: 0, missing: 0 };
            
            const reservedQuantity = Math.max(0, asset.reservedQuantity - item.quantity);
            const damagedQuantity = (asset.damagedQuantity || 0) + cond.damaged;
            const missingQuantity = (asset.missingQuantity || 0) + cond.missing;
            const usedQuantity = asset.usedQuantity || 0;
            
            const updated: Asset = {
              ...asset,
              reservedQuantity,
              damagedQuantity,
              missingQuantity,
              usedQuantity,
              availableQuantity: Math.max(0, asset.quantity - (reservedQuantity + damagedQuantity + missingQuantity + usedQuantity)),
            };
            persistAsset(updated);
            return updated;
          }
          return asset;
        }));
      }

      const updatedWaybill = { 
        ...waybill, 
        status, 
        ...(sentToSiteDate ? { sentToSiteDate } : {}),
        ...(returnConditions ? { 
          items: waybill.items.map(item => ({
            ...item,
            returnedGood: returnConditions[item.assetId]?.good || item.quantity,
            returnedDamaged: returnConditions[item.assetId]?.damaged || 0,
            returnedMissing: returnConditions[item.assetId]?.missing || 0,
          }))
        } : {})
      };
      
      persistWaybill(updatedWaybill);

      return prev.map(w => w.id === id ? updatedWaybill : w);
    });
  };

  const updateWaybill = (id: string, updates: Partial<Omit<Waybill, 'id' | 'status'>>) => {
    setWaybills(prev => {
      const waybill = prev.find(w => w.id === id);
      if (!waybill || waybill.status !== 'outstanding') return prev;

      // Reverse old reservations
      if (waybill.type === 'waybill') {
        setAssets(assetsPrev => assetsPrev.map(asset => {
          const oldItem = waybill.items.find(i => i.assetId === asset.id);
          if (oldItem) {
            return {
              ...asset,
              availableQuantity: asset.availableQuantity + oldItem.quantity,
              reservedQuantity: Math.max(0, asset.reservedQuantity - oldItem.quantity),
            };
          }
          return asset;
        }));
      }

      // Apply new reservations
      const newItems = updates.items || waybill.items;
      if (waybill.type === 'waybill') {
        setAssets(assetsPrev => assetsPrev.map(asset => {
          const newItem = newItems.find(i => i.assetId === asset.id);
          if (newItem) {
            const updated = {
              ...asset,
              availableQuantity: Math.max(0, asset.availableQuantity - newItem.quantity),
              reservedQuantity: asset.reservedQuantity + newItem.quantity,
            };
            persistAsset(updated);
            return updated;
          }
          return asset;
        }));
      }

      const updatedWaybill = { ...waybill, ...updates } as Waybill;
      persistWaybill(updatedWaybill);

      return prev.map(w => w.id === id ? updatedWaybill : w);
    });
  };

  const deleteWaybill = (id: string) => {
    setWaybills(prev => prev.filter(w => w.id !== id));
    supabase.from('waybills').delete().eq('id', id).then();
  };

  const addCheckout = (checkout: Omit<Checkout, 'id' | 'status' | 'checkoutDate' | 'returnedQuantity' | 'expectedReturnDate'>) => {
    const checkoutDate = new Date();
    const expectedDate = new Date();
    expectedDate.setDate(checkoutDate.getDate() + (checkout.returnInDays || 0));

    const newCheckout: Checkout = {
      ...checkout,
      id: `CH-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
      status: 'outstanding',
      checkoutDate: checkoutDate.toISOString(),
      expectedReturnDate: expectedDate.toISOString().split('T')[0],
      returnedQuantity: 0,
    };
    setCheckouts(prev => [newCheckout, ...prev]);
    persistCheckout(newCheckout);
    
    // Update asset quantities
    const asset = assets.find(a => a.id === checkout.assetId);
    if (asset) {
       const updated = { ...asset, availableQuantity: asset.availableQuantity - checkout.quantity };
       updateAsset(asset.id, updated);
       persistAsset(updated);
    }
  };

  const updateCheckoutStatus = (id: string, updates: Partial<Checkout>) => {
    setCheckouts(prev => {
      const checkout = prev.find(c => c.id === id);
      if (!checkout) return prev;
      
      if (updates.status && ['partial_returned', 'returned'].includes(updates.status) && updates.returnedQuantity !== undefined) {
        const newlyReturned = updates.returnedQuantity - checkout.returnedQuantity;
        if (newlyReturned > 0) {
          setAssets(assetsPrev => assetsPrev.map(a => {
            if (a.id === checkout.assetId) {
              const updated = { ...a, availableQuantity: a.availableQuantity + newlyReturned };
              persistAsset(updated);
              return updated;
            }
            return a;
          }));
        }
      }
      
      const updatedCheckout = { ...checkout, ...updates } as Checkout;
      persistCheckout(updatedCheckout);
      return prev.map(c => c.id === id ? updatedCheckout : c);
    });
  };

  const deleteCheckout = (id: string) => {
    setCheckouts(prev => prev.filter(c => c.id !== id));
    supabase.from('operations_checkouts').delete().eq('id', id).then();
  };

  const logMaintenance = (session: Omit<MaintenanceSession, 'id'>) => {
    const newSession: MaintenanceSession = {
      ...session,
      id: `MS-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
    };
    setMaintenanceSessions(prev => [newSession, ...prev]);
    persistMaintenance(newSession);
    
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
    const siteWaybills = waybills.filter(w => w.siteId === siteId && w.type === 'waybill' && w.status !== 'outstanding');
    const returnWaybills = waybills.filter(w => w.siteId === siteId && w.type === 'return' && w.status !== 'outstanding');
    
    const inventoryMap = new Map<string, { assetId: string, assetName: string, quantity: number }>();
    
    siteWaybills.forEach(w => {
      w.items.forEach(item => {
        const existing = inventoryMap.get(item.assetId);
        if (existing) {
          existing.quantity += item.quantity;
        } else {
          inventoryMap.set(item.assetId, { ...item });
        }
      });
    });

    returnWaybills.forEach(w => {
      w.items.forEach(item => {
        const existing = inventoryMap.get(item.assetId);
        if (existing) {
          existing.quantity -= item.quantity;
          if (existing.quantity <= 0) {
            inventoryMap.delete(item.assetId);
          }
        }
      });
    });

    return {
      waybillsCount: waybills.filter(w => w.siteId === siteId).length,
      currentAssets: Array.from(inventoryMap.values()),
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
      updateWaybill,
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
      vehicles,
      vehicleTrips,
      addVehicle: (v) => {
        const newVehicle: Vehicle = {
          ...v,
          id: crypto.randomUUID(),
          status: 'active' as const,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        storeAddVehicle(newVehicle);
      },
      updateVehicle: storeUpdateVehicle,
      deleteVehicle: storeDeleteVehicle,
      addVehicleTripRecords: (logs) => {
        const logsWithIds = logs.map(l => ({ ...l, id: crypto.randomUUID() }));
        storeAddVehicleTripRecords(logsWithIds);
      },
      updateVehicleTripRecord: storeUpdateVehicleTripRecord,
      deleteVehicleTripRecord: storeDeleteVehicleTripRecord,
      vehicleDocumentTypes,
      addVehicleDocumentType: (name) => {
        storeAddVehicleDocumentType({ id: crypto.randomUUID(), name });
      },
      deleteVehicleDocumentType: storeDeleteVehicleDocumentType,
      updateVehicleDocument: storeUpdateVehicleDocument
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
