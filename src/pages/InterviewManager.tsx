import React, { useState, useMemo } from 'react';
import { useAppStore } from '@/src/store/appStore';
import { useUserStore } from '@/src/store/userStore';
import { useTheme } from '@/src/hooks/useTheme';
import { cn } from '@/src/lib/utils';
import { toast, showConfirm } from '@/src/components/ui/toast';
import { Button } from '@/src/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, Plus, Search, CheckCircle2, XCircle, PhoneCall, 
  UserPlus, Trash2, Eye, FileText, CalendarDays, Star, 
  Briefcase, Filter, ArrowRight, ClipboardList, RefreshCw, UserCheck, X, ChevronDown, ChevronUp, BarChart2
} from 'lucide-react';
import type { 
  InterviewCandidate, InterviewStage, InterviewDecision, 
  InterviewScoresheet, KeyAttributes, SuitabilityVerdict 
} from '@/src/types/interviews';
import { useSetPageTitle } from '@/src/contexts/PageContext';

const uid = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};
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
  qualifications: candidate?.cvQualifications?.length ? candidate.cvQualifications : [{ dates: '', institution: '', qualification: '' }],
  workExperience: candidate?.cvWorkExperience?.length ? candidate.cvWorkExperience : [{ date: '', organisation: '', jobTitle: '' }],
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

const extractPdfText = async (file: File) => {
  const { pdfjs } = await import('react-pdf');
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  let text = '';
  const maxPages = Math.min(pdf.numPages, 5);
  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((s: any) => s.str).join(' ') + '\n';
  }
  return text;
};

const extractDocxText = async (file: File) => {
  const mammoth = await import('mammoth/mammoth.browser');
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
};

const extractResumeData = async (file: File) => {
  let apiKey = import.meta.env.VITE_GROQ_API_KEY || localStorage.getItem('GROQ_API_KEY');
  if (!apiKey) {
    apiKey = window.prompt('Please enter your Groq API Key to use the AI OCR feature (or add VITE_GROQ_API_KEY to your .env file):');
    if (!apiKey) {
      throw new Error('API Key is required for AI OCR');
    }
    localStorage.setItem('GROQ_API_KEY', apiKey);
  }

  const basePrompt = `Extract the following information from this resume/CV:
1. Candidate Name (candidateName)
2. Phone Number (phone)
3. Email Address (email)
4. Qualifications/Education Background (qualifications) - array of { dates, institution, qualification }
5. Professional/Work Experience (workExperience) - array of { date, organisation, jobTitle }

Return ONLY a valid JSON object matching this structure without any markdown formatting:
{
  "candidateName": "",
  "phone": "",
  "email": "",
  "qualifications": [{ "dates": "", "institution": "", "qualification": "" }],
  "workExperience": [{ "date": "", "organisation": "", "jobTitle": "" }]
}`;

  let requestBody: any;

  if (file.type.startsWith('image/')) {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    
    requestBody = {
      model: 'llama-3.2-11b-vision-preview',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: basePrompt },
          { type: 'image_url', image_url: { url: `data:${file.type};base64,${base64}` } }
        ]
      }],
      temperature: 0
    };
  } else {
    let textContent = '';
    if (file.type === 'application/pdf') {
      try {
        textContent = await extractPdfText(file);
      } catch (e) {
        console.error('PDF extraction failed', e);
        throw new Error('Could not read PDF text. Try saving as an image or use a text-based PDF.');
      }
    } else if (file.name.toLowerCase().endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      try {
        textContent = await extractDocxText(file);
      } catch (e) {
        console.error('DOCX extraction failed', e);
        throw new Error('Could not read DOCX text. Please convert to PDF or Image.');
      }
    } else if (file.name.toLowerCase().endsWith('.doc') || file.type === 'application/msword') {
      throw new Error('Legacy .doc format is not supported. Please save as .docx or .pdf.');
    } else {
      textContent = await file.text();
    }

    requestBody = {
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: `${basePrompt}\n\nResume Text:\n${textContent.substring(0, 10000)}` }],
      temperature: 0,
      response_format: { type: 'json_object' }
    };
  }

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Failed to call Groq API');
  }

  const data = await res.json();
  let jsonString = data.choices[0].message.content;
  // Fallback to extract json block if model wraps it in markdown
  const match = jsonString.match(/\{[\s\S]*\}/);
  if (match) {
    jsonString = match[0];
  }
  return JSON.parse(jsonString);
};

