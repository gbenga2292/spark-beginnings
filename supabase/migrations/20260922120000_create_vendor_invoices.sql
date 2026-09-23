-- ─── Vendor Invoices ─────────────────────────────────────────────────────────
-- Records invoices issued TO the company by vendors for services rendered.
-- Each invoice can have multiple partial payments tracked separately.

create table if not exists vendor_invoices (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    text not null default 'dcel-team',
  invoice_number  text not null,
  vendor_id       text,           -- references ledger_vendors.id (soft ref)
  vendor_name     text not null,
  date_received   date not null,
  due_date        date,
  description     text not null,
  total_amount    numeric(15,2) not null check (total_amount > 0),
  status          text not null default 'unpaid'
                    check (status in ('unpaid', 'partial', 'paid')),
  notes           text,
  entered_by      text not null,
  created_at      timestamptz not null default now()
);

-- ─── Vendor Invoice Payments ──────────────────────────────────────────────────
-- One row per payment made against a vendor invoice.

create table if not exists vendor_invoice_payments (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        text not null default 'dcel-team',
  invoice_id          uuid not null references vendor_invoices(id) on delete cascade,
  payment_date        date not null,
  amount_paid         numeric(15,2) not null check (amount_paid > 0),
  paid_from_bank      text not null,
  paid_to_bank_name   text,
  paid_to_account_no  text,
  ledger_entry_id     text,        -- nullable link to ledger_entries.id
  notes               text,
  entered_by          text not null,
  created_at          timestamptz not null default now()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
create index if not exists idx_vendor_invoices_workspace
  on vendor_invoices(workspace_id);

create index if not exists idx_vendor_invoices_date
  on vendor_invoices(workspace_id, date_received desc);

create index if not exists idx_vendor_invoices_vendor
  on vendor_invoices(workspace_id, vendor_name);

create index if not exists idx_vendor_invoices_status
  on vendor_invoices(workspace_id, status);

create index if not exists idx_vendor_invoice_payments_invoice
  on vendor_invoice_payments(invoice_id);

create index if not exists idx_vendor_invoice_payments_workspace
  on vendor_invoice_payments(workspace_id);

create index if not exists idx_vendor_invoice_payments_date
  on vendor_invoice_payments(workspace_id, payment_date desc);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
alter table vendor_invoices enable row level security;
alter table vendor_invoice_payments enable row level security;

-- Authenticated users can read/write within their workspace
create policy "vendor_invoices_select" on vendor_invoices
  for select using (auth.role() = 'authenticated');

create policy "vendor_invoices_insert" on vendor_invoices
  for insert with check (auth.role() = 'authenticated');

create policy "vendor_invoices_update" on vendor_invoices
  for update using (auth.role() = 'authenticated');

create policy "vendor_invoices_delete" on vendor_invoices
  for delete using (auth.role() = 'authenticated');

create policy "vendor_invoice_payments_select" on vendor_invoice_payments
  for select using (auth.role() = 'authenticated');

create policy "vendor_invoice_payments_insert" on vendor_invoice_payments
  for insert with check (auth.role() = 'authenticated');

create policy "vendor_invoice_payments_update" on vendor_invoice_payments
  for update using (auth.role() = 'authenticated');

create policy "vendor_invoice_payments_delete" on vendor_invoice_payments
  for delete using (auth.role() = 'authenticated');

-- ─── Realtime ────────────────────────────────────────────────────────────────
alter publication supabase_realtime add table vendor_invoices;
alter publication supabase_realtime add table vendor_invoice_payments;
