import{a as T,u as C,r as b,d as k,j as e,B as n,A as w,F as f,k as D,o as $,i as v,I as o,t as _,av as z}from"./index-BW9BOPPl.js";import{C as E}from"./calendar-days-bP6qgEcF.js";function F(){const c=T(t=>t.employees),m=C(),j=c.filter(t=>t.status==="Active"),g=c.filter(t=>t.status==="Onboarding"),[l,y]=b.useState("Active"),[u,p]=b.useState(""),[a,s]=b.useState({offerDate:"",candidateTitle:"Mr./Ms.",candidateName:"",candidateAddress:"",salutation:"",jobTitle:"",introText:"",dutiesText:"",compensationText:"",goodFaithText:"",confidentialityText:"",resumeDateText:"",workingDaysText:"",signatoryName:"Hubert Olatokunbo Davies"}),h=()=>{if(!u){_.error("Please select an employee first");return}const t=c.find(N=>N.id===u);if(!t)return;const x=`
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
    <img src="${window.location.origin}${z}" alt="Logo" />
  </div>

  <div class="address-block">
    <p>${a.offerDate}</p>
    <br/>
    <p>${a.candidateTitle} ${a.candidateName}</p>
    <p style="white-space: pre-wrap;">${a.candidateAddress||"Click to add address..."}</p>
  </div>

  <p class="salutation">${a.salutation}</p>

  <h1>OFFER OF EMPLOYMENT</h1>

  <div class="body-text">${a.introText}</div>

  <ol class="numbered-list">
    <li>Duties
        <div>${a.dutiesText}</div>
    </li>
    <li>Compensation
        <div>${a.compensationText}</div>
    </li>
    <li>Good Faith
        <div>${a.goodFaithText}</div>
    </li>
    <li>Confidentiality
        <div>${a.confidentialityText}</div>
    </li>
  </ol>

  <p style="text-align: justify;"><strong>${a.resumeDateText}</strong></p>

  <div class="body-text">${a.workingDaysText}</div>

  <div class="signature-block">
    <p>We wish you a successful working relationship with us.</p>
    <p>Yours sincerely,</p>
    <br/><br/><br/>
    <p><strong>${a.signatoryName}</strong><br/>
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
    `.trim(),i=new Blob([x],{type:"application/msword;charset=utf-8"}),r=URL.createObjectURL(i),d=document.createElement("a");d.href=r,d.download=`Employment_Contract_${t.surname}_${t.firstname.replace(/\s+/g,"_")}.doc`,d.click(),URL.revokeObjectURL(r),_.success(`Contract generated for ${t.surname} ${t.firstname}!`),m("/onboarding")};return k("Generate Employee Contract","Select an employee to generate a ready-to-print employment agreement",e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsxs(n,{variant:"outline",size:"sm",onClick:()=>m("/onboarding"),className:"gap-2 border-slate-200 h-9",children:[e.jsx(w,{className:"h-4 w-4"})," Back"]}),e.jsxs(n,{onClick:h,className:"bg-indigo-600 hover:bg-indigo-700 text-white font-semibold gap-2 h-9 px-4 shadow-sm",children:[e.jsx(f,{className:"h-4 w-4"})," Download"]})]})),e.jsxs("div",{className:"flex flex-col gap-6 max-w-4xl mx-auto pb-10 w-full animate-in fade-in duration-300",children:[e.jsxs("div",{className:"flex md:hidden items-center justify-between bg-white p-4 rounded-xl border border-slate-100 shadow-sm mb-2",children:[e.jsxs(n,{variant:"outline",size:"sm",onClick:()=>m("/onboarding"),className:"gap-2 border-slate-200 h-9 shrink-0",children:[e.jsx(w,{className:"h-4 w-4"})," Back"]}),e.jsxs(n,{onClick:h,size:"sm",className:"bg-indigo-600 hover:bg-indigo-700 text-white font-semibold gap-2 h-9 px-4 shadow-sm",children:[e.jsx(f,{className:"h-4 w-4"})," Download"]})]}),e.jsxs(D,{className:"border-none shadow-xl ring-1 ring-black/5 bg-white relative overflow-hidden",children:[e.jsx("div",{className:"absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-400"}),e.jsxs($,{className:"p-6 md:p-8",children:[e.jsxs("div",{className:"flex gap-2 p-1 bg-slate-100 rounded-lg mb-6 max-w-xs",children:[e.jsx("button",{className:`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${l==="Active"?"bg-white shadow-sm text-indigo-700":"text-slate-500 hover:text-slate-700"}`,onClick:()=>{y("Active"),p("")},children:"Active Crew"}),e.jsx("button",{className:`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${l==="Onboarding"?"bg-white shadow-sm text-indigo-700":"text-slate-500 hover:text-slate-700"}`,onClick:()=>{y("Onboarding"),p("")},children:"Pending Hire"})]}),e.jsxs("div",{className:"space-y-4 mb-6 max-w-xl",children:[e.jsxs("div",{className:"space-y-2",children:[e.jsxs("label",{className:"text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1",children:["Select Employee ",e.jsx("span",{className:"text-rose-500",children:"*"})]}),e.jsxs("select",{className:"flex h-11 w-full rounded-md border border-slate-200 bg-slate-50 focus:bg-white px-3 text-sm transition-colors outline-none focus:ring-2 focus:ring-indigo-500/20",value:u,onChange:t=>{var r;const x=t.target.value;p(x);const i=c.find(d=>d.id===x);i&&s({offerDate:v(Date.now()),candidateTitle:"Mr/Ms.",candidateName:`${i.firstname} ${i.surname}`,candidateAddress:"Please provide exact address...",salutation:`Dear ${i.firstname.split(" ")[0]},`,jobTitle:i.position,introText:`Sequel to your interview and subsequent assessments we are pleased to offer you the position of ${i.position} with our organisation. Upon review of your qualifications and skills, we believe your skills and experience make you an excellent fit for our team.

However, you should note with your new employment comes responsibility and it is expected that you discharge your duties accordingly. The success of the business must be paramount in your mind and while under employment, you are expected to continually find ways to advance the growth of the business.

You will be expected to abide by all rules and guidelines as well observe the necessary codes of conduct that have been put in place by your employers.`,dutiesText:`Your duties as a ${i.position} shall include all functions as listed in the job description which will be handed to you upon assumption of duty:

You will be expected to perform all duties and follow all instructions as may be assigned or delegated to you from time to time; act in a manner which is reasonably necessary and proper in the interests of the Company.`,compensationText:`You are entitled to a monthly gross compensation of ₦${(((r=i.monthlySalaries)==null?void 0:r.jan)||0).toLocaleString()} only. By your authority, The Company will deduct and remit all statutory deductions and contributions required by law on your behalf.`,goodFaithText:"You shall be required at all times to act loyally, faithfully and in the best interest of and to use your best endeavours to develop and expand the business of The Company.",confidentialityText:"You shall be required to sign a confidentiality agreement as soon as the offer is accepted by you.",resumeDateText:`You will be expected to resume on ${i.startDate?v(i.startDate):"a mutually agreed date"}.`,workingDaysText:`Your working days will be Monday - Friday from 8:00am. If need be, you will be required to work weekends to meet with demanding timelines.

Please confirm your acceptance of this offer by signing and returning the attached form in advance.`,signatoryName:"Hubert Olatokunbo Davies"})},children:[e.jsx("option",{value:"",disabled:!0,children:"--- Select an Employee ---"}),l==="Active"&&j.map(t=>e.jsxs("option",{value:t.id,children:[t.surname," ",t.firstname," (",t.position,")"]},t.id)),l==="Onboarding"&&g.length>0?g.map(t=>e.jsxs("option",{value:t.id,children:[t.surname," ",t.firstname," (",t.position,")"]},t.id)):null,l==="Onboarding"&&g.length===0&&e.jsx("option",{value:"",disabled:!0,children:"No pending new hires"})]})]}),u&&e.jsxs("div",{className:"animate-in fade-in slide-in-from-top-2 duration-300 space-y-4 pt-2",children:[e.jsxs("div",{className:"grid grid-cols-1 sm:grid-cols-2 gap-4",children:[e.jsxs("div",{className:"space-y-1.5",children:[e.jsx("label",{className:"text-xs font-bold uppercase tracking-wider text-slate-500",children:"Offer Date"}),e.jsx(o,{className:"h-9 text-sm",value:a.offerDate,onChange:t=>s({...a,offerDate:t.target.value})})]}),e.jsxs("div",{className:"space-y-1.5 flex gap-2",children:[e.jsxs("div",{className:"w-1/3 space-y-1.5",children:[e.jsx("label",{className:"text-xs font-bold uppercase tracking-wider text-slate-500",children:"Title"}),e.jsx(o,{className:"h-9 text-sm",value:a.candidateTitle,onChange:t=>s({...a,candidateTitle:t.target.value})})]}),e.jsxs("div",{className:"w-2/3 space-y-1.5",children:[e.jsx("label",{className:"text-xs font-bold uppercase tracking-wider text-slate-500",children:"Candidate Name"}),e.jsx(o,{className:"h-9 text-sm",value:a.candidateName,onChange:t=>s({...a,candidateName:t.target.value})})]})]}),e.jsxs("div",{className:"space-y-1.5 sm:col-span-2",children:[e.jsx("label",{className:"text-xs font-bold uppercase tracking-wider text-slate-500",children:"Candidate Address"}),e.jsx("textarea",{className:"w-full text-sm rounded-md border border-slate-200 bg-slate-50 p-2 h-16 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all resize-none",value:a.candidateAddress,onChange:t=>s({...a,candidateAddress:t.target.value})})]}),e.jsxs("div",{className:"space-y-1.5",children:[e.jsx("label",{className:"text-xs font-bold uppercase tracking-wider text-slate-500",children:"Salutation"}),e.jsx(o,{className:"h-9 text-sm",value:a.salutation,onChange:t=>s({...a,salutation:t.target.value})})]}),e.jsxs("div",{className:"space-y-1.5",children:[e.jsx("label",{className:"text-xs font-bold uppercase tracking-wider text-slate-500",children:"Job Title"}),e.jsx(o,{className:"h-9 text-sm",value:a.jobTitle,onChange:t=>s({...a,jobTitle:t.target.value})})]}),e.jsxs("div",{className:"space-y-1.5 sm:col-span-2 bg-yellow-50 p-3 rounded-lg border border-yellow-200 shadow-sm relative overflow-hidden",children:[e.jsx("div",{className:"absolute top-0 right-0 w-12 h-12 bg-yellow-200/50 rounded-bl-full -z-0"}),e.jsxs("label",{className:"text-xs font-bold uppercase tracking-wider text-yellow-800 flex items-center gap-1.5 relative z-10",children:[e.jsx(E,{className:"h-4 w-4"})," Start Date / Resume Date"]}),e.jsx("p",{className:"text-xs text-yellow-600 mb-2 font-medium relative z-10",children:"Carefully verify the employee's official resumption date below:"}),e.jsx(o,{className:"h-9 text-sm bg-white border-yellow-300 focus-visible:ring-yellow-500/50 relative z-10 font-bold text-yellow-900",value:a.resumeDateText,onChange:t=>s({...a,resumeDateText:t.target.value})})]}),e.jsxs("div",{className:"space-y-1.5",children:[e.jsx("label",{className:"text-xs font-bold uppercase tracking-wider text-slate-500",children:"Signatory Name"}),e.jsx(o,{className:"h-9 text-sm",value:a.signatoryName,onChange:t=>s({...a,signatoryName:t.target.value})})]})]}),e.jsxs("div",{className:"space-y-4 shadow-sm border border-slate-100 p-4 rounded-xl bg-slate-50 mt-4",children:[e.jsxs("div",{className:"space-y-1.5",children:[e.jsx("label",{className:"text-xs font-bold uppercase tracking-wider text-slate-500",children:"Introduction Paragraphs"}),e.jsx("textarea",{className:"w-full text-sm rounded-md border border-slate-200 bg-white p-3 h-32 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all resize-none",value:a.introText,onChange:t=>s({...a,introText:t.target.value})})]}),e.jsxs("div",{className:"space-y-1.5",children:[e.jsxs("label",{className:"text-xs font-bold uppercase tracking-wider text-indigo-500 flex items-center gap-2",children:[e.jsx("div",{className:"h-2 w-2 rounded-full bg-indigo-500"}),"1. Duties & Responsibilities"]}),e.jsx("textarea",{className:"w-full text-sm rounded-md border border-slate-200 bg-white p-3 h-24 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all resize-none",value:a.dutiesText,onChange:t=>s({...a,dutiesText:t.target.value})})]}),e.jsxs("div",{className:"space-y-2 bg-emerald-50 p-4 rounded-xl border border-emerald-200 shadow-sm relative overflow-hidden",children:[e.jsx("div",{className:"absolute top-0 right-0 w-16 h-16 bg-emerald-100 rounded-bl-full -z-0"}),e.jsxs("label",{className:"text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-2 relative z-10",children:[e.jsx("div",{className:"h-2 w-2 rounded-full bg-emerald-500"}),"2. Compensation (Salary Structure)"]}),e.jsx("p",{className:"text-xs text-emerald-600 mb-2 font-medium relative z-10",children:"Verify the monthly basic pay matches the agreed matrix:"}),e.jsx("textarea",{className:"w-full text-sm rounded-md border border-emerald-300 bg-white p-3 h-20 focus:bg-white focus:ring-2 focus:ring-emerald-500/30 outline-none transition-all resize-none relative z-10 font-semibold text-emerald-900",value:a.compensationText,onChange:t=>s({...a,compensationText:t.target.value})})]}),e.jsxs("div",{className:"space-y-1.5",children:[e.jsxs("label",{className:"text-xs font-bold uppercase tracking-wider text-indigo-500 flex items-center gap-2",children:[e.jsx("div",{className:"h-2 w-2 rounded-full bg-indigo-500"}),"3. Good Faith"]}),e.jsx("textarea",{className:"w-full text-sm rounded-md border border-slate-200 bg-white p-3 h-16 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all resize-none",value:a.goodFaithText,onChange:t=>s({...a,goodFaithText:t.target.value})})]}),e.jsxs("div",{className:"space-y-1.5",children:[e.jsxs("label",{className:"text-xs font-bold uppercase tracking-wider text-indigo-500 flex items-center gap-2",children:[e.jsx("div",{className:"h-2 w-2 rounded-full bg-indigo-500"}),"4. Confidentiality"]}),e.jsx("textarea",{className:"w-full text-sm rounded-md border border-slate-200 bg-white p-3 h-16 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all resize-none",value:a.confidentialityText,onChange:t=>s({...a,confidentialityText:t.target.value})})]}),e.jsxs("div",{className:"space-y-1.5",children:[e.jsx("label",{className:"text-xs font-bold uppercase tracking-wider text-slate-500",children:"Working Days / Conclusion"}),e.jsx("textarea",{className:"w-full text-sm rounded-md border border-slate-200 bg-white p-3 h-24 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all resize-none",value:a.workingDaysText,onChange:t=>s({...a,workingDaysText:t.target.value})})]})]})]})]}),e.jsxs("div",{className:"flex justify-end gap-3 mt-8",children:[e.jsx(n,{variant:"ghost",className:"text-slate-500 hover:text-slate-700 font-medium",onClick:()=>m("/onboarding"),children:"Cancel"}),e.jsxs(n,{onClick:h,className:"bg-indigo-600 hover:bg-indigo-700 text-white font-semibold gap-2 h-10 px-6 shadow-md shadow-indigo-200",children:[e.jsx(f,{className:"h-4 w-4"})," Download Document"]})]})]})]})]})}export{F as GenerateContract};
