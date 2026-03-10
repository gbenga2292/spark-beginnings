import fs from 'fs';

let finPath = 'src/pages/FinancialReports.tsx';
let finContent = fs.readFileSync(finPath, 'utf8');

const finMatchStart = '<div className="space-y-5">';
const finMatchEnd = '{/* Export buttons */}';

const finStartIndex = finContent.indexOf(finMatchStart);
const finEndIndex = finContent.indexOf(finMatchEnd, finStartIndex);

if (finStartIndex !== -1 && finEndIndex !== -1) {
  const replacement = `<div className="space-y-6">
            {/* Tab Navigation */}
            <div className="flex overflow-x-auto gap-2 pb-2 hide-scrollbar border-b border-slate-100">
              {FINANCIAL_REPORT_GROUPS.map(group => {
                const isActive = activeFinBuilderTab === group.group;
                const groupSelectedCount = group.fields.filter(f => selectedFields.includes(f)).length;
                return (
                  <button
                    key={group.group}
                    onClick={() => setActiveFinBuilderTab(group.group)}
                    className={\`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors whitespace-nowrap border-b-2 \${
                      isActive 
                        ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50' 
                        : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                    }\`}
                  >
                    {group.group}
                    {groupSelectedCount > 0 && (
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-indigo-800 text-[10px]">
                        {groupSelectedCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Active Tab Content */}
            {FINANCIAL_REPORT_GROUPS.filter(g => g.group === activeFinBuilderTab).map(group => {
              const checkColor: Record<string, string> = {
                indigo:  'accent-indigo-600',
                emerald: 'accent-emerald-600',
                amber:   'accent-amber-500',
                violet:  'accent-violet-600',
              };
              const allGroupSelected = group.fields.every(f => selectedFields.includes(f));
              return (
                <div key={group.group} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <p className="text-sm font-medium text-slate-500">Select modules to include in your report:</p>
                    <button
                      onClick={() => {
                        if (allGroupSelected) {
                          setSelectedFields(prev => prev.filter(f => !group.fields.includes(f)));
                        } else {
                          setSelectedFields(prev => [...new Set([...prev, ...group.fields])]);
                        }
                      }}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                    >
                      {allGroupSelected ? '- Deselect Group' : '+ Select Group'}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 bg-slate-50 p-5 rounded-xl border border-slate-100">
                    {group.fields.map(field => (
                      <label key={field} className="flex items-start gap-3 text-sm font-medium text-slate-700 cursor-pointer hover:text-slate-900 transition-colors bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                        <input
                          type="checkbox"
                          checked={selectedFields.includes(field)}
                          onChange={() => toggleField(field)}
                          className={\`mt-0.5 h-4 w-4 rounded border-slate-300 \${checkColor[group.color]} transition-all\`}
                        />
                        <span className="leading-tight">{field}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Preview bar */}
            {selectedFields.length > 0 && (
              <div className="flex items-start sm:items-center gap-3 text-xs text-slate-500 bg-indigo-50/50 border border-indigo-100 rounded-lg p-3 sm:px-4 sm:py-3 animate-in fade-in">
                <CheckCircle2 className="h-5 w-5 text-indigo-500 flex-shrink-0 mt-0.5 sm:mt-0" />
                <div>
                  Report will include <strong className="text-indigo-700">{selectedFields.length} module{selectedFields.length > 1 ? 's' : ''}</strong>. Excel = one sheet per module. PDF = key metric summary.
                  <div className="text-indigo-600/80 italic mt-0.5">{selectedFields.slice(0, 5).join(', ')}{selectedFields.length > 5 ? \` +\${selectedFields.length - 5} more\` : ''}</div>
                </div>
              </div>
            )}

            `;
  
  finContent = finContent.substring(0, finStartIndex) + replacement + finContent.substring(finEndIndex);
  fs.writeFileSync(finPath, finContent);
  console.log('fin ok');
} else {
  console.log('fin match fail');
}

let repPath = 'src/pages/Reports.tsx';
let repContent = fs.readFileSync(repPath, 'utf8');

