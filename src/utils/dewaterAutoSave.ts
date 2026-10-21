import { cacheGet, cacheSet, cacheDelete } from '../lib/offlineCache';
import type { LineData, PlacedComponent, DimensionData, AreaData, HoseData, ArrowData, TextData, ElevationLevel } from './simulationLogic';
import type { CADLayer } from './cadDataModels';

export interface BlueprintSettings {
  visible: boolean;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  opacity: number;
  locked: boolean;
}

export const DEWATER_AUTOSAVE_CACHE_KEY = 'dewatering_cad_autosave_draft_v1';
export const DEWATER_BLUEPRINT_BLOB_CACHE_KEY = 'dewatering_cad_blueprint_blob_v1';

export interface DewaterDraftData {
  savedAt: string;
  name?: string;
  layoutId?: string | null;
  lines: LineData[];
  placedComponents: PlacedComponent[];
  dimensions: DimensionData[];
  areas: AreaData[];
  hoses: HoseData[];
  arrows: ArrowData[];
  texts: TextData[];
  levels?: ElevationLevel[];
  activeLevelId?: string;
  layers?: CADLayer[];
  activeLayerId?: string;
  blueprintSettings?: BlueprintSettings;
  hasBlueprintImage?: boolean;
  backgroundImageUrl?: string | null;
  itemCount: number;
}

/** Check if there are meaningful elements in the draft */
export function hasDraftContent(draft: DewaterDraftData | null | undefined): boolean {
  if (!draft) return false;
  return (
    (draft.lines?.length || 0) > 0 ||
    (draft.placedComponents?.length || 0) > 0 ||
    (draft.dimensions?.length || 0) > 0 ||
    (draft.areas?.length || 0) > 0 ||
    (draft.hoses?.length || 0) > 0 ||
    (draft.texts?.length || 0) > 0 ||
    !!draft.hasBlueprintImage
  );
}

/** Save drawing state to local offline IndexedDB cache */
export async function saveDewaterDraft(data: Omit<DewaterDraftData, 'savedAt' | 'itemCount'>, blueprintFile?: Blob | null): Promise<void> {
  try {
    const itemCount = 
      (data.lines?.length || 0) +
      (data.placedComponents?.length || 0) +
      (data.dimensions?.length || 0) +
      (data.areas?.length || 0) +
      (data.hoses?.length || 0) +
      (data.arrows?.length || 0) +
      (data.texts?.length || 0);

    const draft: DewaterDraftData = {
      ...data,
      savedAt: new Date().toISOString(),
      itemCount,
      hasBlueprintImage: !!blueprintFile || !!data.backgroundImageUrl
    };

    await cacheSet(DEWATER_AUTOSAVE_CACHE_KEY, draft);

    // Save blueprint blob separately if provided
    if (blueprintFile) {
      await cacheSet(DEWATER_BLUEPRINT_BLOB_CACHE_KEY, blueprintFile);
    }
  } catch (err) {
    console.warn('[DewaterAutoSave] Failed to save draft locally:', err);
  }
}

/** Load drawing draft from local offline IndexedDB cache */
export async function loadDewaterDraft(): Promise<{
  draft: DewaterDraftData | null;
  blueprintBlob: Blob | null;
}> {
  try {
    const draftEntry = await cacheGet<DewaterDraftData>(DEWATER_AUTOSAVE_CACHE_KEY);
    const blobEntry = await cacheGet<Blob>(DEWATER_BLUEPRINT_BLOB_CACHE_KEY);

    return {
      draft: draftEntry?.data || null,
      blueprintBlob: blobEntry?.data || null
    };
  } catch (err) {
    console.warn('[DewaterAutoSave] Failed to load draft locally:', err);
    return { draft: null, blueprintBlob: null };
  }
}

/** Clear the auto-saved draft */
export async function clearDewaterDraft(): Promise<void> {
  try {
    await cacheDelete(DEWATER_AUTOSAVE_CACHE_KEY);
    await cacheDelete(DEWATER_BLUEPRINT_BLOB_CACHE_KEY);
  } catch (err) {
    console.warn('[DewaterAutoSave] Failed to clear draft:', err);
  }
}
