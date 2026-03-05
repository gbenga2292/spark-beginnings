import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Badge } from '@/src/components/ui/badge';
import { Search, Plus, MapPin, Building2, X, Save, Pencil, Trash2, MoreHorizontal } from 'lucide-react';
import { useAppStore } from '@/src/store/appStore';

export function Sites() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newSiteName, setNewSiteName] = useState('');
  const [newClientName, setNewClientName] = useState('');
  const [editForm, setEditForm] = useState({ name: '', client: '', status: 'Active' as 'Active' | 'Inactive' });
  
  const sites = useAppStore((state) => state.sites);
  const addSite = useAppStore((state) => state.addSite);
  const updateSite = useAppStore((state) => state.updateSite);
  const deleteSite = useAppStore((state) => state.deleteSite);

  const filteredSites = sites.filter(site => 
    site.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    site.client.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddSite = () => {
    if (!newSiteName || !newClientName) {
      alert("Site Name and Client are required.");
      return;
    }
    
    addSite({
      id: `S-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
      name: newSiteName,
      client: newClientName,
      status: 'Active'
    });
    
    setNewSiteName('');
    setNewClientName('');
    setIsAdding(false);
  };

  const handleEditClick = (site: { id: string; name: string; client: string; status: 'Active' | 'Inactive' }) => {
    setEditingId(site.id);
    setEditForm({ name: site.name, client: site.client, status: site.status });
  };

  const handleSaveEdit = () => {
    if (editingId) {
      updateSite(editingId, editForm);
      setEditingId(null);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this site?")) {
      deleteSite(id);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Sites & Clients</h1>
          <p className="text-slate-500 mt-2">Manage your project sites, locations, and client catalog.</p>
        </div>
        <div className="flex gap-3">
          {!isAdding && (
            <Button onClick={() => setIsAdding(true)} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
              <Plus className="h-4 w-4" />
              Add New Site
            </Button>
          )}
        </div>
      </div>

      {isAdding && (
        <Card className="border-t-4 border-t-indigo-600 shadow-md">
          <CardHeader className="bg-slate-50 border-b border-slate-100 pb-4 flex flex-row justify-between items-center">
            <CardTitle className="text-indigo-900 text-xl">Add New Site</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setIsAdding(false)}>
              <X className="h-5 w-5" />
            </Button>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Site Name</label>
                <Input 
                  placeholder="e.g. Louiseville" 
                  value={newSiteName} 
                  onChange={(e) => setNewSiteName(e.target.value)} 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Client</label>
                <Input 
                  placeholder="e.g. Alpha Corp" 
                  value={newClientName} 
                  onChange={(e) => setNewClientName(e.target.value)} 
                />
              </div>
            </div>
            <div className="flex justify-end gap-4 mt-6">
              <Button variant="outline" onClick={() => setIsAdding(false)}>Cancel</Button>
              <Button onClick={handleAddSite} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
                <Save className="h-4 w-4" /> Save Site
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="col-span-1 border-indigo-100 bg-indigo-50/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-indigo-900">Total Active Sites</CardTitle>
            <MapPin className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-indigo-900">{sites.filter(s => s.status === 'Active').length}</div>
            <p className="text-xs text-indigo-600 mt-1">Currently operational</p>
          </CardContent>
        </Card>
        <Card className="col-span-1 border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Total Clients</CardTitle>
            <Building2 className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">
              {new Set(sites.map(s => s.client)).size}
            </div>
            <p className="text-xs text-slate-500 mt-1">Unique clients</p>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="relative w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
            <Input
              placeholder="Search sites or clients..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Site ID</TableHead>
              <TableHead>Site Name</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSites.map((site) => (
              <TableRow key={site.id}>
                <TableCell className="font-mono text-xs text-slate-500">{site.id}</TableCell>
                <TableCell className="font-medium text-slate-900">
                  {editingId === site.id ? (
                    <Input 
                      value={editForm.name}
                      onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                      className="h-8"
                    />
                  ) : site.name}
                </TableCell>
                <TableCell>
                  {editingId === site.id ? (
                    <Input 
                      value={editForm.client}
                      onChange={(e) => setEditForm({...editForm, client: e.target.value})}
                      className="h-8"
                    />
                  ) : site.client}
                </TableCell>
                <TableCell>
                  {editingId === site.id ? (
                    <select 
                      value={editForm.status}
                      onChange={(e) => setEditForm({...editForm, status: e.target.value as 'Active' | 'Inactive'})}
                      className="flex h-8 rounded-md border border-slate-200 bg-white px-2 py-1 text-sm"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  ) : (
                    <Badge variant={site.status === 'Active' ? 'success' : 'secondary'}>
                      {site.status}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {editingId === site.id ? (
                    <div className="flex justify-end gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-emerald-600"
                        onClick={handleSaveEdit}
                      >
                        <Save className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-slate-500"
                        onClick={() => setEditingId(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex justify-end gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-indigo-600"
                        onClick={() => handleEditClick(site)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-red-600"
                        onClick={() => handleDelete(site.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {filteredSites.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                  No sites found matching your search.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
