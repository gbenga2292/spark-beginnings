import type { AgentOperationalContext, ActionProposal, ActionPayload } from '@/src/types/agent';
import { useAppStore } from '@/src/store/appStore';

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

/** Compute next voucher number adhering strictly to Ledger sequence rule: VNYY-MM-DD-SEQ */
export function generateNextVoucherNo(voucherDate: string): string {
  const ledgerEntries = useAppStore.getState().ledgerEntries || [];
  const dateObj = new Date(voucherDate || new Date());
  if (isNaN(dateObj.getTime())) return '';
  const yy = String(dateObj.getFullYear()).slice(-2);
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const dd = String(dateObj.getDate()).padStart(2, '0');
  const prefix = `VN${yy}-${mm}-${dd}-`;
  
  let maxSeq = 0;
  ledgerEntries.forEach((e) => {
    if (e.voucherNo && e.voucherNo.startsWith(prefix)) {
      const seqStr = e.voucherNo.replace(prefix, '');
      const seq = parseInt(seqStr, 10);
      if (!isNaN(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }
  });
  const newSeq = String(maxSeq + 1).padStart(2, '0');
  return `${prefix}${newSeq}`;
}

export const ALL_AGENT_TOOLS: ToolDefinition[] = [
  {
    name: 'propose_site_diary',
    description: 'Propose a Site Diary or Daily Progress Log entry for a construction/dewatering site.',
    parameters: {
      type: 'object',
      properties: {
        site_id: { type: 'string', description: 'The UUID of the site. If unknown, leave blank and specify site_name.' },
        site_name: { type: 'string', description: 'Exact or matching name of the site/project' },
        client_name: { type: 'string', description: 'Client name if known (e.g. South Energyx, Elfad, Darycet)' },
        date: { type: 'string', description: 'Date of the log in YYYY-MM-DD format. Default is today or yesterday as specified.' },
        narration: { type: 'string', description: 'Detailed account of site activities, milestones, progress, concrete casts, dewatering status.' },
        progress_percentage: { type: 'number', description: 'Estimated percentage of project progress (0 to 100) if mentioned.' },
        dewatering_stage: { 
          type: 'string', 
          enum: ['mobilization', 'installation', 'jetting', 'rejetting', 'operation', 'demobilisation'],
          description: 'Current dewatering or construction stage'
        },
        general_notes: { type: 'string', description: 'Weather conditions, site challenges, contractor interactions, or safety remarks.' },
      },
      required: ['narration'],
    },
  },
  {
    name: 'propose_attendance_summary',
    description: 'Propose a workforce headcount or attendance report for a site.',
    parameters: {
      type: 'object',
      properties: {
        site_id: { type: 'string', description: 'The UUID of the site' },
        site_name: { type: 'string', description: 'Name of the site' },
        date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
        total_present: { type: 'number', description: 'Total number of personnel/workers on site' },
        notes: { type: 'string', description: 'Summary notes, absenteeism reasons, or trade breakdowns' },
        trade_breakdown: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              trade: { type: 'string', description: 'e.g. Masons, Carpenters, Operators, Laborers' },
              count: { type: 'number', description: 'Number of workers in this trade' },
            },
            required: ['trade', 'count'],
          },
          description: 'Breakdown of personnel by trade or craft',
        },
      },
      required: ['total_present'],
    },
  },
  {
    name: 'propose_incident_log',
    description: 'Propose a safety incident, near-miss hazard, or staff merit/conduct record.',
    parameters: {
      type: 'object',
      properties: {
        site_id: { type: 'string', description: 'The UUID of the site' },
        site_name: { type: 'string', description: 'Name of the site' },
        incident_date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
        record_type: { type: 'string', enum: ['Infringement', 'Accolade'], description: 'Infringement for hazard/violation, Accolade for praise' },
        category: {
          type: 'string',
          enum: ['Behaviour on Site', 'Dress Code', 'PPE Maintenance', 'Client Accolade', 'Client Complaint', 'Other'],
          description: 'Category of the incident',
        },
        description: { type: 'string', description: 'Detailed factual description of what occurred, safety impact, and immediate remedies.' },
        employee_name: { type: 'string', description: 'Name of individual involved (if applicable)' },
        hr_notified: { type: 'boolean', description: 'Whether HR or HSE management needs notification' },
      },
      required: ['description', 'category'],
    },
  },
  {
    name: 'propose_diesel_refill',
    description: 'Propose a fuel / diesel refill log for site generators or equipment.',
    parameters: {
      type: 'object',
      properties: {
        site_id: { type: 'string', description: 'The UUID of the site' },
        site_name: { type: 'string', description: 'Name of the site' },
        date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
        total_litres: { type: 'number', description: 'Total volume in litres refilled' },
        price_per_litre: { type: 'number', description: 'Unit cost per litre if specified' },
        supplier: { type: 'string', description: 'Fuel supplier or vendor name' },
        notes: { type: 'string', description: 'General remarks or pump hour meter reading' },
        machine_name: { type: 'string', description: 'Name of generator, excavator, or pump refueled' },
      },
      required: ['total_litres'],
    },
  },
  {
    name: 'propose_consumable_burn',
    description: 'Propose burning / consuming materials or consumables from inventory on site (e.g. cement bags, chemicals, pipes).',
    parameters: {
      type: 'object',
      properties: {
        site_id: { type: 'string', description: 'The UUID of the site' },
        site_name: { type: 'string', description: 'Name of the site' },
        date: { type: 'string', description: 'Date of consumption in YYYY-MM-DD format' },
        asset_name: { type: 'string', description: 'Name of the material/consumable (e.g. Cement, Waterproofing chemical)' },
        quantity: { type: 'number', description: 'Amount consumed' },
        unit: { type: 'string', description: 'Unit of measurement (e.g. bags, drums, meters, liters)' },
        reason: { type: 'string', description: 'Purpose / work section where material was used' },
      },
      required: ['asset_name', 'quantity'],
    },
  },
  {
    name: 'propose_maintenance_ticket',
    description: 'Propose an equipment breakdown, emergency repair, or routine maintenance session for site machinery.',
    parameters: {
      type: 'object',
      properties: {
        site_id: { type: 'string', description: 'The UUID of the site' },
        site_name: { type: 'string', description: 'Name of the site' },
        date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
        asset_name: { type: 'string', description: 'Name of machine or vehicle (e.g. CAT 320 Excavator, 6-inch Pump)' },
        type: { type: 'string', enum: ['emergency', 'repair', 'scheduled', 'routine'], description: 'Type of maintenance' },
        remark: { type: 'string', description: 'Observed breakdown, symptoms, or repair needed' },
        technician: { type: 'string', description: 'Name of mechanic, vendor, or technician' },
        downtime_hours: { type: 'number', description: 'Hours of machine downtime if applicable' },
      },
      required: ['asset_name', 'remark'],
    },
  },
  {
    name: 'propose_site_task',
    description: 'Propose creating an action item or assigned task for a site team member.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Clear actionable task title' },
        description: { type: 'string', description: 'Details or instructions for the task' },
        site_id: { type: 'string', description: 'The UUID of the site' },
        site_name: { type: 'string', description: 'Name of the site' },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'], description: 'Task priority level' },
        due_date: { type: 'string', description: 'Due date in YYYY-MM-DD format' },
        assignee_name: { type: 'string', description: 'Name of assigned staff member' },
      },
      required: ['title'],
    },
  },
  {
    name: 'propose_create_invoice',
    description: 'Propose creating an invoice for a client or project with line totals, billing cycle, and VAT calculations.',
    parameters: {
      type: 'object',
      properties: {
        client: { type: 'string', description: 'Name of client being invoiced' },
        site_name: { type: 'string', description: 'Site or Project name' },
        invoice_number: { type: 'string', description: 'Unique invoice number (e.g. INV-2026-001). Leave blank to auto-generate.' },
        amount: { type: 'number', description: 'Total invoice amount before VAT' },
        date: { type: 'string', description: 'Invoice issue date in YYYY-MM-DD format' },
        due_date: { type: 'string', description: 'Payment due date in YYYY-MM-DD format' },
        billing_cycle: { type: 'string', enum: ['Weekly', 'Bi-Weekly', 'Monthly', 'Custom'], description: 'Billing frequency' },
        vat_mode: { type: 'string', enum: ['Yes', 'No', 'Add'], description: 'VAT handling (Yes=inclusive, No=none, Add=add 7.5%)' },
        status: { type: 'string', enum: ['Draft', 'Sent', 'Paid', 'Overdue'], description: 'Invoice initial status' },
      },
      required: ['client', 'amount'],
    },
  },
  {
    name: 'propose_ledger_entry',
    description: 'Propose adding a financial transaction or expense to the Company Ledger following the strict voucher sequence rule.',
    parameters: {
      type: 'object',
      properties: {
        description: { type: 'string', description: 'Narrative description of the expense or income' },
        category: { type: 'string', description: 'Expense category matching one of the registered ledger categories' },
        amount: { type: 'number', description: 'Transaction amount in NGN' },
        date: { type: 'string', description: 'Date of transaction in YYYY-MM-DD format. Default is today.' },
        client: { type: 'string', description: 'Associated client name if applicable' },
        site: { type: 'string', description: 'Associated site name if applicable' },
        vendor: { type: 'string', description: 'Vendor or supplier paid' },
        bank: { type: 'string', description: 'Bank account used to pay (e.g. GTBank, Zenith, Access)' },
        vat_mode: { type: 'string', enum: ['No', 'Yes', 'Add'], description: 'VAT mode (No=none, Yes=inclusive, Add=7.5% added)' },
      },
      required: ['description', 'category', 'amount'],
    },
  },
  {
    name: 'propose_new_employee',
    description: 'Propose onboarding a new employee into HR with department, role, start date, and basic pay.',
    parameters: {
      type: 'object',
      properties: {
        firstname: { type: 'string', description: 'First name of employee' },
        surname: { type: 'string', description: 'Last name / Surname of employee' },
        department: { type: 'string', description: 'Department (e.g. Operations, Dewatering, Finance, HR, Engineering)' },
        position: { type: 'string', description: 'Job Title / Position' },
        staff_type: { type: 'string', enum: ['OFFICE', 'FIELD', 'NON-EMPLOYEE'], description: 'Staff classification' },
        start_date: { type: 'string', description: 'Start date in YYYY-MM-DD format' },
        salary: { type: 'number', description: 'Monthly base salary' },
      },
      required: ['firstname', 'surname', 'department', 'position'],
    },
  },
];

