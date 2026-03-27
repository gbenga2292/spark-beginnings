export type AssetCategory = 'dewatering' | 'waterproofing' | 'tiling' | 'ppe' | 'office' | 'all';
export type AssetType = 'consumable' | 'non-consumable' | 'tools' | 'equipment';
export type AssetCondition = 'good' | 'fair' | 'poor' | 'damaged' | 'missing';
export type AssetStatus = 'active' | 'archived';

export interface Asset {
  id: string;
  name: string;
  category: AssetCategory;
  type: AssetType;
  quantity: number;
  availableQuantity: number;
  unitOfMeasurement: string;
  status: AssetStatus;
  condition: AssetCondition;
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
