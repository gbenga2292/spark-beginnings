import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Badge } from '@/src/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { 
  X, Save, Printer, User, Briefcase, Calendar, 
  CheckCircle2, AlertCircle, TrendingUp, Award, 
  MessageSquare, Users, ShieldCheck, Heart,
  ClipboardCheck, Target, Pencil
} from 'lucide-react';
import { Employee, EvaluationRecord, AppraisalCriterionData, AppraisalActionPlan } from '@/src/store/appStore';
import { format } from 'date-fns';
import { toast } from '@/src/components/ui/toast';
import { useAuth } from '@/src/hooks/useAuth';
import logoSrc from '../../../logo/logo-2.png';

interface AppraisalScoreSheetProps {
  employee: Employee;
  record?: EvaluationRecord; // For editing
  onSave: (data: Partial<EvaluationRecord>) => void;
  onClose: () => void;
}

const CRITERIA = [
  // Section 1: Core Job Performance (Weight: 45%)
  { id: '1', name: 'Knowledge of the job', weight: 10, section: 'Core Job Performance', sectionWeight: 45, description: 'How well does the employee know the job' },
  { id: '2', name: 'Integrity & Discipline', weight: 10, section: 'Core Job Performance', sectionWeight: 45, description: 'Honesty and consistency of the employee towards the job' },
  { id: '3', name: 'Care of Company’s Assets', weight: 10, section: 'Core Job Performance', sectionWeight: 45, description: 'Does the employee take good care of the company’s property' },
  { id: '4', name: 'Health & Safety Knowledge & Application', weight: 15, section: 'Core Job Performance', sectionWeight: 45, description: 'What health and safety knowledge is the employee aware of and how have they applied this on the job' },
  
  // Section 2: Professionalism & Attitude (Weight: 30%)
  { id: '5', name: 'Punctuality & Attendance', weight: 10, section: 'Professionalism & Attitude', sectionWeight: 30, description: 'Includes consistent on-time arrival, adherence to schedule, and reliable attendance.' },
  { id: '6', name: 'Professional Appearance & Dress Code', weight: 10, section: 'Professionalism & Attitude', sectionWeight: 30, description: 'Adherence to company uniform/PPE policy, and maintenance of a neat, site-appropriate appearance.' },
  { id: '7', name: 'Communication Skills', weight: 10, section: 'Professionalism & Attitude', sectionWeight: 30, description: 'Clear, effective verbal/written updates with team, supervisors, and clients; active listening.' },
  
  // Section 3: Improvement & Development (Weight: 15%)
  { id: '8', name: 'Problem-Solving', weight: 5, section: 'Improvement & Development', sectionWeight: 15, description: 'Does this person have the skill to solve issues' },
  { id: '9', name: 'Adaptability & Willingness to Learn', weight: 5, section: 'Improvement & Development', sectionWeight: 15, description: 'How well is the staff willing to learn the job role and be able to adapt' },
  { id: '10', name: 'Improvement of job knowledge', weight: 5, section: 'Improvement & Development', sectionWeight: 15, description: 'Have this person improve on knowing about the job' },
  
  // Section 4: Additional Critical Areas (Weight: 10%)
  { id: '11', name: 'Teamwork & Collaboration', weight: 5, section: 'Additional Critical Areas', sectionWeight: 10, description: 'How well does this person collaborate with team members on a job' },
  { id: '12', name: 'Communication with others', weight: 5, section: 'Additional Critical Areas', sectionWeight: 10, description: 'How well does this person communicate with team, members, and others around the office' },
];

