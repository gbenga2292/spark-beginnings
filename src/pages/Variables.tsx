import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Plus, Trash2, Save } from 'lucide-react';
import { useAppStore } from '@/src/store/appStore';

// In a real app, this would be in the global store
const initialHolidays = [
  { id: '1', date: '2026-01-01', name: 'New Year\'s Day' },
  { id: '2', date: '2026-01-02', name: 'New Year Holiday' },
  { id: '3', date: '2026-01-03', name: 'New Year Holiday' },
  { id: '4', date: '2026-03-20', name: 'Eid-el-Fitr' },
  { id: '5', date: '2026-03-21', name: 'Eid-el-Fitr' },
  { id: '6', date: '2026-04-03', name: 'Good Friday' },
  { id: '7', date: '2026-04-06', name: 'Easter Monday' },
  { id: '8', date: '2026-05-01', name: 'Workers\' Day' },
  { id: '9', date: '2026-05-27', name: 'Children\'s Day' },
  { id: '10', date: '2026-05-28', name: 'Eid-el-Kabir' },
  { id: '11', date: '2026-06-12', name: 'Democracy Day' },
  { id: '12', date: '2026-08-26', name: 'Eid-el-Maulud' },
  { id: '13', date: '2026-10-01', name: 'Independence Day' },
  { id: '14', date: '2026-12-25', name: 'Christmas Day' },
];

export function Variables() {
  const [holidays, setHolidays] = useState(initialHolidays);
  const [newDate, setNewDate] = useState('');
  const [newName, setNewName] = useState('');

  const positions = useAppStore((state) => state.positions);
  const departments = useAppStore((state) => state.departments);
  const addPosition = useAppStore((state) => state.addPosition);
  const removePosition = useAppStore((state) => state.removePosition);
  const addDepartment = useAppStore((state) => state.addDepartment);
  const removeDepartment = useAppStore((state) => state.removeDepartment);

  const [newPosition, setNewPosition] = useState('');
  const [newDepartment, setNewDepartment] = useState('');

  const handleAddHoliday = () => {
    if (!newDate || !newName) return;
    
    setHolidays([
      ...holidays,
      { id: crypto.randomUUID(), date: newDate, name: newName }
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
    
    setNewDate('');
    setNewName('');
  };

  const handleRemoveHoliday = (id: string) => {
    setHolidays(holidays.filter(h => h.id !== id));
  };

  const handleAddPosition = () => {
    if (newPosition && !positions.includes(newPosition)) {
      addPosition(newPosition);
      setNewPosition('');
    }
  };

  const handleAddDepartment = () => {
    if (newDepartment && !departments.includes(newDepartment)) {
      addDepartment(newDepartment);
      setNewDepartment('');
    }
  };

  const handleSave = () => {
    // In a real app, this would save to the backend/store
    alert('Variables saved successfully!');
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Variables Used</h1>
          <p className="text-slate-500 mt-1">Manage reusable values and libraries like Public Holidays, Positions, and Departments.</p>
        </div>
        <Button onClick={handleSave} className="bg-[#002040] hover:bg-[#003060] text-white gap-2">
          <Save className="h-4 w-4" /> Save Changes
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Public Holidays</CardTitle>
            <CardDescription>Dates defined here are used to calculate OT in the Daily Register.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-4">
              <Input 
                type="date" 
                value={newDate} 
                onChange={(e) => setNewDate(e.target.value)}
                className="w-40"
              />
              <Input 
                placeholder="Holiday Name" 
                value={newName} 
                onChange={(e) => setNewName(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleAddHoliday} variant="outline" className="gap-2">
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>

            <div className="border rounded-md overflow-hidden max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader className="bg-slate-50 sticky top-0">
                  <TableRow>
                    <TableHead className="w-32">Date</TableHead>
                    <TableHead>Holiday Name</TableHead>
                    <TableHead className="w-16 text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holidays.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-slate-500 py-4">No holidays defined.</TableCell>
                    </TableRow>
                  ) : (
                    holidays.map((holiday) => (
                      <TableRow key={holiday.id}>
                        <TableCell className="font-medium">{holiday.date}</TableCell>
                        <TableCell>{holiday.name}</TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleRemoveHoliday(holiday.id)}
                            className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Positions</CardTitle>
              <CardDescription>Manage available job positions for employees.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-4">
                <Input 
                  placeholder="New Position" 
                  value={newPosition} 
                  onChange={(e) => setNewPosition(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleAddPosition} variant="outline" className="gap-2">
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {positions.map(pos => (
                  <div key={pos} className="bg-slate-100 border border-slate-200 rounded-full px-3 py-1 text-sm flex items-center gap-2">
                    {pos}
                    <button onClick={() => removePosition(pos)} className="text-slate-400 hover:text-red-500">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Departments</CardTitle>
              <CardDescription>Manage available departments.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-4">
                <Input 
                  placeholder="New Department" 
                  value={newDepartment} 
                  onChange={(e) => setNewDepartment(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleAddDepartment} variant="outline" className="gap-2">
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {departments.map(dep => (
                  <div key={dep} className="bg-slate-100 border border-slate-200 rounded-full px-3 py-1 text-sm flex items-center gap-2">
                    {dep}
                    <button onClick={() => removeDepartment(dep)} className="text-slate-400 hover:text-red-500">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
