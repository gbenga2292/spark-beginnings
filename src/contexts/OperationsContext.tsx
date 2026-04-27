import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  Asset, Waybill, AssetCategory, AssetType, AssetStatus, WaybillStatus, WaybillType, 
  Checkout, MaintenanceAsset, MaintenanceSession, MaintenanceLogType, ServiceStatus,
  Vehicle, VehicleTripLeg, VehicleDocumentType, DailyMachineLog
} from '../types/operations';
import { supabase } from '@/src/integrations/supabase/client';
import { useAppStore } from '../store/appStore';
import { useSetPageTitle } from './PageContext';
import { toast } from 'sonner';
import { useAuth } from '../hooks/useAuth';

interface OperationsContextType {
  assets: Asset[];
  waybills: Waybill[];
  checkouts: Checkout[];
  maintenanceAssets: MaintenanceAsset[];
  maintenanceSessions: MaintenanceSession[];
  dailyMachineLogs: DailyMachineLog[];
  
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
  
  // Analytics
  getAssetAnalytics: () => any;
  getSiteAnalytics: (siteId: string) => any;
  getMaintenanceStats: () => any;

  // Vehicle methods
  vehicles: Vehicle[];
  vehicleTrips: VehicleTripLeg[];
  addVehicle: (vehicle: Omit<Vehicle, 'id' | 'created_at' | 'updated_at'>) => void;
  insertVehicles: (vehicles: Vehicle[]) => void;
  setVehicles: (vehicles: Vehicle[]) => void;
  updateVehicle: (id: string, updates: Partial<Vehicle>) => void;
  deleteVehicle: (id: string) => void;
  addVehicleTripRecords: (logs: any[]) => void;
  setVehicleTripRecords: (logs: any[]) => void;
  updateVehicleTripRecord: (id: string, log: any) => void;
  deleteVehicleTripRecord: (id: string) => void;
  vehicleDocumentTypes: VehicleDocumentType[];
  addVehicleDocumentType: (name: string) => void;
  deleteVehicleDocumentType: (id: string) => void;
  updateVehicleDocument: (vehicleId: string, docTypeName: string, date: string) => void;
  
  // Daily Machine Logs
  logDailyActivity: (log: Omit<DailyMachineLog, 'id' | 'created_at'>) => Promise<void>;
}

const OperationsContext = createContext<OperationsContextType | undefined>(undefined);

const initialAssets: Asset[] = [];
const initialWaybills: Waybill[] = [];
const initialCheckouts: Checkout[] = [];

const initialMaintenanceAssets: MaintenanceAsset[] = [];

