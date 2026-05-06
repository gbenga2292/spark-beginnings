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
  ClipboardCheck, Target, Pencil, ArrowLeft, ChevronDown
} from 'lucide-react';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/src/components/ui/dropdown-menu';
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
  const [panelConclusion, setPanelConclusion] = useState<string>(record?.panelConclusion || '');
  
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
      panelConclusion: panelConclusion as "Confirm" | "Extend" | "End" | "Salary Increase",
      status: 'Review'
    });
  };

  const handlePrintReport = () => {
    const getCategoryColor = (score: number) => {
      if (score >= 90) return { bg: '#d1fae5', text: '#065f46', label: 'Outstanding' };
      if (score >= 80) return { bg: '#dbeafe', text: '#1e40af', label: 'Above Average' };
      if (score >= 70) return { bg: '#e0e7ff', text: '#3730a3', label: 'Competent' };
      if (score >= 60) return { bg: '#fef3c7', text: '#92400e', label: 'Needs Improvement' };
      return { bg: '#fee2e2', text: '#991b1b', label: 'Unsatisfactory' };
    };
    const cat = getCategoryColor(totalScore);

    const sectionTableRows = (sectionTitle: string) => {
      return CRITERIA.filter(c => c.section === sectionTitle).map(c => {
        const data = criteriaData[c.id];
        const score = data.rating > 0 ? ((data.rating / 5) * c.weight).toFixed(1) : '—';
        const ratingDots = [1,2,3,4,5].map(n =>
          `<span style="display:inline-block;width:18px;height:18px;border-radius:4px;margin-right:2px;font-size:10px;font-weight:bold;line-height:18px;text-align:center;background:${data.rating >= n ? '#4338ca' : '#e2e8f0'};color:${data.rating >= n ? '#fff' : '#94a3b8'};">${n}</span>`
        ).join('');
        return `
          <tr>
            <td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;font-size:9pt;font-weight:600;color:#1e293b;vertical-align:top;width:30%;">${c.name}<br><span style="font-size:7.5pt;font-weight:400;color:#94a3b8;font-style:italic;">${c.description}</span></td>
            <td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;font-size:9pt;color:#64748b;text-align:center;vertical-align:middle;">${c.weight}%</td>
            <td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;text-align:center;vertical-align:middle;">${ratingDots}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;font-size:9pt;font-weight:700;color:#4338ca;text-align:center;vertical-align:middle;">${score}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;font-size:8pt;color:#475569;vertical-align:top;">${data.comment || '—'}</td>
          </tr>`;
      }).join('');
    };

    const sectionBlock = (title: string, weight: number, iconChar: string) => {
      const sScore = sectionScores[title];
      return `
        <div style="margin-bottom:24px;break-inside:avoid;">
          <div style="display:flex;align-items:center;justify-content:space-between;background:#1e293b;color:#fff;padding:10px 14px;border-radius:6px 6px 0 0;">
            <span style="font-size:10pt;font-weight:800;letter-spacing:0.04em;text-transform:uppercase;">${iconChar} ${title}</span>
            <span style="font-size:9pt;font-weight:700;background:rgba(255,255,255,0.15);padding:2px 10px;border-radius:20px;">Weight: ${weight}% &nbsp;|&nbsp; Score: ${sScore.toFixed(1)} / ${weight}</span>
          </div>
          <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 6px 6px;overflow:hidden;">
            <thead>
              <tr style="background:#f8fafc;">
                <th style="padding:8px 10px;font-size:8pt;font-weight:700;color:#64748b;text-align:left;text-transform:uppercase;letter-spacing:0.06em;border-bottom:2px solid #e2e8f0;">Criteria</th>
                <th style="padding:8px 10px;font-size:8pt;font-weight:700;color:#64748b;text-align:center;text-transform:uppercase;letter-spacing:0.06em;border-bottom:2px solid #e2e8f0;width:60px;">Weight</th>
                <th style="padding:8px 10px;font-size:8pt;font-weight:700;color:#64748b;text-align:center;text-transform:uppercase;letter-spacing:0.06em;border-bottom:2px solid #e2e8f0;width:130px;">Rating</th>
                <th style="padding:8px 10px;font-size:8pt;font-weight:700;color:#64748b;text-align:center;text-transform:uppercase;letter-spacing:0.06em;border-bottom:2px solid #e2e8f0;width:60px;">Score</th>
                <th style="padding:8px 10px;font-size:8pt;font-weight:700;color:#64748b;text-align:left;text-transform:uppercase;letter-spacing:0.06em;border-bottom:2px solid #e2e8f0;">Comments</th>
              </tr>
            </thead>
            <tbody>${sectionTableRows(title)}</tbody>
          </table>
        </div>`;
    };

    const conclusionLabel: Record<string, string> = {
      Confirm: 'Confirm Employment', Extend: 'Extend Probation',
      End: 'End Employment', 'Salary Increase': 'End with Salary Increase', Promote: 'Recommend for Promotion'
    };
    const conclusionColors: Record<string, string> = {
      Confirm: '#d1fae5', Extend: '#fef3c7', End: '#fee2e2', 'Salary Increase': '#dbeafe', Promote: '#e0e7ff'
    };

    const actionPlanRows = actionPlans.filter(ap => ap.area || ap.action || ap.target).map((ap, i) => `
      <tr style="background:${i % 2 === 0 ? '#f8fafc' : '#fff'};">
        <td style="padding:7px 10px;font-size:9pt;border-bottom:1px solid #f1f5f9;">${ap.area || '—'}</td>
        <td style="padding:7px 10px;font-size:9pt;border-bottom:1px solid #f1f5f9;">${ap.action || '—'}</td>
        <td style="padding:7px 10px;font-size:9pt;border-bottom:1px solid #f1f5f9;">${ap.target || '—'}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Appraisal Report — ${employee.surname} ${employee.firstname}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; color: #1e293b; font-size: 10pt; line-height: 1.5; }
    @page { size: A4; margin: 15mm 12mm; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    .page { max-width: 210mm; margin: 0 auto; padding: 0 2mm; }
  </style>
</head>
<body>
<div class="page">

  <!-- REPORT HEADER -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:14px;border-bottom:3px solid #1e293b;margin-bottom:20px;">
    <div style="display:flex;align-items:center;gap:14px;">
      <img src="${logoSrc}" alt="Logo" style="height:52px;width:auto;" />
      <div>
        <div style="font-size:18pt;font-weight:900;color:#1e293b;letter-spacing:-0.02em;line-height:1.1;">PERFORMANCE APPRAISAL</div>
        <div style="font-size:8pt;font-weight:700;color:#64748b;letter-spacing:0.12em;text-transform:uppercase;margin-top:3px;">Formal Assessment Report</div>
      </div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:7.5pt;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;">Generated</div>
      <div style="font-size:10pt;font-weight:700;color:#1e293b;">${format(new Date(), 'dd MMMM yyyy')}</div>
      <div style="margin-top:6px;padding:4px 10px;background:#4338ca;color:#fff;border-radius:4px;font-size:8pt;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;">${reviewPeriod || 'Review Period'}</div>
    </div>
  </div>

  <!-- EMPLOYEE DETAILS -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:20px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
    <tbody>
      <tr style="background:#f8fafc;">
        <td style="padding:10px 14px;font-size:8pt;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;width:20%;border-right:1px solid #e2e8f0;">Employee</td>
        <td style="padding:10px 14px;font-size:11pt;font-weight:800;color:#1e293b;border-right:1px solid #e2e8f0;">${employee.surname} ${employee.firstname}</td>
        <td style="padding:10px 14px;font-size:8pt;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;width:20%;border-right:1px solid #e2e8f0;">Date</td>
        <td style="padding:10px 14px;font-size:10pt;font-weight:600;color:#1e293b;">${appraisalDate}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;font-size:8pt;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;border-right:1px solid #e2e8f0;border-top:1px solid #e2e8f0;">Position</td>
        <td style="padding:10px 14px;font-size:10pt;font-weight:600;color:#1e293b;border-right:1px solid #e2e8f0;border-top:1px solid #e2e8f0;">${employee.position}</td>
        <td style="padding:10px 14px;font-size:8pt;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;border-right:1px solid #e2e8f0;border-top:1px solid #e2e8f0;">Reviewer</td>
        <td style="padding:10px 14px;font-size:10pt;font-weight:600;color:#1e293b;border-top:1px solid #e2e8f0;">${user?.user_metadata?.name || 'System'}</td>
      </tr>
    </tbody>
  </table>

  <!-- SCORE SUMMARY BANNER -->
  <div style="display:flex;gap:12px;margin-bottom:24px;align-items:stretch;">
    <div style="flex:1;background:#1e293b;color:#fff;padding:16px 20px;border-radius:8px;">
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr>
            <th style="padding:4px 8px;font-size:8pt;color:rgba(255,255,255,0.6);text-align:left;border-bottom:1px solid rgba(255,255,255,0.15);">Section</th>
            <th style="padding:4px 8px;font-size:8pt;color:rgba(255,255,255,0.6);text-align:center;border-bottom:1px solid rgba(255,255,255,0.15);">Max</th>
            <th style="padding:4px 8px;font-size:8pt;color:rgba(255,255,255,0.6);text-align:right;border-bottom:1px solid rgba(255,255,255,0.15);">Score</th>
          </tr>
        </thead>
        <tbody>
          ${['Core Job Performance','Professionalism & Attitude','Improvement & Development','Additional Critical Areas'].map((s, i) => {
            const maxes = [45, 30, 15, 10];
            return `<tr>
              <td style="padding:5px 8px;font-size:9pt;color:rgba(255,255,255,0.85);">${s}</td>
              <td style="padding:5px 8px;font-size:9pt;color:rgba(255,255,255,0.6);text-align:center;">${maxes[i]}</td>
              <td style="padding:5px 8px;font-size:9pt;font-weight:700;color:#a5b4fc;text-align:right;">${sectionScores[s].toFixed(1)}</td>
            </tr>`;
          }).join('')}
          <tr style="border-top:1px solid rgba(255,255,255,0.2);">
            <td style="padding:7px 8px;font-size:10pt;font-weight:900;color:#fff;text-transform:uppercase;">TOTAL</td>
            <td style="padding:7px 8px;font-size:10pt;font-weight:700;color:rgba(255,255,255,0.6);text-align:center;">100</td>
            <td style="padding:7px 8px;font-size:13pt;font-weight:900;color:#a5b4fc;text-align:right;">${totalScore.toFixed(1)}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div style="width:160px;background:${cat.bg};border:2px solid ${cat.text}20;border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px;text-align:center;">
      <div style="font-size:8pt;font-weight:700;color:${cat.text};text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;">Overall Rating</div>
      <div style="font-size:28pt;font-weight:900;color:${cat.text};line-height:1;">${totalScore.toFixed(0)}<span style="font-size:14pt;">%</span></div>
      <div style="font-size:10pt;font-weight:800;color:${cat.text};margin-top:4px;">${cat.label}</div>
    </div>
  </div>

  <!-- SCORING SECTIONS -->
  ${sectionBlock('Core Job Performance', 45, '◆')}
  ${sectionBlock('Professionalism & Attitude', 30, '◆')}
  ${sectionBlock('Improvement & Development', 15, '◆')}
  ${sectionBlock('Additional Critical Areas', 10, '◆')}

  <!-- STRENGTHS -->
  ${strengths ? `
  <div style="margin-bottom:20px;break-inside:avoid;">
    <div style="background:#1e293b;color:#fff;padding:8px 14px;border-radius:6px 6px 0 0;font-size:10pt;font-weight:800;text-transform:uppercase;letter-spacing:0.04em;">▲ Key Strengths & Notable Achievements</div>
    <div style="border:1px solid #e2e8f0;border-top:none;border-radius:0 0 6px 6px;padding:14px;font-size:9.5pt;color:#334155;line-height:1.6;white-space:pre-wrap;">${strengths}</div>
  </div>` : ''}

  <!-- ACTION PLANS -->
  ${actionPlanRows ? `
  <div style="margin-bottom:20px;break-inside:avoid;">
    <div style="background:#1e293b;color:#fff;padding:8px 14px;border-radius:6px 6px 0 0;font-size:10pt;font-weight:800;text-transform:uppercase;letter-spacing:0.04em;">▲ Development Areas & Action Plans</div>
    <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 6px 6px;overflow:hidden;">
      <thead><tr style="background:#f8fafc;">
        <th style="padding:8px 10px;font-size:8pt;font-weight:700;color:#64748b;text-align:left;text-transform:uppercase;border-bottom:1px solid #e2e8f0;">Area</th>
        <th style="padding:8px 10px;font-size:8pt;font-weight:700;color:#64748b;text-align:left;text-transform:uppercase;border-bottom:1px solid #e2e8f0;">Action Plan</th>
        <th style="padding:8px 10px;font-size:8pt;font-weight:700;color:#64748b;text-align:left;text-transform:uppercase;border-bottom:1px solid #e2e8f0;">Target</th>
      </tr></thead>
      <tbody>${actionPlanRows}</tbody>
    </table>
  </div>` : ''}

  <!-- EMPLOYEE COMMENTS -->
  ${employeeComments ? `
  <div style="margin-bottom:20px;break-inside:avoid;">
    <div style="background:#1e293b;color:#fff;padding:8px 14px;border-radius:6px 6px 0 0;font-size:10pt;font-weight:800;text-transform:uppercase;letter-spacing:0.04em;">▲ Employee Comments</div>
    <div style="border:1px solid #e2e8f0;border-top:none;border-radius:0 0 6px 6px;padding:14px;font-size:9.5pt;color:#475569;font-style:italic;line-height:1.6;">"${employeeComments}"</div>
  </div>` : ''}

  <!-- FINAL RECOMMENDATION -->
  ${panelConclusion ? `
  <div style="margin-bottom:28px;break-inside:avoid;">
    <div style="background:#1e293b;color:#fff;padding:8px 14px;border-radius:6px 6px 0 0;font-size:10pt;font-weight:800;text-transform:uppercase;letter-spacing:0.04em;">▲ Final Recommendation</div>
    <div style="border:1px solid #e2e8f0;border-top:none;border-radius:0 0 6px 6px;padding:16px;background:${conclusionColors[panelConclusion] || '#f8fafc'};">
      <div style="font-size:14pt;font-weight:900;color:#1e293b;">${conclusionLabel[panelConclusion] || panelConclusion}</div>
      <div style="font-size:9pt;color:#64748b;margin-top:4px;">This is the formal recommendation submitted to Management / CEO for review and action.</div>
    </div>
  </div>` : ''}

  <!-- RATING SCALE REFERENCE -->
  <div style="margin-bottom:28px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;break-inside:avoid;">
    <div style="font-size:8pt;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:10px;">Rating Scale Reference</div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;">
      ${[
        ['5','Outstanding','#065f46','#d1fae5','Consistently exceeds expectations; a role model.'],
        ['4','Above Average','#1e40af','#dbeafe','Frequently exceeds expectations with high quality.'],
        ['3','Competent','#3730a3','#e0e7ff','Reliably meets all job requirements.'],
        ['2','Needs Improvement','#92400e','#fef3c7','Often meets minimum standards only.'],
        ['1','Unsatisfactory','#991b1b','#fee2e2','Fails to meet basic job requirements.'],
      ].map(([n, label, tc, bg, desc]) => `
        <div style="flex:1;min-width:120px;background:${bg};border-radius:6px;padding:8px 10px;">
          <div style="font-size:10pt;font-weight:900;color:${tc};">${n} — ${label}</div>
          <div style="font-size:8pt;color:${tc};opacity:0.8;margin-top:2px;">${desc}</div>
        </div>`).join('')}
    </div>
  </div>

  <!-- FOOTER -->
  <div style="border-top:2px solid #1e293b;padding-top:12px;display:flex;justify-content:space-between;align-items:center;">
    <div>
      <img src="${logoSrc}" alt="Logo" style="height:28px;width:auto;opacity:0.7;" />
    </div>
    <div style="font-size:7.5pt;color:#94a3b8;text-align:center;">
      This document is a confidential formal performance record. Generated on ${format(new Date(), 'dd MMM yyyy, HH:mm')}.
    </div>
    <div style="font-size:8pt;font-weight:700;color:#64748b;">CONFIDENTIAL</div>
  </div>

</div>
<script>window.onload = function() { window.print(); }</script>
</body></html>`;

    const win = window.open('', '_blank', 'width=900,height=700');
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  };


  const renderSection = (title: string, weight: number) => {
    const sectionCriteria = CRITERIA.filter(c => c.section === title);
    return (
      <div key={title} className="mb-8 print-section">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 bg-gradient-to-r from-slate-50 to-white p-4 rounded-xl border border-slate-200 shadow-sm gap-2">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-100 shrink-0">
              {title === 'Core Job Performance' && <Award className="h-6 w-6 text-white" />}
              {title === 'Professionalism & Attitude' && <ShieldCheck className="h-6 w-6 text-white" />}
              {title === 'Improvement & Development' && <TrendingUp className="h-6 w-6 text-white" />}
              {title === 'Additional Critical Areas' && <Users className="h-6 w-6 text-white" />}
            </div>
            <div>
              <h3 className="font-black text-slate-800 text-sm md:text-base uppercase tracking-tight leading-none">
                {title}
              </h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Weight: {weight}% of total</p>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Section Score</div>
            <Badge variant="outline" className="bg-white text-indigo-700 font-black text-xs md:text-sm px-3 py-1 border-indigo-100 shadow-sm">
              {sectionScores[title].toFixed(1)} / {weight}
            </Badge>
          </div>
        </div>
        
        {/* Desktop Table View */}
        <div className="hidden lg:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50">
                <TableHead className="w-12 text-[10px] uppercase font-bold">NO</TableHead>
                <TableHead className="min-w-[200px] text-[10px] uppercase font-bold">Criteria</TableHead>
                <TableHead className="w-20 text-[10px] uppercase font-bold text-center">Weight</TableHead>
                <TableHead className="w-32 text-[10px] uppercase font-bold text-center">Rating (1-5)</TableHead>
                <TableHead className="w-20 text-[10px] uppercase font-bold text-center">Score</TableHead>
                <TableHead className="text-[10px] uppercase font-bold">Comments & Examples</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sectionCriteria.map(c => {
                const data = criteriaData[c.id];
                const score = (data.rating / 5) * c.weight;
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-bold text-slate-400 text-xs">{c.id}</TableCell>
                    <TableCell>
                      <div className="font-bold text-slate-700 text-sm">{c.name}</div>
                      <div className="text-[10px] text-slate-500 italic mt-0.5">{c.description}</div>
                    </TableCell>
                    <TableCell className="text-xs font-semibold text-slate-600 text-center">{c.weight}%</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        {[1, 2, 3, 4, 5].map(star => (
                          <button
                            key={star}
                            onClick={() => handleRatingChange(c.id, star)}
                            className={`h-7 w-7 rounded-md flex items-center justify-center transition-all ${
                              data.rating >= star 
                                ? 'bg-indigo-600 text-white shadow-sm' 
                                : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                            }`}
                          >
                            <span className="text-xs font-bold">{star}</span>
                          </button>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="font-bold text-indigo-600 text-xs text-center">
                      {score > 0 ? score.toFixed(1) : '-'}
                    </TableCell>
                    <TableCell>
                      <textarea
                        className="w-full text-xs p-2 rounded border border-slate-200 focus:ring-1 focus:ring-indigo-500/20 outline-none min-h-[60px]"
                        defaultValue={data.comment}
                        onBlur={(e) => handleCommentChange(c.id, e.target.value)}
                        placeholder="Add specific examples..."
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Mobile/Tablet Card View */}
        <div className="lg:hidden space-y-4">
          {sectionCriteria.map(c => {
            const data = criteriaData[c.id];
            const score = (data.rating / 5) * c.weight;
            return (
              <div key={c.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex gap-2">
                    <span className="flex items-center justify-center h-5 w-5 rounded bg-slate-100 text-[10px] font-bold text-slate-500 shrink-0">{c.id}</span>
                    <div className="min-w-0">
                      <div className="font-bold text-slate-800 text-sm leading-tight">{c.name}</div>
                      <div className="text-[10px] text-slate-500 italic mt-1 leading-snug">{c.description}</div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Weight: {c.weight}%</div>
                    <div className="text-xs font-bold text-indigo-600">{score > 0 ? `Score: ${score.toFixed(1)}` : 'No Score'}</div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Rating</span>
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button
                        key={star}
                        onClick={() => handleRatingChange(c.id, star)}
                        className={`h-8 w-8 rounded-lg flex items-center justify-center transition-all ${
                          data.rating >= star 
                            ? 'bg-indigo-600 text-white shadow-sm' 
                            : 'bg-slate-100 text-slate-400 active:scale-95'
                        }`}
                      >
                        <span className="text-xs font-bold">{star}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5 pt-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Comments & Examples</label>
                  <textarea
                    className="w-full text-sm p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 outline-none min-h-[80px] bg-slate-50/30"
                    defaultValue={data.comment}
                    onBlur={(e) => handleCommentChange(c.id, e.target.value)}
                    placeholder="Provide specific details..."
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-slate-50 overflow-hidden animate-in fade-in duration-300" id="appraisal-print-area">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #appraisal-print-area, #appraisal-print-area * { visibility: visible !important; }
          #appraisal-print-area { 
            position: absolute !important; 
            left: 0 !important; 
            top: 0 !important; 
            width: 100% !important; 
            height: auto !important;
            overflow: visible !important;
            background: white !important;
          }
          .print\\:hidden { display: none !important; }
          .no-print { display: none !important; }
          
          /* Professional PDF-like styling */
          .print-header { border-bottom: 2px solid #1e293b !important; padding-bottom: 10px !important; margin-bottom: 20px !important; }
          .print-section { break-inside: avoid !important; margin-bottom: 20px !important; }
          table { border-collapse: collapse !important; width: 100% !important; margin-bottom: 15px !important; }
          th, td { border: 1px solid #e2e8f0 !important; padding: 8px !important; text-align: left !important; font-size: 10pt !important; }
          th { background-color: #f8fafc !important; font-weight: bold !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print-total { background-color: #1e293b !important; color: white !important; padding: 10px !important; font-weight: bold !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          
          /* Remove scrollbars and shadows for print */
          .overflow-y-auto { overflow: visible !important; }
          .shadow-sm, .shadow-md, .shadow-lg, .shadow-xl, .shadow-2xl { shadow: none !important; }
          .rounded-xl, .rounded-2xl { border-radius: 0 !important; }
        }
      `}</style>

      <div className="flex-1 flex flex-col bg-white overflow-hidden">
        {/* Elegant Integrated Header */}
        <div className="px-4 md:px-8 py-4 border-b border-slate-200 flex justify-between items-center gap-6 bg-white sticky top-0 z-20 no-print shadow-sm">
          <div className="flex items-center gap-4 min-w-0">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-10 w-10 rounded-full hover:bg-slate-100 shrink-0 border border-transparent hover:border-slate-200 transition-all" 
              onClick={onClose}
              title="Back to Directory"
            >
              <ArrowLeft className="h-5 w-5 text-slate-600" />
            </Button>
            
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900 tracking-tight leading-none">Performance Center</h2>
                <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-100 text-[10px] font-bold px-2 py-0 h-5">APPRAISAL MODE</Badge>
              </div>
              <p className="text-[11px] text-slate-400 font-medium mt-1 truncate">Documenting performance metrics and growth objectives</p>
            </div>

            <div className="h-10 w-px bg-slate-200 hidden lg:block"></div>

            <div className="hidden lg:flex flex-col min-w-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] leading-none">Current Assessment</span>
              <div className="flex items-center gap-2 mt-1.5">
                <div className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse"></div>
                <span className="text-sm font-bold text-slate-800 truncate">
                  {employee.surname} {employee.firstname}
                </span>
                <span className="text-xs text-slate-400 font-medium px-2 py-0.5 bg-slate-50 border border-slate-100 rounded">
                  {employee.position}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden sm:flex items-center bg-slate-50 border border-slate-200 rounded-lg p-1 mr-2">
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 gap-2 text-[11px] font-bold text-slate-600 hover:text-indigo-600 hover:bg-white transition-all" 
                onClick={handlePrintReport}
              >
                <Printer className="h-3.5 w-3.5" /> Print
              </Button>
            </div>
            
            <Button 
              size="sm" 
              className="h-10 px-6 gap-2 text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 transition-all hover:scale-[1.02] active:scale-95" 
              onClick={handleSave}
            >
              <Save className="h-4 w-4" /> Save Record
            </Button>
          </div>
        </div>

        {/* Print-only Header (Visible only when printing) */}
        <div className="hidden print:block print-header">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-4">
              <img src={logoSrc} alt="Logo" className="h-12 w-auto" />
              <div>
                <h1 className="text-2xl font-black text-slate-900">PERFORMANCE APPRAISAL</h1>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Formal Assessment Record</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs font-bold text-slate-400 uppercase">Date Generated</div>
              <div className="text-sm font-bold text-slate-900">{format(new Date(), 'dd MMM yyyy')}</div>
            </div>
          </div>
        </div>

        {/* Scrollable Form Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-10 space-y-6 md:space-y-8 bg-[#fdfdfd]">
          
          {/* Top Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 p-4 md:p-6 rounded-xl bg-white border border-slate-200 shadow-sm">
            <div className="space-y-1">
              <label className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest">Employee Name</label>
              <div className="flex items-center gap-2 text-slate-800 font-bold text-sm md:text-base">
                <User className="h-4 w-4 text-indigo-500 shrink-0" />
                <span className="truncate">{employee.surname} {employee.firstname}</span>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest">Position</label>
              <div className="flex items-center gap-2 text-slate-800 font-medium text-xs md:text-sm">
                <Briefcase className="h-4 w-4 text-indigo-500 shrink-0" />
                <span className="truncate">{employee.position}</span>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest">Review Period</label>
              <Input 
                className="h-8 text-xs md:text-sm" 
                value={reviewPeriod} 
                onChange={(e) => setReviewPeriod(e.target.value)}
                placeholder="e.g. Q1 2024"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest">Reviewer</label>
              <div className="flex items-center gap-2 text-slate-800 font-medium text-xs md:text-sm">
                <ClipboardCheck className="h-4 w-4 text-indigo-500 shrink-0" />
                <span className="truncate">{user?.user_metadata?.name || 'System'}</span>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest">Appraisal Date</label>
              <Input 
                type="date" 
                className="h-8 text-xs md:text-sm" 
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
                className="w-full min-h-[120px] p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm leading-relaxed"
                defaultValue={strengths}
                onBlur={(e) => setStrengths(e.target.value)}
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
                        defaultValue={ap.area}
                        onBlur={(e) => handleActionPlanChange(idx, 'area', e.target.value)}
                      />
                      <Input 
                        placeholder="Action Plan: (e.g. Training, Mentoring, Workshop)" 
                        className="h-8 text-xs bg-white" 
                        defaultValue={ap.action}
                        onBlur={(e) => handleActionPlanChange(idx, 'action', e.target.value)}
                      />
                      <Input 
                        placeholder="Target: (e.g. 3 Months, By end of Q3)" 
                        className="h-8 text-xs bg-white" 
                        defaultValue={ap.target}
                        onBlur={(e) => handleActionPlanChange(idx, 'target', e.target.value)}
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
              defaultValue={employeeComments}
              onBlur={(e) => setEmployeeComments(e.target.value)}
              placeholder="The employee may add their comments or reflections on this appraisal here..."
            />
          </div>

          {/* Final Decision / Concession */}
          <div className="space-y-4 print-section">
            <h3 className="font-black text-slate-900 flex items-center gap-2 border-b-2 border-indigo-600 pb-2 text-lg">
              <ShieldCheck className="h-6 w-6 text-indigo-600" />
              Final Conclusion & Recommendation
            </h3>
            <div className="p-6 rounded-2xl border border-indigo-100 bg-indigo-50/20 shadow-inner">
              <div className="max-w-2xl mx-auto space-y-4">
                <div className="text-center space-y-1 mb-6">
                  <p className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em]">Management Decision</p>
                  <p className="text-sm text-slate-500 italic">Select the final employment status recommendation based on this assessment.</p>
                </div>
                
                <div className="max-w-md mx-auto">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="outline" 
                        className={`w-full h-16 px-6 flex justify-between items-center rounded-2xl border-2 transition-all shadow-sm ${
                          panelConclusion 
                            ? "border-indigo-200 bg-indigo-50/50 text-indigo-900" 
                            : "border-slate-200 bg-white text-slate-400"
                        }`}
                      >
                        <div className="flex flex-col items-start text-left min-w-0">
                          <span className="text-[10px] font-black uppercase tracking-[0.1em] opacity-60">Selected Decision</span>
                          <span className="text-sm font-black truncate">
                            {panelConclusion ? [
                              { value: 'Confirm', label: 'Confirm Employment' },
                              { value: 'Extend', label: 'Extend Probation' },
                              { value: 'End', label: 'End Employment' },
                              { value: 'Salary Increase', label: 'End with Salary Increase' },
                              { value: 'Promote', label: 'Recommend for Promotion' }
                            ].find(o => o.value === panelConclusion)?.label : 'Choose a recommendation...'}
                          </span>
                        </div>
                        <ChevronDown className={`h-5 w-5 transition-transform duration-200 ${panelConclusion ? 'text-indigo-600' : 'text-slate-400'}`} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="center" className="w-[var(--radix-dropdown-menu-trigger-width)] p-2 rounded-2xl shadow-2xl border-slate-200">
                      {[
                        { value: 'Confirm', label: 'Confirm Employment', desc: 'Employee has successfully completed the review period.', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                        { value: 'Extend', label: 'Extend Probation', desc: 'Additional time required to evaluate performance.', icon: Calendar, color: 'text-amber-600', bg: 'bg-amber-50' },
                        { value: 'End', label: 'End Employment', desc: 'Performance does not meet company standards.', icon: X, color: 'text-rose-600', bg: 'bg-rose-50' },
                        { value: 'Salary Increase', label: 'End with Salary Increase', desc: 'Excellent performance warranting immediate recognition.', icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
                        { value: 'Promote', label: 'Recommend for Promotion', desc: 'Demonstrates potential for higher level responsibilities.', icon: Award, color: 'text-indigo-600', bg: 'bg-indigo-50' }
                      ].map((opt) => (
                        <DropdownMenuItem 
                          key={opt.value} 
                          onClick={() => setPanelConclusion(opt.value)}
                          className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-colors mb-1 last:mb-0 ${
                            panelConclusion === opt.value ? 'bg-indigo-50 border border-indigo-100' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className={`mt-0.5 h-8 w-8 rounded-lg ${opt.bg} flex items-center justify-center shrink-0`}>
                            <opt.icon className={`h-4 w-4 ${opt.color}`} />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className={`text-sm font-bold ${panelConclusion === opt.value ? 'text-indigo-900' : 'text-slate-700'}`}>{opt.label}</span>
                            <span className="text-[10px] text-slate-400 leading-tight mt-0.5 line-clamp-1">{opt.desc}</span>
                          </div>
                          {panelConclusion === opt.value && (
                            <div className="ml-auto">
                              <CheckCircle2 className="h-4 w-4 text-indigo-600" />
                            </div>
                          )}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          </div>

          {/* Signatures Removed as requested */}

        </div>

        </div>

        {/* Compact Sticky Footer for Mobile Actions */}
        <div className="px-4 py-3 border-t border-slate-200 bg-white md:hidden no-print sticky bottom-0 z-20">
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1 h-11 font-bold text-slate-600 rounded-xl">
              Back
            </Button>
            <Button onClick={handleSave} className="flex-[2] h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-lg shadow-indigo-100 rounded-xl">
              <Save className="h-4 w-4 mr-2" /> Save Record
            </Button>
          </div>
        </div>
      </div>
  );
}
