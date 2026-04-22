import { useState } from 'react';
import { useOperations } from '../contexts/OperationsContext';
import { useAppStore } from '../store/appStore';
import { 
  Plus, Search, Truck, MapPin, Clock, Calendar, 
  Edit2, Trash2, History, AlertCircle, ChevronRight,
  MoreHorizontal, PlusCircle, X, Check, ClipboardList,
  LayoutGrid, List, ChevronLeft
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useTheme } from '@/src/hooks/useTheme';
import { Vehicle, VehicleTripLeg, VehicleDocumentType } from '../types/operations';
import { formatDisplayDate } from '@/src/lib/dateUtils';
import { 
  isSameMonth, isBefore, startOfMonth, endOfMonth, 
  startOfWeek, endOfWeek, addDays, isSameDay, 
  format, startOfDay, addMonths, subMonths 
} from 'date-fns';

import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { Input } from '@/src/components/ui/input';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu";
import { Label } from '@/src/components/ui/label';
import { useSetPageTitle } from '@/src/contexts/PageContext';

export function VehicleManager() {
  const { 
    vehicles, vehicleTrips, addVehicle, updateVehicle, deleteVehicle, addVehicleTripRecords,
    updateVehicleTripRecord, deleteVehicleTripRecord,
    vehicleDocumentTypes, updateVehicleDocument
  } = useOperations();
  const { sites, pendingSites, employees } = useAppStore();
  
  const [activeTab, setActiveTab] = useState<'fleet' | 'logs' | 'documents'>('fleet');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [showTripForm, setShowTripForm] = useState(false);
  const [editingTrip, setEditingTrip] = useState<VehicleTripLeg | null>(null);
  const [editingDocVehicle, setEditingDocVehicle] = useState<Vehicle | null>(null);
  const [showDocUpdateForm, setShowDocUpdateForm] = useState(false);
  const [docUpdateForm, setDocUpdateForm] = useState({ type: '', date: '' });
  const [search, setSearch] = useState('');
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // 1. Vehicle Form State
  const [vForm, setVForm] = useState({
    name: '',
    registration_number: '',
    type: 'van' as string,
    status: 'active' as 'active' | 'inactive'
  });

  // 2. Trip Log Form State
  const [tForm, setTForm] = useState({
    vehicle_id: '',
    date: new Date().toISOString().split('T')[0],
    driver_name: '',
    legs: [
      { site_name: '', purpose: '', departure_time: '', arrival_time: '', remark: '', odometer_start: undefined, odometer_end: undefined }
    ] as any[]
  });

  const allSites = [
    ...sites.map(s => ({ id: s.id, name: s.name, type: 'active' })),
    ...pendingSites.map(s => ({ id: s.id, name: s.siteName, type: 'pending' }))
  ];

  useSetPageTitle(
    'Vehicle Management',
    'Manage company fleet and track daily movement logs',
    <div className="hidden sm:flex items-center gap-2">
      {activeTab === 'logs' && (
        <Button 
          variant="outline" size="sm" className="gap-2 h-9"
          onClick={() => setShowTripForm(true)}
        >
          <ClipboardList className="h-4 w-4" /> Record Trip
        </Button>
      )}
      {activeTab === 'fleet' && (
        <Button 
          size="sm" className="gap-2 bg-teal-600 hover:bg-teal-700 text-white h-9"
          onClick={() => {
            setEditingVehicle(null);
            setVForm({ name: '', registration_number: '', type: 'van', status: 'active' });
            setShowVehicleForm(true);
          }}
        >
          <Plus className="h-4 w-4" /> Add Vehicle
        </Button>
      )}
    </div>
  );

  const handleSaveVehicle = () => {
    if (!vForm.name || !vForm.registration_number) return;
    if (editingVehicle) {
      updateVehicle(editingVehicle.id, vForm);
    } else {
      addVehicle(vForm);
    }
    setShowVehicleForm(false);
  };

  const handleSaveTrip = () => {
    const selectedVehicle = vehicles.find(v => v.id === tForm.vehicle_id);
    if (!selectedVehicle || !tForm.driver_name) return;

    if (editingTrip) {
      const leg = tForm.legs[0];
      const updatedLog = {
        ...leg,
        id: editingTrip.id,
        vehicle_id: selectedVehicle.id,
        vehicle_reg: selectedVehicle.registration_number,
        driver_name: tForm.driver_name,
        departure_time: `${tForm.date}T${leg.departure_time || '00:00'}:00Z`,
        arrival_time: leg.arrival_time ? `${tForm.date}T${leg.arrival_time}:00Z` : undefined,
      };
      updateVehicleTripRecord(editingTrip.id, updatedLog);
    } else {
      const logs = tForm.legs.map(leg => ({
        ...leg,
        vehicle_id: selectedVehicle.id,
        vehicle_reg: selectedVehicle.registration_number,
        driver_name: tForm.driver_name,
        departure_time: `${tForm.date}T${leg.departure_time || '00:00'}:00Z`,
        arrival_time: leg.arrival_time ? `${tForm.date}T${leg.arrival_time}:00Z` : undefined,
      }));
      addVehicleTripRecords(logs);
    }

    setShowTripForm(false);
    setEditingTrip(null);
    setTForm({
      vehicle_id: '',
      date: new Date().toISOString().split('T')[0],
      driver_name: '',
      legs: [{ site_name: '', purpose: '', departure_time: '', arrival_time: '', remark: '', odometer_start: undefined, odometer_end: undefined }]
    });
  };

  const handleEditTrip = (trip: VehicleTripLeg) => {
    setEditingTrip(trip);
    const datePart = trip.departure_time.split('T')[0];
    const depTimePart = trip.departure_time.split('T')[1].substring(0, 5);
    const arrTimePart = trip.arrival_time ? trip.arrival_time.split('T')[1].substring(0, 5) : '';

    setTForm({
      vehicle_id: trip.vehicle_id,
      date: datePart,
      driver_name: trip.driver_name,
      legs: [{
        site_name: trip.site_name,
        purpose: trip.purpose,
        departure_time: depTimePart,
        arrival_time: arrTimePart,
        remark: trip.remark,
        odometer_start: trip.odometer_start,
        odometer_end: trip.odometer_end
      }]
    });
    setShowTripForm(true);
  };

  const filteredVehicles = vehicles.filter(v => 
    v.name.toLowerCase().includes(search.toLowerCase()) || 
    v.registration_number.toLowerCase().includes(search.toLowerCase())
  );

  const sortedTrips = [...vehicleTrips].sort((a, b) => 
    new Date(b.departure_time).getTime() - new Date(a.departure_time).getTime()
  );

  // Calendar Helper Functions
  const calendarDays = () => {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end = endOfWeek(endOfMonth(currentMonth));
    const days = [];
    let day = start;
    while (day <= end) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10">
      {/* Vehicle Form Modal */}
      {showVehicleForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <CardHeader className="bg-slate-50 dark:bg-slate-800 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-bold">{editingVehicle ? 'Edit Vehicle' : 'Add New Vehicle'}</CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setShowVehicleForm(false)}><X className="h-4 w-4" /></Button>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <Label>Vehicle Name</Label>
                <Input placeholder="e.g. Toyota Hilux" value={vForm.name} onChange={e => setVForm({...vForm, name: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Registration Number</Label>
                <Input placeholder="e.g. LAG-123-XY" value={vForm.registration_number} onChange={e => setVForm({...vForm, registration_number: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Vehicle Type</Label>
                <select className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus:outline-none focus:ring-2 focus:ring-teal-500/50 dark:border-slate-800 dark:bg-slate-950 dark:ring-offset-slate-950"
                  value={vForm.type} onChange={e => setVForm({...vForm, type: e.target.value})}>
                  <option value="van">Van</option>
                  <option value="truck">Truck</option>
                  <option value="sedan">Sedan</option>
                  <option value="suv">SUV</option>
                  <option value="bike">Bike</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <Button className="flex-1 bg-teal-600 hover:bg-teal-700" onClick={handleSaveVehicle}>Save Vehicle</Button>
                <Button variant="outline" className="flex-1" onClick={() => setShowVehicleForm(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Trip Log Modal */}
      {showTripForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <Card className="w-full max-w-2xl shadow-2xl my-8 animate-in slide-in-from-bottom-4 duration-300">
            <CardHeader className="bg-slate-50 dark:bg-slate-800 border-b sticky top-0 z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center text-teal-600">
                    <ClipboardList className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-bold">{editingTrip ? 'Edit Trip Record' : 'Daily Trip Movement Log'}</CardTitle>
                    <p className="text-xs text-slate-500">{editingTrip ? 'Modify the details of this site visit' : 'Record vehicle visits and mileage for today'}</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => { setShowTripForm(false); setEditingTrip(null); }}><X className="h-4 w-4" /></Button>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Header Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Vehicle</Label>
                  <select className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
                    value={tForm.vehicle_id} onChange={e => setTForm({...tForm, vehicle_id: e.target.value})}>
                    <option value="">Select Vehicle</option>
                    {vehicles.map(v => <option key={v.id} value={v.id}>{v.name} ({v.registration_number})</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={tForm.date} onChange={e => setTForm({...tForm, date: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Driver Name</Label>
                  <Input list="driver-list" placeholder="Select or type driver" value={tForm.driver_name} onChange={e => setTForm({...tForm, driver_name: e.target.value})} />
                  <datalist id="driver-list">
                    {employees.map(emp => <option key={emp.id} value={`${emp.firstname} ${emp.surname}`} />)}
                  </datalist>
                </div>
              </div>

              <DropdownMenuSeparator className="my-6" />

              {/* Trip Legs */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-teal-600 flex items-center gap-2">
                    <MapPin className="h-4 w-4" /> {editingTrip ? 'Trip Details' : 'Trip Leg(s) / Site Visits'}
                  </h3>
                  {!editingTrip && (
                    <Button variant="ghost" size="sm" className="text-teal-600 hover:text-teal-700 hover:bg-teal-50 h-8 gap-1"
                      onClick={() => setTForm({...tForm, legs: [...tForm.legs, { site_name: '', purpose: '', departure_time: '', arrival_time: '', remark: '', odometer_start: undefined, odometer_end: undefined }]})}>
                      <PlusCircle className="h-4 w-4" /> Add Leg
                    </Button>
                  )}
                </div>

                {tForm.legs.map((leg, idx) => (
                  <div key={idx} className="relative p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 space-y-4 group">
                    {tForm.legs.length > 1 && (
                      <Button variant="ghost" size="icon" className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-white dark:bg-slate-800 border shadow-sm text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => {
                          const newLegs = [...tForm.legs];
                          newLegs.splice(idx, 1);
                          setTForm({...tForm, legs: newLegs});
                        }}>
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs">Destination (Active/Pending/Manual)</Label>
                        <Input list={`site-list-${idx}`} placeholder="Select site or type location" value={leg.site_name} 
                          onChange={e => {
                            const newLegs = [...tForm.legs];
                            newLegs[idx].site_name = e.target.value;
                            setTForm({...tForm, legs: newLegs});
                          }} />
                        <datalist id={`site-list-${idx}`}>
                          {Array.from(new Map(allSites.map(s => [s.name, s])).values()).map(s => <option key={s.id} value={s.name} />)}
                        </datalist>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Purpose of Movement</Label>
                        <Input placeholder="e.g. Delivery, Site Visit, Pickup" value={leg.purpose} 
                          onChange={e => {
                            const newLegs = [...tForm.legs];
                            newLegs[idx].purpose = e.target.value;
                            setTForm({...tForm, legs: newLegs});
                          }} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="space-y-2">
                        <Label className="text-xs flex items-center gap-1"><Clock className="h-3 w-3" /> Dept Time</Label>
                        <Input type="time" className="h-9 px-2" value={leg.departure_time} 
                          onChange={e => {
                            const newLegs = [...tForm.legs];
                            newLegs[idx].departure_time = e.target.value;
                            setTForm({...tForm, legs: newLegs});
                          }} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs flex items-center gap-1"><Clock className="h-3 w-3" /> Arr Time</Label>
                        <Input type="time" className="h-9 px-2" value={leg.arrival_time} 
                          onChange={e => {
                            const newLegs = [...tForm.legs];
                            newLegs[idx].arrival_time = e.target.value;
                            setTForm({...tForm, legs: newLegs});
                          }} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Odom. Start</Label>
                        <Input type="number" className="h-9 px-2" placeholder="Start" value={leg.odometer_start || ''} 
                          onChange={e => {
                            const newLegs = [...tForm.legs];
                            newLegs[idx].odometer_start = Number(e.target.value) || undefined;
                            setTForm({...tForm, legs: newLegs});
                          }} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Odom. End</Label>
                        <Input type="number" className="h-9 px-2" placeholder="End" value={leg.odometer_end || ''} 
                          onChange={e => {
                            const newLegs = [...tForm.legs];
                            newLegs[idx].odometer_end = Number(e.target.value) || undefined;
                            setTForm({...tForm, legs: newLegs});
                          }} />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">Remark / Specific Notes</Label>
                      <Input placeholder="Any additional info..." value={leg.remark} 
                        onChange={e => {
                          const newLegs = [...tForm.legs];
                          newLegs[idx].remark = e.target.value;
                          setTForm({...tForm, legs: newLegs});
                        }} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
            <CardHeader className="bg-slate-50 dark:bg-slate-800 border-t flex flex-row gap-3 pt-4">
              <Button className="flex-1 bg-teal-600 hover:bg-teal-700" onClick={handleSaveTrip}>{editingTrip ? 'Update Entry' : 'Submit Entry'}</Button>
              <Button variant="outline" className="flex-1" onClick={() => { setShowTripForm(false); setEditingTrip(null); }}>Discard</Button>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-8 px-2 mx-1">
        <button 
          className={`pb-3 text-sm font-bold transition-all border-b-2 ${activeTab === 'fleet' ? 'border-teal-600 text-teal-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          onClick={() => setActiveTab('fleet')}
        >
          Vehicle Fleet
        </button>
        <button 
          className={`pb-3 text-sm font-bold transition-all border-b-2 ${activeTab === 'logs' ? 'border-teal-600 text-teal-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          onClick={() => setActiveTab('logs')}
        >
          Movement Logs
        </button>
        <button 
          className={`pb-3 text-sm font-bold transition-all border-b-2 ${activeTab === 'documents' ? 'border-teal-600 text-teal-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          onClick={() => setActiveTab('documents')}
        >
          Vehicle Documents
        </button>
      </div>

      {activeTab === 'fleet' ? (
        <div className="space-y-6">
          {/* Stats Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 px-1">
            <Card className="border-none shadow-sm bg-teal-50 dark:bg-teal-900/10">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center text-teal-600">
                  <Truck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Fleet</p>
                  <p className="text-xl font-bold text-slate-700 dark:text-slate-200">{vehicles.length}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-none shadow-sm overflow-hidden bg-white dark:bg-slate-900">
            <div className="p-4 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col sm:flex-row gap-4 justify-between items-center border-b dark:border-slate-800">
              <h3 className="font-bold text-slate-700 dark:text-slate-200 text-sm flex items-center gap-2">
                <Truck className="h-4 w-4 text-teal-500" /> Fleet Overview
              </h3>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input placeholder="Search fleet..." className="pl-9 h-9 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800/50 text-[10px] uppercase font-bold tracking-wider text-slate-500">
                    <th className="px-6 py-3">Vehicle Details</th>
                    <th className="px-6 py-3">Registration</th>
                    <th className="px-6 py-3">Type</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredVehicles.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-slate-400 text-sm italic">No vehicles found</td>
                    </tr>
                  ) : (
                    filteredVehicles.map(v => (
                      <tr key={v.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                              <Truck className="h-4 w-4" />
                            </div>
                            <span className="font-bold text-slate-700 dark:text-slate-200">{v.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-mono text-xs font-bold text-teal-600 dark:text-teal-400">{v.registration_number}</td>
                        <td className="px-6 py-4">
                          <Badge variant="outline" className="capitalize text-[10px] bg-slate-50 dark:bg-slate-800">{v.type}</Badge>
                        </td>
                        <td className="px-6 py-4">
                          {v.status === 'active' ? (
                            <div className="flex items-center gap-1.5 font-bold text-[10px] uppercase text-emerald-500">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Active
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 font-bold text-[10px] uppercase text-rose-500">
                              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> Inactive
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                              setEditingVehicle(v);
                              setVForm({ name: v.name, registration_number: v.registration_number, type: v.type || 'van', status: v.status });
                              setShowVehicleForm(true);
                            }}>
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-500" onClick={() => deleteVehicle(v.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : activeTab === 'documents' ? (
        <div className="space-y-6">
          {/* Document Legend */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-1">
            <div className="flex flex-wrap gap-2">
              {vehicleDocumentTypes.map(type => (
                <Badge key={type.id} variant="secondary" className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-none">
                  {type.name}
                </Badge>
              ))}
            </div>
          </div>


          {showDocUpdateForm && editingDocVehicle && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <Card className="w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
                <CardHeader className="bg-slate-50 dark:bg-slate-800 border-b">
                  <CardTitle className="text-sm font-bold uppercase tracking-wider">Update Document Date</CardTitle>
                  <p className="text-xs text-slate-500">{editingDocVehicle.name} ({editingDocVehicle.registration_number})</p>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="space-y-2">
                    <Label>Document Type</Label>
                    <select className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
                      value={docUpdateForm.type} onChange={e => setDocUpdateForm({...docUpdateForm, type: e.target.value})}>
                      <option value="">Select Document</option>
                      {vehicleDocumentTypes.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Expiry Date</Label>
                    <Input type="date" value={docUpdateForm.date} onChange={e => setDocUpdateForm({...docUpdateForm, date: e.target.value})} />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Button className="flex-1 bg-teal-600" onClick={() => {
                      if (docUpdateForm.type && docUpdateForm.date) {
                        updateVehicleDocument(editingDocVehicle.id, docUpdateForm.type, docUpdateForm.date);
                        setShowDocUpdateForm(false);
                      }
                    }}>Update</Button>
                    <Button variant="outline" className="flex-1" onClick={() => setShowDocUpdateForm(false)}>Cancel</Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <Card className="border-none shadow-sm overflow-hidden bg-white dark:bg-slate-900">
            <div className="p-4 bg-slate-50/50 dark:bg-slate-800/30 border-b dark:border-slate-800 flex justify-between items-center">
               <h3 className="font-bold text-slate-700 dark:text-slate-200 text-sm flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-teal-500" /> Vehicle Document Tracking
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800/50 text-[10px] uppercase font-bold tracking-wider text-slate-500">
                    <th className="px-6 py-3 whitespace-nowrap sticky left-0 bg-slate-100 dark:bg-slate-800 z-10">Vehicle Details</th>
                    <th className="px-6 py-3 whitespace-nowrap">Reg No</th>
                    {vehicleDocumentTypes.map(type => (
                      <th key={type.id} className="px-6 py-3 whitespace-nowrap">{type.name}</th>
                    ))}
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredVehicles.map(v => (
                    <tr key={v.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap sticky left-0 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800/50 z-10 border-r dark:border-slate-800">
                        <span className="font-bold text-slate-700 dark:text-slate-200 text-xs">{v.name}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-mono text-xs font-bold text-teal-600">{v.registration_number}</td>
                      {vehicleDocumentTypes.map(type => {
                        const date = v.documents?.[type.name];
                        const dateValue = date ? new Date(date) : null;
                        const today = new Date();
                        const isExpiringSoon = dateValue && (
                          isSameMonth(dateValue, today) || 
                          isBefore(dateValue, today)
                        );

                        return (
                          <td key={type.id} className={cn(
                            "px-6 py-4 whitespace-nowrap transition-colors",
                            isExpiringSoon && "bg-rose-50 dark:bg-rose-900/20"
                          )}>
                            {date ? (
                              <span className={cn(
                                "text-[10px] font-bold",
                                isExpiringSoon ? "text-rose-600 dark:text-rose-400" : "text-slate-600 dark:text-slate-300"
                              )}>
                                {formatDisplayDate(date)}
                                {isExpiringSoon && (
                                  <AlertCircle className="inline-block h-3 w-3 ml-1 text-rose-500 animate-pulse" />
                                )}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">Not set</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-6 py-4 text-right">
                        <Button variant="ghost" size="sm" className="h-7 text-[10px] uppercase font-bold text-teal-600" 
                          onClick={() => {
                            setEditingDocVehicle(v);
                            setDocUpdateForm({ type: '', date: '' });
                            setShowDocUpdateForm(true);
                          }}>
                          Update
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between px-1">
             <h3 className="font-bold text-slate-700 dark:text-slate-200 text-sm flex items-center gap-2">
              <History className="h-4 w-4 text-teal-500" /> {viewMode === 'list' ? 'Recent Movements' : 'Monthly Movement Calendar'}
            </h3>
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
              <Button 
                variant={viewMode === 'list' ? 'secondary' : 'ghost'} 
                size="sm" className="h-7 px-3 gap-2 text-[10px] font-bold uppercase"
                onClick={() => setViewMode('list')}
              >
                <List className="h-3 w-3" /> List
              </Button>
              <Button 
                variant={viewMode === 'calendar' ? 'secondary' : 'ghost'} 
                size="sm" className="h-7 px-3 gap-2 text-[10px] font-bold uppercase"
                onClick={() => setViewMode('calendar')}
              >
                <LayoutGrid className="h-3 w-3" /> Calendar
              </Button>
            </div>
          </div>

          {viewMode === 'list' ? (
            <Card className="border-none shadow-sm overflow-hidden bg-white dark:bg-slate-900">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800/50 text-[10px] uppercase font-bold tracking-wider text-slate-500">
                      <th className="px-6 py-3">Vehicle & Driver</th>
                      <th className="px-6 py-3">Destination & Purpose</th>
                      <th className="px-6 py-3">Times</th>
                      <th className="px-6 py-3">Mileage</th>
                      <th className="px-6 py-3">Remark</th>
                      <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {sortedTrips.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-10 text-center text-slate-400 text-sm italic">No logs recorded yet</td>
                      </tr>
                    ) : (
                      sortedTrips.map(trip => (
                        <tr key={trip.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-700 dark:text-slate-200 text-xs uppercase">{trip.vehicle_reg}</span>
                              <span className="text-[10px] font-semibold text-slate-400">{trip.driver_name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="font-bold text-teal-600 dark:text-teal-400 text-xs flex items-center gap-1">
                                <MapPin className="h-3 w-3" /> {trip.site_name}
                              </span>
                              <span className="text-[10px] text-slate-500 italic">{trip.purpose}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col text-[10px] font-bold text-slate-600 dark:text-slate-300">
                              <div className="flex items-center gap-1"><span className="text-slate-400 uppercase text-[8px]">Dep:</span> {new Date(trip.departure_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                              <div className="flex items-center gap-1"><span className="text-slate-400 uppercase text-[8px]">Arr:</span> {trip.arrival_time ? new Date(trip.arrival_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '—'}</div>
                              <div className="text-[8px] text-slate-400 mt-0.5">{formatDisplayDate(trip.departure_time)}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col text-[10px] font-bold text-slate-600 dark:text-slate-300">
                              <div className="flex items-center gap-1"><span className="text-slate-400 uppercase text-[8px]">Start:</span> {trip.odometer_start || '—'}</div>
                              <div className="flex items-center gap-1"><span className="text-slate-400 uppercase text-[8px]">End:</span> {trip.odometer_end || '—'}</div>
                              {trip.odometer_start && trip.odometer_end && (
                                <div className="text-[8px] text-teal-500 mt-0.5">Total: {trip.odometer_end - trip.odometer_start} km</div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-[10px] text-slate-500 max-w-[150px] truncate" title={trip.remark}>{trip.remark || '—'}</p>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditTrip(trip)}>
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-500" onClick={() => deleteVehicleTripRecord(trip.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : (
            <Card className="border-none shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <h4 className="font-bold text-sm text-slate-700 dark:text-slate-200">{format(currentMonth, 'MMMM yyyy')}</h4>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 px-2 text-[10px] font-bold uppercase" onClick={() => setCurrentMonth(new Date())}>
                      Today
                    </Button>
                  </div>
                </div>
                <div className="flex gap-4">
                   <div className="flex items-center gap-2">
                     <div className="h-2 w-2 rounded-full bg-teal-500"></div>
                     <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Site Visit</span>
                   </div>
                </div>
              </div>

              <div className="grid grid-cols-7 border-b dark:border-slate-800">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="py-2 text-center text-[10px] font-bold text-slate-400 uppercase border-r last:border-r-0 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/20">
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 auto-rows-[120px]">
                {calendarDays().map((day, idx) => {
                  const dayTrips = vehicleTrips.filter(t => isSameDay(new Date(t.departure_time), day));
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  const isToday = isSameDay(day, new Date());

                  return (
                    <div key={idx} className={cn(
                      "border-r border-b dark:border-slate-800 p-2 relative group",
                      !isCurrentMonth && "bg-slate-50/50 dark:bg-slate-900/50",
                      isToday && "bg-teal-50/30 dark:bg-teal-900/10"
                    )}>
                      <span className={cn(
                        "text-[10px] font-bold",
                        isToday ? "text-teal-600" : isCurrentMonth ? "text-slate-500" : "text-slate-300"
                      )}>
                        {format(day, 'd')}
                      </span>
                      
                      <div className="mt-1 space-y-1 overflow-y-auto max-h-[85px] scrollbar-hide">
                        {dayTrips.map(trip => (
                          <div 
                            key={trip.id} 
                            className="bg-teal-50 dark:bg-teal-900/20 border-l-2 border-teal-500 p-1 rounded-sm cursor-pointer hover:bg-teal-100 transition-colors group/item"
                            onClick={() => handleEditTrip(trip)}
                          >
                            <div className="flex justify-between items-start gap-1">
                              <span className="text-[8px] font-bold text-teal-700 dark:text-teal-400 truncate leading-tight uppercase" title={trip.site_name}>
                                {trip.site_name}
                              </span>
                              <span className="text-[7px] text-slate-400 font-mono shrink-0">
                                {format(new Date(trip.departure_time), 'HH:mm')}
                              </span>
                            </div>
                            <p className="text-[7px] text-slate-500 truncate leading-tight" title={`${trip.vehicle_reg} - ${trip.driver_name}`}>
                              {trip.vehicle_reg}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
