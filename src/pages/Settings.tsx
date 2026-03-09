import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/tabs';
import { Badge } from '@/src/components/ui/badge';
import { Save, Building, Bell, Link as LinkIcon } from 'lucide-react';
import { useState } from 'react';

export function Settings() {
  const [activeTab, setActiveTab] = useState('general');

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Settings</h1>
          <p className="text-slate-500 mt-2">Manage application preferences, integrations, and security.</p>
        </div>
        <div className="flex gap-3">
          <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700">
            <Save className="h-4 w-4" />
            Save Changes
          </Button>
        </div>
      </div>

      <Tabs className="w-full">
<TabsList className="mb-8 bg-slate-100">
          <TabsTrigger active={activeTab === 'general'} onClick={() => setActiveTab('general')} className="w-32">
            <Building className="mr-2 h-4 w-4" /> General
          </TabsTrigger>
          <TabsTrigger active={activeTab === 'notifications'} onClick={() => setActiveTab('notifications')} className="w-32">
            <Bell className="mr-2 h-4 w-4" /> Notifications
          </TabsTrigger>
          <TabsTrigger active={activeTab === 'integrations'} onClick={() => setActiveTab('integrations')} className="w-32">
            <LinkIcon className="mr-2 h-4 w-4" /> Integrations
          </TabsTrigger>
        </TabsList>

        <TabsContent active={activeTab === 'general'}>
          <Card>
            <CardHeader>
              <CardTitle>Company Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none">Company Name</label>
                  <Input defaultValue="Dewatering Construction Etc Limited" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none">Registration Number</label>
                  <Input defaultValue="RC-1245678" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none">Primary Email</label>
                  <Input type="email" defaultValue="hr@dcel.com" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none">Phone Number</label>
                  <Input type="tel" defaultValue="+234 801 234 5678" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium leading-none">Address</label>
                  <Input defaultValue="Victoria Island, Lagos, Nigeria" />
                </div>
              </div>
            </CardContent>
          </Card>
</TabsContent>

        <TabsContent active={activeTab === 'notifications'}>
          <Card>
            <CardHeader>
              <CardTitle>Email & SMS Alerts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                {['Leave Requests', 'Payroll Processing', 'New Hire Onboarding', 'Document Expiry', 'System Updates'].map((item) => (
                  <div key={item} className="flex items-center justify-between border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                    <div>
                      <p className="font-medium text-slate-900">{item}</p>
                      <p className="text-sm text-slate-500">Receive notifications for {item.toLowerCase()}.</p>
                    </div>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-sm text-slate-600">
                        <input type="checkbox" defaultChecked className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 h-4 w-4" />
                        Email
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-600">
                        <input type="checkbox" className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 h-4 w-4" />
                        SMS
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent active={activeTab === 'integrations'}>
          <Card>
            <CardHeader>
              <CardTitle>Connected Services</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-blue-100 text-blue-600 flex items-center justify-center rounded-md font-bold text-xl">W</div>
                    <div>
                      <p className="font-medium text-slate-900">Microsoft Word</p>
                      <p className="text-xs text-slate-500">Document Generation</p>
                    </div>
                  </div>
                  <Badge variant="success">Connected</Badge>
                </div>
                <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-emerald-100 text-emerald-600 flex items-center justify-center rounded-md font-bold text-xl">X</div>
                    <div>
                      <p className="font-medium text-slate-900">Microsoft Excel</p>
                      <p className="text-xs text-slate-500">Data Import/Export</p>
                    </div>
                  </div>
                  <Badge variant="success">Connected</Badge>
                </div>
                <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-green-100 text-green-600 flex items-center justify-center rounded-md font-bold text-xl">Q</div>
                    <div>
                      <p className="font-medium text-slate-900">QuickBooks</p>
                      <p className="text-xs text-slate-500">Accounting Sync</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">Connect</Button>
                </div>
                <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-slate-100 text-slate-600 flex items-center justify-center rounded-md font-bold text-xl">S</div>
                    <div>
                      <p className="font-medium text-slate-900">Stripe</p>
                      <p className="text-xs text-slate-500">Payment Gateway</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">Connect</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
