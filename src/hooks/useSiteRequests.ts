import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/src/integrations/supabase/client';
import { useWorkspace } from '@/src/hooks/use-workspace';
import { useUserStore } from '@/src/store/userStore';
import {
  SiteRequest, SiteRequestUpdate, SiteRequestStatus,
  CreateSiteRequestPayload,
} from '@/src/types/siteRequests';

function toRequest(row: any): SiteRequest {
  return {
    id:               row.id,
    workspaceId:      row.workspace_id,
    siteId:           row.site_id ?? undefined,
    siteName:         row.site_name ?? undefined,
    requestedById:    row.requested_by_id ?? undefined,
    requestedByName:  row.requested_by_name,
    requestedByRole:  row.requested_by_role ?? undefined,
    category:         row.category,
    item:             row.item,
    quantity:         row.quantity ?? undefined,
    unit:             row.unit ?? undefined,
    urgency:          row.urgency,
    requestDate:      row.request_date ?? (row.created_at ? row.created_at.split('T')[0] : undefined),
    neededByDate:     row.needed_by_date ?? undefined,
    status:           row.status,
    rejectionReason:  row.rejection_reason ?? undefined,
    fulfilmentNote:   row.fulfilment_note ?? undefined,
    assignedToId:     row.assigned_to_id ?? undefined,
    assignedToName:   row.assigned_to_name ?? undefined,
    linkedWaybillId:  row.linked_waybill_id ?? undefined,
    linkedCheckoutId: row.linked_checkout_id ?? undefined,
    loggedById:       row.logged_by_id ?? undefined,
    loggedByName:     row.logged_by_name ?? undefined,
    createdAt:        row.created_at,
    updatedAt:        row.updated_at,
  };
}

function toUpdate(row: any): SiteRequestUpdate {
  return {
    id:          row.id,
    requestId:   row.request_id,
    workspaceId: row.workspace_id,
    authorName:  row.author_name,
    authorId:    row.author_id ?? undefined,
    statusFrom:  row.status_from ?? undefined,
    statusTo:    row.status_to ?? undefined,
    note:        row.note ?? undefined,
    createdAt:   row.created_at,
  };
}