export function AppraisalScoreSheet({ employee, record, onSave, onClose }: AppraisalScoreSheetProps) {
  const { user } = useAuth();
  
  // Form State
  const [reviewPeriod, setReviewPeriod] = useState(record?.reviewPeriod || '');
  const [appraisalDate, setAppraisalDate] = useState(record?.date || format(new Date(), 'yyyy-MM-dd'));
  const [criteriaData, setCriteriaData] = useState<Record<string, AppraisalCriterionData>>(
    record?.appraisalCriteria || CRITERIA.reduce((acc, c) => ({ ...acc, [c.id]: { rating: 0, comment: '' } }), {})
  );
  const [strengths, setStrengths] = useState(record?.strengths || '');
  const [actionPlans, setActionPlans] = useState<AppraisalActionPlan[]>(
    record?.actionPlans || [
      { area: '', action: '', target: '' },
      { area: '', action: '', target: '' }
    ]
  );
  const [employeeComments, setEmployeeComments] = useState(record?.employeeComment || '');
  
  // Signature States
  const [reviewerSig, setReviewerSig] = useState(record?.reviewerSignature || { signed: false });
  const [hrSig, setHrSig] = useState(record?.hrSignature || { signed: false });

  // Calculations
  const sectionScores = useMemo(() => {
    const scores: Record<string, number> = {
      'Core Job Performance': 0,
      'Professionalism & Attitude': 0,
      'Improvement & Development': 0,
      'Additional Critical Areas': 0,
    };

    CRITERIA.forEach(c => {
      const data = criteriaData[c.id];
      if (data && data.rating > 0) {
        // Criterion Score = (Rating / 5) * Weight
        scores[c.section] += (data.rating / 5) * c.weight;
      }
    });

    return scores;
  }, [criteriaData]);

  const totalScore = useMemo(() => {
    return Object.values(sectionScores).reduce((a, b) => a + b, 0);
  }, [sectionScores]);

  const performanceCategory = useMemo(() => {
    if (totalScore >= 90) return { label: 'Outstanding', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
    if (totalScore >= 80) return { label: 'Above Average', color: 'bg-blue-100 text-blue-800 border-blue-200' };
    if (totalScore >= 70) return { label: 'Competent', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' };
    if (totalScore >= 60) return { label: 'Needs Improvement Plan', color: 'bg-amber-100 text-amber-800 border-amber-200' };
    return { label: 'Unsatisfactory', color: 'bg-rose-100 text-rose-800 border-rose-200' };
  }, [totalScore]);

  const handleRatingChange = (id: string, rating: number) => {
    setCriteriaData(prev => ({
      ...prev,
      [id]: { ...prev[id], rating }
    }));
  };

  const handleCommentChange = (id: string, comment: string) => {
    setCriteriaData(prev => ({
      ...prev,
      [id]: { ...prev[id], comment }
    }));
  };

  const handleActionPlanChange = (index: number, field: keyof AppraisalActionPlan, value: string) => {
    const next = [...actionPlans];
    next[index] = { ...next[index], [field]: value };
    setActionPlans(next);
  };

  const handleSave = () => {
    if (!reviewPeriod) {
      toast.error('Please specify the Review Period');
      return;
    }

    const hasIncompleteRatings = CRITERIA.some(c => criteriaData[c.id].rating === 0);
    if (hasIncompleteRatings) {
      toast.warning('Some criteria are missing ratings. They will be treated as zero score.');
    }

    onSave({
      employeeId: employee.id,
      date: appraisalDate,
      type: 'Annual', // Defaulting to annual for this sheet
      isAppraisal: true,
      reviewPeriod,
      appraisalCriteria: criteriaData,
      overallScore: Math.round(totalScore),
      strengths,
      actionPlans,
      employeeComment: employeeComments,
      reviewerSignature: reviewerSig,
      hrSignature: hrSig,
      status: 'Review'
    });
  };

  const renderSection = (title: string, weight: number) => {
    const sectionCriteria = CRITERIA.filter(c => c.section === title);
    return (
      <div key={title} className="mb-8">
        <div className="flex items-center justify-between mb-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            {title === 'Core Job Performance' && <Award className="h-5 w-5 text-indigo-600" />}
            {title === 'Professionalism & Attitude' && <ShieldCheck className="h-5 w-5 text-indigo-600" />}
            {title === 'Improvement & Development' && <TrendingUp className="h-5 w-5 text-indigo-600" />}
            {title === 'Additional Critical Areas' && <Users className="h-5 w-5 text-indigo-600" />}
            {title} <span className="text-slate-400 font-normal ml-1">(Weight: {weight}%)</span>
          </h3>
          <Badge variant="outline" className="bg-white text-indigo-700 font-bold">
            Section Score: {sectionScores[title].toFixed(1)}
          </Badge>
        </div>
        
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50">
                <TableHead className="w-12">NO</TableHead>
                <TableHead className="min-w-[200px]">Criteria</TableHead>
                <TableHead className="w-20">Weight</TableHead>
                <TableHead className="w-32">Rating (1-5)</TableHead>
                <TableHead className="w-20">Score</TableHead>
                <TableHead>Comments & Examples</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sectionCriteria.map(c => {
                const data = criteriaData[c.id];
                const score = (data.rating / 5) * c.weight;
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-bold text-slate-400">{c.id}</TableCell>
                    <TableCell>
                      <div className="font-bold text-slate-700">{c.name}</div>
                      <div className="text-[10px] text-slate-500 italic mt-0.5">{c.description}</div>
                    </TableCell>
                    <TableCell className="text-xs font-semibold text-slate-600">{c.weight}%</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map(star => (
                          <button
                            key={star}
                            onClick={() => handleRatingChange(c.id, star)}
                            className={`h-6 w-6 rounded-md flex items-center justify-center transition-all ${
                              data.rating >= star 
                                ? 'bg-indigo-600 text-white shadow-sm' 
                                : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                            }`}
                          >
                            <span className="text-[10px] font-bold">{star}</span>
                          </button>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="font-bold text-indigo-600 text-xs">
                      {score > 0 ? score.toFixed(1) : '-'}
                    </TableCell>
                    <TableCell>
                      <textarea
                        className="w-full text-xs p-2 rounded border border-slate-200 focus:ring-1 focus:ring-indigo-500/20 outline-none min-h-[60px]"
                        value={data.comment}
                        onChange={(e) => handleCommentChange(c.id, e.target.value)}
                        placeholder="Add specific examples..."
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-slate-900/60 backdrop-blur-sm overflow-hidden animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-5xl h-full rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <img src={logoSrc} alt="Logo" className="h-10 w-auto" />
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">APPRAISAL EVALUATION SCORE SHEET</h2>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Employee Performance Assessment</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-9 gap-2" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Print
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full hover:bg-rose-50 hover:text-rose-600" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Scrollable Form Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 bg-[#fdfdfd]">
          
          {/* Top Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 rounded-xl bg-white border border-slate-200 shadow-sm">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Employee Name</label>
              <div className="flex items-center gap-2 text-slate-800 font-bold">
                <User className="h-4 w-4 text-indigo-500" />
                {employee.surname} {employee.firstname}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Position</label>
              <div className="flex items-center gap-2 text-slate-800 font-medium">
                <Briefcase className="h-4 w-4 text-indigo-500" />
                {employee.position}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Review Period</label>
              <Input 
                className="h-8 text-sm" 
                value={reviewPeriod} 
                onChange={(e) => setReviewPeriod(e.target.value)}
                placeholder="e.g. Q1 2024, FY 2023"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Reviewer</label>
              <div className="flex items-center gap-2 text-slate-800 font-medium">
                <ClipboardCheck className="h-4 w-4 text-indigo-500" />
                {user?.user_metadata?.name || 'System'}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Appraisal Date</label>
              <Input 
                type="date" 
                className="h-8 text-sm" 
                value={appraisalDate} 
                onChange={(e) => setAppraisalDate(e.target.value)}
              />
            </div>
          </div>

          <div className="bg-indigo-50/50 p-4 rounded-lg border border-indigo-100 text-xs text-indigo-800 italic leading-relaxed">
            <CheckCircle2 className="h-4 w-4 inline-block mr-2 text-indigo-600" />
            For this appraisal, the guiding questions are below. Take time to read through before appraising.
          </div>

          {/* Scoring Sections */}
          {renderSection('Core Job Performance', 45)}
          {renderSection('Professionalism & Attitude', 30)}
          {renderSection('Improvement & Development', 15)}
          {renderSection('Additional Critical Areas', 10)}

          {/* Summary & Total Score Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            <Card className="border-slate-200 shadow-sm overflow-hidden">
              <CardHeader className="bg-slate-50 py-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4 text-indigo-600" />
                  Summary & Total Score
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-[10px] font-bold">Section</TableHead>
                      <TableHead className="text-[10px] font-bold text-center">Max Score</TableHead>
                      <TableHead className="text-[10px] font-bold text-right">Employee Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="text-xs">Core Job Performance</TableCell>
                      <TableCell className="text-xs text-center">45</TableCell>
                      <TableCell className="text-xs text-right font-bold">{sectionScores['Core Job Performance'].toFixed(1)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-xs">Professionalism & Attitude</TableCell>
                      <TableCell className="text-xs text-center">30</TableCell>
                      <TableCell className="text-xs text-right font-bold">{sectionScores['Professionalism & Attitude'].toFixed(1)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-xs">Improvement & Development</TableCell>
                      <TableCell className="text-xs text-center">15</TableCell>
                      <TableCell className="text-xs text-right font-bold">{sectionScores['Improvement & Development'].toFixed(1)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-xs">Additional Critical Areas</TableCell>
                      <TableCell className="text-xs text-center">10</TableCell>
                      <TableCell className="text-xs text-right font-bold">{sectionScores['Additional Critical Areas'].toFixed(1)}</TableCell>
                    </TableRow>
                    <TableRow className="bg-slate-50 font-black">
                      <TableCell className="text-xs uppercase">Total Score</TableCell>
                      <TableCell className="text-xs text-center">100</TableCell>
                      <TableCell className="text-sm text-right text-indigo-600">{totalScore.toFixed(1)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <div className={`p-6 rounded-xl border-2 flex flex-col items-center justify-center text-center ${performanceCategory.color} shadow-sm`}>
                <label className="text-[10px] font-black uppercase tracking-widest mb-1 opacity-60">Overall Performance Category</label>
                <div className="text-3xl font-black mb-1">{totalScore.toFixed(1)}%</div>
                <div className="text-lg font-bold tracking-tight">{performanceCategory.label}</div>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
                  <div className="flex justify-between items-center border-b pb-1">
                    <span>90–100%</span> <span className="text-emerald-600 font-black">Outstanding</span>
                  </div>
                  <div className="flex justify-between items-center border-b pb-1">
                    <span>80–89%</span> <span className="text-blue-600 font-black">Above Average</span>
                  </div>
                  <div className="flex justify-between items-center border-b pb-1">
                    <span>70–79%</span> <span className="text-indigo-600 font-black">Competent</span>
                  </div>
                  <div className="flex justify-between items-center border-b pb-1">
                    <span>60–69%</span> <span className="text-amber-600 font-black">Needs Improvement</span>
                  </div>
                  <div className="flex justify-between items-center border-b pb-1">
                    <span>Below 60%</span> <span className="text-rose-600 font-black">Unsatisfactory</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Strengths & Development */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 border-b pb-2">
                <Award className="h-5 w-5 text-indigo-600" />
                Key Strengths & Notable Achievements
              </h3>
              <textarea
                className="w-full min-h-[150px] p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm leading-relaxed"
                value={strengths}
                onChange={(e) => setStrengths(e.target.value)}
                placeholder="List major contributions, awards, or exceptional performance points..."
              />
            </div>

            <div className="space-y-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 border-b pb-2">
                <Target className="h-5 w-5 text-indigo-600" />
                Areas for Development & Action Plans
              </h3>
              <div className="space-y-4">
                {actionPlans.map((ap, idx) => (
                  <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-slate-50/30 space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="flex items-center justify-center h-5 w-5 rounded-full bg-slate-200 text-[10px] font-bold text-slate-600">{idx + 1}</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Development Objective</span>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      <Input 
                        placeholder="Area: (e.g. Technical Knowledge, Communication)" 
                        className="h-8 text-xs bg-white" 
                        value={ap.area}
                        onChange={(e) => handleActionPlanChange(idx, 'area', e.target.value)}
                      />
                      <Input 
                        placeholder="Action Plan: (e.g. Training, Mentoring, Workshop)" 
                        className="h-8 text-xs bg-white" 
                        value={ap.action}
                        onChange={(e) => handleActionPlanChange(idx, 'action', e.target.value)}
                      />
                      <Input 
                        placeholder="Target: (e.g. 3 Months, By end of Q3)" 
                        className="h-8 text-xs bg-white" 
                        value={ap.target}
                        onChange={(e) => handleActionPlanChange(idx, 'target', e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Rating Scale Legend */}
          <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg">
            <h4 className="font-bold text-sm mb-4 flex items-center gap-2 opacity-90 uppercase tracking-widest">
              <Award className="h-4 w-4" /> Rating Scale Guide
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              <div className="space-y-1">
                <span className="text-emerald-400 font-black">5 = Outstanding:</span>
                <p className="text-[10px] opacity-70 leading-normal">Consistently exceeds role expectations; a role model in this area.</p>
              </div>
              <div className="space-y-1">
                <span className="text-blue-400 font-black">4 = Above Average:</span>
                <p className="text-[10px] opacity-70 leading-normal">Frequently exceeds expectations with high-quality contributions.</p>
              </div>
              <div className="space-y-1">
                <span className="text-indigo-400 font-black">3 = Competent:</span>
                <p className="text-[10px] opacity-70 leading-normal">Reliably meets all job requirements and standards.</p>
              </div>
              <div className="space-y-1">
                <span className="text-amber-400 font-black">2 = Needs Improvement:</span>
                <p className="text-[10px] opacity-70 leading-normal">Inconsistent; often meets only minimum standards or requires supervision.</p>
              </div>
              <div className="space-y-1">
                <span className="text-rose-400 font-black">1 = Unsatisfactory:</span>
                <p className="text-[10px] opacity-70 leading-normal">Fails to meet basic job requirements in this area.</p>
              </div>
            </div>
          </div>

          {/* Employee Comments */}
          <div className="space-y-4">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 border-b pb-2">
              <MessageSquare className="h-5 w-5 text-indigo-600" />
              Employee Comments
            </h3>
            <textarea
              className="w-full min-h-[100px] p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm italic text-slate-600 leading-relaxed"
              value={employeeComments}
              onChange={(e) => setEmployeeComments(e.target.value)}
              placeholder="The employee may add their comments or reflections on this appraisal here..."
            />
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-10 pb-20 border-t border-dashed border-slate-200">
            <div className="space-y-6">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Employee Signature</label>
              <div className="border-b border-slate-900 pb-2 h-12 flex items-end justify-center italic text-slate-400 text-xs">
                (Sign upon acknowledgement)
              </div>
              <div className="flex justify-between text-[10px] font-bold uppercase text-slate-500">
                <span>Date: ____________</span>
              </div>
            </div>
            
            <div className="space-y-6">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Reviewer/Supervisor Signature</label>
              <div className="border-b border-slate-900 pb-2 h-12 flex items-end justify-center">
                {reviewerSig.signed ? (
                  <span className="font-serif text-lg font-bold text-indigo-900">{reviewerSig.name}</span>
                ) : (
                  <Button variant="outline" size="sm" className="h-8 text-[10px] uppercase font-black tracking-widest hover:bg-indigo-50" onClick={() => setReviewerSig({ signed: true, date: new Date().toISOString(), name: user?.user_metadata?.name })}>
                    Sign Appraisal
                  </Button>
                )}
              </div>
              <div className="flex justify-between text-[10px] font-bold uppercase text-slate-500">
                <span>Date: {reviewerSig.date ? format(new Date(reviewerSig.date), 'dd/MM/yyyy') : '____________'}</span>
              </div>
            </div>

            <div className="space-y-6">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">HR / Dept Head Acknowledgment</label>
              <div className="border-b border-slate-900 pb-2 h-12 flex items-end justify-center">
                {hrSig.signed ? (
                  <span className="font-serif text-lg font-bold text-indigo-900">{hrSig.name}</span>
                ) : (
                  <Button variant="outline" size="sm" className="h-8 text-[10px] uppercase font-black tracking-widest hover:bg-indigo-50" onClick={() => setHrSig({ signed: true, date: new Date().toISOString(), name: user?.user_metadata?.name })}>
                    Sign Acknowledgment
                  </Button>
                )}
              </div>
              <div className="flex justify-between text-[10px] font-bold uppercase text-slate-500">
                <span>Date: {hrSig.date ? format(new Date(hrSig.date), 'dd/MM/yyyy') : '____________'}</span>
              </div>
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 flex justify-between items-center bg-white sticky bottom-0 z-20">
          <p className="text-[10px] text-slate-400 max-w-md italic">
            * Signing acknowledges the discussion, not necessarily agreement with all content. This document is a formal performance record.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="h-10 px-6 font-bold text-slate-600">
              Cancel
            </Button>
            <Button onClick={handleSave} className="h-10 px-8 bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-lg shadow-indigo-200">
              <Save className="h-4 w-4 mr-2" /> Save Appraisal Record
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
