import { formatDisplayDate } from '@/src/lib/dateUtils';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { FileText, CalendarDays, ArrowLeft } from 'lucide-react';
import { useAppStore } from '@/src/store/appStore';
import { toast } from '@/src/components/ui/toast';
import { useNavigate } from 'react-router-dom';
import logoSrc from '../../logo/logo-2.png';
import { useSetPageTitle } from '@/src/contexts/PageContext';

export function GenerateContract() {
  const employees = useAppStore((state) => state.employees);
  const navigate = useNavigate();

  const activeEmployees = employees.filter(e => e.status === 'Active');
  const pendingEmployees = employees.filter(e => e.status === 'Onboarding');

  const [contractTab, setContractTab] = useState<'Active' | 'Onboarding'>('Active');
  const [contractEmployee, setContractEmployee] = useState<string>('');

  const [contractTempFields, setContractTempFields] = useState({
    offerDate: '',
    candidateTitle: 'Mr./Ms.',
    candidateName: '',
    candidateAddress: '',
    salutation: '',
    jobTitle: '',
    introText: '',
    dutiesText: '',
    compensationText: '',
    goodFaithText: '',
    confidentialityText: '',
    resumeDateText: '',
    workingDaysText: '',
    signatoryName: 'Hubert Olatokunbo Davies',
  });

  const handleGenerateContract = () => {
    if (!contractEmployee) {
      toast.error('Please select an employee first');
      return;
    }
    const emp = employees.find(e => e.id === contractEmployee);
    if (!emp) return;

    const contractContent = `
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
<meta charset="utf-8">
<style>
  body { font-family: 'Century Gothic', Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #000; padding: 40px; }
  .logo-container { text-align: left; margin-bottom: 20px; }
  .logo-container img { height: 70px; }
  h1 { font-size: 12pt; text-decoration: underline; margin-bottom: 20px; text-transform: uppercase; border: none; }
  .address-block { margin-bottom: 20px; }
  .address-block p { margin: 2px 0; font-weight: bold; }
  .salutation { margin-bottom: 20px; }
  .body-text { margin-bottom: 15px; white-space: pre-wrap; text-align: justify; }
  .numbered-list { list-style-type: decimal; padding-left: 20px; margin-top: 10px; }
  .numbered-list li { margin-bottom: 15px; font-weight: bold;}
  .numbered-list li div { font-weight: normal; margin-top: 5px; white-space: pre-wrap; text-align: justify; }
  .signature-block { margin-top: 30px; }
  .employee-sign { margin-top: 40px; }
  .employee-sign div { margin-top: 25px; }
  .footer { font-size: 8pt; text-align: left; color: #666; margin-top: 60px; border-top: 1px solid #ccc; padding-top: 10px; }
</style>
</head>
<body>
  <div class="logo-container">
    <img src="${window.location.origin}${logoSrc}" alt="Logo" />
  </div>

  <div class="address-block">
    <p>${contractTempFields.offerDate}</p>
    <br/>
    <p>${contractTempFields.candidateTitle} ${contractTempFields.candidateName}</p>
    <p style="white-space: pre-wrap;">${contractTempFields.candidateAddress || 'Click to add address...'}</p>
  </div>

  <p class="salutation">${contractTempFields.salutation}</p>

  <h1>OFFER OF EMPLOYMENT</h1>

  <div class="body-text">${contractTempFields.introText}</div>

  <ol class="numbered-list">
    <li>Duties
        <div>${contractTempFields.dutiesText}</div>
    </li>
    <li>Compensation
        <div>${contractTempFields.compensationText}</div>
    </li>
    <li>Good Faith
        <div>${contractTempFields.goodFaithText}</div>
    </li>
    <li>Confidentiality
        <div>${contractTempFields.confidentialityText}</div>
    </li>
  </ol>

  <p style="text-align: justify;"><strong>${contractTempFields.resumeDateText}</strong></p>

  <div class="body-text">${contractTempFields.workingDaysText}</div>

  <div class="signature-block">
    <p>We wish you a successful working relationship with us.</p>
    <p>Yours sincerely,</p>
    <br/><br/><br/>
    <p><strong>${contractTempFields.signatoryName}</strong><br/>
    For: <strong>DEWATERING CONSTRUCTION ETC LIMITED</strong></p>
  </div>

  <div class="employee-sign">
    <p>The terms and conditions of this offer are agreed to by:</p>
    <div><strong>Name:</strong> __________________________________________</div>
    <div><strong>Signature:</strong> ______________________________________</div>
    <div><strong>Date:</strong> __________________________________________</div>
  </div>
</body>
</html>
    `.trim();

    const blob = new Blob([contractContent], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Employment_Contract_${emp.surname}_${emp.firstname.replace(/\s+/g, '_')}.doc`;
    link.click();
    URL.revokeObjectURL(url);

    toast.success(`Contract generated for ${emp.surname} ${emp.firstname}!`);
    navigate('/onboarding');
  };

  useSetPageTitle(
    'Generate Employee Contract',
    'Select an employee to generate a ready-to-print employment agreement',
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => navigate('/onboarding')} className="gap-2 border-slate-200 h-9">
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>
      <Button onClick={handleGenerateContract} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold gap-2 h-9 px-4 shadow-sm">
        <FileText className="h-4 w-4" /> Download
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto pb-10 w-full animate-in fade-in duration-300">
      {/* Mobile-only Action Bar */}
      <div className="flex md:hidden items-center justify-between bg-white p-4 rounded-xl border border-slate-100 shadow-sm mb-2">
        <Button variant="outline" size="sm" onClick={() => navigate('/onboarding')} className="gap-2 border-slate-200 h-9 shrink-0">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button onClick={handleGenerateContract} size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold gap-2 h-9 px-4 shadow-sm">
          <FileText className="h-4 w-4" /> Download
        </Button>
      </div>
      <Card className="border-none shadow-xl ring-1 ring-black/5 bg-white relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-400"></div>
        <CardContent className="p-6 md:p-8">
          <div className="flex gap-2 p-1 bg-slate-100 rounded-lg mb-6 max-w-xs">
            <button
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${contractTab === 'Active' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}
              onClick={() => { setContractTab('Active'); setContractEmployee(''); }}
            >
              Active Crew
            </button>
            <button
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${contractTab === 'Onboarding' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}
              onClick={() => { setContractTab('Onboarding'); setContractEmployee(''); }}
            >
              Pending Hire
            </button>
          </div>

          <div className="space-y-4 mb-6 max-w-xl">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">Select Employee <span className="text-rose-500">*</span></label>
              <select className="flex h-11 w-full rounded-md border border-slate-200 bg-slate-50 focus:bg-white px-3 text-sm transition-colors outline-none focus:ring-2 focus:ring-indigo-500/20"
                value={contractEmployee} onChange={(e) => {
                  const id = e.target.value;
                  setContractEmployee(id);
                  const found = employees.find(emp => emp.id === id);
                  if (found) {
                    setContractTempFields({
                      offerDate: formatDisplayDate(Date.now()),
                      candidateTitle: 'Mr/Ms.',
                      candidateName: `${found.firstname} ${found.surname}`,
                      candidateAddress: 'Please provide exact address...',
                      salutation: `Dear ${found.firstname.split(' ')[0]},`,
                      jobTitle: found.position,
                      introText: `Sequel to your interview and subsequent assessments we are pleased to offer you the position of ${found.position} with our organisation. Upon review of your qualifications and skills, we believe your skills and experience make you an excellent fit for our team.\n\nHowever, you should note with your new employment comes responsibility and it is expected that you discharge your duties accordingly. The success of the business must be paramount in your mind and while under employment, you are expected to continually find ways to advance the growth of the business.\n\nYou will be expected to abide by all rules and guidelines as well observe the necessary codes of conduct that have been put in place by your employers.`,
                      dutiesText: `Your duties as a ${found.position} shall include all functions as listed in the job description which will be handed to you upon assumption of duty:\n\nYou will be expected to perform all duties and follow all instructions as may be assigned or delegated to you from time to time; act in a manner which is reasonably necessary and proper in the interests of the Company.`,
                      compensationText: `You are entitled to a monthly gross compensation of ₦${(found.monthlySalaries?.jan || 0).toLocaleString()} only. By your authority, The Company will deduct and remit all statutory deductions and contributions required by law on your behalf.`,
                      goodFaithText: `You shall be required at all times to act loyally, faithfully and in the best interest of and to use your best endeavours to develop and expand the business of The Company.`,
                      confidentialityText: `You shall be required to sign a confidentiality agreement as soon as the offer is accepted by you.`,
                      resumeDateText: `You will be expected to resume on ${found.startDate ? formatDisplayDate(found.startDate) : 'a mutually agreed date'}.`,
                      workingDaysText: `Your working days will be Monday - Friday from 8:00am. If need be, you will be required to work weekends to meet with demanding timelines.\n\nPlease confirm your acceptance of this offer by signing and returning the attached form in advance.`,
                      signatoryName: 'Hubert Olatokunbo Davies'
                    });
                  }
                }}>
                <option value="" disabled>--- Select an Employee ---</option>
                {contractTab === 'Active' && activeEmployees.map(emp => <option key={emp.id} value={emp.id}>{emp.surname} {emp.firstname} ({emp.position})</option>)}
                {contractTab === 'Onboarding' && pendingEmployees.length > 0 ? pendingEmployees.map(emp => <option key={emp.id} value={emp.id}>{emp.surname} {emp.firstname} ({emp.position})</option>) : null}
                {contractTab === 'Onboarding' && pendingEmployees.length === 0 && <option value="" disabled>No pending new hires</option>}
              </select>
            </div>

            {contractEmployee && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300 space-y-4 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Offer Date</label>
                    <Input className="h-9 text-sm" value={contractTempFields.offerDate} onChange={e => setContractTempFields({ ...contractTempFields, offerDate: e.target.value })} />
                  </div>
                  <div className="space-y-1.5 flex gap-2">
                    <div className="w-1/3 space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Title</label>
                      <Input className="h-9 text-sm" value={contractTempFields.candidateTitle} onChange={e => setContractTempFields({ ...contractTempFields, candidateTitle: e.target.value })} />
                    </div>
                    <div className="w-2/3 space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Candidate Name</label>
                      <Input className="h-9 text-sm" value={contractTempFields.candidateName} onChange={e => setContractTempFields({ ...contractTempFields, candidateName: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Candidate Address</label>
                    <textarea className="w-full text-sm rounded-md border border-slate-200 bg-slate-50 p-2 h-16 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all resize-none" value={contractTempFields.candidateAddress} onChange={e => setContractTempFields({ ...contractTempFields, candidateAddress: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Salutation</label>
                    <Input className="h-9 text-sm" value={contractTempFields.salutation} onChange={e => setContractTempFields({ ...contractTempFields, salutation: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Job Title</label>
                    <Input className="h-9 text-sm" value={contractTempFields.jobTitle} onChange={e => setContractTempFields({ ...contractTempFields, jobTitle: e.target.value })} />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2 bg-yellow-50 p-3 rounded-lg border border-yellow-200 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-12 h-12 bg-yellow-200/50 rounded-bl-full -z-0"></div>
                    <label className="text-xs font-bold uppercase tracking-wider text-yellow-800 flex items-center gap-1.5 relative z-10"><CalendarDays className="h-4 w-4" /> Start Date / Resume Date</label>
                    <p className="text-xs text-yellow-600 mb-2 font-medium relative z-10">Carefully verify the employee's official resumption date below:</p>
                    <Input className="h-9 text-sm bg-white border-yellow-300 focus-visible:ring-yellow-500/50 relative z-10 font-bold text-yellow-900" value={contractTempFields.resumeDateText} onChange={e => setContractTempFields({ ...contractTempFields, resumeDateText: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Signatory Name</label>
                    <Input className="h-9 text-sm" value={contractTempFields.signatoryName} onChange={e => setContractTempFields({ ...contractTempFields, signatoryName: e.target.value })} />
                  </div>
                </div>

                <div className="space-y-4 shadow-sm border border-slate-100 p-4 rounded-xl bg-slate-50 mt-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Introduction Paragraphs</label>
                    <textarea className="w-full text-sm rounded-md border border-slate-200 bg-white p-3 h-32 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all resize-none" value={contractTempFields.introText} onChange={e => setContractTempFields({ ...contractTempFields, introText: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-indigo-500 flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-indigo-500"></div>1. Duties & Responsibilities</label>
                    <textarea className="w-full text-sm rounded-md border border-slate-200 bg-white p-3 h-24 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all resize-none" value={contractTempFields.dutiesText} onChange={e => setContractTempFields({ ...contractTempFields, dutiesText: e.target.value })} />
                  </div>
                  <div className="space-y-2 bg-emerald-50 p-4 rounded-xl border border-emerald-200 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-100 rounded-bl-full -z-0"></div>
                    <label className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-2 relative z-10"><div className="h-2 w-2 rounded-full bg-emerald-500"></div>2. Compensation (Salary Structure)</label>
                    <p className="text-xs text-emerald-600 mb-2 font-medium relative z-10">Verify the monthly basic pay matches the agreed matrix:</p>
                    <textarea className="w-full text-sm rounded-md border border-emerald-300 bg-white p-3 h-20 focus:bg-white focus:ring-2 focus:ring-emerald-500/30 outline-none transition-all resize-none relative z-10 font-semibold text-emerald-900" value={contractTempFields.compensationText} onChange={e => setContractTempFields({ ...contractTempFields, compensationText: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-indigo-500 flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-indigo-500"></div>3. Good Faith</label>
                    <textarea className="w-full text-sm rounded-md border border-slate-200 bg-white p-3 h-16 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all resize-none" value={contractTempFields.goodFaithText} onChange={e => setContractTempFields({ ...contractTempFields, goodFaithText: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-indigo-500 flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-indigo-500"></div>4. Confidentiality</label>
                    <textarea className="w-full text-sm rounded-md border border-slate-200 bg-white p-3 h-16 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all resize-none" value={contractTempFields.confidentialityText} onChange={e => setContractTempFields({ ...contractTempFields, confidentialityText: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Working Days / Conclusion</label>
                    <textarea className="w-full text-sm rounded-md border border-slate-200 bg-white p-3 h-24 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all resize-none" value={contractTempFields.workingDaysText} onChange={e => setContractTempFields({ ...contractTempFields, workingDaysText: e.target.value })} />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-8">
            <Button variant="ghost" className="text-slate-500 hover:text-slate-700 font-medium" onClick={() => navigate('/onboarding')}>Cancel</Button>
            <Button onClick={handleGenerateContract} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold gap-2 h-10 px-6 shadow-md shadow-indigo-200">
              <FileText className="h-4 w-4" /> Download Document
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

