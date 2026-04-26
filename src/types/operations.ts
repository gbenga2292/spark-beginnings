export type AssetCategory = 'dewatering' | 'waterproofing' | 'tiling' | 'ppe' | 'office' | 'all';
export type AssetType = 'consumable' | 'non-consumable' | 'tools' | 'equipment' | 'reusables';
export type AssetCondition = 'good' | 'fair' | 'poor' | 'damaged' | 'missing';
export type AssetStatus = 'active' | 'archived';

export interface RestockRecord {
  id: string;
  assetId: string;
  quantity: number;
  totalCost: number;
  unitCost: number;
  date: string;
}

export interface Asset {
  id: string;
  name: string;
  description?: string;
  category: AssetCategory;
  type: AssetType;
  quantity: number;
  availableQuantity: number;
  reservedQuantity: number;
  missingQuantity: number;
  damagedQuantity: number;
  usedQuantity: number;
  unitOfMeasurement: string;
  cost?: number;
  lowStockLevel?: number;
  criticalStockLevel?: number;
  status: AssetStatus;
  condition: AssetCondition;
  location: string;
  powerSource?: string;
  requiresLogging?: boolean;
  serialNumber?: string;
  serviceIntervalMonths?: number;
  restockHistory?: RestockRecord[];
  created_at?: string;
}

export type WaybillStatus = 
  | 'outstanding' 
  | 'sent_to_site' 
  | 'partial_returned' 
  | 'return_completed' 
  | 'open';

export type WaybillType = 'waybill' | 'return';

export interface WaybillItem {
  assetId: string;
  assetName: string;
  quantity: number;
  returnedGood?: number;
  returnedDamaged?: number;
  returnedMissing?: number;
}

export interface Waybill {
  id: string;
  type: WaybillType;
  status: WaybillStatus;
  siteId: string;
  siteName?: string;
  driverName?: string;
  vehicle?: string;
  issueDate: string;
  sentToSiteDate?: string;
  items: WaybillItem[];
  created_at?: string;
}

export interface SiteAsset {
  assetId: string;
  assetName: string;
  quantity: number;
  lastUpdated: string;
}

export interface OperationalSite {
  id: string;
  name: string;
  location?: string;
  inventory: SiteAsset[];
  activeWaybills: string[]; // IDs
}

export type CheckoutStatus = 'outstanding' | 'returned' | 'partial_returned';

export interface Checkout {
  id: string;
  assetId: string;
  assetName: string;
  quantity: number;
  returnedQuantity: number;
  employeeId: string;
  employeeName: string;
  checkoutDate: string;
  returnInDays: number;
  expectedReturnDate?: string;
  status: CheckoutStatus;
}

export type ServiceStatus = 'ok' | 'due_soon' | 'overdue' | 'in_service';
export type MaintenanceLogType = 'scheduled' | 'repair' | 'routine' | 'emergency';

export interface MaintenanceRecord {
  id: string;
  assetId: string;
  assetName: string;
  date: string;
  type: MaintenanceLogType;
  technician: string;
  remark?: string;
  cost: number;
  downtimeHours?: number;
}

export interface MaintenanceAsset {
  id: string;
  name: string;
  serialNumber?: string;
  category: 'machine' | 'vehicle';
  site: string;
  lastServiceDate: string;
  nextServiceDate: string;
  serviceIntervalMonths: number;
  status: ServiceStatus;
  pattern: string;
  totalMaintenanceRecords: number;
  isActive: boolean;
}

export interface MaintenanceAssetLog {
  assetId: string;
  assetName: string;
  remark?: string;
  workDone?: string;
  location?: string;
  shutdown?: boolean;
  cost: number;
  parts?: {
    type: 'inventory' | 'custom';
    name: string;
    quantity: number;
    cost: number;
  }[];
  date?: string;
  technician?: string;
  type?: MaintenanceLogType;
}

export interface MaintenanceSession {
  id: string;
  date: string;
  type: MaintenanceLogType;
  technician: string;
  generalRemark?: string;
  assets: MaintenanceAssetLog[];
}
export interface VehicleDocumentType {
  id: string;
  name: string;
  created_at?: string;
}

export interface Vehicle {
  id: string;
  name: string;
  type?: string;
  registration_number: string;
  status: 'active' | 'inactive';
  documents?: Record<string, string>; // Mapping of document type name (or ID) to expiry date
  created_at?: string;
  updated_at?: string;
}

export interface VehicleTripLeg {
  id?: string;
  vehicle_id: string;
  vehicle_reg: string;
  driver_name: string;
  site_id?: string;
  site_name: string;
  purpose: string;
  departure_time: string;
  arrival_time?: string;
  remark?: string;
  odometer_start?: number;
  odometer_end?: number;
}

export interface VehicleDailyLog {
  date: string;
  vehicle_id: string;
  vehicle_reg: string;
  driver_name: string;
  driver_employee_id?: string;
  legs: VehicleTripLeg[];
}
export interface DowntimeEntry {
  id: string;
  reason: string;
  durationHours: number;
  severity: 'low' | 'medium' | 'high';
  timestamp: string;
}

export interface DailyMachineLog {
  id: string;
  assetId: string;
  assetName: string;
  siteId: string;
  siteName: string;
  date: string;
  isActive: boolean;
  downtimeEntries: DowntimeEntry[];
  maintenanceDetails?: string;
  clientFeedback?: string;
  issuesOnSite?: string;
  dieselUsage: number;
  supervisorOnSite?: string;
  loggedBy?: string;
  created_at?: string;
}
