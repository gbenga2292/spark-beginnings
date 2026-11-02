export type DamageLocationType = 'active_site' | 'old_site' | 'office' | 'warehouse' | 'transit' | 'other';

export type DamageItemType =
  | 'asset'
  | 'vehicle'
  | 'office_fixture'
  | 'tool_equipment'
  | 'property'
  | 'other';

export type DamageSeverity = 'minor' | 'moderate' | 'severe' | 'critical';

export type DamageStatus =
  | 'reported'
  | 'under_assessment'
  | 'in_repair'
  | 'repaired'
  | 'written_off'
  | 'resolved';

export type DamageCauseCategory =
  | 'operator_error'
  | 'wear_tear'
  | 'accident'
  | 'weather'
  | 'malfunction'
  | 'third_party'
  | 'other';

export type DamageFaultAttribution =
  | 'client'
  | 'dcel_personnel'
  | 'act_of_god';

export interface DamagePhoto {
  name: string;
  url: string;
  type?: string;
  uploaded_at?: string;
  size?: number;
}

export interface DamageLog {
  id: string;
  incident_number: string;
  incident_date: string;
  
  // Location details
  location_type: DamageLocationType;
  site_id?: string | null;
  specific_location?: string | null;
  
  // Damaged item details
  item_type: DamageItemType;
  asset_id?: string | null;
  vehicle_id?: string | null;
  item_name: string;
  quantity_damaged?: number | null;
  
  // Severity & Status
  severity: DamageSeverity;
  status: DamageStatus;
  
  // Personnel & Narrative
  reported_by?: string | null;
  reported_by_name?: string | null;
  personnel_involved?: string | null;
  cause_category: DamageCauseCategory;
  cause_notes?: string | null;
  description: string;
  
  // Financial & Fault Assessment
  estimated_repair_cost: number;
  actual_repair_cost: number;
  fault_attribution: DamageFaultAttribution;
  
  // Photos / Evidence
  photos: DamagePhoto[];
  
  // Sign-off
  signed_off_by?: string | null;
  signed_off_by_name?: string | null;
  signed_off_at?: string | null;
  resolution_notes?: string | null;
  
  // Timestamps
  created_at: string;
  updated_at: string;
  
  // Joined relation fields (optional UI helpers)
  site_name?: string;
  asset_code?: string;
  vehicle_plate?: string;
}
