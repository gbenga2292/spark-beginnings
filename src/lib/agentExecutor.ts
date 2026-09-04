import { supabase } from '@/src/integrations/supabase/client';
import { useAppStore } from '@/src/store/appStore';
import { useUserStore } from '@/src/store/userStore';
import { db } from '@/src/lib/supabaseService';
import type { 
  AgentMessage, 
  AgentOperationalContext, 
  ActionProposal,
} from '@/src/types/agent';
import { 
  buildAgentSystemPrompt, 
  getPermittedToolDefinitions, 
  convertToolCallToProposal 
} from './agentTools';

export interface ActiveAiConfig {
  apiKey: string;
  provider: 'gemini' | 'groq' | 'openai';
  model: string;
}

/** Retrieve active AI API key configuration strictly from Settings */
export async function getActiveAiConfig(): Promise<ActiveAiConfig> {
  try {
    const { data: dbKeys, error } = await supabase
      .from('api_keys')
      .select('*')
      .order('is_default', { ascending: false });

    if (!error && dbKeys && dbKeys.length > 0) {
      const activeKey = dbKeys.find((k: any) => k.is_default) || dbKeys[0];
      const provider = activeKey.provider || (activeKey.key_value?.startsWith('AIza') ? 'gemini' : 'groq');
      const rawModel = (activeKey.default_model || '').trim();
      const model = rawModel || (provider === 'gemini' ? 'gemini-2.0-flash' : 'llama-3.3-70b-versatile');
      return {
        apiKey: activeKey.key_value,
        provider,
        model,
      };
    }
  } catch (err) {
    console.warn('Failed to load api_keys from DB, falling back to env/localStorage:', err);
  }

  // Fallback to local storage or environment
  const geminiKey = localStorage.getItem('GEMINI_API_KEY') || import.meta.env.VITE_GEMINI_API_KEY;
  if (geminiKey) {
    return { apiKey: geminiKey, provider: 'gemini', model: 'gemini-2.0-flash' };
  }

  const groqKey = localStorage.getItem('GROQ_API_KEY') || import.meta.env.VITE_GROQ_API_KEY;
  if (groqKey) {
    return { apiKey: groqKey, provider: 'groq', model: 'llama-3.3-70b-versatile' };
  }

  return { apiKey: '', provider: 'gemini', model: 'gemini-2.0-flash' };
}

/** Execute chat turn strictly against the model selected in Settings */
export async function processAgentMessage(
  userPrompt: string,
  history: AgentMessage[],
  context: AgentOperationalContext,
  config: ActiveAiConfig
): Promise<{ text: string; proposals: ActionProposal[] }> {
  if (!config.apiKey) {
    throw new Error('No AI API Key found. Please add an API key in Settings -> AI Keys.');
  }

  const systemPrompt = buildAgentSystemPrompt(context);
  const tools = getPermittedToolDefinitions(context.permittedTools);

  if (config.provider === 'gemini') {
    return processGeminiTurn(userPrompt, history, systemPrompt, tools, context, config);
  } else {
    return processOpenAiCompatibleTurn(userPrompt, history, systemPrompt, tools, context, config);
  }
}