export const OperationsProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [assets, setAssets] = useState<Asset[]>(initialAssets);
  const [waybills, setWaybills] = useState<Waybill[]>(initialWaybills);
  const [checkouts, setCheckouts] = useState<Checkout[]>(initialCheckouts);
  const [maintenanceSessions, setMaintenanceSessions] = useState<MaintenanceSession[]>([]);
  const [dailyMachineLogs, setDailyMachineLogs] = useState<DailyMachineLog[]>([]);

  const { 
    vehicles, 
    vehicleTrips, 
    vehicleDocumentTypes,
    addVehicle: storeAddVehicle, 
    insertVehicles: storeInsertVehicles,
    setVehicles: storeSetVehicles,
    updateVehicle: storeUpdateVehicle, 
    deleteVehicle: storeDeleteVehicle, 
    addVehicleTripRecords: storeAddVehicleTripRecords,
    setVehicleTripRecords: storeSetVehicleTripRecords,
    updateVehicleTripRecord: storeUpdateVehicleTripRecord,
    deleteVehicleTripRecord: storeDeleteVehicleTripRecord,
    addVehicleDocumentType: storeAddVehicleDocumentType,
    deleteVehicleDocumentType: storeDeleteVehicleDocumentType,
    updateVehicleDocument: storeUpdateVehicleDocument
  } = useAppStore();

  const maintenanceAssets = React.useMemo(() => {
    // 1. Machines: Assets with type 'equipment' and requiresLogging = true
    const machines = assets
      .filter(a => a.type === 'equipment' && a.requiresLogging)
      .map(a => {
        const sessions = maintenanceSessions.filter(s => s.assets.some(sa => sa.assetId === a.id));
        const lastSession = sessions.sort((x, y) => new Date(y.date).getTime() - new Date(x.date).getTime())[0];
        
        const nextDate = lastSession ? new Date(lastSession.date) : new Date();
        nextDate.setMonth(nextDate.getMonth() + (a.serviceIntervalMonths || 2));
        
        const now = new Date();
        let status: ServiceStatus = 'ok';
        if (now > nextDate) status = 'overdue';
        else if (nextDate.getTime() - now.getTime() < 14 * 24 * 60 * 60 * 1000) status = 'due_soon';

        return {
          id: a.id,
          name: a.name,
          serialNumber: a.serialNumber,
          category: 'machine' as const,
          site: a.location || 'Main Store',
          lastServiceDate: lastSession?.date || '',
          nextServiceDate: nextDate.toISOString(),
          serviceIntervalMonths: a.serviceIntervalMonths || 2,
          status,
          pattern: 'Routine',
          totalMaintenanceRecords: sessions.length,
          isActive: a.status === 'active'
        };
      });

    // 2. Vehicles: All vehicles from the vehicle page
    const mappedVehicles = vehicles.map(v => {
      const sessions = maintenanceSessions.filter(s => s.assets.some(sa => sa.assetId === v.id));
      const lastSession = sessions.sort((x, y) => new Date(y.date).getTime() - new Date(x.date).getTime())[0];
      
      const nextDate = lastSession ? new Date(lastSession.date) : new Date();
      nextDate.setMonth(nextDate.getMonth() + 3); // Default 3 months
      
      const now = new Date();
      let status: ServiceStatus = 'ok';
      if (now > nextDate) status = 'overdue';
      else if (nextDate.getTime() - now.getTime() < 14 * 24 * 60 * 60 * 1000) status = 'due_soon';

      return {
        id: v.id,
        name: v.name,
        serialNumber: v.registration_number,
        category: 'vehicle' as const,
        site: 'Main Office',
        lastServiceDate: lastSession?.date || '',
        nextServiceDate: nextDate.toISOString(),
        serviceIntervalMonths: 3,
        status,
        pattern: 'Routine',
        totalMaintenanceRecords: sessions.length,
        isActive: v.status === 'active'
      };
    });

    return [...machines, ...mappedVehicles];
  }, [assets, vehicles, maintenanceSessions]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [
          { data: dbAssets }, 
          { data: dbWaybills }, 
          { data: dbCheckouts }, 
          { data: dbMaintenance },
          { data: dbDailyLogs }
        ] = await Promise.all([
          supabase.from('operations_assets').select('*'),
          supabase.from('operations_waybills').select('*'),
          supabase.from('operations_checkouts').select('*'),
          supabase.from('operations_maintenance').select('*'),
          supabase.from('operations_daily_logs').select('*')
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
            usedQuantity: a.used_quantity || 0,
            missingQuantity: a.missing_quantity || 0,
            damagedQuantity: a.damaged_quantity || 0,
            unitOfMeasurement: a.unit,
            status: a.status,
            location: a.location,
            condition: a.condition,
            description: a.description,
            requiresLogging: a.requires_logging,
            serialNumber: a.serial_number,
            serviceIntervalMonths: a.service_interval_months || 2,
            powerSource: a.power_source,
            cost: a.cost,
            lowStockLevel: a.low_stock_level,
            criticalStockLevel: a.critical_stock_level
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
            expectedReturnDate: c.expected_return_date,
            returnedQuantity: c.returned_quantity,
            returnInDays: c.return_in_days || 0
          })));
        }

        if (dbDailyLogs) {
          setDailyMachineLogs(dbDailyLogs.map((log: any) => ({
            id: log.id,
            assetId: log.asset_id,
            assetName: log.asset_name,
            siteId: log.site_id,
            siteName: log.site_name,
            date: log.date,
            isActive: log.is_active,
            downtimeEntries: log.downtime_entries || [],
            maintenanceDetails: log.maintenance_details,
            clientFeedback: log.client_feedback,
            issuesOnSite: log.issues_on_site,
            dieselUsage: Number(log.diesel_usage || 0),
            supervisorOnSite: log.supervisor_on_site,
            loggedBy: log.logged_by,
            created_at: log.created_at
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
    if (user) {
      fetchData();
    }
  }, [user]);

  const persistAsset = async (asset: Asset) => {
    try {
      const { error } = await supabase.from('operations_assets').upsert({
        id: asset.id,
        name: asset.name,
        category: asset.category,
        type: asset.type,
        quantity: asset.quantity,
        available_quantity: asset.availableQuantity,
        reserved_quantity: asset.reservedQuantity,
        used_quantity: asset.usedQuantity,
        missing_quantity: asset.missingQuantity || 0,
        damaged_quantity: asset.damagedQuantity || 0,
        unit: asset.unitOfMeasurement,
        status: asset.status,
        location: asset.location,
        condition: asset.condition,
        description: asset.description,
        requires_logging: asset.requiresLogging,
        serial_number: asset.serialNumber,
        service_interval_months: asset.serviceIntervalMonths,
        power_source: asset.powerSource,
        cost: asset.cost,
        low_stock_level: asset.lowStockLevel,
        critical_stock_level: asset.criticalStockLevel,
        updated_at: new Date().toISOString()
      });

      if (error) throw error;
    } catch (error: any) {
      console.error('Error persisting asset:', error);
      toast.error(`Failed to sync asset: ${error.message || 'Unknown error'}`);
      throw error;
    }
  };

  const persistWaybill = async (waybill: Waybill) => {
    await supabase.from('operations_waybills').upsert({
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
    await supabase.from('operations_checkouts').upsert({
      id: checkout.id,
      employee_id: checkout.employeeId,
      employee_name: checkout.employeeName,
      asset_id: checkout.assetId,
      asset_name: checkout.assetName,
      quantity: checkout.quantity,
      status: checkout.status,
      checkout_date: checkout.checkoutDate,
      expected_return_date: checkout.expectedReturnDate,
      returned_quantity: checkout.returnedQuantity,
      return_in_days: checkout.returnInDays
    });
  };

  const persistMaintenance = async (session: MaintenanceSession) => {
    await supabase.from('operations_maintenance').upsert({
      id: session.id,
      date: session.date,
      type: session.type,
      technician: session.technician,
      description: session.generalRemark,
      assets: session.assets
    });
  };

  const addAsset = async (asset: Omit<Asset, 'id' | 'availableQuantity' | 'reservedQuantity' | 'missingQuantity' | 'damagedQuantity' | 'usedQuantity'>) => {
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
    
    try {
      await persistAsset(newAsset);
      toast.success('Asset added successfully');
    } catch (error) {
      // Revert local state if DB save fails
      setAssets(prev => prev.filter(a => a.id !== newAsset.id));
    }
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
      description: asset.description,
      requires_logging: asset.requiresLogging,
      serial_number: asset.serialNumber,
      service_interval_months: asset.serviceIntervalMonths,
      power_source: asset.powerSource,
      cost: asset.cost,
      low_stock_level: asset.lowStockLevel,
      critical_stock_level: asset.criticalStockLevel
    }))).then();
  };

  const updateAsset = async (id: string, updates: Partial<Asset>) => {
    const originalAssets = assets;
    let targetAsset: Asset | undefined;

    setAssets(prev => {
      const updated = prev.map(a => a.id === id ? { ...a, ...updates } : a);
      targetAsset = updated.find(a => a.id === id);
      return updated;
    });

    if (targetAsset) {
      try {
        await persistAsset(targetAsset);
        toast.success('Asset updated successfully');
      } catch (error) {
        // Revert local state if DB save fails
        setAssets(originalAssets);
      }
    }
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

      const updated: Asset = {
        ...asset,
        quantity: asset.quantity + restockItem.quantity,
        availableQuantity: Math.max(0, (asset.quantity + restockItem.quantity) - ((asset.reservedQuantity || 0) + (asset.missingQuantity || 0) + (asset.damagedQuantity || 0) + (asset.usedQuantity || 0))),
        restockHistory: [...(asset.restockHistory || []), newRecord]
      };
      persistAsset(updated);
      return updated;
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
    supabase.from('operations_waybills').delete().eq('id', id).then();
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
    
    // Update asset quantities: reserve the item
    setAssets(assetsPrev => assetsPrev.map(asset => {
      if (asset.id === checkout.assetId) {
        const reservedQuantity = (asset.reservedQuantity || 0) + checkout.quantity;
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
  };

  const updateCheckoutStatus = (id: string, updates: Partial<Checkout>) => {
    setCheckouts(prev => {
      const checkout = prev.find(c => c.id === id);
      if (!checkout) return prev;
      
      if (updates.status && ['partial_returned', 'returned', 'outstanding'].includes(updates.status) && updates.returnedQuantity !== undefined) {
        // Return logic: reduce reservation based on INCREMENTAL return
        const delta = updates.returnedQuantity - (checkout.returnedQuantity || 0);
        
        if (delta !== 0) {
          setAssets(assetsPrev => assetsPrev.map(asset => {
            if (asset.id === checkout.assetId) {
              const reservedQuantity = Math.max(0, (asset.reservedQuantity || 0) - delta);
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

    // Update inventory for parts used
    session.assets.forEach(assetLog => {
      assetLog.parts?.forEach(part => {
        if (part.type === 'inventory' && (part as any).id) {
          const partId = (part as any).id;
          setAssets(prev => prev.map(a => {
            if (a.id === partId) {
              const newQty = Math.max(0, a.quantity - (part.quantity || 1));
              const updated: Asset = {
                ...a,
                quantity: newQty,
                availableQuantity: Math.max(0, newQty - ((a.reservedQuantity || 0) + (a.usedQuantity || 0) + (a.missingQuantity || 0) + (a.damagedQuantity || 0)))
              };
              persistAsset(updated);
              return updated;
            }
            return a;
          }));
        }
      });
    });

    setMaintenanceSessions(prev => [newSession, ...prev]);
    persistMaintenance(newSession);
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
    
    // Calculate monthly cost
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    let monthlyCost = 0;
    let totalDowntime = 0;
    
    maintenanceSessions.forEach(session => {
      const sessionDate = new Date(session.date);
      if (sessionDate.getMonth() === currentMonth && sessionDate.getFullYear() === currentYear) {
        session.assets.forEach(assetLog => {
          monthlyCost += (assetLog.cost || 0);
          if (assetLog.shutdown) {
            // Assuming 8 hours for each shutdown if not specified, 
            // though we could add a downtimeHours field to the log
            totalDowntime += 8; 
          }
        });
      }
    });
    
    return {
      totalMachines,
      totalVehicles,
      dueSoon,
      overdue,
      monthlyCost,
      totalDowntime,
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
      insertVehicles: storeInsertVehicles,
      setVehicles: storeSetVehicles,
      addVehicleTripRecords: (logs) => {
        const logsWithIds = logs.map(l => ({ ...l, id: crypto.randomUUID() }));
        storeAddVehicleTripRecords(logsWithIds);
      },
      setVehicleTripRecords: (logs) => {
        const logsWithIds = logs.map(l => ({ ...l, id: l.id || crypto.randomUUID() }));
        storeSetVehicleTripRecords(logsWithIds);
      },
      updateVehicleTripRecord: storeUpdateVehicleTripRecord,
      deleteVehicleTripRecord: storeDeleteVehicleTripRecord,
      vehicleDocumentTypes,
      addVehicleDocumentType: (name) => {
        storeAddVehicleDocumentType({ id: crypto.randomUUID(), name });
      },
      deleteVehicleDocumentType: storeDeleteVehicleDocumentType,
      updateVehicleDocument: storeUpdateVehicleDocument,
      dailyMachineLogs,
      logDailyActivity: async (logData: Omit<DailyMachineLog, 'id' | 'created_at'>) => {
        try {
          const payload = {
            asset_id: logData.assetId,
            asset_name: logData.assetName,
            site_id: logData.siteId,
            site_name: logData.siteName,
            date: logData.date,
            is_active: logData.isActive,
            downtime_entries: logData.downtimeEntries,
            maintenance_details: logData.maintenanceDetails,
            client_feedback: logData.clientFeedback,
            issues_on_site: logData.issuesOnSite,
            diesel_usage: logData.dieselUsage,
            supervisor_on_site: logData.supervisorOnSite,
            logged_by: logData.loggedBy
          };

          const { data, error } = await supabase
            .from('operations_daily_logs')
            .upsert(payload, { onConflict: 'asset_id,date' })
            .select()
            .single();

          if (error) throw error;

          const newLog: DailyMachineLog = {
            id: data.id,
            assetId: data.asset_id,
            assetName: data.asset_name,
            siteId: data.site_id,
            siteName: data.site_name,
            date: data.date,
            isActive: data.is_active,
            downtimeEntries: data.downtime_entries || [],
            maintenanceDetails: data.maintenance_details,
            clientFeedback: data.client_feedback,
            issuesOnSite: data.issues_on_site,
            dieselUsage: Number(data.diesel_usage || 0),
            supervisorOnSite: data.supervisor_on_site,
            loggedBy: data.logged_by,
            created_at: data.created_at
          };

          setDailyMachineLogs(prev => {
            const index = prev.findIndex(l => l.assetId === newLog.assetId && l.date === newLog.date);
            if (index >= 0) {
              const updated = [...prev];
              updated[index] = newLog;
              return updated;
            }
            return [newLog, ...prev];
          });

          // toast.success('Daily activity logged successfully'); // Need to import toast or use a different feedback mechanism
        } catch (error) {
          console.error('Error logging daily activity:', error);
          // toast.error('Failed to log daily activity');
          throw error;
        }
      }
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