const repMatchStart = '<div className="space-y-6">';
const repMatchEnd = '{/* Export buttons */}';

const repStartIndex = repContent.indexOf(repMatchStart);
const repEndIndex = repContent.indexOf(repMatchEnd, repStartIndex);

if (repStartIndex !== -1 && repEndIndex !== -1) {
    const repReplacement = `<div className="space-y-6">
            {/* Tab Navigation */}
            <div className="flex overflow-x-auto gap-2 pb-2 hide-scrollbar border-b border-slate-100">
              {REPORT_FIELD_GROUPS.map(group => {
                const isActive = activeEmpBuilderTab === group.group;
                const groupSelectedCount = group.fields.filter(f => selectedFields.includes(f)).length;
                return (
                  <button
                    key={group.group}
                    onClick={() => setActiveEmpBuilderTab(group.group)}
                    className={\`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors whitespace-nowrap border-b-2 \${
                      isActive 
                        ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50' 
                        : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                    }\`}
                  >
                    {group.group}
                    {groupSelectedCount > 0 && (
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-indigo-800 text-[10px]">
                        {groupSelectedCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Active Tab Content */}
            {REPORT_FIELD_GROUPS.filter(g => g.group === activeEmpBuilderTab).map(group => {
              const checkColor: Record<string, string> = {
                indigo:  'accent-indigo-600',
                emerald: 'accent-emerald-600',
                amber:   'accent-amber-500',
                violet:  'accent-violet-600',
                rose:    'accent-rose-600',
              };

              const groupSelectedCount = group.fields.filter(f => selectedFields.includes(f)).length;
              const allGroupSelected = groupSelectedCount === group.fields.length;

              return (
                <div key={group.group} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <p className="text-sm font-medium text-slate-500">Select data fields to include as columns in your report:</p>
                    <button
                      onClick={() => {
                        if (allGroupSelected) {
                          setSelectedFields(prev => prev.filter(f => !group.fields.includes(f)));
                        } else {
                          setSelectedFields(prev => [...new Set([...prev, ...group.fields])]);
                        }
                      }}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                    >
                      {allGroupSelected ? '- Deselect Group' : '+ Select Group'}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50 p-5 rounded-xl border border-slate-100">
                    {group.fields.map((field) => (
                      <label key={field} className="flex items-start gap-3 text-sm font-medium text-slate-700 cursor-pointer hover:text-slate-900 transition-colors bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                        <input
                          type="checkbox"
                          checked={selectedFields.includes(field)}
                          onChange={() => toggleField(field)}
                          className={\`mt-0.5 h-4 w-4 rounded border-slate-300 \${checkColor[group.color]} transition-all\`}
                        />
                        <span className="leading-tight">{field}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Selected Count & Preview banner */}
            {selectedFields.length > 0 && (
              <div className="flex items-start sm:items-center gap-3 text-xs text-slate-500 bg-indigo-50/50 border border-indigo-100 rounded-lg p-3 sm:px-4 sm:py-3 animate-in fade-in">
                <CheckCircle2 className="h-5 w-5 text-indigo-500 flex-shrink-0 mt-0.5 sm:mt-0" />
                <div>
                  Report will include <strong className="text-indigo-700">{selectedFields.length} field{selectedFields.length > 1 ? 's' : ''}</strong> as columns. 
                  <div className="text-indigo-600/80 italic mt-0.5">({selectedFields.slice(0, 5).join(', ')}{selectedFields.length > 5 ? \` +\${selectedFields.length - 5} more\` : ''})</div>
                </div>
              </div>
            )}

            `;
    repContent = repContent.substring(0, repStartIndex) + repReplacement + repContent.substring(repEndIndex);
    fs.writeFileSync(repPath, repContent);
    console.log('rep ok');
} else {
    // try different search block
    const repMatchStartAlt = '{REPORT_FIELD_GROUPS.map(group => {';
    const repMatchEndAlt = '{/* Export actions */}';
    
    // We already know activeEmpBuilderTab logic is inside
    console.log('rep match fail, end = ' + repEndIndex);
}