/** Get tool definitions permitted for the current user's role */
export function getPermittedToolDefinitions(permittedToolNames: string[]): ToolDefinition[] {
  return ALL_AGENT_TOOLS.filter((t) => permittedToolNames.includes(t.name));
}

/** Build System Grounding Prompt */
export function buildAgentSystemPrompt(context: AgentOperationalContext): string {
  const store = useAppStore.getState();
  const ledgerCats = (store.ledgerCategories || []).map((c) => c.name).slice(0, 25).join(', ');
  const ledgerBanksList = (store.ledgerBanks || []).map((b) => b.name).join(', ');
  const ledgerVendorsList = (store.ledgerVendors || []).map((v) => v.name).slice(0, 20).join(', ');

  const activeClientStr = context.activeClient
    ? `Active Client on Screen: "${context.activeClient.name}" (Sites: ${context.activeClient.sites.map((s) => `${s.name} [${s.status}]`).join(', ') || 'None'})`
    : '';

  const activeSiteStr = context.activeSite
    ? `Active Project / Site on Screen: "${context.activeSite.name}"${context.activeSite.clientName ? ` (Client: "${context.activeSite.clientName}")` : ''} [internal_id: ${context.activeSite.id}]`
    : 'No specific site currently selected.';

  const sitesListStr = context.availableSites
    .slice(0, 35)
    .map((s) => `- ${s.name}${s.clientName ? ` (Client: ${s.clientName})` : ''} [internal_id: ${s.id}]`)
    .join('\n');

  const pageContextStr = context.currentRoute
    ? `ACTIVE SCREEN / PAGE CONTEXT:
- Module: ${context.currentRoute.moduleName} (Path: ${context.currentRoute.path})
${context.currentRoute.activeEntity ? `- Focused Entity: ${context.currentRoute.activeEntity}\n` : ''}- Guidance: ${context.currentRoute.hint}`
    : '';

  return `You are Spark AI Co-Pilot, the universal enterprise assistant across the entire Spark Operations & ERP platform.
You handle all aspects of the business: Invoicing & Billing, Financial Ledger & Expenses, HR & Employee Onboarding, Site Diary, Workforce Attendance, Fleet & Maintenance, and Tasks.

CURRENT ON-SCREEN CONTEXT:
- Today's Date: ${context.todayDate}
- Logged-in User: ${context.user.name} (Role: ${context.user.role})
${activeClientStr ? `- ${activeClientStr}\n` : ''}- ${activeSiteStr}
${pageContextStr}

REGISTERED SITES & CLIENTS (ACTIVE IN SYSTEM):
${sitesListStr}

REGISTERED LEDGER RULES & MASTER DATA:
- Voucher Number Sequence: Strict format "VNYY-MM-DD-SEQ" (e.g. VN26-09-03-01). You MUST let the system sequence handle this automatically.
- Registered Ledger Categories: ${ledgerCats || 'Fuel & Diesel, Site Equipment, Maintenance, Salaries, Logistics, Office & Admin'}
- Registered Bank Accounts: ${ledgerBanksList || 'GTBank, Zenith Bank, Access Bank, First Bank'}
- Registered Vendors: ${ledgerVendorsList || 'General Vendors'}

CRITICAL OPERATIONAL RULES:
1. HUMAN-READABLE PRESENTATION (NO RAW UUIDs / IDs): NEVER display raw database UUIDs, site IDs, or internal hashes in your conversational text responses, summaries, or bullet points to the user (e.g. NEVER write "Site ID: 66e63038-...", "(ID: \`68d519b8-...\`)", or raw uuid strings). Always present entities using their clean, human-readable names (e.g. "Eko Atlantic APD Site", "Hunuponu Wusu Lekki", "APD PROJECT MANAGEMENT LIMITED"). Internal IDs [internal_id: ...] are strictly for tool argument payloads.
2. ON-SCREEN GROUNDING: When the user asks about "this client", "the site on the page I'm on", or asks for a brief/summary, ALWAYS answer using the Active Client ("${context.activeClient?.name || context.activeSite?.clientName || 'current'}") and Active Site ("${context.activeSite?.name || 'current'}") shown in CURRENT ON-SCREEN CONTEXT above. Do NOT mention unrelated sites unless explicitly requested.
3. SITE DISAMBIGUATION: When the user mentions a specific site or client by name (e.g. "south energy active site", "orange island elfad", "darycet"), look up that exact site from the registered list above.
4. MULTI-SITE LOGS: If a user's prompt covers multiple sites, call "propose_site_diary" for EACH site separately so distinct structured cards are created.
5. FOLLOW-UPS: If the user mentions an action item (e.g. "sending a technical proposal later"), also call "propose_site_task" to create an actionable task card.
6. DEWATERING STAGES: Assign appropriate stages: 'mobilization', 'installation', 'operation', or 'demobilisation'.
7. Always let the user review, edit, and click "Confirm & Save" on the cards before writing to the database.
8. Format your conversational summary cleanly with markdown bullet points.`;
}

