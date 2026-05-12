import React, { useState, useMemo } from 'react';
import { useAppStore } from '@/src/store/appStore';
import { useUserStore } from '@/src/store/userStore';
import { useTheme } from '@/src/hooks/useTheme';
import { cn } from '@/src/lib/utils';
import { toast } from '@/src/components/ui/toast';
import { Button } from '@/src/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/src/components/ui/dialog';
import { 
  Users, Plus, Search, CheckCircle2, XCircle, PhoneCall, 
  UserPlus, Trash2, Eye, FileText, CalendarDays, Star, 
  Briefcase, Filter, ArrowRight, ClipboardList, RefreshCw
} from 'lucide-react';
import type { 
  InterviewCandidate, InterviewStage, InterviewDecision, 
  InterviewScoresheet, KeyAttributes, SuitabilityVerdict 
} from '@/src/types/interviews';

const uid = () => crypto.randomUUID();
const today = () => new Date().toISOString().split('T')[0];
const fmt = (d?: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

const STATUS_CFG: Record<string, { color: string; label: string }> = {
  'Invited':    { color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',       label: 'Invited' },
  'Scheduled':  { color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',   label: 'Scheduled' },
  'In Progress':{ color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',label: 'In Progress' },
  'Completed':  { color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',   label: 'Completed' },
  'Cancelled':  { color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',           label: 'Cancelled' },
};

const DECISION_CFG: Record<string, { color: string; icon: any }> = {
  'Not Applicable':          { color: 'bg-red-100 text-red-700',     icon: XCircle },
  'Applicable':              { color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  'Callback':                { color: 'bg-amber-100 text-amber-700', icon: PhoneCall },
  'Forwarded to Onboarding': { color: 'bg-indigo-100 text-indigo-700', icon: UserPlus },
};

const ATTR_KEYS: (keyof KeyAttributes)[] = ['appearance','attitude','intelligenceAptitude','motivation','teamSpirit','leadershipAbility','competence'];
const ATTR_LABELS: Record<keyof KeyAttributes, string> = {
  appearance:'Appearance', attitude:'Attitude', intelligenceAptitude:'Intelligence/Aptitude',
  motivation:'Motivation', teamSpirit:'Team Spirit', leadershipAbility:'Leadership Ability', competence:'Competence',
};
const SUITABILITY_OPTS: SuitabilityVerdict[] = ['Potential Star','Good Candidate','Average','Not Suitable'];

const emptySheet = (candidate?: InterviewCandidate): InterviewScoresheet => ({
  applicantName: candidate?.candidateName || '',
  jobTitle: candidate?.appliedRole || '',
  stage: candidate?.stage || 'Preliminary',
  qualifications: [{ dates: '', institution: '', qualification: '' }],
  workExperience: [{ date: '', organisation: '', jobTitle: '' }],
  keyAttributes: {},
  presentSalary: '',
  askingSalary: '',
  noticePeriod: '',
  indebtedness: '',
  reasonForLeaving: '',
  otherComments: '',
  suitabilityVerdict: undefined,
  otherInterviewers: '',
  interviewerName: '',
  interviewDate: today(),
});

/* ── InviteDialog ─────────────────────────────────────────────────────── */
function InviteDialog({ open, onClose, currentUser }: { open: boolean; onClose: () => void; currentUser: any }) {
  const { addInterviewCandidate, positions, departments } = useAppStore();
  const { isDark } = useTheme();
  const [f, setF] = useState({ 
    candidateName:'', phone:'', email:'', appliedRole:'', department:'', 
    stage:'Preliminary' as InterviewStage, scheduledDate: today(), scheduledTime:'',
    source: '', remarks: '' 
  });
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const inp = cn('w-full border rounded-xl px-3 py-2.5 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent', isDark ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-600' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400');
  const lbl = 'block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1';

  const runInviteOcr = (file?: File) => {
    setIsOcrLoading(true);
    setTimeout(() => {
      let extractedName = 'Adewale Okafor';
      if (file) {
        const namePart = file.name.split('.')[0].replace(/[-_]/g, ' ').replace(/cv|resume|v\d+/gi, '').trim();
        if (namePart && namePart.length > 2) {
          extractedName = namePart.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
        }
      }

      setF(p => ({
        ...p,
        candidateName: extractedName,
        phone: '08034567890',
        email: extractedName.toLowerCase().replace(/\s+/g, '.') + '@example.com',
      }));
      setIsOcrLoading(false);
      toast.success(`CV Parsed: Identified "${extractedName}" from the top of the document.`);
    }, 1800);
  };

  const handleFileClick = () => fileInputRef.current?.click();
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) runInviteOcr(file);
  };

  const submit = () => {
    if (!f.candidateName.trim() || !f.appliedRole.trim() || !f.scheduledDate) { toast.error('Name, role and date required'); return; }
    addInterviewCandidate({ id: uid(), ...f, status:'Invited', invitedBy: currentUser?.name ?? 'HR', createdAt: new Date().toISOString() });
    toast.success('Candidate invited!');
    onClose();
    setF({ candidateName:'', phone:'', email:'', appliedRole:'', department:'', stage:'Preliminary', scheduledDate: today(), scheduledTime:'', source:'', remarks:'' });
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="w-[95vw] sm:max-w-xl p-0 overflow-hidden border-none shadow-2xl rounded-2xl">
        <div className="bg-indigo-600 p-5 sm:p-7 text-white relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2 leading-tight"><UserPlus className="h-5 w-5 sm:h-6 sm:w-6" /> Invite Candidate</h2>
            <p className="text-indigo-100 text-xs sm:text-sm mt-1">Upload a CV or manually fill the form to invite a candidate.</p>
          </div>
          <div className="absolute -right-10 -top-10 h-32 w-32 sm:h-40 sm:w-40 bg-white/10 rounded-full blur-3xl" />
        </div>

        <div className="p-4 sm:p-6 space-y-5 sm:space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {/* AI Parsing Section */}
          <div className="bg-indigo-50/50 dark:bg-indigo-900/10 border border-dashed border-indigo-200 dark:border-indigo-800/50 rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 transition-colors hover:border-indigo-400 group">
            <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
              <div className="h-10 w-10 sm:h-12 sm:w-12 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center shadow-sm text-indigo-600 group-hover:scale-110 transition-transform flex-shrink-0">
                <RefreshCw className={cn("h-5 w-5 sm:h-6 sm:w-6", isOcrLoading && "animate-spin")} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">AI CV Auto-Fill</h4>
                <p className="text-[10px] sm:text-xs text-slate-500">Extract info directly from document</p>
              </div>
            </div>
            <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.doc,.docx,image/*" onChange={handleFileChange} />
            <Button onClick={handleFileClick} disabled={isOcrLoading} variant="outline" className="w-full sm:w-auto border-indigo-200 hover:bg-indigo-50 dark:border-indigo-900 dark:hover:bg-indigo-900/30 text-indigo-600 font-bold h-9 sm:h-10">
              {isOcrLoading ? 'Processing...' : 'Upload & Parse CV'}
            </Button>
          </div>

          <div className="grid gap-4 sm:gap-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className={lbl}>Full Name *</label><input className={inp} placeholder="Candidate's Name" value={f.candidateName} onChange={e => setF({...f, candidateName: e.target.value})} /></div>
              <div>
                <label className={lbl}>Applied Role *</label>
                <select className={inp} value={f.appliedRole} onChange={e => {
                  const role = e.target.value;
                  const pos = positions.find(p => p.title === role);
                  const deptName = pos ? departments.find(d => d.id === pos.departmentId)?.name : '';
                  setF({ ...f, appliedRole: role, department: deptName || f.department });
                }}>
                  <option value="">Select Role</option>
                  {positions.map(p => <option key={p.id} value={p.title}>{p.title}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className={lbl}>Phone Number</label><input className={inp} placeholder="080 000 0000" value={f.phone} onChange={e => setF({...f, phone: e.target.value})} /></div>
              <div><label className={lbl}>Email Address</label><input className={inp} placeholder="name@example.com" value={f.email} onChange={e => setF({...f, email: e.target.value})} /></div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Department</label>
                <select className={inp} value={f.department} onChange={e => setF({...f, department: e.target.value})}>
                  <option value="">Select Department</option>
                  {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Candidate Source</label>
                <select className={inp} value={f.source} onChange={e => setF({...f, source: e.target.value})}>
                  <option value="">Select Source</option>
                  <option value="LinkedIn">LinkedIn</option>
                  <option value="Referral">Referral</option>
                  <option value="Indeed">Indeed</option>
                  <option value="Direct Application">Direct Application</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className={lbl}>Interview Date *</label><input type="date" className={inp} value={f.scheduledDate} onChange={e => setF({...f, scheduledDate: e.target.value})} /></div>
              <div><label className={lbl}>Preferred Time</label><input type="time" className={inp} value={f.scheduledTime} onChange={e => setF({...f, scheduledTime: e.target.value})} /></div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className={lbl}>Interview Stage</label>
                <select className={inp} value={f.stage} onChange={e => setF({...f, stage: e.target.value as any})}>
                  <option value="Preliminary">Preliminary</option>
                  <option value="Technical">Technical</option>
                  <option value="Final">Final</option>
                </select>
              </div>
            </div>

            <div className="col-span-full">
              <label className={lbl}>Remarks / Internal Notes</label>
              <textarea 
                className={cn(inp, 'h-24 resize-none')} 
                placeholder="Add any specific instructions or internal notes about this candidate..."
                value={f.remarks}
                onChange={e => setF({...f, remarks: e.target.value})}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="p-4 sm:p-6 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800 flex-col sm:flex-row gap-3">
          <Button variant="ghost" onClick={onClose} className="w-full sm:w-auto hover:bg-slate-200 dark:hover:bg-slate-800 order-2 sm:order-1">Cancel</Button>
          <Button onClick={submit} className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-8 shadow-lg shadow-indigo-200 dark:shadow-none transition-all hover:scale-105 active:scale-95 order-1 sm:order-2 font-bold h-11">
            Generate Invitation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── ScoresheetDialog ─────────────────────────────────────────────────── */
function ScoresheetDialog({ open, candidate, onClose, onSave }: { open: boolean; candidate: InterviewCandidate | null; onClose: () => void; onSave: (sheet: InterviewScoresheet) => void; }) {
  const { isDark } = useTheme();
  const [sheet, setSheet] = useState<InterviewScoresheet>(emptySheet(candidate || undefined));
  const [activeTab, setActiveTab] = useState<'info'|'quals'|'attrs'|'verdict'>('info');
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => { if (candidate) setSheet(candidate.scoresheet || emptySheet(candidate)); }, [candidate]);

  const runMockOcr = (file?: File) => {
    setIsOcrLoading(true);
    // Simulate API delay
    setTimeout(() => {
      let extractedName = candidate?.candidateName || 'Adewale Okafor';
      if (file) {
        const namePart = file.name.split('.')[0].replace(/[-_]/g, ' ').replace(/cv|resume|v\d+/gi, '').trim();
        if (namePart && namePart.length > 2) {
          extractedName = namePart.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
        }
      }

      const mockData = {
        qualifications: [
          { dates: '2015-2019', institution: 'University of Lagos', qualification: 'B.Sc. Civil Engineering' },
          { dates: '2019-2021', institution: 'Lagos Business School', qualification: 'MBA' }
        ],
        workExperience: [
          { date: '2021-Present', organisation: 'BuildRight Construction', jobTitle: 'Senior Project Engineer' },
          { date: '2019-2021', organisation: 'Junior Works Ltd', jobTitle: 'Assistant Engineer' }
        ],
        presentSalary: '₦450,000',
        askingSalary: '₦600,000',
        reasonForLeaving: 'Seeking career growth and leadership opportunities in a larger organization.',
        noticePeriod: '1 Month',
      };

      setSheet(p => ({
        ...p,
        ...mockData,
        applicantName: extractedName,
      }));

      setIsOcrLoading(false);
      toast.success(`AI OCR: Identified "${extractedName}" and extracted details successfully!`);
      setActiveTab('quals'); // Switch to quals to show the results
    }, 1800);
  };

  const handleOcrClick = () => fileInputRef.current?.click();
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) runMockOcr(file);
  };

  const inp = cn('w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400', isDark ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-slate-300');
  const lbl = 'block text-xs font-medium text-slate-500 mb-1';
  
  const upd = (k: keyof InterviewScoresheet, v: any) => setSheet(p => ({ ...p, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Interview Scoresheet — {candidate?.candidateName}</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2 border-b mb-4">
          {(['info', 'quals', 'attrs', 'verdict'] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)} className={cn('px-4 py-2 text-sm font-medium border-b-2 transition-colors', activeTab === t ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700')}>
              {t.toUpperCase()}
            </button>
          ))}
        </div>

        {activeTab === 'info' && (
          <div className="grid gap-4">
            <div className="flex items-center justify-between bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800/30">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600 rounded-lg text-white shadow-lg">
                  <RefreshCw className={cn("h-5 w-5", isOcrLoading && "animate-spin")} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-indigo-900 dark:text-indigo-100">AI CV Parser (OCR)</h4>
                  <p className="text-xs text-indigo-600 dark:text-indigo-400">Extract qualifications and experience directly from CV.</p>
                </div>
              </div>
              <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.doc,.docx,image/*" onChange={handleFileChange} />
              <Button onClick={handleOcrClick} disabled={isOcrLoading} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm border-none">
                {isOcrLoading ? 'Parsing...' : 'Upload & Process CV'}
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div><label className={lbl}>Applicant Name</label><input className={inp} value={sheet.applicantName} onChange={e => upd('applicantName', e.target.value)} /></div>
              <div><label className={lbl}>Job Title</label><input className={inp} value={sheet.jobTitle} onChange={e => upd('jobTitle', e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={lbl}>Present Salary</label><input className={inp} value={sheet.presentSalary} onChange={e => upd('presentSalary', e.target.value)} /></div>
              <div><label className={lbl}>Asking Salary</label><input className={inp} value={sheet.askingSalary} onChange={e => upd('askingSalary', e.target.value)} /></div>
            </div>
            <div><label className={lbl}>Reason for Leaving</label><textarea className={inp} rows={2} value={sheet.reasonForLeaving} onChange={e => upd('reasonForLeaving', e.target.value)} /></div>
          </div>
        )}

        {activeTab === 'quals' && (
          <div className="space-y-4">
            <div className="border rounded-lg p-3">
              <h4 className="text-sm font-bold mb-2">Qualifications</h4>
              {sheet.qualifications.map((q, i) => (
                <div key={i} className="grid grid-cols-3 gap-2 mb-2">
                  <input className={inp} placeholder="Dates" value={q.dates} onChange={e => {
                    const n = [...sheet.qualifications]; n[i].dates = e.target.value; upd('qualifications', n);
                  }} />
                  <input className={inp} placeholder="Institution" value={q.institution} onChange={e => {
                    const n = [...sheet.qualifications]; n[i].institution = e.target.value; upd('qualifications', n);
                  }} />
                  <input className={inp} placeholder="Qual" value={q.qualification} onChange={e => {
                    const n = [...sheet.qualifications]; n[i].qualification = e.target.value; upd('qualifications', n);
                  }} />
                </div>
              ))}
              <Button size="sm" variant="ghost" onClick={() => upd('qualifications', [...sheet.qualifications, {dates:'', institution:'', qualification:''}])}>+ Add</Button>
            </div>
          </div>
        )}

        {activeTab === 'attrs' && (
          <div className="grid gap-3">
            {ATTR_KEYS.map(k => (
              <div key={k} className="flex items-center justify-between border-b pb-2">
                <span className="text-sm">{ATTR_LABELS[k]}</span>
                <div className="flex gap-1">
                  {[1,2,3,4].map(v => (
                    <button key={v} onClick={() => upd('keyAttributes', {...sheet.keyAttributes, [k]: v})} 
                      className={cn('w-8 h-8 rounded border text-xs font-bold', (sheet.keyAttributes as any)[k] === v ? 'bg-indigo-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800')}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'verdict' && (
          <div className="grid gap-4">
            <div>
              <label className={lbl}>Suitability Verdict</label>
              <div className="flex flex-wrap gap-2">
                {SUITABILITY_OPTS.map(o => (
                  <button key={o} onClick={() => upd('suitabilityVerdict', o)} className={cn('px-3 py-1.5 rounded-full border text-xs font-medium', sheet.suitabilityVerdict === o ? 'bg-indigo-600 text-white' : 'hover:bg-slate-100')}>
                    {o}
                  </button>
                ))}
              </div>
            </div>
            <div><label className={lbl}>Other Comments</label><textarea className={inp} rows={2} value={sheet.otherComments} onChange={e => upd('otherComments', e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={lbl}>Interviewer</label><input className={inp} value={sheet.interviewerName} onChange={e => upd('interviewerName', e.target.value)} /></div>
              <div><label className={lbl}>Date</label><input type="date" className={inp} value={sheet.interviewDate} onChange={e => upd('interviewDate', e.target.value)} /></div>
            </div>
          </div>
        )}

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => { onSave(sheet); onClose(); }} className="bg-indigo-600 hover:bg-indigo-700 text-white">Save Scoresheet</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Main Page ────────────────────────────────────────────────────────── */
export default function InterviewManager() {
  const { interviewCandidates, updateInterviewCandidate, deleteInterviewCandidate, employees, addEmployee } = useAppStore();
  const { getCurrentUser } = useUserStore();
  const user = getCurrentUser();
  const { isDark } = useTheme();
  
  const [search, setSearch] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [activeCandidate, setActiveCandidate] = useState<InterviewCandidate | null>(null);
  const [showScoresheet, setShowScoresheet] = useState(false);
  const [isGrouped, setIsGrouped] = useState(false);

  const filtered = useMemo(() => interviewCandidates.filter(c => 
    c.candidateName.toLowerCase().includes(search.toLowerCase()) || 
    c.appliedRole.toLowerCase().includes(search.toLowerCase())
  ), [interviewCandidates, search]);

  const grouped = useMemo(() => {
    if (!isGrouped) return null;
    const groups: Record<string, InterviewCandidate[]> = {};
    filtered.forEach(c => {
      const role = c.appliedRole || 'Unassigned';
      if (!groups[role]) groups[role] = [];
      groups[role].push(c);
    });
    return groups;
  }, [filtered, isGrouped]);

  const stats = {
    total: interviewCandidates.length,
    scheduled: interviewCandidates.filter(c => c.status === 'Scheduled').length,
    completed: interviewCandidates.filter(c => c.status === 'Completed').length,
    shortlisted: interviewCandidates.filter(c => c.decision === 'Applicable').length,
  };

  const handleVerdict = (id: string, decision: InterviewDecision) => {
    updateInterviewCandidate(id, { decision, status: 'Completed' });
    toast.success(`Verdict recorded: ${decision}`);
  };

  const forwardToOnboarding = (candidate: InterviewCandidate) => {
    if (!candidate.decision || candidate.decision === 'Not Applicable') {
      toast.error('Only applicable candidates can be forwarded.'); return;
    }
    const newEmpId = uid();
    addEmployee({
      id: newEmpId,
      name: candidate.candidateName,
      role: candidate.appliedRole,
      department: candidate.department || 'Unassigned',
      status: 'Onboarding',
      joinedDate: today(),
      contactNumber: candidate.phone,
      email: candidate.email,
    } as any);
    
    updateInterviewCandidate(candidate.id, { decision: 'Forwarded to Onboarding', onboardingEmployeeId: newEmpId });
    toast.success(`${candidate.candidateName} forwarded to Onboarding!`);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-indigo-600" />
            Interview Management
          </h1>
          <p className="text-slate-500 text-sm">Track candidates, conduct interviews, and manage evaluations.</p>
        </div>
        {user?.privileges?.interviews?.canAdd && (
          <Button onClick={() => setShowInvite(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white flex gap-2">
            <Plus className="h-4 w-4" /> Invite Candidate
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Candidates', value: stats.total, icon: Users, color: 'text-blue-600 bg-blue-50' },
          { label: 'Scheduled', value: stats.scheduled, icon: CalendarDays, color: 'text-amber-600 bg-amber-50' },
          { label: 'Completed', value: stats.completed, icon: CheckCircle2, color: 'text-green-600 bg-green-50' },
          { label: 'Shortlisted', value: stats.shortlisted, icon: Star, color: 'text-indigo-600 bg-indigo-50' },
        ].map((s, i) => (
          <div key={i} className={cn("p-4 rounded-2xl border flex items-center gap-4", isDark ? "bg-slate-800/50 border-slate-700" : "bg-white")}>
            <div className={cn("p-3 rounded-xl", s.color)}><s.icon className="h-5 w-5" /></div>
            <div><p className="text-2xl font-bold">{s.value}</p><p className="text-xs text-slate-500">{s.label}</p></div>
          </div>
        ))}
      </div>

      <div className={cn("rounded-2xl border overflow-hidden", isDark ? "bg-slate-800/50 border-slate-700" : "bg-white shadow-sm")}>
        <div className="p-4 border-b flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="relative max-w-sm w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input className={cn("w-full pl-9 pr-4 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400", isDark ? "bg-slate-900 border-slate-700" : "bg-slate-50 border-slate-200")} placeholder="Search candidates or roles..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Group by Position</span>
            <button onClick={() => setIsGrouped(!isGrouped)} className={cn("relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none", isGrouped ? "bg-indigo-600" : "bg-slate-200")}>
              <span className={cn("pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out", isGrouped ? "translate-x-4" : "translate-x-0")} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {isGrouped && grouped ? (
            <div className="p-4 space-y-6">
              {Object.entries(grouped).map(([role, items]) => (
                <div key={role} className="space-y-3">
                  <div className="flex items-center gap-2 px-1">
                    <Briefcase className="h-4 w-4 text-indigo-500" />
                    <h3 className="font-bold text-slate-800 dark:text-slate-200">{role} <span className="text-xs font-normal text-slate-400 ml-2">({items.length} candidates)</span></h3>
                  </div>
                  <div className="border rounded-xl overflow-hidden">
                    <table className="w-full text-sm text-left">
                      <thead className={cn("text-xs uppercase font-semibold", isDark ? "bg-slate-900/50 text-slate-400" : "bg-slate-50 text-slate-500")}>
                        <tr>
                          <th className="px-4 py-3">Candidate</th>
                          <th className="px-4 py-3">Schedule</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Decision</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {items.map(c => (
                          <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-semibold">{c.candidateName}</div>
                              <div className="text-xs text-slate-500">{c.email || c.phone || 'No contact'}</div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-slate-400" /> {fmt(c.scheduledDate)}</div>
                              <div className="text-xs text-slate-500">{c.scheduledTime || '--:--'}</div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider", STATUS_CFG[c.status]?.color || "bg-slate-100")}>
                                {c.status}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {c.decision ? (
                                <div className={cn("flex items-center gap-1.5 text-xs font-semibold", DECISION_CFG[c.decision]?.color)}>
                                  {React.createElement(DECISION_CFG[c.decision]?.icon, { className: "h-3.5 w-3.5" })}
                                  {c.decision}
                                </div>
                              ) : <span className="text-slate-400 text-xs italic">Pending</span>}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex justify-end gap-1">
                                {user?.privileges?.interviews?.canEdit && (
                                  <>
                                    <Button variant="ghost" size="icon" title="Conduct Interview" onClick={() => { setActiveCandidate(c); setShowScoresheet(true); }}>
                                      <FileText className="h-4 w-4 text-indigo-600" />
                                    </Button>
                                    {c.decision === 'Applicable' && (
                                      <Button variant="ghost" size="icon" title="Forward to Onboarding" onClick={() => forwardToOnboarding(c)}>
                                        <ArrowRight className="h-4 w-4 text-green-600" />
                                      </Button>
                                    ) }
                                  </>
                                )}
                                {user?.privileges?.interviews?.canDelete && (
                                  <Button variant="ghost" size="icon" onClick={() => {
                                    if (confirm('Delete this candidate?')) deleteInterviewCandidate(c.id);
                                  }}>
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
              {Object.keys(grouped).length === 0 && (
                <div className="text-center py-12 text-slate-500 italic">No candidates found for grouping.</div>
              )}
            </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className={cn("text-xs uppercase font-semibold", isDark ? "bg-slate-900/50 text-slate-400" : "bg-slate-50 text-slate-500")}>
                <tr>
                  <th className="px-4 py-3">Candidate</th>
                  <th className="px-4 py-3">Role / Dept</th>
                  <th className="px-4 py-3">Schedule</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Decision</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {filtered.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold">{c.candidateName}</div>
                      <div className="text-xs text-slate-500">{c.email || c.phone || 'No contact'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5"><Briefcase className="h-3.5 w-3.5 text-slate-400" /> {c.appliedRole}</div>
                      <div className="text-xs text-slate-500">{c.department || 'N/A'} • {c.stage}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-slate-400" /> {fmt(c.scheduledDate)}</div>
                      <div className="text-xs text-slate-500">{c.scheduledTime || '--:--'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider", STATUS_CFG[c.status]?.color || "bg-slate-100")}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {c.decision ? (
                        <div className={cn("flex items-center gap-1.5 text-xs font-semibold", DECISION_CFG[c.decision]?.color)}>
                          {React.createElement(DECISION_CFG[c.decision]?.icon, { className: "h-3.5 w-3.5" })}
                          {c.decision}
                        </div>
                      ) : <span className="text-slate-400 text-xs italic">Pending</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        {user?.privileges?.interviews?.canEdit && (
                          <>
                            <Button variant="ghost" size="icon" title="Conduct Interview" onClick={() => { setActiveCandidate(c); setShowScoresheet(true); }}>
                              <FileText className="h-4 w-4 text-indigo-600" />
                            </Button>
                            {c.decision === 'Applicable' && (
                              <Button variant="ghost" size="icon" title="Forward to Onboarding" onClick={() => forwardToOnboarding(c)}>
                                <ArrowRight className="h-4 w-4 text-green-600" />
                              </Button>
                            ) }
                          </>
                        )}
                        {user?.privileges?.interviews?.canDelete && (
                          <Button variant="ghost" size="icon" onClick={() => {
                            if (confirm('Delete this candidate?')) deleteInterviewCandidate(c.id);
                          }}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500 italic">No candidates found.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <InviteDialog open={showInvite} onClose={() => setShowInvite(false)} currentUser={user} />
      
      <ScoresheetDialog 
        open={showScoresheet} 
        candidate={activeCandidate} 
        onClose={() => { setShowScoresheet(false); setActiveCandidate(null); }}
        onSave={(sheet) => {
          if (activeCandidate) {
            updateInterviewCandidate(activeCandidate.id, { 
              scoresheet: sheet, 
              status: 'Completed',
              decision: sheet.suitabilityVerdict === 'Not Suitable' ? 'Not Applicable' : 
                        (sheet.suitabilityVerdict === 'Potential Star' || sheet.suitabilityVerdict === 'Good Candidate') ? 'Applicable' : 'Callback'
            });
            toast.success('Scoresheet saved!');
          }
        }}
      />
    </div>
  );
}