/** Gemini Function Calling using STRICTLY the selected model from Settings */
async function processGeminiTurn(
  userPrompt: string,
  history: AgentMessage[],
  systemPrompt: string,
  tools: any[],
  context: AgentOperationalContext,
  config: ActiveAiConfig
): Promise<{ text: string; proposals: ActionProposal[] }> {
  const selectedModel = (config.model || 'gemini-2.0-flash').replace(/^models\//, '').trim();

  const geminiTools = tools.length > 0 ? [
    {
      functionDeclarations: tools.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: {
          type: 'OBJECT',
          properties: Object.fromEntries(
            Object.entries(t.parameters.properties).map(([k, v]: [string, any]) => [
              k,
              {
                type: v.type === 'number' ? 'NUMBER' : v.type === 'boolean' ? 'BOOLEAN' : v.type === 'array' ? 'ARRAY' : 'STRING',
                description: v.description,
                ...(v.enum ? { enum: v.enum } : {}),
                ...(v.items ? { items: { type: 'OBJECT', description: v.items.description } } : {}),
              },
            ])
          ),
          required: t.parameters.required,
        },
      })),
    },
  ] : undefined;

  // Build conversational contents
  const contents = [
    ...history.slice(-6).map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    })),
    {
      role: 'user',
      parts: [{ text: userPrompt }],
    },
  ];

  const payload: any = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 1500,
    },
  };

  if (geminiTools) {
    payload.tools = geminiTools;
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${config.apiKey}`;

  let res: Response | null = null;
  let lastErrMessage = '';

  for (let attempt = 1; attempt <= 3; attempt++) {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) break;

    const errData = await res.json().catch(() => ({}));
    lastErrMessage = errData?.error?.message || `HTTP ${res.status}: ${res.statusText}`;

    // If 503 (high demand) or 429 (rate limit), pause and retry on the exact same selected model
    if ((res.status === 503 || res.status === 429 || lastErrMessage.toLowerCase().includes('high demand')) && attempt < 3) {
      console.warn(`[AgentExecutor] ${selectedModel} returned ${res.status} (high demand). Retrying attempt ${attempt + 1}/3...`);
      await new Promise((resolve) => setTimeout(resolve, attempt * 1200));
      continue;
    }

    throw new Error(lastErrMessage);
  }

  if (!res || !res.ok) {
    throw new Error(lastErrMessage || `Failed to connect to ${selectedModel}`);
  }

  const data = await res.json();
  const candidate = data.candidates?.[0];
  const parts = candidate?.content?.parts || [];

  let text = '';
  const proposals: ActionProposal[] = [];

  for (const part of parts) {
    if (part.text) {
      text += part.text + '\n';
    }
    if (part.functionCall) {
      const toolName = part.functionCall.name;
      const toolArgs = part.functionCall.args || {};
      const proposal = convertToolCallToProposal(toolName, toolArgs, context);
      if (proposal) {
        proposals.push(proposal);
      }
    }
  }

  text = sanitizeAssistantText(text.trim());
  if (!text && proposals.length > 0) {
    text = `I have drafted ${proposals.length === 1 ? 'an action proposal' : `${proposals.length} action proposals`}. Please review the parameters below:`;
  }

  return { text, proposals };
}

/** Groq / OpenAI Compatible Function Calling using STRICTLY the selected model from Settings */
async function processOpenAiCompatibleTurn(
  userPrompt: string,
  history: AgentMessage[],
  systemPrompt: string,
  tools: any[],
  context: AgentOperationalContext,
  config: ActiveAiConfig
): Promise<{ text: string; proposals: ActionProposal[] }> {
  const openAiTools = tools.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-6).map((m) => ({
      role: m.role,
      content: m.content,
    })),
    { role: 'user', content: userPrompt },
  ];

  const endpoint = config.provider === 'groq'
    ? 'https://api.groq.com/openai/v1/chat/completions'
    : 'https://api.openai.com/v1/chat/completions';

  const body: any = {
    model: config.model || (config.provider === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini'),
    messages,
    temperature: 0.2,
  };

  if (openAiTools.length > 0) {
    body.tools = openAiTools;
    body.tool_choice = 'auto';
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData?.error?.message || `API error: ${res.statusText}`);
  }

  const data = await res.json();
  const choice = data.choices?.[0];
  const message = choice?.message;
  let text = message?.content || '';
  const proposals: ActionProposal[] = [];

  if (message?.tool_calls) {
    for (const toolCall of message.tool_calls) {
      try {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments || '{}');
        const proposal = convertToolCallToProposal(toolName, toolArgs, context);
        if (proposal) proposals.push(proposal);
      } catch (e) {
        console.error('Failed to parse tool call args:', e);
      }
    }
  }

  text = sanitizeAssistantText(text.trim());
  if (!text && proposals.length > 0) {
    text = `I have formulated ${proposals.length} proposal(s). Please review and confirm the details below:`;
  }

  return { text, proposals };
}

/** Clean up any leaking UUIDs or raw IDs from assistant text messages */
export function sanitizeAssistantText(rawText: string): string {
  if (!rawText) return '';
  return rawText
    // Remove (ID: `uuid`) or (ID: uuid) or (Site ID: `uuid`)
    .replace(/\s*\((?:Site\s+)?(?:ID|internal_id):\s*`?[0-9a-fA-F-]{36}`?\)/gi, '')
    // Remove [ID: `uuid`] or [internal_id: `uuid`]
    .replace(/\s*\[(?:Site\s+)?(?:ID|internal_id):\s*`?[0-9a-fA-F-]{36}`?\]/gi, '')
    // Remove "Site ID: `uuid`" or "Site ID: uuid" lines or inline phrases
    .replace(/(?:Site\s+ID|SiteId|Site\s+UUID):\s*`?[0-9a-fA-F-]{36}`?/gi, '')
    // Clean up empty trailing parenthesis or double spaces
    .replace(/\(\s*\)/g, '')
    .replace(/ {2,}/g, ' ')
    .trim();
}

/** Execute confirmed action proposal directly into DB */
export async function executeActionProposal(
  proposal: ActionProposal,
  context: AgentOperationalContext
): Promise<{ success: boolean; recordId?: string; error?: string }> {
  try {
    const currentUser = context.user;
    const authorName = currentUser.name || 'AI Co-Pilot';
    const workspaceId = useUserStore.getState().getCurrentUser()?.workspaceId || 'dcel-team';

    switch (proposal.payload.type) {
      case 'CREATE_SITE_DIARY': {
        const data = proposal.payload.data;
        const journalId = crypto.randomUUID();
        const entryId = crypto.randomUUID();

        const journal = {
          id: journalId,
          date: data.date,
          generalNotes: data.generalNotes || 'Created via AI Co-Pilot',
          loggedBy: authorName,
          workspaceId,
        };

        const entry = {
          id: entryId,
          journalId,
          siteId: data.siteId,
          siteName: data.siteName,
          clientName: data.clientName || '',
          narration: data.narration,
          progressPercentage: data.progressPercentage,
          dewateringStage: data.dewateringStage || 'operation',
          createdAt: new Date().toISOString(),
          loggedBy: authorName,
        };

        await useAppStore.getState().addDailyJournal(journal as any, [entry as any]);

        if (data.siteId) {
          const siteUpdate: any = {};
          if (data.dewateringStage) siteUpdate.currentDewateringStage = data.dewateringStage;
          if (data.progressPercentage !== undefined) siteUpdate.currentProgressPercentage = data.progressPercentage;
          if (Object.keys(siteUpdate).length > 0) {
            useAppStore.getState().updateSite(data.siteId, siteUpdate);
          }
        }

        return { success: true, recordId: entryId };
      }

      case 'LOG_ATTENDANCE_BATCH': {
        const data = proposal.payload.data;
        const recordId = crypto.randomUUID();
        const breakdownStr = data.tradeBreakdown
          ? data.tradeBreakdown.map((t) => `${t.trade}: ${t.count}`).join(', ')
          : '';

        const noteWithBreakdown = [data.notes, breakdownStr ? `Trades: ${breakdownStr}` : '']
          .filter(Boolean)
          .join(' | ');

        const rec = {
          id: recordId,
          workspaceId,
          siteId: data.siteId,
          siteName: data.siteName,
          date: data.date,
          employeeId: 'HEADCOUNT_SUMMARY',
          employeeName: `Site Headcount (${data.totalPresent} staff)`,
          status: 'present' as const,
          notes: `[AI Copilot] ${noteWithBreakdown || 'General headcount logged'}`,
          loggedBy: authorName,
          createdAt: new Date().toISOString(),
        };

        await useAppStore.getState().addAttendanceRecords([rec as any]);
        return { success: true, recordId };
      }

      case 'CREATE_INCIDENT_REPORT': {
        const data = proposal.payload.data;
        const recordId = crypto.randomUUID();

        const meritRecord = {
          id: recordId,
          workspaceId,
          employeeId: data.employeeId || 'SITE_STAFF',
          employeeName: data.employeeName || 'Site Workforce',
          recordType: data.recordType,
          category: data.category,
          description: data.description,
          siteId: data.siteId,
          siteName: data.siteName,
          loggedById: currentUser.id,
          loggedByName: authorName,
          hrNotified: data.hrNotified,
          incidentDate: data.incidentDate,
          createdAt: new Date().toISOString(),
        };

        useAppStore.getState().addStaffMeritRecord(meritRecord as any);
        return { success: true, recordId };
      }

      case 'LOG_DIESEL_REFILL': {
        const data = proposal.payload.data;
        const recordId = crypto.randomUUID();

        const { error } = await supabase.from('diesel_refills').insert({
          id: recordId,
          date: data.date,
          site_id: data.siteId,
          site_name: data.siteName,
          total_litres: data.totalLitres,
          price_per_litre: data.pricePerLitre || null,
          total_cost: data.totalCost || null,
          supplier: data.supplier || null,
          notes: data.notes ? `[AI Co-Pilot] ${data.notes}` : '[AI Co-Pilot] Fuel logged',
          purchased_by: authorName,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        if (error) throw error;
        return { success: true, recordId };
      }

      case 'LOG_CONSUMABLE_BURN': {
        const data = proposal.payload.data;
        const recordId = crypto.randomUUID();

        const { error } = await supabase.from('site_transactions').insert({
          id: recordId,
          site_id: data.siteId,
          asset_id: data.assetId || crypto.randomUUID(),
          asset_name: data.assetName,
          quantity: data.quantity,
          transaction_type: 'burn',
          type: 'consumed',
          reference_id: 'AI_COPILOT_BURN',
          reference_type: 'site_burn',
          condition: 'good',
          notes: data.notes || `[AI Co-Pilot] ${data.quantity} ${data.unitOfMeasurement || 'units'} consumed on site`,
          created_by: authorName,
          created_at: new Date().toISOString(),
        });

        if (error) throw error;
        return { success: true, recordId };
      }

      case 'LOG_MAINTENANCE_TICKET': {
        const data = proposal.payload.data;
        const recordId = crypto.randomUUID();

        const { error } = await supabase.from('maintenance_logs').insert({
          id: recordId,
          service_date: data.date,
          description: `[AI Co-Pilot] ${data.remark}${data.downtimeHours ? ` | Downtime: ${data.downtimeHours}hrs` : ''}`,
          maintenance_type: data.type,
          performed_by: data.technician || authorName,
          status: 'pending',
          created_at: new Date().toISOString(),
        });

        if (error) throw error;
        return { success: true, recordId };
      }

      case 'CREATE_SITE_TASK': {
        const data = proposal.payload.data;
        const recordId = crypto.randomUUID();

        const { error } = await supabase.from('tasks').insert({
          id: recordId,
          title: data.title,
          description: data.description ? `[AI Co-Pilot] ${data.description}` : `Site Task for ${data.siteName || 'Site'}`,
          priority: data.priority,
          due_date: data.dueDate || null,
          status: 'todo',
          site_id: data.siteId || null,
          workspace_id: workspaceId,
          created_at: new Date().toISOString(),
        } as any);

        if (error) throw error;
        return { success: true, recordId };
      }

      case 'CREATE_INVOICE': {
        const data = proposal.payload.data;
        const recordId = crypto.randomUUID();

        const invoice = {
          id: recordId,
          invoiceNumber: data.invoiceNumber,
          client: data.client,
          project: data.project || data.siteName || 'General Project',
          siteId: data.siteId || '',
          siteName: data.siteName || 'General Site',
          amount: data.amount,
          date: data.date,
          dueDate: data.dueDate,
          billingCycle: data.billingCycle,
          reminderDate: data.dueDate,
          status: data.status,
          vatInc: data.vatInc,
          vat: data.vatAmount || 0,
          totalCost: data.amount,
          totalCharge: data.totalCharge || data.amount,
          totalExclusiveOfVat: data.amount,
        };

        useAppStore.getState().addInvoice(invoice as any);
        return { success: true, recordId };
      }

      case 'CREATE_LEDGER_ENTRY': {
        const data = proposal.payload.data;
        const recordId = crypto.randomUUID();

        const ledgerEntry = {
          id: recordId,
          voucherNo: data.voucherNo,
          date: data.date,
          description: data.description,
          category: data.category,
          amount: data.amount,
          client: data.client || '',
          site: data.site || '',
          vendor: data.vendor || '',
          bank: data.bank || 'Main Bank',
          enteredBy: authorName,
          isVatable: data.isVatable,
          vatMode: data.vatMode,
        };

        useAppStore.getState().addLedgerEntry(ledgerEntry as any);
        return { success: true, recordId };
      }

      case 'CREATE_EMPLOYEE': {
        const data = proposal.payload.data;
        const recordId = crypto.randomUUID();

        const employee = {
          id: recordId,
          firstname: data.firstname,
          surname: data.surname,
          department: data.department,
          position: data.position,
          staffType: data.staffType,
          startDate: data.startDate,
          endDate: '',
          yearlyLeave: 20,
          bankName: data.bankName || '',
          accountNo: data.accountNo || '',
          payeTax: false,
          withholdingTax: false,
          taxId: '',
          pensionNumber: '',
          status: 'Active' as const,
          monthlySalaries: {
            basicSalary: data.salary || 0,
            housingAllowance: 0,
            transportAllowance: 0,
            grossSalary: data.salary || 0,
            netSalary: data.salary || 0,
          },
        };

        useAppStore.getState().addEmployee(employee as any);
        return { success: true, recordId };
      }

      default:
        throw new Error('Unsupported proposal type');
    }
  } catch (err: any) {
    console.error('Failed to execute action proposal:', err);
    return { success: false, error: err.message || 'Database execution failed' };
  }
}
