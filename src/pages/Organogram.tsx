import { useState, useMemo } from 'react';
import { useAppStore, Department, Position, Employee } from '@/src/store/appStore';
import { Button } from '@/src/components/ui/button';
import { ArrowLeft, Users, Building2, Briefcase, ZoomIn, ZoomOut, Maximize, Network, UserSquare2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

// Extended Department type that contains nested children and positions
type OrgNode = Department & {
  childrenDepts: OrgNode[];
  positionsWithStaff: (Position & { employees: Employee[] })[];
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
    return employees.filter(emp => (emp.status === 'Active' || emp.status === 'On Leave') && emp.staffType !== 'BENEFICIARY');
  }, [employees]);

  // Recursively build the organogram tree
  const rootNodes = useMemo(() => {
    // 1. Build a map of all node IDs to their populated data
    const nodesMap = new Map<string, OrgNode>();

    departments.forEach(dept => {
      // Find positions for this department
      const deptPositions = positions.filter(pos => pos.departmentId === dept.id);
      
      const positionsWithStaff = deptPositions.map(pos => {
        const staffInPosition = activeEmployees.filter(
          emp => emp.position === pos.id || emp.position === pos.title
        );
        return {
          ...pos,
          employees: staffInPosition
        };
      });

      nodesMap.set(dept.id, {
        ...dept,
        positionsWithStaff,
        childrenDepts: []
      });
    });

    const roots: OrgNode[] = [];

    // 2. Link children to their parents
    // Notice: we must convert Map values to Array before iterating if we rely on mutations forming the tree
    Array.from(nodesMap.values()).forEach(node => {
      if (node.parentDepartmentId && nodesMap.has(node.parentDepartmentId)) {
        nodesMap.get(node.parentDepartmentId)!.childrenDepts.push(node);
      } else {
        // No parent or parent not found -> treat as root
        roots.push(node);
      }
    });

    // Sort roots alphabetically
    roots.sort((a, b) => a.name.localeCompare(b.name));
    return roots;
  }, [departments, positions, activeEmployees]);

  // Recursively build the reporting line tree (Internal Staff only)
  const reportingRoots = useMemo(() => {
    const internalActive = activeEmployees.filter(emp => emp.staffType === 'INTERNAL');
    const nodesMap = new Map<string, ReportingNode>();

    internalActive.forEach(emp => {
      nodesMap.set(emp.id, { ...emp, directReports: [] });
    });

    const roots: ReportingNode[] = [];

    Array.from(nodesMap.values()).forEach(node => {
      if (node.lineManager && nodesMap.has(node.lineManager)) {
        nodesMap.get(node.lineManager)!.directReports.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  }, [activeEmployees]);

  // Render a single department node and its children recursively
  const renderNode = (node: OrgNode, level: number = 0) => {
    return (
      <div key={node.id} className="flex flex-col items-center relative px-2 animate-in fade-in zoom-in duration-300">
        
        {/* Vertical line connecting up to parent (except first-level nodes where the parent is the root company node) */}
        {level > 0 && <div className="w-px h-6 bg-slate-400"></div>}

        <motion.div
          initial={{ y: 15, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="w-64 bg-white border border-slate-200 rounded-lg shadow-sm hover:shadow-md transition-shadow z-10 overflow-hidden relative group"
        >
          {/* Top colored strip based on type */}
          <div className={`h-1.5 w-full ${node.staffType === 'EXTERNAL' ? 'bg-amber-400' : 'bg-blue-500'}`}></div>
          <div className="bg-slate-50 border-b border-slate-100 p-4 flex flex-col items-center text-center">
            <div className={`p-2 rounded-lg mb-3 shadow-sm ${node.staffType === 'EXTERNAL' ? 'bg-amber-100' : 'bg-blue-100'}`}>
              <Users className={`h-5 w-5 ${node.staffType === 'EXTERNAL' ? 'text-amber-600' : 'text-blue-600'}`} />
            </div>
            <h3 className="font-bold text-slate-800 line-clamp-2 leading-tight">{node.name}</h3>
            <span className="text-[10px] font-bold text-slate-500 mt-1.5 uppercase tracking-widest bg-slate-200/50 px-2 py-0.5 rounded-full">{node.staffType}</span>
          </div>
          
          {/* POSITIONS & EMPLOYEES INSIDE THIS DEPT */}
          {node.positionsWithStaff.length > 0 && (
            <div className="p-3 bg-white flex flex-col gap-3">
              {node.positionsWithStaff.map(pos => (
                <div key={pos.id} className="border border-slate-100 rounded-md p-2 shadow-sm bg-slate-50/50">
                  <div className="flex items-center justify-center gap-1.5 mb-2 pb-2 border-b border-slate-100">
                    <Briefcase className="h-3 w-3 text-slate-400" />
                    <h4 className="font-semibold text-xs text-slate-700 text-center">{pos.title}</h4>
                  </div>
                  <div className="flex flex-col gap-1">
                    {pos.employees.map(emp => (
                      <div key={emp.id} className="text-[11px] bg-white border border-indigo-100 text-indigo-700 font-medium px-2 py-1.5 rounded truncate shadow-sm text-center">
                        {emp.firstname} {emp.surname}
                      </div>
                    ))}
                    {pos.employees.length === 0 && (
                      <div className="text-[10px] text-slate-400 italic text-center py-0.5">Empty Role</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* RECURSIVE CHILDREN RENDERING */}
        {node.childrenDepts.length > 0 && (
          <div className="flex flex-col items-center w-full mt-2 relative">
            {/* Stem line down from this node */}
            <div className="w-px h-6 bg-slate-400"></div>
            
            <div className="flex items-start justify-center relative pt-4">
              {/* Horizontal connection line if multiple children */}
              {node.childrenDepts.length > 1 && (
                <div 
                  className="absolute top-0 h-px bg-slate-400"
                  style={{
                    left: `calc(100% / ${node.childrenDepts.length} / 2)`,
                    right: `calc(100% / ${node.childrenDepts.length} / 2)`
                  }}
                ></div>
              )}
              
              {node.childrenDepts.sort((a,b) => a.name.localeCompare(b.name)).map(childNode => (
                <div key={childNode.id} className="relative flex flex-col items-center px-4">
                  {/* Vertical stub from the horizontal line up to the line */}
                  <div className="absolute top-0 w-px h-4 bg-slate-400 -mt-4"></div>
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
    return (
      <div key={node.id} className="flex flex-col items-center relative px-2 animate-in fade-in zoom-in duration-300">
        
        {/* Vertical line connecting up to parent */}
        {level > 0 && <div className="w-px h-6 bg-slate-400"></div>}

        <motion.div
          initial={{ y: 15, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="w-56 bg-white border border-slate-200 rounded-lg shadow-sm hover:shadow-md transition-shadow z-10 overflow-hidden relative group"
        >
          <div className="h-1.5 w-full bg-emerald-500"></div>
          <div className="bg-slate-50 border-b border-slate-100 p-4 flex flex-col items-center text-center">
            {node.avatar ? (
              <img src={node.avatar} alt="Avatar" className="w-12 h-12 rounded-full mb-3 object-cover shadow-sm border-2 border-white" />
            ) : (
              <div className="w-12 h-12 rounded-full mb-3 bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-lg shadow-sm border-2 border-white">
                {node.firstname.charAt(0)}{node.surname.charAt(0)}
              </div>
            )}
            <h3 className="font-bold text-slate-800 line-clamp-2 leading-tight">{node.firstname} {node.surname}</h3>
            <span className="text-[11px] font-semibold text-slate-500 mt-1">{node.position}</span>
            <span className="text-[10px] font-bold text-emerald-600 mt-1.5 uppercase tracking-widest bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">{node.department}</span>
          </div>
        </motion.div>

        {/* RECURSIVE DIRECT REPORTS RENDERING */}
        {node.directReports.length > 0 && (
          <div className="flex flex-col items-center w-full mt-2 relative">
            <div className="w-px h-6 bg-slate-400"></div>
            
            <div className="flex items-start justify-center relative pt-4">
              {node.directReports.length > 1 && (
                <div 
                  className="absolute top-0 h-px bg-slate-400"
                  style={{
                    left: `calc(100% / ${node.directReports.length} / 2)`,
                    right: `calc(100% / ${node.directReports.length} / 2)`
                  }}
                ></div>
              )}
              
              {node.directReports.sort((a,b) => a.firstname.localeCompare(b.firstname)).map(report => (
                <div key={report.id} className="relative flex flex-col items-center px-4">
                  <div className="absolute top-0 w-px h-4 bg-slate-400 -mt-4"></div>
                  {renderReportingNode(report, level + 1)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 h-full flex flex-col min-h-[calc(100vh-8rem)]">
      {/* HEADER CONTROLS */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Network className="h-6 w-6 text-indigo-600 hidden sm:block"/>
            Organogram
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">Interactive visual hierarchy of departments and positions.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('department')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all ${viewMode === 'department' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Building2 className="h-3.5 w-3.5" /> Dept View
            </button>
            <button
              onClick={() => setViewMode('reporting')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all ${viewMode === 'reporting' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <UserSquare2 className="h-3.5 w-3.5" /> Reporting View
            </button>
          </div>
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
          <Button variant="ghost" size="icon" onClick={handleZoomOut} className="h-8 w-8 text-slate-600 hover:bg-white hover:text-indigo-600 hover:shadow-sm" title="Zoom Out">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <div className="w-12 text-center text-xs font-bold text-slate-600 font-mono">
            {Math.round(zoom * 100)}%
          </div>
          <Button variant="ghost" size="icon" onClick={handleZoomIn} className="h-8 w-8 text-slate-600 hover:bg-white hover:text-indigo-600 hover:shadow-sm" title="Zoom In">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <div className="w-px h-4 bg-slate-300 mx-1"></div>
          <Button variant="ghost" size="icon" onClick={handleResetZoom} className="h-8 w-8 text-slate-600 hover:bg-white hover:text-indigo-600 hover:shadow-sm" title="Reset Zoom">
            <Maximize className="h-4 w-4" />
          </Button>
          <div className="w-px h-4 bg-slate-300 mx-1"></div>
          <Button variant="ghost" className="h-8 text-xs font-semibold text-slate-600 hover:bg-white hover:text-indigo-600 hover:shadow-sm" onClick={() => navigate('/employees')}>
            <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back
          </Button>
        </div>
        </div>
      </div>

      {/* CANVAS */}
      <div className="flex-1 bg-slate-50/50 border border-slate-200 rounded-xl overflow-auto relative cursor-grab active:cursor-grabbing">
        {/* We use an internal container that scales based on zoom. The transform-origin is top center so it grows downwards and outwards symmetrically. */}
        <div 
          className="min-w-max min-h-full flex justify-center py-12 px-20 transition-transform duration-200 ease-out"
          style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
        >
          {/* ROOT CONTAINER */}
          <div className="flex flex-col items-center">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={`text-white rounded-xl shadow-xl px-10 py-5 z-20 relative flex flex-col items-center border-[4px] ring-4 ${viewMode === 'department' ? 'bg-slate-900 border-slate-800 ring-indigo-50/50' : 'bg-slate-900 border-slate-800 ring-emerald-50/50'}`}
            >
              <div className={`p-3 rounded-xl mb-3 border ${viewMode === 'department' ? 'bg-indigo-500/20 border-indigo-400/30' : 'bg-emerald-500/20 border-emerald-400/30'}`}>
                {viewMode === 'department' ? <Building2 className="h-8 w-8 text-indigo-300" /> : <Network className="h-8 w-8 text-emerald-300" />}
              </div>
              <h2 className="text-xl font-bold tracking-wide">{viewMode === 'department' ? 'Company Executive' : 'Internal Staff Hierarchy'}</h2>
              <span className="text-slate-400 text-sm mt-1 font-medium">{viewMode === 'department' ? activeEmployees.length : activeEmployees.filter(e => e.staffType === 'INTERNAL').length} Total Active Staff</span>
            </motion.div>

            {/* Stem dropping down */}
            <div className="w-px h-12 bg-slate-400"></div>

            {/* Render top-level children depending on mode */}
            {viewMode === 'department' ? (
              <div className="flex items-start justify-center relative pt-4">
                {rootNodes.length > 1 && (
                  <div 
                    className="absolute top-0 h-px bg-slate-400"
                    style={{
                      left: `calc(100% / ${rootNodes.length} / 2)`,
                      right: `calc(100% / ${rootNodes.length} / 2)`
                    }}
                  ></div>
                )}

                {rootNodes.map(node => (
                  <div key={node.id} className="relative flex flex-col items-center px-4">
                    <div className="absolute top-0 w-px h-4 bg-slate-400 -mt-4"></div>
                    {renderNode(node, 0)}
                  </div>
                ))}

                {rootNodes.length === 0 && (
                  <div className="bg-white p-8 rounded-xl border border-dashed border-slate-300 text-slate-500 text-center mx-auto shadow-sm mt-4">
                    <Building2 className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                    <p className="font-medium text-slate-600">No departments configured yet.</p>
                    <p className="text-xs text-slate-400 mt-1">Head to Variables &gt; Departments to add some.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-start justify-center relative pt-4">
                {reportingRoots.length > 1 && (
                  <div 
                    className="absolute top-0 h-px bg-slate-400"
                    style={{
                      left: `calc(100% / ${reportingRoots.length} / 2)`,
                      right: `calc(100% / ${reportingRoots.length} / 2)`
                    }}
                  ></div>
                )}

                {reportingRoots.sort((a,b) => a.firstname.localeCompare(b.firstname)).map(node => (
                  <div key={node.id} className="relative flex flex-col items-center px-4">
                    <div className="absolute top-0 w-px h-4 bg-slate-400 -mt-4"></div>
                    {renderReportingNode(node, 0)}
                  </div>
                ))}

                {reportingRoots.length === 0 && (
                  <div className="bg-white p-8 rounded-xl border border-dashed border-slate-300 text-slate-500 text-center mx-auto shadow-sm mt-4">
                    <UserSquare2 className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                    <p className="font-medium text-slate-600">No internal staff found.</p>
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

