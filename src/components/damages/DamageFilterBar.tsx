import React from 'react';
import { Search, Filter, X, SlidersHorizontal } from 'lucide-react';
import { DamageLocationType, DamageItemType, DamageStatus } from '../../types/damage';

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (val: string) => void;
  selectedStatus: DamageStatus | 'all';
  onStatusChange: (status: DamageStatus | 'all') => void;
  selectedLocation: DamageLocationType | 'all';
  onLocationChange: (loc: DamageLocationType | 'all') => void;
  selectedItemType: DamageItemType | 'all';
  onItemTypeChange: (type: DamageItemType | 'all') => void;
  counts: {
    all: number;
    reported: number;
    under_assessment: number;
    in_repair: number;
    repaired: number;
    written_off: number;
    resolved: number;
  };
  onResetFilters: () => void;
  hasActiveFilters: boolean;
}

export function DamageFilterBar({
  searchQuery,
  onSearchChange,
  selectedStatus,
  onStatusChange,
  selectedLocation,
  onLocationChange,
  selectedItemType,
  onItemTypeChange,
  counts,
  onResetFilters,
  hasActiveFilters,
}: FilterBarProps) {
  const statusTabs: { id: DamageStatus | 'all'; label: string; count: number }[] = [
    { id: 'all', label: 'All Incidents', count: counts.all },
    { id: 'reported', label: 'Reported', count: counts.reported },
    { id: 'under_assessment', label: 'Under Assessment', count: counts.under_assessment },
    { id: 'in_repair', label: 'In Repair', count: counts.in_repair },
    { id: 'repaired', label: 'Repaired', count: counts.repaired },
    { id: 'written_off', label: 'Written Off', count: counts.written_off },
    { id: 'resolved', label: 'Resolved', count: counts.resolved },
  ];

  return (
    <div className="space-y-3 bg-card border border-border/70 rounded-xl p-3.5 shadow-xs">
      {/* Search and Secondary Filter Row */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search incident #, damaged item, location, personnel..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-sm bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Location Filter */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/40 px-2 py-1 rounded-lg border border-border/50">
            <Filter className="w-3.5 h-3.5" />
            <select
              value={selectedLocation}
              onChange={(e) => onLocationChange(e.target.value as any)}
              className="bg-transparent text-foreground text-xs font-medium focus:outline-none cursor-pointer"
            >
              <option value="all">All Locations</option>
              <option value="active_site">Active Site</option>
              <option value="old_site">Old Site</option>
              <option value="office">Office</option>
              <option value="warehouse">Warehouse</option>
              <option value="transit">In Transit</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Item Type Filter */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/40 px-2 py-1 rounded-lg border border-border/50">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <select
              value={selectedItemType}
              onChange={(e) => onItemTypeChange(e.target.value as any)}
              className="bg-transparent text-foreground text-xs font-medium focus:outline-none cursor-pointer"
            >
              <option value="all">All Item Types</option>
              <option value="asset">Machinery & Plant (Assets)</option>
              <option value="vehicle">Fleet Vehicles</option>
              <option value="office_fixture">Office Fixtures & Buildings</option>
              <option value="tool_equipment">Tools & Equipment</option>
              <option value="property">Client Property</option>
              <option value="other">Other</option>
            </select>
          </div>

          {hasActiveFilters && (
            <button
              onClick={onResetFilters}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted/60 transition-colors"
            >
              <X className="w-3 h-3" />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Status Badges Scrollable List */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
        {statusTabs.map((tab) => {
          const isActive = selectedStatus === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onStatusChange(tab.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-2xs font-semibold'
                  : 'bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  isActive
                    ? 'bg-primary-foreground/20 text-primary-foreground font-bold'
                    : 'bg-muted-foreground/15 text-muted-foreground'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
