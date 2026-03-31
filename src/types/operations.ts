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

export interface MaintenanceSession {
  id: string;
  date: string;
  type: MaintenanceLogType;
  technician: string;
  generalRemark?: string;
  assets: {
    assetId: string;
    assetName: string;
    remark?: string;
  }[];
}