export function useSiteRequests() {
  const { workspace } = useWorkspace();
  const currentUser = useUserStore((s) => s.getCurrentUser());
  const workspaceId = currentUser?.workspaceId || workspace?.id || 'dcel-team';
  const currentUserName = currentUser?.name || currentUser?.email || 'Unknown';
  const currentUserId   = currentUser?.id;

  const [requests, setRequests]       = useState<SiteRequest[]>([]);
  const [loading, setLoading]         = useState(true);

  const fetchRequests = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('site_requests')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });
    if (!error && data) setRequests(data.map(toRequest));
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  // ── Create ─────────────────────────────────────────────────────────────────
  const createRequest = useCallback(async (payload: CreateSiteRequestPayload): Promise<SiteRequest | null> => {
    if (!workspaceId) return null;
    const { data, error } = await supabase
      .from('site_requests')
      .insert({
        workspace_id:      workspaceId,
        site_id:           payload.siteId ?? null,
        site_name:         payload.siteName ?? null,
        requested_by_id:   payload.requestedById ?? null,
        requested_by_name: payload.requestedByName,
        requested_by_role: payload.requestedByRole ?? null,
        category:          payload.category,
        item:              payload.item,
        quantity:          payload.quantity ?? null,
        unit:              payload.unit ?? null,
        urgency:           payload.urgency,
        needed_by_date:    payload.neededByDate ?? null,
        request_date:      payload.requestDate ?? new Date().toISOString().split('T')[0],
        status:            'pending',
        logged_by_id:      currentUserId ?? null,
        logged_by_name:    currentUserName,
      })
      .select()
      .single();

    if (error || !data) return null;
    const req = toRequest(data);

    // Auto-log first update
    await supabase.from('site_request_updates').insert({
      request_id:   req.id,
      workspace_id: workspaceId,
      author_name:  currentUserName,
      author_id:    currentUserId ?? null,
      status_from:  null,
      status_to:    'pending',
      note:         `Request submitted by ${payload.requestedByName}`,
    });

    setRequests(prev => [req, ...prev]);
    return req;
  }, [workspaceId, currentUserId, currentUserName]);

  // ── Update Status ──────────────────────────────────────────────────────────
  const updateStatus = useCallback(async (
    id: string,
    newStatus: SiteRequestStatus,
    note?: string,
    extra?: Partial<Pick<SiteRequest, 'rejectionReason' | 'fulfilmentNote' | 'assignedToName' | 'assignedToId'>>
  ) => {
    if (!workspaceId) return;
    const existing = requests.find(r => r.id === id);
    if (!existing) return;

    const updates: any = { status: newStatus };
    if (extra?.rejectionReason !== undefined) updates.rejection_reason = extra.rejectionReason;
    if (extra?.fulfilmentNote  !== undefined) updates.fulfilment_note  = extra.fulfilmentNote;
    if (extra?.assignedToName  !== undefined) updates.assigned_to_name = extra.assignedToName;
    if (extra?.assignedToId    !== undefined) updates.assigned_to_id   = extra.assignedToId;

    const { error } = await supabase
      .from('site_requests')
      .update(updates)
      .eq('id', id);

    if (error) return;

    await supabase.from('site_request_updates').insert({
      request_id:   id,
      workspace_id: workspaceId,
      author_name:  currentUserName,
      author_id:    currentUserId ?? null,
      status_from:  existing.status,
      status_to:    newStatus,
      note:         note ?? null,
    });

    setRequests(prev => prev.map(r =>
      r.id === id ? { ...r, status: newStatus, ...extra } : r
    ));
  }, [workspaceId, requests, currentUserId, currentUserName]);

  // ── Add Comment ────────────────────────────────────────────────────────────
  const addComment = useCallback(async (requestId: string, note: string) => {
    if (!workspaceId || !note.trim()) return;
    await supabase.from('site_request_updates').insert({
      request_id:   requestId,
      workspace_id: workspaceId,
      author_name:  currentUserName,
      author_id:    currentUserId ?? null,
      status_from:  null,
      status_to:    null,
      note:         note.trim(),
    });
  }, [workspaceId, currentUserId, currentUserName]);

  // ── Fetch Updates for a request ────────────────────────────────────────────
  const fetchUpdates = useCallback(async (requestId: string): Promise<SiteRequestUpdate[]> => {
    const { data } = await supabase
      .from('site_request_updates')
      .select('*')
      .eq('request_id', requestId)
      .order('created_at', { ascending: true });
    return (data ?? []).map(toUpdate);
  }, []);

  // ── Edit ───────────────────────────────────────────────────────────────────
  const editRequest = useCallback(async (
    id: string,
    payload: Partial<CreateSiteRequestPayload>
  ): Promise<boolean> => {
    if (!workspaceId) return false;
    const updates: any = {};
    if (payload.siteId !== undefined) updates.site_id = payload.siteId ?? null;
    if (payload.siteName !== undefined) updates.site_name = payload.siteName ?? null;
    if (payload.requestedById !== undefined) updates.requested_by_id = payload.requestedById ?? null;
    if (payload.requestedByName !== undefined) updates.requested_by_name = payload.requestedByName;
    if (payload.requestedByRole !== undefined) updates.requested_by_role = payload.requestedByRole ?? null;
    if (payload.category !== undefined) updates.category = payload.category;
    if (payload.item !== undefined) updates.item = payload.item;
    if (payload.quantity !== undefined) updates.quantity = payload.quantity ?? null;
    if (payload.unit !== undefined) updates.unit = payload.unit ?? null;
    if (payload.urgency !== undefined) updates.urgency = payload.urgency;
    if (payload.requestDate !== undefined) updates.request_date = payload.requestDate ?? null;
    if (payload.neededByDate !== undefined) updates.needed_by_date = payload.neededByDate ?? null;

    const { error } = await supabase
      .from('site_requests')
      .update(updates)
      .eq('id', id);

    if (error) return false;

    await supabase.from('site_request_updates').insert({
      request_id:   id,
      workspace_id: workspaceId,
      author_name:  currentUserName,
      author_id:    currentUserId ?? null,
      status_from:  null,
      status_to:    null,
      note:         `Request updated by ${currentUserName}`,
    });

    setRequests(prev => prev.map(r => r.id === id ? { ...r, ...payload } : r));
    return true;
  }, [workspaceId, currentUserName, currentUserId]);

  // ── Delete ─────────────────────────────────────────────────────────────────
  const deleteRequest = useCallback(async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('site_requests').delete().eq('id', id);
    if (!error) {
      setRequests(prev => prev.filter(r => r.id !== id));
      return true;
    }
    return false;
  }, []);

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return {
    requests,
    loading,
    pendingCount,
    fetchRequests,
    createRequest,
    editRequest,
    updateStatus,
    addComment,
    fetchUpdates,
    deleteRequest,
  };
}
