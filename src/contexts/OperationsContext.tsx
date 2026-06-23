import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  Asset, Waybill, AssetCategory, AssetType, AssetStatus, WaybillStatus, WaybillType, 
  Checkout, MaintenanceAsset, MaintenanceSession, MaintenanceLogType, ServiceStatus,
  Vehicle, VehicleTripLeg, VehicleDocumentType, DailyMachineLog, AssetPumpDate,
  MaintenanceCertificate, VehicleFuelLog, DieselRefill
} from '../types/operations';
import { supabase } from '@/src/integrations/supabase/client';
import { useAppStore } from '../store/appStore';
import { useSetPageTitle } from './PageContext';
import { toast } from 'sonner';
import { useAuth } from '../hooks/useAuth';
import { isInternalSite } from '@/src/lib/siteUtils';

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
  createWaybill: (waybill: Omit<Waybill, 'id' | 'status'> & { id?: string; status?: WaybillStatus }) => void;
  updateWaybill: (id: string, updates: Partial<Omit<Waybill, 'id' | 'status'>>) => void;
  updateWaybillStatus: (id: string, status: WaybillStatus, sentToSiteDate?: string, returnConditions?: Record<string, { good: number, damaged: number, missing: number }>) => void;
  deleteWaybill: (id: string) => void;

  // Checkout methods
  addCheckout: (checkout: Omit<Checkout, 'id' | 'status' | 'checkoutDate' | 'returnedQuantity'>) => void;
  updateCheckoutStatus: (id: string, updates: Partial<Checkout>) => void;
  deleteCheckout: (id: string) => void;

  // Maintenance methods
  logMaintenance: (session: Omit<MaintenanceSession, 'id'>) => void;
  updateMaintenance: (id: string, updates: Partial<Omit<MaintenanceSession, 'id'>>) => void;
  
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
  deleteDailyLog: (logId: string) => Promise<void>;
  sitePumpDates: AssetPumpDate[];
  persistSitePumpDates: (assetId: string, siteId: string, pumpStartDate: string, pumpStopDate: string | null) => Promise<void>;

  // Certificates
  maintenanceCertificates: MaintenanceCertificate[];
  issueCertificate: (cert: Omit<MaintenanceCertificate, 'id'>) => Promise<void>;

  // Fuel Logs
  vehicleFuelLogs: VehicleFuelLog[];
  addVehicleFuelLog: (log: Omit<VehicleFuelLog, 'id' | 'created_at'>) => Promise<void>;
  updateVehicleFuelLog: (id: string, updates: Partial<VehicleFuelLog>) => Promise<void>;
  deleteVehicleFuelLog: (id: string) => Promise<void>;

  // Diesel Refills
  dieselRefills: DieselRefill[];
  addDieselRefill: (refill: Omit<DieselRefill, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateDieselRefill: (id: string, updates: Partial<Omit<DieselRefill, 'id' | 'created_at'>>) => Promise<void>;
  deleteDieselRefill: (id: string) => Promise<void>;
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
  const [sitePumpDates, setSitePumpDates] = useState<AssetPumpDate[]>([]);
  const [maintenanceCertificates, setMaintenanceCertificates] = useState<MaintenanceCertificate[]>([]);
  const [vehicleFuelLogs, setVehicleFuelLogs] = useState<VehicleFuelLog[]>([]);
  const [dieselRefills, setDieselRefills] = useState<DieselRefill[]>([]);

  const { 
    sites,
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
      .filter(a => a.type === 'equipment' && a.requiresLogging && (!a.location || !isInternalSite({ name: a.location })))
      .map(a => {
        const sessions = maintenanceSessions.filter(s => s.assets.some(sa => sa.assetId === a.id));
        const routineSessions = sessions.filter(s => s.type === 'routine' || s.type === 'scheduled');
        
        const lastSession = sessions.sort((x, y) => new Date(y.date).getTime() - new Date(x.date).getTime())[0];
        const lastRoutineSession = routineSessions.sort((x, y) => new Date(y.date).getTime() - new Date(x.date).getTime())[0];
        
        const lastRoutineDate = lastRoutineSession ? new Date(lastRoutineSession.date) : (a.created_at ? new Date(a.created_at) : new Date());
        
        const logsSinceLastMaintenance = dailyMachineLogs.filter(log => 
          log.assetId === a.id && 
          new Date(log.date).getTime() > lastRoutineDate.getTime() &&
          log.isActive
        );
        
        let activeDaysCount = 0;
        logsSinceLastMaintenance.forEach(log => {
          if (log.operationalDay === 'full') activeDaysCount += 1;
          else if (log.operationalDay === 'half') activeDaysCount += 0.5;
          else activeDaysCount += 1;
        });

        // Convert the configured months to operational days (assuming 1 month = 30 days)
        const intervalMonths = a.serviceIntervalMonths || 2;
        const OPERATIONAL_DAYS_LIMIT = intervalMonths * 30;
        const OPERATIONAL_DAYS_WARNING = OPERATIONAL_DAYS_LIMIT - 10;
        
        // Smart Estimate: Push the date forward dynamically based on remaining days
        const daysLeft = Math.max(0, OPERATIONAL_DAYS_LIMIT - activeDaysCount);
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + daysLeft);
        
        let status: ServiceStatus = 'ok';
        if (activeDaysCount >= OPERATIONAL_DAYS_LIMIT) {
          status = 'overdue';
        } else if (activeDaysCount >= OPERATIONAL_DAYS_WARNING) {
          status = 'due_soon';
        }

        // Resolve current site by looking at ALL waybills for this machine (outbound + return),
        // sorted by most recent date. The most recent action tells us where it is right now.
        //
        // Bug fix: outbound waybills never change status when a return waybill completes,
        // so filtering only "active outbound" was wrong — it ignored completed returns.
        const allAssetWaybills = waybills
          .filter(wb => wb.items.some(item => item.assetId === a.id))
          .sort((x, y) => {
            const dx = new Date(x.sentToSiteDate || x.issueDate).getTime();
            const dy = new Date(y.sentToSiteDate || y.issueDate).getTime();
            return dy - dx;
          });

        let resolvedSite = 'Warehouse';

        if (allAssetWaybills.length > 0) {
          const latest = allAssetWaybills[0];
          // Machine is on site only if the most recent waybill is an active outbound dispatch
          if (
            latest.type === 'waybill' &&
            ['sent_to_site', 'partial_returned', 'outstanding', 'open'].includes(latest.status)
          ) {
            resolvedSite = latest.siteName || 'Warehouse';
          }
          // If the most recent is a return waybill (any status) OR a fully-returned outbound → Warehouse
        } else {
          // No waybills at all — fall back to recent daily log (within 45 days)
          const recentLog = dailyMachineLogs
            .filter(log => log.assetId === a.id)
            .sort((x, y) => new Date(y.date).getTime() - new Date(x.date).getTime())[0];
          if (recentLog) {
            const daysSinceLog = (Date.now() - new Date(recentLog.date).getTime()) / (1000 * 60 * 60 * 24);
            resolvedSite = daysSinceLog <= 45 ? recentLog.siteName : 'Warehouse';
          }
        }


        return {
          id: a.id,
          name: a.name,
          serialNumber: a.serialNumber,
          category: 'machine' as const,
          site: resolvedSite,
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
    const mappedVehicles = vehicles
      .filter(v => !isInternalSite({ name: 'Main Office' }))
      .map(v => {
        const sessions = maintenanceSessions.filter(s => s.assets.some(sa => sa.assetId === v.id));
        const routineSessions = sessions.filter(s => s.type === 'routine' || s.type === 'scheduled');
        
        const lastSession = sessions.sort((x, y) => new Date(y.date).getTime() - new Date(x.date).getTime())[0];
        const lastRoutineSession = routineSessions.sort((x, y) => new Date(y.date).getTime() - new Date(x.date).getTime())[0];
        
        const nextDate = lastRoutineSession ? new Date(lastRoutineSession.date) : (v.created_at ? new Date(v.created_at) : new Date());
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
  }, [assets, vehicles, maintenanceSessions, dailyMachineLogs, waybills]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [
          { data: dbAssets }, 
          { data: dbWaybills }, 
          { data: dbCheckouts }, 
          { data: dbMaintenance },
          { data: dbDailyLogs },
          { data: dbPumpDates },
          { data: dbFuelLogs },
          { data: dbDieselRefills }
        ] = await Promise.all([
          supabase.from('operations_assets').select('*'),
          supabase.from('operations_waybills').select('*'),
          supabase.from('operations_checkouts').select('*'),
          supabase.from('operations_maintenance').select('*'),
          supabase.from('operations_daily_logs').select('*'),
          supabase.from('operations_site_pump_dates').select('*'),
          supabase.from('vehicle_fuel_logs').select('*').order('date', { ascending: false }),
          supabase.from('diesel_refills').select('*').order('date', { ascending: false })
        ]);

        if (dbAssets) {
          setAssets(dbAssets.map((a: any) => {
            const quantity = a.quantity || 0;
            const reservedQuantity = a.reserved_quantity || 0;
            const usedQuantity = a.used_quantity || 0;
            const missingQuantity = a.missing_quantity || 0;
            const damagedQuantity = a.damaged_quantity || 0;
            const availableQuantity = Math.max(0, quantity - (reservedQuantity + usedQuantity + missingQuantity + damagedQuantity));

            return {
              id: a.id,
              name: a.name,
              category: a.category,
              type: a.type || 'equipment',
              quantity,
              availableQuantity,
              reservedQuantity,
              usedQuantity,
              missingQuantity,
              damagedQuantity,
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
              criticalStockLevel: a.critical_stock_level,
              created_at: a.created_at
            };
          }));
        }

        if (dbPumpDates) {
          setSitePumpDates(dbPumpDates.map((p: any) => ({
            id: p.id,
            assetId: p.asset_id,
            siteId: p.site_id,
            pumpStartDate: p.pump_start_date,
            pumpStopDate: p.pump_stop_date,
            created_at: p.created_at
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
            transferSiteId: w.transfer_site_id,
            transferSiteName: w.transfer_site_name,
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
            operationalDay: log.operational_day,
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

        if (dbFuelLogs) {
          setVehicleFuelLogs(dbFuelLogs.map((f: any) => ({
            id: f.id,
            vehicle_id: f.vehicle_id,
            vehicle_reg: f.vehicle_reg,
            date: f.date,
            rate_per_litre: Number(f.rate_per_litre || 0),
            litres: Number(f.litres || 0),
            total_cost: Number(f.total_cost || 0),
            odometer: f.odometer ? Number(f.odometer) : undefined,
            filled_by: f.filled_by,
            notes: f.notes,
            created_at: f.created_at
          })));
        }

        if (dbDieselRefills) {
          setDieselRefills(dbDieselRefills.map((r: any): DieselRefill => ({
            id: r.id,
            date: r.date,
            siteId: r.site_id || '',
            siteName: r.site_name || '',
            totalLitres: Number(r.total_litres || 0),
            pricePerLitre: r.price_per_litre ? Number(r.price_per_litre) : undefined,
            totalCost: r.total_cost ? Number(r.total_cost) : undefined,
            purchasedBy: r.purchased_by,
            supplier: r.supplier,
            notes: r.notes,
            machineAllocations: r.machine_allocations || [],
            created_at: r.created_at,
            updated_at: r.updated_at,
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

  useEffect(() => {
    const fetchCertificates = async () => {
      try {
        const { data, error } = await supabase
          .from('maintenance_certificates')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data) {
          const certs: MaintenanceCertificate[] = data.map((r: any) => ({
            id: r.id,
            certNumber: r.cert_number,
            machineId: r.machine_id,
            machineName: r.machine_name,
            machineCategory: r.machine_category,
            machineSite: r.machine_site,
            machineSerial: r.machine_serial,
            issuedDate: r.issued_date,
            expiryDate: r.expiry_date,
            issuedByEmployeeId: r.issued_by_employee_id,
            issuedByName: r.issued_by_name,
            issuedByDesignation: r.issued_by_designation,
            lastServiceDate: r.last_service_date,
            nextServiceDate: r.next_service_date,
            totalServices: r.total_services,
            complianceStandards: r.compliance_standards,
            conditionsOfOperation: r.conditions_of_operation,
            manufacturer: r.manufacturer,
            modelNumber: r.model_number,
            outcomeRemarks: r.outcome_remarks,
            lastInspectionDateOverride: r.last_inspection_date_override,
            issuedDateOverride: r.issued_date_override,
            criteriaCompliance: r.criteria_compliance,
          }));
          setMaintenanceCertificates(certs);
          // Keep localStorage as offline cache
          localStorage.setItem('dcel-maintenance-certificates', JSON.stringify(certs));
          return;
        }
      } catch (err) {
        console.error('Failed to fetch certificates from Supabase:', err);
      }
      // Fallback: load from localStorage if Supabase fails
      const cachedCerts = localStorage.getItem('dcel-maintenance-certificates');
      if (cachedCerts) {
        try { setMaintenanceCertificates(JSON.parse(cachedCerts)); } catch (e) {}
      }
    };

    if (user) fetchCertificates();
  }, [user]);

  // ── Real-Time Subscriptions for Dewatering Operations & Maintenance ──
  useEffect(() => {
    if (!user) return;

    // Helper mappers corresponding to the database to frontend state formats
    const mapDbAsset = (a: any) => {
      const quantity = a.quantity || 0;
      const reservedQuantity = a.reserved_quantity || 0;
      const usedQuantity = a.used_quantity || 0;
      const missingQuantity = a.missing_quantity || 0;
      const damagedQuantity = a.damaged_quantity || 0;
      const availableQuantity = Math.max(0, quantity - (reservedQuantity + usedQuantity + missingQuantity + damagedQuantity));

      return {
        id: a.id,
        name: a.name,
        category: a.category,
        type: a.type || 'equipment',
        quantity,
        availableQuantity,
        reservedQuantity,
        usedQuantity,
        missingQuantity,
        damagedQuantity,
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
        criticalStockLevel: a.critical_stock_level,
        created_at: a.created_at
      };
    };

    const mapDbPumpDate = (p: any) => ({
      id: p.id,
      assetId: p.asset_id,
      siteId: p.site_id,
      pumpStartDate: p.pump_start_date,
      pumpStopDate: p.pump_stop_date,
      created_at: p.created_at
    });

    const mapDbWaybill = (w: any) => ({
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
      signature: w.signature,
      transferSiteId: w.transfer_site_id,
      transferSiteName: w.transfer_site_name,
    });

    const mapDbCheckout = (c: any) => ({
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
    });

    const mapDbDailyLog = (log: any) => ({
      id: log.id,
      assetId: log.asset_id,
      assetName: log.asset_name,
      siteId: log.site_id,
      siteName: log.site_name,
      date: log.date,
      isActive: log.is_active,
      operationalDay: log.operational_day,
      downtimeEntries: log.downtime_entries || [],
      maintenanceDetails: log.maintenance_details,
      clientFeedback: log.client_feedback,
      issuesOnSite: log.issues_on_site,
      dieselUsage: Number(log.diesel_usage || 0),
      supervisorOnSite: log.supervisor_on_site,
      loggedBy: log.logged_by,
      created_at: log.created_at
    });

    const mapDbMaintenance = (m: any) => ({
      id: m.id,
      date: m.date,
      type: m.type,
      technician: m.technician || 'Unknown',
      generalRemark: m.general_remark || undefined,
      assets: m.assets || [],
    });

    const mapDbCertificate = (r: any) => ({
      id: r.id,
      certNumber: r.cert_number,
      machineId: r.machine_id,
      machineName: r.machine_name,
      machineCategory: r.machine_category,
      machineSite: r.machine_site,
      machineSerial: r.machine_serial,
      issuedDate: r.issued_date,
      expiryDate: r.expiry_date,
      issuedByEmployeeId: r.issued_by_employee_id,
      issuedByName: r.issued_by_name,
      issuedByDesignation: r.issued_by_designation,
      lastServiceDate: r.last_service_date,
      nextServiceDate: r.next_service_date,
      totalServices: r.total_services,
      complianceStandards: r.compliance_standards,
      conditionsOfOperation: r.conditions_of_operation,
      manufacturer: r.manufacturer,
      modelNumber: r.model_number,
      outcomeRemarks: r.outcome_remarks,
      lastInspectionDateOverride: r.last_inspection_date_override,
      issuedDateOverride: r.issued_date_override,
      criteriaCompliance: r.criteria_compliance,
    });

    const channel = supabase
      .channel('operations-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public' },
        (payload) => {
          const table = payload.table;
          const eventType = payload.eventType;
          const newRow = payload.new as Record<string, any>;
          const oldRow = payload.old as Record<string, any>;

          switch (table) {
            case 'operations_assets': {
              if (eventType === 'INSERT') {
                setAssets(prev => {
                  if (prev.some(a => a.id === newRow.id)) return prev;
                  return [...prev, mapDbAsset(newRow)];
                });
              } else if (eventType === 'UPDATE') {
                setAssets(prev => prev.map(a => a.id === newRow.id ? mapDbAsset(newRow) : a));
              } else if (eventType === 'DELETE') {
                setAssets(prev => prev.filter(a => a.id !== oldRow.id));
              }
              break;
            }
            case 'operations_site_pump_dates': {
              if (eventType === 'INSERT') {
                setSitePumpDates(prev => {
                  if (prev.some(p => p.id === newRow.id)) return prev;
                  return [...prev, mapDbPumpDate(newRow)];
                });
              } else if (eventType === 'UPDATE') {
                setSitePumpDates(prev => prev.map(p => p.id === newRow.id ? mapDbPumpDate(newRow) : p));
              } else if (eventType === 'DELETE') {
                setSitePumpDates(prev => prev.filter(p => p.id !== oldRow.id));
              }
              break;
            }
            case 'operations_waybills': {
              if (eventType === 'INSERT') {
                setWaybills(prev => {
                  if (prev.some(w => w.id === newRow.id)) return prev;
                  return [...prev, mapDbWaybill(newRow)];
                });
              } else if (eventType === 'UPDATE') {
                setWaybills(prev => prev.map(w => w.id === newRow.id ? mapDbWaybill(newRow) : w));
              } else if (eventType === 'DELETE') {
                setWaybills(prev => prev.filter(w => w.id !== oldRow.id));
              }
              break;
            }
            case 'operations_checkouts': {
              if (eventType === 'INSERT') {
                setCheckouts(prev => {
                  if (prev.some(c => c.id === newRow.id)) return prev;
                  return [mapDbCheckout(newRow), ...prev];
                });
              } else if (eventType === 'UPDATE') {
                setCheckouts(prev => prev.map(c => c.id === newRow.id ? mapDbCheckout(newRow) : c));
              } else if (eventType === 'DELETE') {
                setCheckouts(prev => prev.filter(c => c.id !== oldRow.id));
              }
              break;
            }
            case 'operations_daily_logs': {
              if (eventType === 'INSERT') {
                setDailyMachineLogs(prev => {
                  if (prev.some(log => log.id === newRow.id)) return prev;
                  return [mapDbDailyLog(newRow), ...prev];
                });
              } else if (eventType === 'UPDATE') {
                setDailyMachineLogs(prev => prev.map(log => log.id === newRow.id ? mapDbDailyLog(newRow) : log));
              } else if (eventType === 'DELETE') {
                setDailyMachineLogs(prev => prev.filter(log => log.id !== oldRow.id));
              }
              break;
            }
            case 'operations_maintenance': {
              if (eventType === 'INSERT') {
                setMaintenanceSessions(prev => {
                  if (prev.some(m => m.id === newRow.id)) return prev;
                  return [...prev, mapDbMaintenance(newRow)];
                });
              } else if (eventType === 'UPDATE') {
                setMaintenanceSessions(prev => prev.map(m => m.id === newRow.id ? mapDbMaintenance(newRow) : m));
              } else if (eventType === 'DELETE') {
                setMaintenanceSessions(prev => prev.filter(m => m.id !== oldRow.id));
              }
              break;
            }
            case 'maintenance_certificates': {
              if (eventType === 'INSERT') {
                setMaintenanceCertificates(prev => {
                  if (prev.some(r => r.id === newRow.id)) return prev;
                  const updated = [mapDbCertificate(newRow), ...prev];
                  localStorage.setItem('dcel-maintenance-certificates', JSON.stringify(updated));
                  return updated;
                });
              } else if (eventType === 'UPDATE') {
                setMaintenanceCertificates(prev => {
                  const updated = prev.map(r => r.id === newRow.id ? mapDbCertificate(newRow) : r);
                  localStorage.setItem('dcel-maintenance-certificates', JSON.stringify(updated));
                  return updated;
                });
              } else if (eventType === 'DELETE') {
                setMaintenanceCertificates(prev => {
                  const updated = prev.filter(r => r.id !== oldRow.id);
                  localStorage.setItem('dcel-maintenance-certificates', JSON.stringify(updated));
                  return updated;
                });
              }
              break;
            }
            case 'vehicle_fuel_logs': {
              const mapFuel = (f: any): VehicleFuelLog => ({
                id: f.id,
                vehicle_id: f.vehicle_id,
                vehicle_reg: f.vehicle_reg,
                date: f.date,
                rate_per_litre: Number(f.rate_per_litre || 0),
                litres: Number(f.litres || 0),
                total_cost: Number(f.total_cost || 0),
                odometer: f.odometer ? Number(f.odometer) : undefined,
                filled_by: f.filled_by,
                notes: f.notes,
                created_at: f.created_at
              });
              if (eventType === 'INSERT') {
                setVehicleFuelLogs(prev => {
                  if (prev.some(f => f.id === newRow.id)) return prev;
                  return [mapFuel(newRow), ...prev];
                });
              } else if (eventType === 'UPDATE') {
                setVehicleFuelLogs(prev => prev.map(f => f.id === newRow.id ? mapFuel(newRow) : f));
              } else if (eventType === 'DELETE') {
                setVehicleFuelLogs(prev => prev.filter(f => f.id !== oldRow.id));
              }
              break;
            }
            case 'diesel_refills': {
              const mapRefill = (r: any): DieselRefill => ({
                id: r.id,
                date: r.date,
                siteId: r.site_id || '',
                siteName: r.site_name || '',
                totalLitres: Number(r.total_litres || 0),
                pricePerLitre: r.price_per_litre ? Number(r.price_per_litre) : undefined,
                totalCost: r.total_cost ? Number(r.total_cost) : undefined,
                purchasedBy: r.purchased_by,
                supplier: r.supplier,
                notes: r.notes,
                machineAllocations: r.machine_allocations || [],
                created_at: r.created_at,
                updated_at: r.updated_at,
              });
              if (eventType === 'INSERT') {
                setDieselRefills(prev => {
                  if (prev.some(r => r.id === newRow.id)) return prev;
                  return [mapRefill(newRow), ...prev];
                });
              } else if (eventType === 'UPDATE') {
                setDieselRefills(prev => prev.map(r => r.id === newRow.id ? mapRefill(newRow) : r));
              } else if (eventType === 'DELETE') {
                setDieselRefills(prev => prev.filter(r => r.id !== oldRow.id));
              }
              break;
            }
          }
        }
      )
      .subscribe((status, err) => {
        if (err) {
          console.error("Error setting up operations realtime:", err);
        } else {
          console.log("Operations realtime subscription status:", status);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const issueCertificate = async (cert: Omit<MaintenanceCertificate, 'id'>) => {
    const newCert: MaintenanceCertificate = { ...cert, id: crypto.randomUUID() };

    // Optimistic local update
    setMaintenanceCertificates(prev => {
      const updated = [newCert, ...prev];
      localStorage.setItem('dcel-maintenance-certificates', JSON.stringify(updated));
      return updated;
    });

    // Persist to Supabase
    try {
      const { error } = await supabase.from('maintenance_certificates').insert({
        id: newCert.id,
        cert_number: newCert.certNumber,
        machine_id: newCert.machineId,
        machine_name: newCert.machineName,
        machine_category: newCert.machineCategory,
        machine_site: newCert.machineSite,
        machine_serial: newCert.machineSerial,
        issued_date: newCert.issuedDate,
        expiry_date: newCert.expiryDate,
        issued_by_employee_id: newCert.issuedByEmployeeId,
        issued_by_name: newCert.issuedByName,
        issued_by_designation: newCert.issuedByDesignation,
        last_service_date: newCert.lastServiceDate,
        next_service_date: newCert.nextServiceDate,
        total_services: newCert.totalServices,
        compliance_standards: newCert.complianceStandards,
        conditions_of_operation: newCert.conditionsOfOperation,
        manufacturer: newCert.manufacturer,
        model_number: newCert.modelNumber,
        outcome_remarks: newCert.outcomeRemarks,
        last_inspection_date_override: newCert.lastInspectionDateOverride,
        issued_date_override: newCert.issuedDateOverride,
        criteria_compliance: newCert.criteriaCompliance,
      });
      if (error) throw error;
      toast.success(`Certificate ${newCert.certNumber} issued & saved`);
    } catch (err: any) {
      console.error('Failed to save certificate to Supabase:', err);
      toast.warning(`Certificate issued locally — sync failed: ${err.message || 'unknown error'}`);
    }
  };

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
      items: waybill.items,
      signature: waybill.signature,
      transfer_site_id: waybill.transferSiteId,
      transfer_site_name: waybill.transferSiteName
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
      const updated = prev.map(a => {
        if (a.id === id) {
          const newAsset = { ...a, ...updates };
          newAsset.availableQuantity = Math.max(0, newAsset.quantity - ((newAsset.reservedQuantity || 0) + (newAsset.missingQuantity || 0) + (newAsset.damagedQuantity || 0) + (newAsset.usedQuantity || 0)));
          return newAsset;
        }
        return a;
      });
      targetAsset = updated.find(a => a.id === id);
      return updated;
    });

    if (targetAsset) {
      try {
        await persistAsset(targetAsset);
        toast.success('Asset updated successfully');
      } catch (error) {
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

  const createWaybill = (waybill: Omit<Waybill, 'id' | 'status'> & { id?: string; status?: WaybillStatus }) => {
    const newWaybill: Waybill = {
      ...waybill,
      id: waybill.id || `WB-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
      status: waybill.status || 'outstanding',
    };

    if (newWaybill.type === 'waybill') {
      setAssets(prev => prev.map(asset => {
        const item = newWaybill.items.find(i => i.assetId === asset.id);
        if (item) {
          const reservedQuantity = asset.reservedQuantity + item.quantity;
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
    } else if (newWaybill.type === 'return' && newWaybill.status === 'return_completed') {
      setAssets(assetsPrev => assetsPrev.map(asset => {
        const item = newWaybill.items.find(i => i.assetId === asset.id);
        if (item) {
          const reservedQuantity = Math.max(0, asset.reservedQuantity - item.quantity);
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

      if (waybill.type === 'return' && status === 'outstanding' && waybill.status === 'return_completed') {
        setAssets(assetsPrev => assetsPrev.map(asset => {
          const item = waybill.items.find(i => i.assetId === asset.id);
          if (item) {
            const returnedGood = item.returnedGood || item.quantity;
            const returnedDamaged = item.returnedDamaged || 0;
            const returnedMissing = item.returnedMissing || 0;

            const reservedQuantity = asset.reservedQuantity + item.quantity;
            const damagedQuantity = Math.max(0, (asset.damagedQuantity || 0) - returnedDamaged);
            const missingQuantity = Math.max(0, (asset.missingQuantity || 0) - returnedMissing);
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
        ...(sentToSiteDate ? { 
          sentToSiteDate,
          issueDate: sentToSiteDate
        } : {}),
        ...(status === 'outstanding' && waybill.type === 'return' ? {
          items: waybill.items.map(item => {
            const { returnedGood, returnedDamaged, returnedMissing, ...rest } = item;
            return rest;
          })
        } : (returnConditions ? { 
          items: waybill.items.map(item => ({
            ...item,
            returnedGood: returnConditions[item.assetId]?.good || item.quantity,
            returnedDamaged: returnConditions[item.assetId]?.damaged || 0,
            returnedMissing: returnConditions[item.assetId]?.missing || 0,
          }))
        } : {}))
      };
      
      persistWaybill(updatedWaybill);

      return prev.map(w => w.id === id ? updatedWaybill : w);
    });
  };

  const updateWaybill = (id: string, updates: Partial<Omit<Waybill, 'id' | 'status'>>) => {
    setWaybills(prev => {
      const waybill = prev.find(w => w.id === id);
      if (!waybill || waybill.status !== 'outstanding') return prev;

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

    // DAILY JOURNAL SYNC
    setTimeout(() => {
      const appStore = useAppStore.getState();
      const existingJournal = appStore.dailyJournals.find(j => j.date === newSession.date);
      
      const narrationText = `Maintenance Logged - Tech: ${newSession.technician} | Type: ${newSession.type}\n` +
        `Remark: ${newSession.generalRemark || 'N/A'}\n` + 
        newSession.assets.map(a => `- ${a.assetName}: ${a.workDone || a.remark || 'Maintained'}`).join('\n');
      
      const newEntry = {
          id: `maint-${newSession.id}`,
          journalId: existingJournal ? existingJournal.id : `DJ-${newSession.date.replace(/-/g, '')}`,
          siteId: 'dcel-office',
          siteName: 'DCEL OFFICE',
          clientName: 'DCEL',
          narration: narrationText,
          createdAt: new Date().toISOString(),
          loggedBy: (user as any)?.user_metadata?.name || user?.email || 'Unknown User'
      };
      
      if (existingJournal) {
          let currentEntries = appStore.siteJournalEntries.filter(e => e.journalId === existingJournal.id);
          currentEntries = currentEntries.filter(e => e.id !== newEntry.id);
          currentEntries.push(newEntry);
          appStore.updateDailyJournal(existingJournal.id, existingJournal, currentEntries);
      } else {
          appStore.addDailyJournal({
              id: `DJ-${newSession.date.replace(/-/g, '')}`,
              date: newSession.date,
              generalNotes: 'Maintenance recorded.',
              loggedBy: (user as any)?.user_metadata?.name || user?.email || 'Unknown User',
              createdAt: new Date().toISOString()
          }, [newEntry]);
      }
    }, 0);
  };

  const updateMaintenance = (id: string, updates: Partial<Omit<MaintenanceSession, 'id'>>) => {
    setMaintenanceSessions(prev => {
      const oldSession = prev.find(s => s.id === id);
      if (!oldSession) return prev;

      if (updates.assets) {
        const oldParts = new Map<string, number>();
        oldSession.assets.forEach(asset => {
          asset.parts?.forEach(part => {
            if (part.type === 'inventory' && (part as any).id) {
              const partId = (part as any).id;
              oldParts.set(partId, (oldParts.get(partId) || 0) + (part.quantity || 1));
            }
          });
        });

        const newParts = new Map<string, number>();
        updates.assets.forEach(asset => {
          asset.parts?.forEach(part => {
            if (part.type === 'inventory' && (part as any).id) {
              const partId = (part as any).id;
              newParts.set(partId, (newParts.get(partId) || 0) + (part.quantity || 1));
            }
          });
        });

        const allPartIds = new Set([...oldParts.keys(), ...newParts.keys()]);
        
        allPartIds.forEach(partId => {
          const oldQty = oldParts.get(partId) || 0;
          const newQty = newParts.get(partId) || 0;
          const diff = oldQty - newQty;
          
          if (diff !== 0) {
            setAssets(assetsPrev => assetsPrev.map(a => {
              if (a.id === partId) {
                const updatedQty = Math.max(0, a.quantity + diff);
                const updatedAsset: Asset = {
                  ...a,
                  quantity: updatedQty,
                  availableQuantity: Math.max(0, updatedQty - ((a.reservedQuantity || 0) + (a.usedQuantity || 0) + (a.missingQuantity || 0) + (a.damagedQuantity || 0)))
                };
                persistAsset(updatedAsset);
                return updatedAsset;
              }
              return a;
            }));
          }
        });
      }

      const updatedSession = { ...oldSession, ...updates } as MaintenanceSession;
      persistMaintenance(updatedSession);

      // DAILY JOURNAL SYNC
      setTimeout(() => {
        const appStore = useAppStore.getState();
        const existingJournal = appStore.dailyJournals.find(j => j.date === updatedSession.date);
        
        const narrationText = `Maintenance Updated - Tech: ${updatedSession.technician} | Type: ${updatedSession.type}\n` +
          `Remark: ${updatedSession.generalRemark || 'N/A'}\n` + 
          updatedSession.assets.map(a => `- ${a.assetName}: ${a.workDone || a.remark || 'Maintained'}`).join('\n');
        
        const newEntry = {
            id: `maint-${updatedSession.id}`,
            journalId: existingJournal ? existingJournal.id : `DJ-${updatedSession.date.replace(/-/g, '')}`,
            siteId: 'dcel-office',
            siteName: 'DCEL OFFICE',
            clientName: 'DCEL',
            narration: narrationText,
            createdAt: new Date().toISOString(),
            loggedBy: (user as any)?.user_metadata?.name || user?.email || 'Unknown User'
        };
        
        if (existingJournal) {
            let currentEntries = appStore.siteJournalEntries.filter(e => e.journalId === existingJournal.id);
            currentEntries = currentEntries.filter(e => e.id !== newEntry.id);
            currentEntries.push(newEntry);
            appStore.updateDailyJournal(existingJournal.id, existingJournal, currentEntries);
        } else {
            appStore.addDailyJournal({
                id: `DJ-${updatedSession.date.replace(/-/g, '')}`,
                date: updatedSession.date,
                generalNotes: 'Maintenance updated.',
                loggedBy: (user as any)?.user_metadata?.name || user?.email || 'Unknown User',
                createdAt: new Date().toISOString()
            }, [newEntry]);
        }
      }, 0);

      return prev.map(s => s.id === id ? updatedSession : s);
    });
  };

  const getAssetAnalytics = () => {
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

  const persistSitePumpDates = async (assetId: string, siteId: string, pumpStartDate: string, pumpStopDate: string | null) => {
    try {
      const existing = sitePumpDates.find(p => p.assetId === assetId && p.siteId === siteId);
      const id = existing?.id || crypto.randomUUID();

      const payload = {
        id,
        asset_id: assetId,
        site_id: siteId,
        pump_start_date: pumpStartDate,
        pump_stop_date: pumpStopDate
      };

      const { data, error } = await supabase
        .from('operations_site_pump_dates')
        .upsert(payload, { onConflict: 'asset_id,site_id' })
        .select()
        .single();

      if (error) throw error;

      const newDateRecord: AssetPumpDate = {
        id: data.id,
        assetId: data.asset_id,
        siteId: data.site_id,
        pumpStartDate: data.pump_start_date,
        pumpStopDate: data.pump_stop_date,
        created_at: data.created_at
      };

      setSitePumpDates(prev => {
        const index = prev.findIndex(p => p.assetId === assetId && p.siteId === siteId);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = newDateRecord;
          return updated;
        }
        return [...prev, newDateRecord];
      });

      toast.success('Pump dates saved successfully');
    } catch (error: any) {
      console.error('Error persisting site pump dates:', error);
      toast.error(`Failed to save pump dates: ${error.message || 'Unknown error'}`);
      throw error;
    }
  };

  return (
    <OperationsContext.Provider value={{
      assets,
      waybills,
      checkouts,
      maintenanceAssets,
      maintenanceSessions,
      dailyMachineLogs,
      sitePumpDates,
      persistSitePumpDates,
      maintenanceCertificates,
      issueCertificate,
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
      updateMaintenance,
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
      logDailyActivity: async (logData: Omit<DailyMachineLog, 'id' | 'created_at'>) => {
        try {
          const payload = {
            asset_id: logData.assetId,
            asset_name: logData.assetName,
            site_id: logData.siteId,
            site_name: logData.siteName,
            date: logData.date,
            is_active: logData.isActive,
            operational_day: logData.operationalDay,
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
            operationalDay: data.operational_day,
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

        } catch (error) {
          console.error('Error logging daily activity:', error);
          throw error;
        }
      },
      deleteDailyLog: async (logId: string) => {
        try {
          const { error } = await supabase
            .from('operations_daily_logs')
            .delete()
            .eq('id', logId);

          if (error) throw error;

          setDailyMachineLogs(prev => prev.filter(l => l.id !== logId));
        } catch (error) {
          console.error('Error deleting daily log:', error);
          throw error;
        }
      },

      // ── Fuel Logs ──
      vehicleFuelLogs,
      addVehicleFuelLog: async (log: Omit<VehicleFuelLog, 'id' | 'created_at'>) => {
        const newLog: VehicleFuelLog = { ...log, id: crypto.randomUUID(), created_at: new Date().toISOString() };
        setVehicleFuelLogs(prev => [newLog, ...prev]);
        try {
          const { error } = await supabase.from('vehicle_fuel_logs').insert({
            id: newLog.id,
            vehicle_id: newLog.vehicle_id,
            vehicle_reg: newLog.vehicle_reg,
            date: newLog.date,
            rate_per_litre: newLog.rate_per_litre,
            litres: newLog.litres,
            total_cost: newLog.total_cost,
            odometer: newLog.odometer ?? null,
            filled_by: newLog.filled_by ?? null,
            notes: newLog.notes ?? null,
            created_at: newLog.created_at
          });
          if (error) throw error;
          toast.success('Fuel log saved');
        } catch (err: any) {
          console.error('Failed to save fuel log:', err);
          toast.warning(`Fuel log saved locally — sync failed`);
        }
      },
      updateVehicleFuelLog: async (id: string, updates: Partial<VehicleFuelLog>) => {
        setVehicleFuelLogs(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
        try {
          const { error } = await supabase.from('vehicle_fuel_logs').update({
            vehicle_id: updates.vehicle_id,
            vehicle_reg: updates.vehicle_reg,
            date: updates.date,
            rate_per_litre: updates.rate_per_litre,
            litres: updates.litres,
            total_cost: updates.total_cost,
            odometer: updates.odometer ?? null,
            filled_by: updates.filled_by ?? null,
            notes: updates.notes ?? null
          }).eq('id', id);
          if (error) throw error;
          toast.success('Fuel log updated');
        } catch (err: any) {
          console.error('Failed to update fuel log:', err);
          toast.warning('Fuel log updated locally — sync failed');
        }
      },
      deleteVehicleFuelLog: async (id: string) => {
        setVehicleFuelLogs(prev => prev.filter(f => f.id !== id));
        try {
          const { error } = await supabase.from('vehicle_fuel_logs').delete().eq('id', id);
          if (error) throw error;
          toast.success('Fuel log deleted');
        } catch (err: any) {
          console.error('Failed to delete fuel log:', err);
          toast.warning('Fuel log deleted locally — sync failed');
        }
      },

      // ── Diesel Refills ──────────────────────────────────────────────────────
      dieselRefills,
      addDieselRefill: async (refill) => {
        const newRefill: DieselRefill = {
          ...refill,
          id: crypto.randomUUID(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setDieselRefills(prev => [newRefill, ...prev]);
        try {
          const { error } = await supabase.from('diesel_refills').insert({
            id: newRefill.id,
            date: newRefill.date,
            site_id: newRefill.siteId,
            site_name: newRefill.siteName,
            total_litres: newRefill.totalLitres,
            price_per_litre: newRefill.pricePerLitre ?? null,
            total_cost: newRefill.totalCost ?? null,
            purchased_by: newRefill.purchasedBy ?? null,
            supplier: newRefill.supplier ?? null,
            notes: newRefill.notes ?? null,
            machine_allocations: newRefill.machineAllocations,
          });
          if (error) throw error;
          toast.success('Diesel refill logged');
        } catch (err: any) {
          console.error('Failed to save diesel refill:', err);
          toast.warning('Refill saved locally — sync failed');
        }
      },
      updateDieselRefill: async (id, updates) => {
        setDieselRefills(prev => prev.map(r => r.id === id ? { ...r, ...updates, updated_at: new Date().toISOString() } : r));
        try {
          const dbUpdates: Record<string, any> = { updated_at: new Date().toISOString() };
          if (updates.date !== undefined) dbUpdates.date = updates.date;
          if (updates.siteId !== undefined) dbUpdates.site_id = updates.siteId;
          if (updates.siteName !== undefined) dbUpdates.site_name = updates.siteName;
          if (updates.totalLitres !== undefined) dbUpdates.total_litres = updates.totalLitres;
          if (updates.pricePerLitre !== undefined) dbUpdates.price_per_litre = updates.pricePerLitre;
          if (updates.totalCost !== undefined) dbUpdates.total_cost = updates.totalCost;
          if (updates.purchasedBy !== undefined) dbUpdates.purchased_by = updates.purchasedBy;
          if (updates.supplier !== undefined) dbUpdates.supplier = updates.supplier;
          if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
          if (updates.machineAllocations !== undefined) dbUpdates.machine_allocations = updates.machineAllocations;
          const { error } = await supabase.from('diesel_refills').update(dbUpdates).eq('id', id);
          if (error) throw error;
          toast.success('Diesel refill updated');
        } catch (err: any) {
          console.error('Failed to update diesel refill:', err);
          toast.warning('Refill updated locally — sync failed');
        }
      },
      deleteDieselRefill: async (id) => {
        setDieselRefills(prev => prev.filter(r => r.id !== id));
        try {
          const { error } = await supabase.from('diesel_refills').delete().eq('id', id);
          if (error) throw error;
          toast.success('Diesel refill deleted');
        } catch (err: any) {
          console.error('Failed to delete diesel refill:', err);
          toast.warning('Refill deleted locally — sync failed');
        }
      },
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
