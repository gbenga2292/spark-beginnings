import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Check, 
  X, 
  Edit3, 
  ExternalLink, 
  Loader2, 
  BookOpen, 
  Users, 
  AlertTriangle, 
  Fuel, 
  CheckCircle2, 
  AlertCircle,
  Package,
  Wrench,
  CheckSquare,
  FileText,
  DollarSign,
  UserPlus
} from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Textarea } from '@/src/components/ui/textarea';
import { cn } from '@/src/lib/utils';
import { useTheme } from '@/src/hooks/useTheme';
import { useAppStore } from '@/src/store/appStore';
import type { 
  ActionProposal, 
  AgentOperationalContext, 
  ActionPayload 
} from '@/src/types/agent';
import { executeActionProposal } from '@/src/lib/agentExecutor';
import { generateNextVoucherNo } from '@/src/lib/agentTools';
import { toast } from 'sonner';

interface Props {
  proposal: ActionProposal;
  context: AgentOperationalContext;
  onUpdateProposal: (updated: ActionProposal) => void;
  onCloseParent?: () => void;
}

export function ActionProposalCard({ proposal, context, onUpdateProposal, onCloseParent }: Props) {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  // Store lists for compliant dropdowns
  const ledgerCategories = useAppStore((s) => s.ledgerCategories) || [];
  const ledgerBanks = useAppStore((s) => s.ledgerBanks) || [];
  const ledgerVendors = useAppStore((s) => s.ledgerVendors) || [];
  const sites = useAppStore((s) => s.sites) || [];

  // Maintain typed payload
  const [payload, setPayload] = useState<ActionPayload>(proposal.payload);

  const getProposalIcon = () => {
    switch (proposal.type) {
      case 'CREATE_INVOICE':
        return <FileText className="w-4 h-4 text-emerald-500" />;
      case 'CREATE_LEDGER_ENTRY':
        return <DollarSign className="w-4 h-4 text-amber-500" />;
      case 'CREATE_EMPLOYEE':
        return <UserPlus className="w-4 h-4 text-cyan-500" />;
      case 'CREATE_SITE_DIARY':
        return <BookOpen className="w-4 h-4 text-sky-500" />;
      case 'LOG_ATTENDANCE_BATCH':
        return <Users className="w-4 h-4 text-emerald-500" />;
      case 'CREATE_INCIDENT_REPORT':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'LOG_DIESEL_REFILL':
        return <Fuel className="w-4 h-4 text-orange-500" />;
      case 'LOG_CONSUMABLE_BURN':
        return <Package className="w-4 h-4 text-purple-500" />;
      case 'LOG_MAINTENANCE_TICKET':
        return <Wrench className="w-4 h-4 text-rose-500" />;
      case 'CREATE_SITE_TASK':
        return <CheckSquare className="w-4 h-4 text-indigo-500" />;
      default:
        return <CheckCircle2 className="w-4 h-4 text-blue-500" />;
    }
  };

  const getBadgeStyle = () => {
    switch (proposal.type) {
      case 'CREATE_INVOICE':
        return isDark ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'CREATE_LEDGER_ENTRY':
        return isDark ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-amber-50 text-amber-700 border-amber-200';
      case 'CREATE_EMPLOYEE':
        return isDark ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 'bg-cyan-50 text-cyan-700 border-cyan-200';
      case 'CREATE_SITE_DIARY':
        return isDark ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' : 'bg-sky-50 text-sky-700 border-sky-200';
      case 'LOG_ATTENDANCE_BATCH':
        return isDark ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'CREATE_INCIDENT_REPORT':
        return isDark ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-amber-50 text-amber-700 border-amber-200';
      case 'LOG_DIESEL_REFILL':
        return isDark ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 'bg-orange-50 text-orange-700 border-orange-200';
      case 'LOG_CONSUMABLE_BURN':
        return isDark ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-purple-50 text-purple-700 border-purple-200';
      case 'LOG_MAINTENANCE_TICKET':
        return isDark ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-rose-50 text-rose-700 border-rose-200';
      case 'CREATE_SITE_TASK':
        return isDark ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-indigo-50 text-indigo-700 border-indigo-200';
      default:
        return isDark ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-blue-50 text-blue-700 border-blue-200';
    }
  };

  const handleConfirm = async () => {
    setIsExecuting(true);
    const updatedProposal: ActionProposal = {
      ...proposal,
      payload,
      status: 'executing',
    };
    onUpdateProposal(updatedProposal);

    const res = await executeActionProposal(updatedProposal, context);
    setIsExecuting(false);

    if (res.success) {
      toast.success(`${proposal.title} confirmed and saved!`);
      onUpdateProposal({
        ...updatedProposal,
        status: 'confirmed',
        createdRecordId: res.recordId,
      });
    } else {
      toast.error(res.error || 'Failed to execute action');
      onUpdateProposal({
        ...updatedProposal,
        status: 'failed',
        error: res.error,
      });
    }
  };

  const handleDiscard = () => {
    onUpdateProposal({
      ...proposal,
      status: 'rejected',
    });
    toast.info('Proposal discarded');
  };

  const handleNavigate = () => {
    if (proposal.targetPath) {
      navigate(proposal.targetPath);
      onCloseParent?.();
    }
  };

  if (proposal.status === 'rejected') {
    return (
      <div className={cn(
        "p-3 my-2 rounded-xl border text-xs flex items-center justify-between",
        isDark ? "border-slate-800 bg-slate-900/40 text-slate-500" : "border-slate-200 bg-slate-50 text-slate-400"
      )}>
        <span className="line-through italic text-[11.5px]">Discarded: {proposal.title}</span>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => onUpdateProposal({ ...proposal, status: 'pending' })}
          className={cn("h-6 text-[10px] cursor-pointer", isDark ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-900")}
        >
          Undo
        </Button>
      </div>
    );
  }

  if (proposal.status === 'confirmed') {
    return (
      <div className={cn(
        "p-3.5 my-2.5 rounded-xl border shadow-xs backdrop-blur-sm",
        isDark ? "border-emerald-500/30 bg-emerald-950/20" : "border-emerald-200 bg-emerald-50/70"
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn("p-1.5 rounded-lg", isDark ? "bg-emerald-500/10 text-emerald-400" : "bg-emerald-100 text-emerald-700")}>
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <p className={cn("text-xs font-semibold", isDark ? "text-emerald-300" : "text-emerald-800")}>Successfully Recorded</p>
              <p className={cn("text-[11px]", isDark ? "text-slate-400" : "text-slate-600")}>{proposal.title}</p>
            </div>
          </div>
          {proposal.targetPath && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleNavigate}
              className={cn(
                "h-7 text-xs gap-1 cursor-pointer",
                isDark 
                  ? "border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20" 
                  : "border-emerald-300 text-emerald-800 hover:bg-emerald-100 bg-white"
              )}
            >
              View Record
              <ExternalLink className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  const innerBoxClass = isDark ? "bg-slate-950/70 border-slate-800" : "bg-slate-50 border-slate-200";
  const labelClass = isDark ? "text-slate-400" : "text-slate-500";
  const textValueClass = isDark ? "text-slate-100 font-semibold" : "text-slate-900 font-semibold";
  const inputClass = isDark ? "h-7 text-xs bg-slate-900 border-slate-700 text-white" : "h-7 text-xs bg-white border-slate-300 text-slate-900";
  const selectClass = isDark ? "h-7 text-xs bg-slate-900 border-slate-700 text-white rounded-md px-2 focus:ring-1 focus:ring-indigo-500" : "h-7 text-xs bg-white border-slate-300 text-slate-900 rounded-md px-2 focus:ring-1 focus:ring-indigo-500";

  return (
    <div className={cn(
      "my-2.5 rounded-xl border shadow-md overflow-hidden transition-all",
      isDark ? "border-slate-800 bg-slate-900 text-slate-200" : "border-slate-200 bg-white text-slate-800"
    )}>
      {/* Card Header */}
      <div className={cn(
        "p-3 border-b flex items-center justify-between",
        isDark ? "bg-slate-850 border-slate-800" : "bg-slate-50/80 border-slate-200"
      )}>
        <div className="flex items-center gap-2">
          <div className={cn("p-1 rounded-md border", isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200 shadow-2xs")}>
            {getProposalIcon()}
          </div>
          <span className={cn("text-xs font-bold", isDark ? "text-slate-100" : "text-slate-900")}>
            {proposal.title}
          </span>
        </div>
        <span className={cn('text-[9.5px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full border', getBadgeStyle())}>
          {proposal.type.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Card Body */}
      <div className="p-3.5 space-y-2.5 text-xs">
        <p className={cn("text-[11.5px] leading-snug", isDark ? "text-slate-400" : "text-slate-600")}>
          {proposal.summary}
        </p>

        {/* Invoice Fields */}
        {payload.type === 'CREATE_INVOICE' && (
          <div className={cn("space-y-2 p-2.5 rounded-lg border", innerBoxClass)}>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={cn("text-[10px] uppercase tracking-wider font-semibold block", labelClass)}>Client</label>
                <p className={textValueClass}>{payload.data.client}</p>
              </div>
              <div>
                <label className={cn("text-[10px] uppercase tracking-wider font-semibold block", labelClass)}>Invoice No</label>
                <p className={cn("font-mono font-bold", isDark ? "text-emerald-400" : "text-emerald-700")}>{payload.data.invoiceNumber}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={cn("text-[10px] uppercase tracking-wider font-semibold block", labelClass)}>Subtotal Amount</label>
                {isEditing ? (
                  <Input
                    type="number"
                    value={payload.data.amount}
                    onChange={(e) =>
                      setPayload({
                        ...payload,
                        data: { ...payload.data, amount: Number(e.target.value) },
                      })
                    }
                    className={inputClass}
                  />
                ) : (
                  <p className={textValueClass}>₦{payload.data.amount.toLocaleString()}</p>
                )}
              </div>
              <div>
                <label className={cn("text-[10px] uppercase tracking-wider font-semibold block", labelClass)}>VAT Mode / Total</label>
                <p className={cn("font-bold", isDark ? "text-emerald-300" : "text-emerald-700")}>
                  ₦{(payload.data.totalCharge || payload.data.amount).toLocaleString()} ({payload.data.vatInc})
                </p>
              </div>
            </div>
            <div className={cn("grid grid-cols-2 gap-2 text-[11px]", isDark ? "text-slate-400" : "text-slate-600")}>
              <div>
                <span>Issue Date: {payload.data.date}</span>
              </div>
              <div>
                <span>Due: {payload.data.dueDate}</span>
              </div>
            </div>
          </div>
        )}

        {/* Ledger Entry Fields (Strict Sequence & Full Form Conformity) */}
        {payload.type === 'CREATE_LEDGER_ENTRY' && (
          <div className={cn("space-y-2 p-2.5 rounded-lg border", innerBoxClass)}>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={cn("text-[10px] uppercase tracking-wider font-semibold block", labelClass)}>
                  Voucher No (Sequence)
                </label>
                <p className={cn("font-mono font-bold", isDark ? "text-amber-300" : "text-amber-700")}>
                  {payload.data.voucherNo}
                </p>
              </div>
              <div>
                <label className={cn("text-[10px] uppercase tracking-wider font-semibold block", labelClass)}>
                  Paid From (Bank)
                </label>
                {isEditing ? (
                  <select
                    value={payload.data.bank || ''}
                    onChange={(e) =>
                      setPayload({
                        ...payload,
                        data: { ...payload.data, bank: e.target.value },
                      })
                    }
                    className={cn(selectClass, "w-full")}
                  >
                    {ledgerBanks.map((b) => (
                      <option key={b.id} value={b.name}>{b.name}</option>
                    ))}
                    {ledgerBanks.length === 0 && <option value="GTBank">GTBank</option>}
                  </select>
                ) : (
                  <p className={cn("font-semibold", isDark ? "text-indigo-300" : "text-indigo-700")}>
                    {payload.data.bank || 'Primary Bank'}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={cn("text-[10px] uppercase tracking-wider font-semibold block", labelClass)}>
                  Category
                </label>
                {isEditing ? (
                  <select
                    value={payload.data.category}
                    onChange={(e) =>
                      setPayload({
                        ...payload,
                        data: { ...payload.data, category: e.target.value },
                      })
                    }
                    className={cn(selectClass, "w-full")}
                  >
                    {ledgerCategories.map((c) => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                    {ledgerCategories.length === 0 && <option value="Site Expenses">Site Expenses</option>}
                  </select>
                ) : (
                  <p className={textValueClass}>{payload.data.category}</p>
                )}
              </div>
              <div>
                <label className={cn("text-[10px] uppercase tracking-wider font-semibold block", labelClass)}>
                  Amount (₦)
                </label>
                {isEditing ? (
                  <Input
                    type="number"
                    value={payload.data.amount}
                    onChange={(e) =>
                      setPayload({
                        ...payload,
                        data: { ...payload.data, amount: Number(e.target.value) },
                      })
                    }
                    className={inputClass}
                  />
                ) : (
                  <p className={cn("font-extrabold text-sm", isDark ? "text-amber-400" : "text-amber-700")}>
                    ₦{payload.data.amount.toLocaleString()}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className={cn("text-[10px] uppercase tracking-wider font-semibold block", labelClass)}>
                  Date
                </label>
                {isEditing ? (
                  <Input
                    type="date"
                    value={payload.data.date}
                    onChange={(e) => {
                      const newDate = e.target.value;
                      const newVoucher = generateNextVoucherNo(newDate);
                      setPayload({
                        ...payload,
                        data: { ...payload.data, date: newDate, voucherNo: newVoucher },
                      });
                    }}
                    className={inputClass}
                  />
                ) : (
                  <p className={cn("text-[11px]", isDark ? "text-slate-300" : "text-slate-700")}>
                    {payload.data.date}
                  </p>
                )}
              </div>
              <div>
                <label className={cn("text-[10px] uppercase tracking-wider font-semibold block", labelClass)}>
                  Vendor / Payee
                </label>
                {isEditing ? (
                  <select
                    value={payload.data.vendor || ''}
                    onChange={(e) =>
                      setPayload({
                        ...payload,
                        data: { ...payload.data, vendor: e.target.value },
                      })
                    }
                    className={cn(selectClass, "w-full")}
                  >
                    <option value="">None / General</option>
                    {ledgerVendors.map((v) => (
                      <option key={v.id} value={v.name}>{v.name}</option>
                    ))}
                  </select>
                ) : (
                  <p className={cn("text-[11px]", isDark ? "text-slate-300" : "text-slate-700")}>
                    {payload.data.vendor || 'None'}
                  </p>
                )}
              </div>
              <div>
                <label className={cn("text-[10px] uppercase tracking-wider font-semibold block", labelClass)}>
                  VAT Mode
                </label>
                {isEditing ? (
                  <select
                    value={payload.data.vatMode || 'No'}
                    onChange={(e) =>
                      setPayload({
                        ...payload,
                        data: { 
                          ...payload.data, 
                          vatMode: e.target.value as any,
                          isVatable: e.target.value !== 'No'
                        },
                      })
                    }
                    className={cn(selectClass, "w-full")}
                  >
                    <option value="No">No VAT</option>
                    <option value="Yes">Inclusive (7.5%)</option>
                    <option value="Add">Add (7.5%)</option>
                  </select>
                ) : (
                  <p className={cn("text-[11px] font-semibold", isDark ? "text-slate-300" : "text-slate-700")}>
                    {payload.data.vatMode || 'No'}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className={cn("text-[10px] uppercase tracking-wider font-semibold block", labelClass)}>
                Description
              </label>
              {isEditing ? (
                <Textarea
                  value={payload.data.description}
                  onChange={(e) =>
                    setPayload({
                      ...payload,
                      data: { ...payload.data, description: e.target.value },
                    })
                  }
                  className={cn("text-xs min-h-[45px]", isDark ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-300 text-slate-900")}
                />
              ) : (
                <p className={isDark ? "text-slate-200" : "text-slate-800"}>{payload.data.description}</p>
              )}
            </div>
          </div>
        )}

        {/* Employee Onboarding Fields */}
        {payload.type === 'CREATE_EMPLOYEE' && (
          <div className={cn("space-y-2 p-2.5 rounded-lg border", innerBoxClass)}>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={cn("text-[10px] uppercase tracking-wider font-semibold block", labelClass)}>Full Name</label>
                <p className={cn("font-bold", isDark ? "text-cyan-300" : "text-cyan-700")}>{payload.data.firstname} {payload.data.surname}</p>
              </div>
              <div>
                <label className={cn("text-[10px] uppercase tracking-wider font-semibold block", labelClass)}>Department</label>
                <p className={textValueClass}>{payload.data.department}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={cn("text-[10px] uppercase tracking-wider font-semibold block", labelClass)}>Position</label>
                <p className={textValueClass}>{payload.data.position}</p>
              </div>
              <div>
                <label className={cn("text-[10px] uppercase tracking-wider font-semibold block", labelClass)}>Start Date</label>
                <p className={isDark ? "text-slate-300" : "text-slate-700"}>{payload.data.startDate}</p>
              </div>
            </div>
          </div>
        )}

        {/* Site Diary / Daily Log Fields (Conforming to New Daily Log Dialog) */}
        {payload.type === 'CREATE_SITE_DIARY' && (
          <div className={cn("space-y-2 p-2.5 rounded-lg border", innerBoxClass)}>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={cn("text-[10px] uppercase tracking-wider font-semibold block", labelClass)}>
                  Target Site
                </label>
                {isEditing ? (
                  <select
                    value={payload.data.siteId}
                    onChange={(e) => {
                      const selected = sites.find((s) => s.id === e.target.value);
                      setPayload({
                        ...payload,
                        data: {
                          ...payload.data,
                          siteId: e.target.value,
                          siteName: selected?.name || payload.data.siteName,
                          clientName: selected?.client || payload.data.clientName,
                        },
                      });
                    }}
                    className={cn(selectClass, "w-full")}
                  >
                    {sites.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.client ? `(${s.client})` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div>
                    <p className={textValueClass}>{payload.data.siteName}</p>
                    {payload.data.clientName && (
                      <span className={cn("text-[10.5px]", isDark ? "text-slate-400" : "text-slate-500")}>
                        Client: {payload.data.clientName}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className={cn("text-[10px] uppercase tracking-wider font-semibold block", labelClass)}>
                  Log Date
                </label>
                {isEditing ? (
                  <Input
                    type="date"
                    value={payload.data.date}
                    onChange={(e) =>
                      setPayload({
                        ...payload,
                        data: { ...payload.data, date: e.target.value },
                      })
                    }
                    className={inputClass}
                  />
                ) : (
                  <p className={cn("text-xs font-semibold", isDark ? "text-slate-200" : "text-slate-800")}>
                    {payload.data.date}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={cn("text-[10px] uppercase tracking-wider font-semibold block", labelClass)}>
                  Dewatering Stage
                </label>
                {isEditing ? (
                  <select
                    value={payload.data.dewateringStage || 'operation'}
                    onChange={(e) =>
                      setPayload({
                        ...payload,
                        data: { ...payload.data, dewateringStage: e.target.value as any },
                      })
                    }
                    className={cn(selectClass, "w-full capitalize")}
                  >
                    <option value="mobilization">Mobilization</option>
                    <option value="installation">Installation / Setup</option>
                    <option value="operation">Operation / Dewatering</option>
                    <option value="demobilisation">Demobilisation</option>
                  </select>
                ) : (
                  <p className={cn("font-bold capitalize text-sky-500", isDark ? "text-sky-400" : "text-sky-600")}>
                    {payload.data.dewateringStage === 'installation' ? 'Installation' :
                     payload.data.dewateringStage === 'mobilization' ? 'Mobilization' :
                     payload.data.dewateringStage === 'demobilisation' ? 'Demobilisation' :
                     'Operation'}
                  </p>
                )}
              </div>
              <div>
                <label className={cn("text-[10px] uppercase tracking-wider font-semibold block", labelClass)}>
                  Site Progress (%)
                </label>
                {isEditing ? (
                  <Input
                    type="number"
                    value={payload.data.progressPercentage ?? ''}
                    placeholder="e.g. 75"
                    onChange={(e) =>
                      setPayload({
                        ...payload,
                        data: { ...payload.data, progressPercentage: e.target.value ? Number(e.target.value) : undefined },
                      })
                    }
                    className={inputClass}
                  />
                ) : (
                  <p className={textValueClass}>
                    {payload.data.progressPercentage != null ? `${payload.data.progressPercentage}%` : 'Unchanged'}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className={cn("text-[10px] uppercase tracking-wider font-semibold block", labelClass)}>
                Site Activity Notes
              </label>
              {isEditing ? (
                <Textarea
                  value={payload.data.narration}
                  onChange={(e) =>
                    setPayload({
                      ...payload,
                      data: { ...payload.data, narration: e.target.value },
                    })
                  }
                  className={cn("text-xs min-h-[60px]", isDark ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-300 text-slate-900")}
                />
              ) : (
                <p className={cn("whitespace-pre-wrap leading-relaxed", isDark ? "text-slate-200" : "text-slate-800")}>
                  {payload.data.narration}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Attendance Headcount Fields */}
        {payload.type === 'LOG_ATTENDANCE_BATCH' && (
          <div className={cn("space-y-2 p-2.5 rounded-lg border", innerBoxClass)}>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={cn("text-[10px] uppercase tracking-wider font-semibold block", labelClass)}>Date</label>
                <p className={textValueClass}>{payload.data.date}</p>
              </div>
              <div>
                <label className={cn("text-[10px] uppercase tracking-wider font-semibold block", labelClass)}>Total Present</label>
                {isEditing ? (
                  <Input
                    type="number"
                    value={payload.data.totalPresent}
                    onChange={(e) =>
                      setPayload({
                        ...payload,
                        data: { ...payload.data, totalPresent: Number(e.target.value) },
                      })
                    }
                    className={inputClass}
                  />
                ) : (
                  <p className={cn("font-bold", isDark ? "text-emerald-400" : "text-emerald-700")}>{payload.data.totalPresent} workers</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Incident Fields */}
        {payload.type === 'CREATE_INCIDENT_REPORT' && (
          <div className={cn("space-y-2 p-2.5 rounded-lg border", innerBoxClass)}>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={cn("text-[10px] uppercase tracking-wider font-semibold block", labelClass)}>Record Type</label>
                <p className={cn("font-bold", isDark ? "text-amber-300" : "text-amber-700")}>{payload.data.recordType}</p>
              </div>
              <div>
                <label className={cn("text-[10px] uppercase tracking-wider font-semibold block", labelClass)}>Category</label>
                <p className={textValueClass}>{payload.data.category}</p>
              </div>
            </div>
            <div>
              <label className={cn("text-[10px] uppercase tracking-wider font-semibold block", labelClass)}>Description</label>
              {isEditing ? (
                <Textarea
                  value={payload.data.description}
                  onChange={(e) =>
                    setPayload({
                      ...payload,
                      data: { ...payload.data, description: e.target.value },
                    })
                  }
                  className={cn("text-xs min-h-[50px]", isDark ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-300 text-slate-900")}
                />
              ) : (
                <p className={isDark ? "text-slate-200" : "text-slate-800"}>{payload.data.description}</p>
              )}
            </div>
          </div>
        )}

        {/* Diesel Refill Fields */}
        {payload.type === 'LOG_DIESEL_REFILL' && (
          <div className={cn("space-y-2 p-2.5 rounded-lg border", innerBoxClass)}>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={cn("text-[10px] uppercase tracking-wider font-semibold block", labelClass)}>Litres Refilled</label>
                <p className={cn("font-bold", isDark ? "text-orange-400" : "text-orange-700")}>{payload.data.totalLitres} L</p>
              </div>
              <div>
                <label className={cn("text-[10px] uppercase tracking-wider font-semibold block", labelClass)}>Date</label>
                <p className={textValueClass}>{payload.data.date}</p>
              </div>
            </div>
          </div>
        )}

        {/* Consumable Stock Burn Fields */}
        {payload.type === 'LOG_CONSUMABLE_BURN' && (
          <div className={cn("space-y-2 p-2.5 rounded-lg border", innerBoxClass)}>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={cn("text-[10px] uppercase tracking-wider font-semibold block", labelClass)}>Material</label>
                <p className={cn("font-bold", isDark ? "text-purple-300" : "text-purple-700")}>{payload.data.assetName}</p>
              </div>
              <div>
                <label className={cn("text-[10px] uppercase tracking-wider font-semibold block", labelClass)}>Quantity</label>
                {isEditing ? (
                  <Input
                    type="number"
                    value={payload.data.quantity}
                    onChange={(e) =>
                      setPayload({
                        ...payload,
                        data: { ...payload.data, quantity: Number(e.target.value) },
                      })
                    }
                    className={inputClass}
                  />
                ) : (
                  <p className={cn("font-bold", isDark ? "text-purple-400" : "text-purple-700")}>{payload.data.quantity} {payload.data.unitOfMeasurement || 'units'}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Maintenance Ticket Fields */}
        {payload.type === 'LOG_MAINTENANCE_TICKET' && (
          <div className={cn("space-y-2 p-2.5 rounded-lg border", innerBoxClass)}>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={cn("text-[10px] uppercase tracking-wider font-semibold block", labelClass)}>Equipment</label>
                <p className={cn("font-bold", isDark ? "text-rose-300" : "text-rose-700")}>{payload.data.assetName}</p>
              </div>
              <div>
                <label className={cn("text-[10px] uppercase tracking-wider font-semibold block", labelClass)}>Type</label>
                <p className={cn("font-bold uppercase text-[11px]", isDark ? "text-amber-400" : "text-amber-700")}>{payload.data.type}</p>
              </div>
            </div>
          </div>
        )}

        {/* Site Task Fields */}
        {payload.type === 'CREATE_SITE_TASK' && (
          <div className={cn("space-y-2 p-2.5 rounded-lg border", innerBoxClass)}>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={cn("text-[10px] uppercase tracking-wider font-semibold block", labelClass)}>Priority</label>
                <p className={cn("font-bold uppercase text-[11px]", isDark ? "text-indigo-400" : "text-indigo-700")}>{payload.data.priority}</p>
              </div>
              <div>
                <label className={cn("text-[10px] uppercase tracking-wider font-semibold block", labelClass)}>Assignee</label>
                <p className={textValueClass}>{payload.data.assigneeName || 'Unassigned'}</p>
              </div>
            </div>
            <div>
              <label className={cn("text-[10px] uppercase tracking-wider font-semibold block", labelClass)}>Task Title</label>
              <p className={textValueClass}>{payload.data.title}</p>
            </div>
          </div>
        )}

        {proposal.error && (
          <div className={cn(
            "flex items-center gap-1.5 p-2 rounded-lg border text-[11px]",
            isDark ? "bg-rose-500/10 border-rose-500/20 text-rose-300" : "bg-rose-50 border-rose-200 text-rose-700"
          )}>
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{proposal.error}</span>
          </div>
        )}
      </div>

      {/* Card Actions */}
      <div className={cn(
        "p-2.5 border-t flex items-center justify-between gap-2",
        isDark ? "bg-slate-850/50 border-slate-800" : "bg-slate-50 border-slate-200"
      )}>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditing(!isEditing)}
            className={cn(
              "h-7 text-[11px] px-2 gap-1 cursor-pointer",
              isDark ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800" : "text-slate-600 hover:text-slate-900 hover:bg-slate-200"
            )}
          >
            <Edit3 className="w-3 h-3" />
            {isEditing ? 'Done Editing' : 'Edit Details'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDiscard}
            className={cn(
              "h-7 text-[11px] px-2 gap-1 cursor-pointer",
              isDark ? "text-rose-400 hover:text-rose-300 hover:bg-rose-500/10" : "text-rose-600 hover:text-rose-700 hover:bg-rose-50"
            )}
          >
            <X className="w-3 h-3" />
            Discard
          </Button>
        </div>

        <Button
          size="sm"
          onClick={handleConfirm}
          disabled={isExecuting}
          className="h-7 text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-3 gap-1.5 shadow-xs cursor-pointer"
        >
          {isExecuting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Check className="w-3.5 h-3.5" />
              Confirm & Save
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
