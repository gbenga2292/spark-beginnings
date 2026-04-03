import { useState, useMemo } from 'react';
import { useAppStore, Department, Position, Employee } from '@/src/store/appStore';
import { Button } from '@/src/components/ui/button';
import { ArrowLeft, Users, Building2, Briefcase, ZoomIn, ZoomOut, Maximize, Network, UserSquare2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getPositionIndex } from '@/src/lib/hierarchy';
import { useSetPageTitle } from '@/src/contexts/PageContext';

// Updated Node type for a more hierarchical organogram
type OrgNode = Department & {
  childrenDepts: OrgNode[];
  hods: Employee[];
  officeStaff: (Position & { staff: Employee[] })[];
  fieldStaff: (Position & { staff: Employee[] })[];
  totalStaff: number;
};

// Tree structure for Reporting Line view
type ReportingNode = Employee & {
  directReports: ReportingNode[];
};

export function Organogram() {
  const navigate = useNavigate();
  const departments = useAppStore(state => state.departments);
  const positions = useAppStore(state => state.positions);
  const employees = useAppStore(state => state.employees);

  const [zoom, setZoom] = useState(1);
  const [viewMode, setViewMode] = useState<'department' | 'reporting'>('department');

  const handleZoomIn = () => setZoom(z => Math.min(z + 0.1, 2));
  const handleZoomOut = () => setZoom(z => Math.max(z - 0.1, 0.3));
  const handleResetZoom = () => setZoom(1);

  const activeEmployees = useMemo(() => {
    return employees.filter(emp => (emp.status === 'Active' || emp.status === 'On Leave') && emp.staffType !== 'NON-EMPLOYEE');
  }, [employees]);

  // Recursively build the organogram tree
  const rootNodes = useMemo(() => {
    const nodesMap = new Map<string, OrgNode>();

    // 1. Initialize all department nodes
    departments.filter(dept => dept.staffType === 'OFFICE' || dept.staffType === 'FIELD').forEach(dept => {
      const deptPositions = positions.filter(pos => pos.departmentId === dept.id);
      const deptEmployees = activeEmployees.filter(emp => emp.department === dept.name || emp.secondaryDepartments?.includes(dept.name));
      
      // Separate HODs (Level 2) - Sort by hierarchy index, then by name
      const hods = deptEmployees.filter(emp => emp.level === 2).sort((a,b) => {
        const hA = getPositionIndex(a.position);
        const hB = getPositionIndex(b.position);
        if (hA !== hB) return hA - hB;
        return a.firstname.localeCompare(b.firstname);
      });
      
      // Group other staff by position and staff type, excluding Level 1 and Level 2
      const otherStaff = deptEmployees.filter(emp => emp.level !== 1 && emp.level !== 2);
      
      const createPositionGroup = (type: 'OFFICE' | 'FIELD') => {
        return deptPositions.map(pos => {
          const staffInPos = otherStaff.filter(emp => 
            (emp.position === pos.id || emp.position === pos.title) && emp.staffType === type
          ).sort((a,b) => {
            // Internal sort within a position: Level first, then name
            if (a.level !== b.level) return (a.level || 10) - (b.level || 10);
            return a.firstname.localeCompare(b.firstname);
          });
          
          return staffInPos.length > 0 ? { ...pos, staff: staffInPos } : null;
        }).filter(Boolean)
          .sort((a, b) => getPositionIndex(a?.title) - getPositionIndex(b?.title)) as (Position & { staff: Employee[] })[];
      };

      nodesMap.set(dept.id, {
        ...dept,
        hods,
        officeStaff: createPositionGroup('OFFICE'),
        fieldStaff: createPositionGroup('FIELD'),
        totalStaff: deptEmployees.length,
        childrenDepts: []
      });
    });

    const roots: OrgNode[] = [];

    // 2. Link children to their parents
    Array.from(nodesMap.values()).forEach(node => {
      if (node.parentDepartmentId && nodesMap.has(node.parentDepartmentId)) {
        nodesMap.get(node.parentDepartmentId)!.childrenDepts.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots.sort((a, b) => a.name.localeCompare(b.name));
  }, [departments, positions, activeEmployees]);

  // Recursively build the reporting line tree
  const reportingRoots = useMemo(() => {
    const nodesMap = new Map<string, ReportingNode>();

    activeEmployees.forEach(emp => {
      nodesMap.set(emp.id, { ...emp, directReports: [] });
    });

    const roots: ReportingNode[] = [];

    Array.from(nodesMap.values()).forEach(node => {
      // Logic: Root is Level 1, or anyone without a line manager who isn't reporting to a Level 1 elsewhere
      if (node.level === 1) {
        roots.push(node);
      } else if (node.lineManager && nodesMap.has(node.lineManager)) {
        nodesMap.get(node.lineManager)!.directReports.push(node);
      } else {
        roots.push(node);
      }
    });

    // 2. Secondary Sort: Sort direct reports for each node by hierarchy
    Array.from(nodesMap.values()).forEach(node => {
      node.directReports.sort((a, b) => {
        const hA = getPositionIndex(a.position);
        const hB = getPositionIndex(b.position);
        if (hA !== hB) return hA - hB;
        return a.firstname.localeCompare(b.firstname);
      });
    });

    return roots.sort((a, b) => {
      const hA = getPositionIndex(a.position);
      const hB = getPositionIndex(b.position);
      if (hA !== hB) return hA - hB;
      return a.firstname.localeCompare(b.firstname);
    });
  }, [activeEmployees]);

  // Render a single department node and its children recursively
  const renderNode = (node: OrgNode, level: number = 0) => {
    const hasBothTypes = node.officeStaff.length > 0 && node.fieldStaff.length > 0;

    return (
      <div key={node.id} className="flex flex-col items-center relative px-4 animate-in fade-in zoom-in duration-300">
        
        {/* Vertical line connecting up to parent */}
        {level > 0 && <div className="w-px h-8 bg-slate-300"></div>}

        <motion.div
          initial={{ y: 15, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className={`${hasBothTypes ? 'w-[480px]' : 'w-72'} bg-white border border-slate-200 rounded-xl shadow-md hover:shadow-lg transition-all z-10 overflow-hidden relative group`}
        >
          {/* Header - Department Name */}
          <div className="bg-slate-900 text-white p-3 flex flex-col items-center text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
            <h3 className="font-extrabold text-sm uppercase tracking-wider mb-0.5">{node.name}</h3>
            <div className="flex items-center gap-2 opacity-70">
              <Users className="h-3 w-3" />
              <span className="text-[10px] font-bold">{node.totalStaff} Total Staff</span>
            </div>
          </div>

          {/* HOD SECTION (Level 2) */}
          {node.hods.length > 0 && (
            <div className="bg-indigo-50/50 border-b border-indigo-100 p-3">
              <div className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.2em] text-center mb-2">Head of Department</div>
              <div className="flex flex-col gap-2">
                {node.hods.map(hod => (
                  <div key={hod.id} className="bg-white border-2 border-indigo-200 rounded-lg p-2.5 shadow-sm flex items-center gap-3">
                    {hod.avatar ? (
                      <img src={hod.avatar} alt="" className="w-9 h-9 rounded-full object-cover ring-2 ring-white shadow-sm" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                        {hod.firstname.charAt(0)}{hod.surname.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0 text-left">
                      <div className="text-[11px] font-bold text-slate-900 truncate">{hod.firstname} {hod.surname}</div>
                      <div className="text-[9px] text-indigo-600 font-bold uppercase truncate">{hod.position}</div>
                    </div>
                    <div className="bg-indigo-100 text-indigo-700 text-[9px] font-black px-1.5 py-0.5 rounded shadow-sm border border-indigo-200">LVL 2</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SPLIT BODY: OFFICE vs FIELD */}
          <div className={`flex ${hasBothTypes ? 'divide-x divide-slate-100' : 'flex-col'} bg-white`}>
            {/* OFFICE COLUMN */}
            {(node.officeStaff.length > 0 || !hasBothTypes) && (
              <div className={`flex-1 p-3 ${!hasBothTypes && node.officeStaff.length === 0 ? 'hidden' : ''}`}>
                <div className="flex items-center justify-center gap-1.5 mb-3">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500"></div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Office Staff</span>
                </div>
                <div className="space-y-3">
                  {node.officeStaff.map(pos => (
                    <div key={pos.id} className="space-y-1.5">
                      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter text-center">{pos.title}</div>
                      {pos.staff.map(emp => (
                        <div key={emp.id} className="flex flex-col gap-0.5 bg-slate-50 border border-slate-100 rounded-md p-2 hover:border-blue-200 hover:bg-white transition-colors">
                          <div className="text-[11px] text-slate-800 font-bold text-center">
                            {emp.firstname} {emp.surname}
                          </div>
                          <div className="text-[8px] text-slate-400 font-bold text-center uppercase">Level {emp.level || 10}</div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* FIELD COLUMN */}
            {(node.fieldStaff.length > 0) && (
              <div className="flex-1 p-3">
                <div className="flex items-center justify-center gap-1.5 mb-3">
                  <div className="h-1.5 w-1.5 rounded-full bg-amber-500"></div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Field Staff</span>
                </div>
                <div className="space-y-3">
                  {node.fieldStaff.map(pos => (
                    <div key={pos.id} className="space-y-1.5">
                      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter text-center">{pos.title}</div>
                      {pos.staff.map(emp => (
                        <div key={emp.id} className="flex flex-col gap-0.5 bg-slate-50 border border-slate-100 rounded-md p-2 hover:border-amber-200 hover:bg-white transition-colors">
                          <div className="text-[11px] text-slate-800 font-bold text-center">
                            {emp.firstname} {emp.surname}
                          </div>
                          <div className="text-[8px] text-slate-400 font-bold text-center uppercase">Level {emp.level || 10}</div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* If fully empty department (no office/field but might have HOD or nothing) */}
            {node.officeStaff.length === 0 && node.fieldStaff.length === 0 && (
              <div className="p-8 text-center text-slate-300 italic text-[10px]">No assigned staff positions</div>
            )}
          </div>
        </motion.div>

        {/* RECURSIVE CHILDREN RENDERING */}
        {node.childrenDepts.length > 0 && (
          <div className="flex flex-col items-center w-full mt-2 relative">
            <div className="w-px h-8 bg-slate-300"></div>
            
            <div className="flex items-start justify-center relative pt-6">
              {node.childrenDepts.length > 1 && (
                <div 
                  className="absolute top-0 h-px bg-slate-300"
                  style={{
                    left: `calc(100% / ${node.childrenDepts.length} / 2)`,
                    right: `calc(100% / ${node.childrenDepts.length} / 2)`
                  }}
                ></div>
              )}
              
              {node.childrenDepts.sort((a,b) => a.name.localeCompare(b.name)).map(childNode => (
                <div key={childNode.id} className="relative flex flex-col items-center px-4">
                  <div className="absolute top-0 w-px h-6 bg-slate-300 -mt-6"></div>
                  {renderNode(childNode, level + 1)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render a single reporting node (employee) and their direct reports
  const renderReportingNode = (node: ReportingNode, level: number = 0) => {
    const isCEO = node.level === 1;
    const isHOD = node.level === 2;

    return (
      <div key={node.id} className="flex flex-col items-center relative px-2 animate-in fade-in zoom-in duration-300">
        
        {/* Vertical line connecting up to parent */}
        {level > 0 && <div className="w-px h-6 bg-slate-300"></div>}

        <motion.div
          initial={{ y: 15, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className={`w-60 bg-white border ${isCEO ? 'border-slate-800 ring-4 ring-slate-100' : isHOD ? 'border-indigo-300 shadow-indigo-100/50' : 'border-slate-200'} rounded-xl shadow-md hover:shadow-lg transition-all z-10 overflow-hidden relative group`}
        >
          <div className={`h-1.5 w-full ${isCEO ? 'bg-slate-900' : isHOD ? 'bg-indigo-500' : node.staffType === 'FIELD' ? 'bg-amber-400' : 'bg-blue-500'}`}></div>
          <div className="bg-slate-50 border-b border-slate-100 p-4 flex flex-col items-center text-center">
            {node.avatar ? (
              <img src={node.avatar} alt="Avatar" className={`w-14 h-14 rounded-full mb-3 object-cover shadow-md border-2 ${isCEO ? 'border-slate-800' : 'border-white'}`} />
            ) : (
              <div className={`w-14 h-14 rounded-full mb-3 flex items-center justify-center font-bold text-xl shadow-md border-2 border-white ${isCEO ? 'bg-slate-900 text-white' : isHOD ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                {node.firstname.charAt(0)}{node.surname.charAt(0)}
              </div>
            )}
            <h4 className={`font-black tracking-tight ${isCEO ? 'text-slate-900 text-base' : 'text-slate-800 text-sm'} line-clamp-2 leading-tight`}>
              {node.firstname} {node.surname}
            </h4>
            <span className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-tighter">{node.position}</span>
            <div className="flex items-center justify-center gap-1.5 mt-3">
              <span className={`text-[9px] font-black uppercase tracking-[0.1em] px-2 py-0.5 rounded-full border ${isCEO ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200'}`}>
                LVL {node.level || 10}
              </span>
              <span className={`text-[9px] font-black uppercase tracking-[0.1em] px-2 py-0.5 rounded-full ${node.staffType === 'FIELD' ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-blue-50 text-blue-700 border border-blue-100'}`}>
                {node.staffType}
              </span>
            </div>
          </div>
          <div className="bg-white px-3 py-2 flex flex-wrap items-center justify-center gap-1 border-t border-slate-50">
            {[node.department, ...(node.secondaryDepartments || [])].filter(Boolean).map((d, idx) => (
              <span key={idx} className="text-[9px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50 px-1.5 rounded">{d}</span>
            ))}
          </div>
        </motion.div>

        {/* RECURSIVE DIRECT REPORTS RENDERING */}
        {node.directReports.length > 0 && (
          <div className="flex flex-col items-center w-full mt-2 relative">
            <div className="w-px h-6 bg-slate-300"></div>
            
            <div className="flex items-start justify-center relative pt-6">
              {node.directReports.length > 1 && (
                <div 
                  className="absolute top-0 h-px bg-slate-300"
                  style={{
                    left: `calc(100% / ${node.directReports.length} / 2)`,
                    right: `calc(100% / ${node.directReports.length} / 2)`
                  }}
                ></div>
              )}
              
              {node.directReports.sort((a,b) => (a.level || 10) - (b.level || 10)).map(report => (
                <div key={report.id} className="relative flex flex-col items-center px-4">
                  <div className="absolute top-0 w-px h-6 bg-slate-300 -mt-6"></div>
                  {renderReportingNode(report, level + 1)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const ceoEmployee = useMemo(() => activeEmployees.find(e => e.level === 1), [activeEmployees]);

  useSetPageTitle(
    'Organogram',
    'Hierarchical structure with departmental splits and reporting lines',
    <div className="flex flex-col sm:flex-row items-center gap-3">
      <div className="flex bg-slate-100 p-1 rounded-lg">
        <button
          onClick={() => setViewMode('department')}
          className={`px-3 py-1.5 text-[10px] font-bold rounded-md flex items-center gap-1.5 transition-all ${viewMode === 'department' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Building2 className="h-3.5 w-3.5" /> Dept
        </button>
        <button
          onClick={() => setViewMode('reporting')}
          className={`px-3 py-1.5 text-[10px] font-bold rounded-md flex items-center gap-1.5 transition-all ${viewMode === 'reporting' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Users className="h-3.5 w-3.5" /> Reporting
        </button>
      </div>
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
        <Button variant="ghost" size="icon" onClick={handleZoomOut} className="h-8 w-8 text-slate-600 hover:bg-white" title="Zoom Out">
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <div className="w-10 text-center text-[10px] font-black text-slate-600 font-mono">
          {Math.round(zoom * 100)}%
        </div>
        <Button variant="ghost" size="icon" onClick={handleZoomIn} className="h-8 w-8 text-slate-600 hover:bg-white" title="Zoom In">
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
        <div className="w-px h-4 bg-slate-300 mx-0.5"></div>
        <Button variant="ghost" size="icon" onClick={handleResetZoom} className="h-8 w-8 text-slate-600 hover:bg-white" title="Reset Zoom">
          <Maximize className="h-3.5 w-3.5" />
        </Button>
        <div className="w-px h-4 bg-slate-300 mx-0.5"></div>
        <Button variant="ghost" className="h-8 text-[10px] font-bold text-slate-600 hover:bg-white" onClick={() => navigate('/employees')}>
          <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4 h-full flex flex-col min-h-[calc(100vh-8rem)]">

      {/* CANVAS */}
      <div className="flex-1 bg-[#f8fafc] border border-slate-200 rounded-2xl overflow-auto relative cursor-grab active:cursor-grabbing shadow-inner">
        {/* We use an internal container that scales based on zoom. The transform-origin is top center so it grows downwards and outwards symmetrically. */}
        <div 
          className="min-w-max min-h-full flex justify-center py-16 px-32 transition-transform duration-300 ease-out"
          style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
        >
          {/* ROOT CONTAINER */}
          <div className="flex flex-col items-center">
            {/* BIG CEO / COMPANY HEAD CARD */}
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={`rounded-2xl shadow-xl p-8 z-20 relative flex flex-col items-center border-[6px] ring-8 ${viewMode === 'department' ? 'bg-slate-900 border-slate-800 ring-indigo-50/30' : 'bg-slate-900 border-slate-800 ring-emerald-50/30'}`}
            >
              {ceoEmployee ? (
                <div className="flex flex-col items-center">
                   {ceoEmployee.avatar ? (
                     <img src={ceoEmployee.avatar} alt="" className="w-20 h-20 rounded-full border-4 border-white shadow-lg mb-4 object-cover" />
                   ) : (
                     <div className="w-20 h-20 rounded-full bg-slate-800 border-4 border-slate-700 flex items-center justify-center mb-4 shadow-lg">
                       <Network className="h-10 w-10 text-slate-300" />
                     </div>
                   )}
                   <h2 className="text-white text-2xl font-black tracking-tight">{ceoEmployee.firstname} {ceoEmployee.surname}</h2>
                   <div className="flex items-center gap-2 mt-2">
                     <span className="text-indigo-400 text-xs font-black uppercase tracking-[0.2em]">CEO / Head of Company</span>
                   </div>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="p-4 rounded-full bg-slate-800 mb-4 border-2 border-slate-700">
                    {viewMode === 'department' ? <Building2 className="h-10 w-10 text-indigo-400" /> : <Network className="h-10 w-10 text-emerald-400" />}
                  </div>
                  <h2 className="text-white text-2xl font-black tracking-tight uppercase leading-none">{viewMode === 'department' ? 'Company Structure' : 'Employee Hierarchy'}</h2>
                  <span className="text-slate-500 text-xs mt-3 font-bold uppercase tracking-[0.3em]">{activeEmployees.length} Active System Staff</span>
                </div>
              )}
            </motion.div>

            {/* Stem dropping down */}
            <div className="w-px h-16 bg-slate-300"></div>

            {/* Render top-level children depending on mode */}
            {viewMode === 'department' ? (
              <div className="flex items-start justify-center relative pt-8">
                {rootNodes.length > 1 && (
                  <div 
                    className="absolute top-0 h-px bg-slate-300"
                    style={{
                      left: `calc(100% / ${rootNodes.length} / 2)`,
                      right: `calc(100% / ${rootNodes.length} / 2)`
                    }}
                  ></div>
                )}

                {rootNodes.map(node => (
                  <div key={node.id} className="relative flex flex-col items-center">
                    <div className="absolute top-0 w-px h-8 bg-slate-300 -mt-8"></div>
                    {renderNode(node, 0)}
                  </div>
                ))}

                {rootNodes.length === 0 && (
                  <div className="bg-white p-12 rounded-3xl border border-dashed border-slate-200 text-slate-400 text-center mx-auto shadow-sm mt-8">
                    <Building2 className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p className="font-bold text-slate-500 uppercase tracking-widest text-sm">No departments defined</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-start justify-center relative pt-8">
                {reportingRoots.length > 1 && (
                  <div 
                    className="absolute top-0 h-px bg-slate-300"
                    style={{
                      left: `calc(100% / ${reportingRoots.length} / 2)`,
                      right: `calc(100% / ${reportingRoots.length} / 2)`
                    }}
                  ></div>
                )}

                {reportingRoots.sort((a,b) => (a.level || 10) - (b.level || 10)).map(node => (
                  <div key={node.id} className="relative flex flex-col items-center">
                    <div className="absolute top-0 w-px h-8 bg-slate-300 -mt-8"></div>
                    {renderReportingNode(node, 0)}
                  </div>
                ))}

                {reportingRoots.length === 0 && (
                  <div className="bg-white p-12 rounded-3xl border border-dashed border-slate-200 text-slate-400 text-center mx-auto shadow-sm mt-8">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p className="font-bold text-slate-500 uppercase tracking-widest text-sm">No reporting lines found</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


