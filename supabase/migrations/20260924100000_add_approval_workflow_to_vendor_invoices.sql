-- Add approval workflow, versioning, line items, and negotiation tracking to vendor_invoices
ALTER TABLE public.vendor_invoices
  ADD COLUMN IF NOT EXISTS approval_status text DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS approver_id text,
  ADD COLUMN IF NOT EXISTS approver_name text,
  ADD COLUMN IF NOT EXISTS approval_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS versions jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS initial_amount numeric,
  ADD COLUMN IF NOT EXISTS line_items text;

-- Index for filtering pending approvals by workspace and approver
CREATE INDEX IF NOT EXISTS idx_vendor_invoices_approval_status
  ON public.vendor_invoices (workspace_id, approval_status);

CREATE INDEX IF NOT EXISTS idx_vendor_invoices_approver
  ON public.vendor_invoices (approver_id, approval_status);