/* ── InviteDialog ─────────────────────────────────────────────────────── */
function InviteDialog({ open, onClose, currentUser }: { open: boolean; onClose: () => void; currentUser: any }) {
  const { addInterviewCandidate, interviewCandidates, positions, departments } = useAppStore();
  const { isDark } = useTheme();
  const [f, setF] = useState({ 
    candidateName:'', phone:'', email:'', appliedRole:'', department:'', 
    stage:'Preliminary' as InterviewStage, scheduledDate: today(), scheduledTime:'',
    source: '', remarks: '' 
  });
  const [cvQualifications, setCvQualifications] = useState<{dates:string;institution:string;qualification:string}[]>([]);
  const [cvWorkExperience, setCvWorkExperience] = useState<{date:string;organisation:string;jobTitle:string}[]>([]);
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const inp = cn('w-full border rounded-xl px-3 py-2.5 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent', isDark ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-600' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400');
  const lbl = 'block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1';

  const runInviteOcr = async (file?: File) => {
    if (!file) return;
    setIsOcrLoading(true);
    try {
      const data = await extractResumeData(file);
      setF(p => ({
        ...p,
        candidateName: data.candidateName || p.candidateName,
        phone: data.phone || p.phone,
        email: data.email || p.email,
      }));
      if (data.qualifications?.length) setCvQualifications(data.qualifications);
      if (data.workExperience?.length) setCvWorkExperience(data.workExperience);
      const quals = data.qualifications?.length || 0;
      const exp = data.workExperience?.length || 0;
      toast.success(`AI Intelligence: Extracted details for "${data.candidateName || file.name}" — ${quals} qualifications, ${exp} work records. These will auto-populate the Assessment History tab.`);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message === 'API Key is required for AI OCR' ? e.message : 'AI OCR Failed: Ensure the file is a PDF or Image, and API Key is valid.');
    } finally {
      setIsOcrLoading(false);
    }
  };

  const handleFileClick = () => fileInputRef.current?.click();
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) runInviteOcr(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const submit = async () => {
    if (!f.candidateName.trim() || !f.appliedRole.trim() || !f.scheduledDate) { toast.error('Name, role and date required'); return; }
    
    const isDuplicate = interviewCandidates.some(c => 
      c.candidateName.toLowerCase().trim() === f.candidateName.toLowerCase().trim() ||
      (f.email && c.email?.toLowerCase().trim() === f.email.toLowerCase().trim()) ||
      (f.phone && c.phone?.trim() === f.phone.trim())
    );

    if (isDuplicate) {
      const ok = await showConfirm(`A candidate named "${f.candidateName.trim()}" or with matching contact details already exists. Do you want to proceed and create a duplicate record?`, { confirmLabel: 'Yes, Proceed' });
      if (!ok) return;
    }

    addInterviewCandidate({ 
      id: uid(), ...f, 
      status:'Invited', 
      invitedBy: currentUser?.name ?? 'HR', 
      createdAt: new Date().toISOString(),
      ...(cvQualifications.length ? { cvQualifications } : {}),
      ...(cvWorkExperience.length ? { cvWorkExperience } : {}),
    });
    toast.success('Candidate invited!');
    handleClose();
  };

  const handleClose = () => {
    setF({ candidateName:'', phone:'', email:'', appliedRole:'', department:'', stage:'Preliminary', scheduledDate: today(), scheduledTime:'', source:'', remarks:'' });
    setCvQualifications([]);
    setCvWorkExperience([]);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18 }}
            className="bg-card border-0 sm:border border-border rounded-none sm:rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col h-[100dvh] sm:h-auto sm:max-h-[90vh]"
          >
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-border bg-gradient-to-r from-primary/5 to-transparent shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <UserPlus className="w-4.5 h-4.5 text-primary" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground">Invite Candidate</h2>
                  <p className="text-[11px] text-muted-foreground">Upload a CV or manually fill the form to invite a candidate.</p>
                </div>
              </div>
              <button onClick={handleClose} className="p-1.5 rounded-full hover:bg-muted transition-colors flex-shrink-0">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-5 sm:space-y-6 overflow-y-auto custom-scrollbar flex-1">
              {/* AI Parsing Section */}
              <div className="bg-primary/5 border border-dashed border-primary/20 rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 transition-colors hover:border-primary/40 group">
                <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
                  <div className="h-10 w-10 sm:h-12 sm:w-12 bg-background rounded-xl flex items-center justify-center shadow-sm text-primary group-hover:scale-110 transition-transform flex-shrink-0">
                    <RefreshCw className={cn("h-5 w-5 sm:h-6 sm:w-6", isOcrLoading && "animate-spin")} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">AI CV Auto-Fill</h4>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Extract info directly from document</p>
                  </div>
                </div>
                <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.doc,.docx,image/*" onChange={handleFileChange} />
                <Button onClick={handleFileClick} disabled={isOcrLoading} variant="outline" className="w-full sm:w-auto text-primary font-bold h-9 sm:h-10 border-primary/20 hover:bg-primary/10">
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

            <div className="flex justify-end gap-3 px-4 sm:px-6 py-4 pb-6 sm:pb-4 border-t border-border bg-muted/30 shrink-0 flex-col sm:flex-row">
              <Button variant="outline" onClick={handleClose} className="w-full sm:w-auto h-auto py-2.5 rounded-xl text-sm font-medium order-2 sm:order-1 border-border">Cancel</Button>
              <Button onClick={submit} className="w-full sm:w-auto px-5 h-auto py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm order-1 sm:order-2">
                Generate Invitation
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/* ── ScoresheetDialog ─────────────────────────────────────────────────── */
function ScoresheetDialog({ open, candidate, onClose, onSave, onForward, currentUser }: { open: boolean; candidate: InterviewCandidate | null; onClose: () => void; onSave: (sheet: InterviewScoresheet) => void; onForward?: (candidate: InterviewCandidate, sheet: InterviewScoresheet) => void; currentUser?: any; }) {
  const { isDark } = useTheme();
  const [sheet, setSheet] = useState<InterviewScoresheet>(emptySheet(candidate || undefined));
  const [activeTab, setActiveTab] = useState<'info'|'quals'|'attrs'|'verdict'|'others'>('info');
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => { 
    if (candidate) {
      const existingSheets = candidate.scoresheets || (candidate.scoresheet ? [candidate.scoresheet] : []);
      let mySheet = existingSheets.find(s => s.interviewerName === currentUser?.name);
      
      if (!mySheet) {
        mySheet = emptySheet(candidate);
        mySheet.interviewerName = currentUser?.name || '';
      }
      setSheet(mySheet);
    }
  }, [candidate, currentUser]);

  const runMockOcr = async (file?: File) => {
    if (!file) return;
    setIsOcrLoading(true);
    try {
      const data = await extractResumeData(file);
      setSheet(p => ({
        ...p,
        applicantName: data.candidateName || p.applicantName,
        qualifications: data.qualifications?.length ? data.qualifications : p.qualifications,
        workExperience: data.workExperience?.length ? data.workExperience : p.workExperience,
      }));
      toast.success(`AI Deep Scan: Extracted ${data.qualifications?.length || 0} qualifications and ${data.workExperience?.length || 0} work records.`);
      if (data.qualifications?.length || data.workExperience?.length) {
        setActiveTab('quals');
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e.message === 'API Key is required for AI OCR' ? e.message : 'AI Deep Scan Failed. Please check your API Key and file format.');
    } finally {
      setIsOcrLoading(false);
    }
  };

  const handleOcrClick = () => fileInputRef.current?.click();
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) runMockOcr(file);
  };

  const inp = cn('w-full border rounded-xl px-3 py-2.5 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent', isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900');
  const lbl = 'block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1';
  const upd = (k: keyof InterviewScoresheet, v: any) => setSheet(p => ({ ...p, [k]: v }));

  const existingSheets = candidate?.scoresheets || (candidate?.scoresheet ? [candidate.scoresheet] : []);
  const allSheets = existingSheets.filter(s => !!s.interviewerName);

  const tabs = [
    { id: 'info', label: 'Details', icon: FileText },
    { id: 'quals', label: 'History', icon: Briefcase },
    { id: 'attrs', label: 'Attributes', icon: Star },
    { id: 'verdict', label: 'Verdict', icon: CheckCircle2 },
    ...(allSheets.length > 0 ? [{ id: 'others', label: 'All Reviews', icon: Users }] as const : [])
  ];

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18 }}
            className="bg-card border-0 sm:border border-border rounded-none sm:rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col h-[100dvh] sm:h-auto sm:max-h-[90vh]"
          >
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-border bg-gradient-to-r from-primary/5 to-transparent shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <ClipboardList className="w-4.5 h-4.5 text-primary" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground">Assessment</h2>
                  <p className="text-[11px] text-muted-foreground">Scoresheet for <span className="font-semibold text-foreground">{candidate?.candidateName}</span></p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="hidden sm:flex items-center gap-2 bg-muted/50 px-3 py-1.5 rounded-xl border border-border">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Progress</span>
                  <div className="w-16 h-1.5 bg-border rounded-full overflow-hidden">
                    <div className="h-full bg-primary transition-all duration-700" style={{ width: `${(tabs.findIndex(t => t.id === activeTab) + 1) * 25}%` }} />
                  </div>
                </div>
                <button onClick={onClose} className="p-1.5 rounded-full hover:bg-muted transition-colors flex-shrink-0">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            </div>

            <div className="bg-muted/10 px-4 py-2 border-b border-border flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar shrink-0">
              {tabs.map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => setActiveTab(id as any)} 
                  className={cn('flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap', 
                  activeTab === id ? 'bg-background text-foreground shadow-sm border border-border' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent')}>
                  <Icon className="h-3.5 w-3.5" /> {label}
                </button>
              ))}
            </div>

            <div className="p-4 sm:p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
              {activeTab === 'info' && (
                <div className="space-y-5 animate-in fade-in duration-300">
                  <div className="bg-primary/5 border border-dashed border-primary/20 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 transition-colors hover:border-primary/40">
                    <div className="flex items-center gap-4 w-full sm:w-auto">
                      <div className="h-10 w-10 bg-background rounded-xl flex items-center justify-center shadow-sm text-primary flex-shrink-0">
                        <RefreshCw className={cn("h-5 w-5", isOcrLoading && "animate-spin")} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-foreground">AI Intelligence</h4>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">Extract CV data into fields automatically.</p>
                      </div>
                    </div>
                    <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.doc,.docx,image/*" onChange={handleFileChange} />
                    <Button onClick={handleOcrClick} disabled={isOcrLoading} variant="outline" className="w-full sm:w-auto text-primary font-bold h-9 border-primary/20 hover:bg-primary/10">
                      {isOcrLoading ? 'Processing...' : 'Upload & Parse CV'}
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><label className={lbl}>Applicant Full Name</label><input className={inp} value={sheet.applicantName} onChange={e => upd('applicantName', e.target.value)} /></div>
                    <div><label className={lbl}>Job Position</label><input className={inp} value={sheet.jobTitle} onChange={e => upd('jobTitle', e.target.value)} /></div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><label className={lbl}>Current Remuneration</label><input className={inp} value={sheet.presentSalary} onChange={e => upd('presentSalary', e.target.value)} /></div>
                    <div><label className={lbl}>Expected Remuneration</label><input className={inp} value={sheet.askingSalary} onChange={e => upd('askingSalary', e.target.value)} /></div>
                  </div>
                  <div><label className={lbl}>Reason for Career Change</label><textarea className={cn(inp, 'h-20 resize-none')} value={sheet.reasonForLeaving} onChange={e => upd('reasonForLeaving', e.target.value)} /></div>
                </div>
              )}

              {activeTab === 'quals' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5"><ArrowRight className="h-3.5 w-3.5 text-primary" /> Educational Background</h4>
                      <Button size="sm" variant="ghost" onClick={() => upd('qualifications', [...sheet.qualifications, {dates:'', institution:'', qualification:''}])} className="text-primary text-[11px] font-bold h-7 hover:bg-primary/10">+ Add Entry</Button>
                    </div>
                    <div className="grid gap-2">
                      {sheet.qualifications.map((q, i) => (
                        <div key={i} className="flex flex-col sm:flex-row gap-2">
                          <input className={cn(inp, 'sm:w-1/4')} placeholder="Dates (e.g. 2018-2022)" value={q.dates} onChange={e => { const n = [...sheet.qualifications]; n[i].dates = e.target.value; upd('qualifications', n); }} />
                          <input className={cn(inp, 'sm:w-2/4')} placeholder="Institution" value={q.institution} onChange={e => { const n = [...sheet.qualifications]; n[i].institution = e.target.value; upd('qualifications', n); }} />
                          <input className={cn(inp, 'sm:w-1/4')} placeholder="Qualification" value={q.qualification} onChange={e => { const n = [...sheet.qualifications]; n[i].qualification = e.target.value; upd('qualifications', n); }} />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5"><ArrowRight className="h-3.5 w-3.5 text-primary" /> Professional Experience</h4>
                      <Button size="sm" variant="ghost" onClick={() => upd('workExperience', [...sheet.workExperience, {date:'', organisation:'', jobTitle:''}])} className="text-primary text-[11px] font-bold h-7 hover:bg-primary/10">+ Add Entry</Button>
                    </div>
                    <div className="grid gap-2">
                      {sheet.workExperience.map((w, i) => (
                        <div key={i} className="flex flex-col sm:flex-row gap-2">
                          <input className={cn(inp, 'sm:w-1/4')} placeholder="Duration" value={w.date} onChange={e => { const n = [...sheet.workExperience]; n[i].date = e.target.value; upd('workExperience', n); }} />
                          <input className={cn(inp, 'sm:w-2/4')} placeholder="Company" value={w.organisation} onChange={e => { const n = [...sheet.workExperience]; n[i].organisation = e.target.value; upd('workExperience', n); }} />
                          <input className={cn(inp, 'sm:w-1/4')} placeholder="Role" value={w.jobTitle} onChange={e => { const n = [...sheet.workExperience]; n[i].jobTitle = e.target.value; upd('workExperience', n); }} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'attrs' && (
                <div className="space-y-3 animate-in fade-in duration-300">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {ATTR_KEYS.map(k => (
                      <div key={k} className="p-4 bg-muted/30 rounded-2xl border border-border flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-foreground uppercase tracking-wide">{ATTR_LABELS[k]}</span>
                          <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-bold bg-background border border-border", 
                            (sheet.keyAttributes as any)[k] === 4 ? "text-emerald-600 border-emerald-200 bg-emerald-50" :
                            (sheet.keyAttributes as any)[k] === 3 ? "text-sky-600 border-sky-200 bg-sky-50" :
                            (sheet.keyAttributes as any)[k] === 2 ? "text-amber-600 border-amber-200 bg-amber-50" :
                            (sheet.keyAttributes as any)[k] === 1 ? "text-rose-600 border-rose-200 bg-rose-50" : "text-muted-foreground"
                          )}>
                            {(sheet.keyAttributes as any)[k] ? `Score: ${(sheet.keyAttributes as any)[k]}` : 'Unrated'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {[1,2,3,4].map(v => {
                            const colors = {
                              1: 'hover:bg-rose-50 hover:border-rose-400 text-rose-600',
                              2: 'hover:bg-amber-50 hover:border-amber-400 text-amber-600',
                              3: 'hover:bg-sky-50 hover:border-sky-400 text-sky-600',
                              4: 'hover:bg-emerald-50 hover:border-emerald-400 text-emerald-600'
                            };
                            const activeColors = {
                              1: 'bg-rose-600 border-rose-600 text-white shadow-sm',
                              2: 'bg-amber-600 border-amber-600 text-white shadow-sm',
                              3: 'bg-sky-600 border-sky-600 text-white shadow-sm',
                              4: 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                            };
                            return (
                              <button key={v} onClick={() => upd('keyAttributes', {...sheet.keyAttributes, [k]: v})} 
                                className={cn('flex-1 h-9 rounded-lg border font-bold text-xs transition-all flex items-center justify-center', 
                                (sheet.keyAttributes as any)[k] === v ? (activeColors as any)[v] : cn('bg-background border-border text-muted-foreground', (colors as any)[v]))}>
                                {v}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'verdict' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <div className="space-y-3">
                    <label className={lbl}>Final Suitability Verdict</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {SUITABILITY_OPTS.map(o => (
                        <button key={o} onClick={() => upd('suitabilityVerdict', o)} 
                          className={cn('px-3 py-3 rounded-xl border text-xs font-bold transition-all text-center flex items-center justify-center', 
                          sheet.suitabilityVerdict === o ? 'bg-primary border-primary text-primary-foreground shadow-md' : 'bg-background border-border text-muted-foreground hover:border-primary/40 hover:text-foreground')}>
                          {o}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div><label className={lbl}>Final Comments & Justification</label><textarea className={cn(inp, 'h-24 resize-none')} value={sheet.otherComments} onChange={e => upd('otherComments', e.target.value)} /></div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><label className={lbl}>Interviewer Name</label><input className={inp} value={sheet.interviewerName} onChange={e => upd('interviewerName', e.target.value)} readOnly={!!currentUser?.name} /></div>
                    <div><label className={lbl}>Assessment Date</label><input type="date" className={inp} value={sheet.interviewDate} onChange={e => upd('interviewDate', e.target.value)} /></div>
                  </div>
                  {(sheet.suitabilityVerdict === 'Good Candidate' || sheet.suitabilityVerdict === 'Potential Star') && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-in zoom-in duration-300">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-sm flex-shrink-0">
                          <UserCheck className="h-5 w-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-emerald-700 dark:text-emerald-400">Ready for Onboarding</h4>
                          <p className="text-[10px] sm:text-xs text-emerald-600/80 font-medium">This candidate meets our standards. Start onboarding now?</p>
                        </div>
                      </div>
                      <Button 
                        onClick={() => { if (candidate) onForward?.(candidate, sheet); onClose(); }} 
                        className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-5 h-9 font-bold shadow-sm text-xs"
                      >
                        Forward & Onboard
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'others' && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  {allSheets.map((os, i) => (
                    <div key={i} className="p-4 bg-muted/20 border border-border rounded-xl space-y-3 relative overflow-hidden">
                      {os.interviewerName === currentUser?.name && (
                        <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-bl-lg">
                          My Assessment
                        </div>
                      )}
                      <div className="flex items-center gap-2 border-b border-border pb-2">
                        <UserCheck className="h-4 w-4 text-primary" />
                        <span className="font-bold text-sm text-foreground">{os.interviewerName}</span>
                        <span className="text-[10px] text-muted-foreground ml-auto">{os.interviewDate}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-muted-foreground">Verdict</span>
                          <div className={cn("text-xs font-bold mt-0.5", os.suitabilityVerdict === 'Not Suitable' ? 'text-red-600' : 'text-emerald-600')}>{os.suitabilityVerdict || 'N/A'}</div>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-muted-foreground">Comments</span>
                          <div className="text-xs text-foreground mt-0.5 truncate" title={os.otherComments}>{os.otherComments || 'None'}</div>
                        </div>
                      </div>
                      {Object.keys(os.keyAttributes || {}).length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border/50">
                          {Object.entries(os.keyAttributes || {}).map(([k, v]) => (
                            <span key={k} className="text-[10px] bg-background border border-border px-2 py-0.5 rounded flex gap-1">
                              {ATTR_LABELS[k as keyof KeyAttributes]}: <span className="font-bold">{v}/4</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 px-4 sm:px-6 py-4 pb-6 sm:pb-4 border-t border-border bg-muted/30 shrink-0 flex-col sm:flex-row">
              <Button variant="outline" onClick={onClose} className="w-full sm:w-auto h-auto py-2.5 rounded-xl text-sm font-medium order-2 sm:order-1 border-border">Discard Changes</Button>
              <Button onClick={() => { onSave(sheet); onClose(); }} className="w-full sm:w-auto px-5 h-auto py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm order-1 sm:order-2">
                Finalize Scoresheet
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
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
  const [showStats, setShowStats] = useState(true);

  useSetPageTitle(
    'Interview Management',
    'Track candidates, conduct interviews, and manage evaluations.',
    user?.privileges?.interviews?.canAdd && (
      <Button onClick={() => setShowInvite(true)} className="hidden sm:flex bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
        <Plus className="h-4 w-4" /> Invite Candidate
      </Button>
    )
  );

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

  const forwardToOnboarding = async (candidate: InterviewCandidate, finalizedSheet?: InterviewScoresheet) => {
    const verdict = finalizedSheet?.suitabilityVerdict || candidate.scoresheet?.suitabilityVerdict;
    const isApplicable = verdict === 'Good Candidate' || verdict === 'Potential Star' || candidate.decision === 'Applicable';

    if (!isApplicable) {
      toast.error('Only applicable candidates can be forwarded.'); return;
    }

    const newEmpId = uid();
    const sheet = finalizedSheet || candidate.scoresheet;
    
    const nameParts = candidate.candidateName.trim().split(' ');
    const firstname = nameParts[0] || 'Unknown';
    const surname = nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'Unknown';

    try {
      await addEmployee({
        id: newEmpId,
        firstname,
        surname,
        position: candidate.appliedRole,
        department: candidate.department || 'Unassigned',
        status: 'Onboarding',
        startDate: today(),
        phone: candidate.phone,
        email: candidate.email,
        qualifications: sheet?.qualifications || [],
        workExperience: sheet?.workExperience || [],
        onboardingNotes: `Interview Verdict: ${verdict}\nPresent Salary: ${sheet?.presentSalary || 'N/A'}\nAsking Salary: ${sheet?.askingSalary || 'N/A'}\n\nNotes: ${sheet?.otherComments || 'None'}`,
      } as any);

      updateInterviewCandidate(candidate.id, { 
        decision: 'Forwarded to Onboarding', 
        status: 'Completed',
        onboardingEmployeeId: newEmpId,
        scoresheet: sheet
      });
      
      toast.success(`${candidate.candidateName} successfully forwarded to Onboarding! Check the Employee Directory to complete their setup.`);
    } catch (err: any) {
      toast.error(`Failed to save to database: ${err?.message || 'Unknown error'}. Please check your Supabase schema and try again.`);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">

      {user?.privileges?.interviews?.canAdd && (
        <Button onClick={() => setShowInvite(true)} className="w-full sm:hidden bg-indigo-600 hover:bg-indigo-700 text-white flex gap-2 h-11 text-base rounded-xl shadow-sm">
          <Plus className="h-5 w-5" /> Invite Candidate
        </Button>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-indigo-500" />
          Overview Statistics
        </h3>
        <Button variant="ghost" size="sm" className="h-8 text-xs text-slate-500" onClick={() => setShowStats(!showStats)}>
          {showStats ? <><ChevronUp className="w-3.5 h-3.5 mr-1" /> Hide</> : <><ChevronDown className="w-3.5 h-3.5 mr-1" /> Show</>}
        </Button>
      </div>

      <AnimatePresence initial={false}>
        {showStats && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pb-2">
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
          </motion.div>
        )}
      </AnimatePresence>

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
                    {/* Desktop Table */}
                    <table className="hidden md:table w-full text-sm text-left">
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
                                  <Button variant="ghost" size="icon" onClick={async () => {
                                    const ok = await showConfirm('Delete this candidate?', { variant: 'danger' });
                                    if (ok) deleteInterviewCandidate(c.id);
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

                    {/* Mobile Cards */}
                    <div className="md:hidden flex flex-col divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                      {items.map(c => (
                        <div key={c.id} className="p-4 space-y-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <div className="flex justify-between items-start gap-4">
                            <div>
                              <div className="font-bold text-slate-800 dark:text-slate-200">{c.candidateName}</div>
                              <div className="text-xs text-slate-500 mt-0.5">{c.email || c.phone || 'No contact'}</div>
                            </div>
                            <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0", STATUS_CFG[c.status]?.color || "bg-slate-100")}>
                              {c.status}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3 text-sm bg-slate-50 dark:bg-slate-800/30 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                            <div>
                              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Schedule</span>
                              <div className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-slate-400" /> {fmt(c.scheduledDate)}</div>
                              <div className="text-xs text-slate-500 mt-1">{c.scheduledTime || '--:--'}</div>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Decision</span>
                              {c.decision ? (
                                <div className={cn("flex items-center gap-1.5 text-xs font-semibold", DECISION_CFG[c.decision]?.color)}>
                                  {React.createElement(DECISION_CFG[c.decision]?.icon, { className: "h-3.5 w-3.5" })}
                                  {c.decision}
                                </div>
                              ) : <span className="text-slate-400 text-xs italic">Pending</span>}
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-1">
                            {user?.privileges?.interviews?.canEdit && (
                              <>
                                <Button variant="outline" size="sm" className="h-8 text-indigo-600 border-indigo-200 hover:bg-indigo-50 dark:border-indigo-800/50 dark:hover:bg-indigo-900/30" onClick={() => { setActiveCandidate(c); setShowScoresheet(true); }}>
                                  <FileText className="h-3.5 w-3.5 mr-1.5" /> Assess
                                </Button>
                                {c.decision === 'Applicable' && (
                                  <Button variant="outline" size="sm" className="h-8 text-green-600 border-green-200 hover:bg-green-50 dark:border-green-800/50 dark:hover:bg-green-900/30" onClick={() => forwardToOnboarding(c)}>
                                    <ArrowRight className="h-3.5 w-3.5 mr-1.5" /> Onboard
                                  </Button>
                                ) }
                              </>
                            )}
                            {user?.privileges?.interviews?.canDelete && (
                              <Button variant="outline" size="sm" className="h-8 px-2 text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800/50 dark:hover:bg-red-900/30" onClick={async () => {
                                const ok = await showConfirm('Delete this candidate?', { variant: 'danger' });
                                if (ok) deleteInterviewCandidate(c.id);
                              }}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
              {Object.keys(grouped).length === 0 && (
                <div className="text-center py-12 text-slate-500 italic">No candidates found for grouping.</div>
              )}
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <table className="hidden md:table w-full text-sm text-left">
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
                          <Button variant="ghost" size="icon" onClick={async () => {
                            const ok = await showConfirm('Delete this candidate?', { variant: 'danger' });
                            if (ok) deleteInterviewCandidate(c.id);
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

            {/* Mobile Cards */}
            <div className="md:hidden flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map(c => (
                <div key={c.id} className="p-4 space-y-4 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <div className="font-bold text-slate-800 dark:text-slate-200">{c.candidateName}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{c.email || c.phone || 'No contact'}</div>
                    </div>
                    <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0", STATUS_CFG[c.status]?.color || "bg-slate-100")}>
                      {c.status}
                    </span>
                  </div>
                  
                  <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-1.5 text-sm font-semibold"><Briefcase className="h-4 w-4 text-slate-400" /> {c.appliedRole}</div>
                    <div className="text-xs text-slate-500 mt-1.5 ml-5.5">{c.department || 'N/A'} • <span className="font-medium text-slate-600 dark:text-slate-400">{c.stage}</span></div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Schedule</span>
                      <div className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-slate-400" /> {fmt(c.scheduledDate)}</div>
                      <div className="text-xs text-slate-500 mt-1">{c.scheduledTime || '--:--'}</div>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Decision</span>
                      {c.decision ? (
                        <div className={cn("flex items-center gap-1.5 text-xs font-semibold", DECISION_CFG[c.decision]?.color)}>
                          {React.createElement(DECISION_CFG[c.decision]?.icon, { className: "h-3.5 w-3.5" })}
                          {c.decision}
                        </div>
                      ) : <span className="text-slate-400 text-xs italic">Pending</span>}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                    {user?.privileges?.interviews?.canEdit && (
                      <>
                        <Button variant="outline" size="sm" className="h-8 text-indigo-600 border-indigo-200 hover:bg-indigo-50 dark:border-indigo-800/50 dark:hover:bg-indigo-900/30" onClick={() => { setActiveCandidate(c); setShowScoresheet(true); }}>
                          <FileText className="h-3.5 w-3.5 mr-1.5" /> Assess
                        </Button>
                        {c.decision === 'Applicable' && (
                          <Button variant="outline" size="sm" className="h-8 text-green-600 border-green-200 hover:bg-green-50 dark:border-green-800/50 dark:hover:bg-green-900/30" onClick={() => forwardToOnboarding(c)}>
                            <ArrowRight className="h-3.5 w-3.5 mr-1.5" /> Onboard
                          </Button>
                        ) }
                      </>
                    )}
                    {user?.privileges?.interviews?.canDelete && (
                      <Button variant="outline" size="sm" className="h-8 px-2 text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800/50 dark:hover:bg-red-900/30" onClick={async () => {
                        const ok = await showConfirm('Delete this candidate?', { variant: 'danger' });
                        if (ok) deleteInterviewCandidate(c.id);
                      }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="p-12 text-center text-slate-500 italic bg-white dark:bg-slate-900">No candidates found.</div>
              )}
            </div>
            </>
          )}
        </div>
      </div>

      <InviteDialog open={showInvite} onClose={() => setShowInvite(false)} currentUser={user} />
      
      <ScoresheetDialog 
        open={showScoresheet} 
        candidate={activeCandidate} 
        currentUser={user}
        onClose={() => { setShowScoresheet(false); setActiveCandidate(null); }}
        onForward={(c, sheet) => forwardToOnboarding(c, sheet)}
        onSave={(sheet) => {
          if (activeCandidate) {
            const existingSheets = activeCandidate.scoresheets || (activeCandidate.scoresheet ? [activeCandidate.scoresheet] : []);
            const updatedSheets = [...existingSheets];
            const myIndex = updatedSheets.findIndex(s => s.interviewerName === sheet.interviewerName);
            if (myIndex >= 0) updatedSheets[myIndex] = sheet;
            else updatedSheets.push(sheet);

            updateInterviewCandidate(activeCandidate.id, { 
              scoresheets: updatedSheets, 
              scoresheet: sheet, // Maintain primary legacy backward compatibility
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