/** Convert tool call arguments into a typed ActionProposal */
export function convertToolCallToProposal(
  toolName: string,
  args: any,
  context: AgentOperationalContext
): ActionProposal | null {
  const proposalId = crypto.randomUUID();
  const defaultSiteId = context.activeSite?.id || (context.availableSites[0]?.id ?? '');
  const defaultSiteName = context.activeSite?.name || (context.availableSites[0]?.name ?? 'General Site');
  const defaultDate = context.todayDate;
  const store = useAppStore.getState();

  switch (toolName) {
    case 'propose_site_diary': {
      // Smart fuzzy matching against availableSites by ID, site_name, or client_name
      let matchingSite = context.availableSites.find((s) => s.id === args.site_id);
      if (!matchingSite && args.site_name) {
        const query = args.site_name.toLowerCase();
        matchingSite = context.availableSites.find(
          (s) => s.name.toLowerCase().includes(query) || (s.clientName && s.clientName.toLowerCase().includes(query))
        );
      }
      if (!matchingSite && args.client_name) {
        const clientQuery = args.client_name.toLowerCase();
        matchingSite = context.availableSites.find(
          (s) => s.clientName && s.clientName.toLowerCase().includes(clientQuery)
        );
      }

      const siteId = matchingSite?.id || args.site_id || defaultSiteId;
      const siteName = matchingSite?.name || args.site_name || defaultSiteName;
      const clientName = matchingSite?.clientName || args.client_name;
      const stage = (['mobilization', 'installation', 'jetting', 'rejetting', 'operation', 'demobilisation'].includes(args.dewatering_stage)
        ? args.dewatering_stage
        : undefined) as any;

      return {
        id: proposalId,
        type: 'CREATE_SITE_DIARY',
        title: `Site Log: ${siteName}`,
        summary: `Log daily progress for ${siteName}${clientName ? ` (${clientName})` : ''} on ${args.date || defaultDate}.`,
        status: 'pending',
        createdAt: new Date().toISOString(),
        targetPath: `/sites/diary/${siteId}`,
        payload: {
          type: 'CREATE_SITE_DIARY',
          data: {
            date: args.date || defaultDate,
            siteId,
            siteName,
            clientName,
            narration: args.narration || '',
            progressPercentage: args.progress_percentage ? Number(args.progress_percentage) : undefined,
            dewateringStage: stage,
            generalNotes: args.general_notes || '',
          },
        },
      };
    }

    case 'propose_attendance_summary': {
      const siteId = args.site_id || defaultSiteId;
      const foundSite = context.availableSites.find((s) => s.id === siteId);
      const siteName = args.site_name || foundSite?.name || defaultSiteName;
      const count = Number(args.total_present) || 0;

      return {
        id: proposalId,
        type: 'LOG_ATTENDANCE_BATCH',
        title: `Attendance Headcount: ${siteName}`,
        summary: `Record ${count} personnel on site for ${siteName} on ${args.date || defaultDate}.`,
        status: 'pending',
        createdAt: new Date().toISOString(),
        targetPath: '/attendance',
        payload: {
          type: 'LOG_ATTENDANCE_BATCH',
          data: {
            date: args.date || defaultDate,
            siteId,
            siteName,
            totalPresent: count,
            notes: args.notes || '',
            tradeBreakdown: Array.isArray(args.trade_breakdown) ? args.trade_breakdown : undefined,
          },
        },
      };
    }

    case 'propose_incident_log': {
      const siteId = args.site_id || defaultSiteId;
      const foundSite = context.availableSites.find((s) => s.id === siteId);
      const siteName = args.site_name || foundSite?.name || defaultSiteName;

      return {
        id: proposalId,
        type: 'CREATE_INCIDENT_REPORT',
        title: `Safety & Conduct Log: ${args.category || 'Site Incident'}`,
        summary: `Document ${args.record_type || 'Infringement'} incident at ${siteName}.`,
        status: 'pending',
        createdAt: new Date().toISOString(),
        targetPath: '/performance-conduct',
        payload: {
          type: 'CREATE_INCIDENT_REPORT',
          data: {
            incidentDate: args.incident_date || defaultDate,
            siteId,
            siteName,
            recordType: args.record_type === 'Accolade' ? 'Accolade' : 'Infringement',
            category: args.category || 'Behaviour on Site',
            description: args.description || '',
            employeeName: args.employee_name || undefined,
            hrNotified: Boolean(args.hr_notified),
          },
        },
      };
    }

    case 'propose_diesel_refill': {
      const siteId = args.site_id || defaultSiteId;
      const foundSite = context.availableSites.find((s) => s.id === siteId);
      const siteName = args.site_name || foundSite?.name || defaultSiteName;
      const litres = Number(args.total_litres) || 0;
      const price = args.price_per_litre ? Number(args.price_per_litre) : undefined;
      const totalCost = price ? litres * price : undefined;

      return {
        id: proposalId,
        type: 'LOG_DIESEL_REFILL',
        title: `Fuel Refill: ${litres}L Diesel`,
        summary: `Record ${litres} Litres diesel refill at ${siteName}.`,
        status: 'pending',
        createdAt: new Date().toISOString(),
        targetPath: '/operations',
        payload: {
          type: 'LOG_DIESEL_REFILL',
          data: {
            date: args.date || defaultDate,
            siteId,
            siteName,
            totalLitres: litres,
            pricePerLitre: price,
            totalCost,
            supplier: args.supplier || undefined,
            notes: args.notes || (args.machine_name ? `Refueled ${args.machine_name}` : ''),
          },
        },
      };
    }

    case 'propose_consumable_burn': {
      const siteId = args.site_id || defaultSiteId;
      const foundSite = context.availableSites.find((s) => s.id === siteId);
      const siteName = args.site_name || foundSite?.name || defaultSiteName;
      const qty = Number(args.quantity) || 0;

      return {
        id: proposalId,
        type: 'LOG_CONSUMABLE_BURN',
        title: `Material Usage: ${qty} ${args.unit || 'units'} ${args.asset_name}`,
        summary: `Record consumption of ${qty} ${args.unit || ''} ${args.asset_name} at ${siteName}.`,
        status: 'pending',
        createdAt: new Date().toISOString(),
        targetPath: '/operations/assets',
        payload: {
          type: 'LOG_CONSUMABLE_BURN',
          data: {
            date: args.date || defaultDate,
            siteId,
            siteName,
            assetName: args.asset_name || 'Material',
            quantity: qty,
            unitOfMeasurement: args.unit,
            reason: args.reason,
            notes: args.reason ? `Used for: ${args.reason}` : '',
          },
        },
      };
    }

    case 'propose_maintenance_ticket': {
      const siteId = args.site_id || defaultSiteId;
      const foundSite = context.availableSites.find((s) => s.id === siteId);
      const siteName = args.site_name || foundSite?.name || defaultSiteName;

      return {
        id: proposalId,
        type: 'LOG_MAINTENANCE_TICKET',
        title: `Maintenance Ticket: ${args.asset_name}`,
        summary: `Flag ${args.type || 'repair'} for ${args.asset_name} at ${siteName}.`,
        status: 'pending',
        createdAt: new Date().toISOString(),
        targetPath: '/operations/maintenance',
        payload: {
          type: 'LOG_MAINTENANCE_TICKET',
          data: {
            date: args.date || defaultDate,
            siteId,
            siteName,
            assetName: args.asset_name || 'Equipment',
            type: (['emergency', 'repair', 'scheduled', 'routine'].includes(args.type) ? args.type : 'repair') as any,
            remark: args.remark || 'Maintenance required',
            technician: args.technician,
            downtimeHours: args.downtime_hours ? Number(args.downtime_hours) : undefined,
          },
        },
      };
    }

    case 'propose_site_task': {
      const siteId = args.site_id || defaultSiteId;
      const foundSite = context.availableSites.find((s) => s.id === siteId);
      const siteName = args.site_name || foundSite?.name || defaultSiteName;

      return {
        id: proposalId,
        type: 'CREATE_SITE_TASK',
        title: `Task: ${args.title}`,
        summary: `Create task for ${siteName}${args.assignee_name ? ` assigned to ${args.assignee_name}` : ''}.`,
        status: 'pending',
        createdAt: new Date().toISOString(),
        targetPath: '/tasks',
        payload: {
          type: 'CREATE_SITE_TASK',
          data: {
            title: args.title || 'Site Task',
            description: args.description,
            siteId,
            siteName,
            priority: (['low', 'medium', 'high', 'urgent'].includes(args.priority) ? args.priority : 'medium') as any,
            dueDate: args.due_date,
            assigneeName: args.assignee_name,
          },
        },
      };
    }

    case 'propose_create_invoice': {
      const amount = Number(args.amount) || 0;
      const vatMode = (['Yes', 'No', 'Add'].includes(args.vat_mode) ? args.vat_mode : 'Add') as 'Yes' | 'No' | 'Add';
      const vatAmount = vatMode === 'Add' ? amount * 0.075 : (vatMode === 'Yes' ? (amount * 0.075) / 1.075 : 0);
      const totalCharge = vatMode === 'Add' ? amount + vatAmount : amount;
      const autoInvNum = args.invoice_number || `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

      return {
        id: proposalId,
        type: 'CREATE_INVOICE',
        title: `Draft Invoice: ${args.client} (${autoInvNum})`,
        summary: `Draft invoice for ${args.client} for ₦${amount.toLocaleString()} (${args.billing_cycle || 'Monthly'}).`,
        status: 'pending',
        createdAt: new Date().toISOString(),
        targetPath: '/billing',
        payload: {
          type: 'CREATE_INVOICE',
          data: {
            invoiceNumber: autoInvNum,
            client: args.client,
            project: args.site_name || defaultSiteName,
            siteId: defaultSiteId,
            siteName: args.site_name || defaultSiteName,
            amount,
            date: args.date || defaultDate,
            dueDate: args.due_date || defaultDate,
            billingCycle: args.billing_cycle || 'Monthly',
            status: args.status || 'Draft',
            vatInc: vatMode,
            vatAmount: Math.round(vatAmount),
            totalCharge: Math.round(totalCharge),
            notes: args.notes,
          },
        },
      };
    }

    case 'propose_ledger_entry': {
      const amount = Number(args.amount) || 0;
      const entryDate = args.date || defaultDate;
      const voucherNo = generateNextVoucherNo(entryDate);

      const registeredCats = store.ledgerCategories || [];
      const registeredBanks = store.ledgerBanks || [];
      const categoryMatch = registeredCats.find((c) => c.name.toLowerCase() === (args.category || '').toLowerCase())?.name
        || registeredCats[0]?.name
        || args.category
        || 'Site Expenses';
      const bankMatch = registeredBanks.find((b) => b.name.toLowerCase() === (args.bank || '').toLowerCase())?.name
        || registeredBanks[0]?.name
        || args.bank
        || 'GTBank';

      return {
        id: proposalId,
        type: 'CREATE_LEDGER_ENTRY',
        title: `Ledger Voucher: ${voucherNo} (₦${amount.toLocaleString()})`,
        summary: `Record ₦${amount.toLocaleString()} under ${categoryMatch} for "${args.description}" paid from ${bankMatch}.`,
        status: 'pending',
        createdAt: new Date().toISOString(),
        targetPath: '/ledger',
        payload: {
          type: 'CREATE_LEDGER_ENTRY',
          data: {
            voucherNo,
            date: entryDate,
            description: args.description || 'Ledger Expense',
            category: categoryMatch,
            amount,
            client: args.client || '',
            site: args.site || defaultSiteName,
            vendor: args.vendor || '',
            bank: bankMatch,
            isVatable: args.vat_mode === 'Yes' || args.vat_mode === 'Add',
            vatMode: args.vat_mode || 'No',
          },
        },
      };
    }

    case 'propose_new_employee': {
      return {
        id: proposalId,
        type: 'CREATE_EMPLOYEE',
        title: `New Hire: ${args.firstname} ${args.surname}`,
        summary: `Onboard ${args.firstname} ${args.surname} as ${args.position} in ${args.department}.`,
        status: 'pending',
        createdAt: new Date().toISOString(),
        targetPath: '/employees',
        payload: {
          type: 'CREATE_EMPLOYEE',
          data: {
            firstname: args.firstname,
            surname: args.surname,
            department: args.department || 'Operations',
            position: args.position || 'Staff',
            staffType: args.staff_type || 'FIELD',
            startDate: args.start_date || defaultDate,
            salary: args.salary ? Number(args.salary) : undefined,
          },
        },
      };
    }

    default:
      return null;
  }
}
