import React, { useState } from 'react';
import {
  Users,
  Settings as SettingsIcon,
  Shield,
  FileText,
  Clock,
  MapPin,
  User,
  Plus,
  Trash2,
  Edit2,
  Check,
  RotateCcw,
  Sparkles,
  Printer,
  ChevronDown,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Textarea } from '@/src/components/ui/textarea';
import { Badge } from '@/src/components/ui/badge';
import { toast } from '@/src/components/ui/toast';
import { useMeetingSettingsStore } from '@/src/store/meetingSettingsStore';
import { useAppStore } from '@/src/store/appStore';
import type { CommitteeGroup } from '@/src/types/minute';

export function MeetingSettingsPanel() {
  const {
    settings,
    updateSettings,
    addCommitteeGroup,
    updateCommitteeGroup,
    deleteCommitteeGroup,
    resetSettings,
  } = useMeetingSettingsStore();

  const employees = useAppStore((s) => s.employees);

  // Group editing state
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<string[]>([]);
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');

  const employeeNames = employees
    .map((e) => [e.firstname, e.surname].filter(Boolean).join(' ').trim())
    .filter(Boolean);

  const startEditGroup = (group: CommitteeGroup) => {
    setEditingGroupId(group.id);
    setGroupName(group.name);
    setGroupDescription(group.description || '');
    setSelectedGroupMembers([...group.memberNames]);
    setIsAddingGroup(false);
  };

  const startAddGroup = () => {
    setEditingGroupId(null);
    setGroupName('');
    setGroupDescription('');
    setSelectedGroupMembers([]);
    setIsAddingGroup(true);
  };

  const cancelGroupEdit = () => {
    setEditingGroupId(null);
    setIsAddingGroup(false);
    setGroupName('');
    setGroupDescription('');
    setSelectedGroupMembers([]);
    setMemberSearch('');
  };

  const saveGroup = () => {
    if (!groupName.trim()) {
      toast.error('Please enter a group name.');
      return;
    }

    if (isAddingGroup) {
      addCommitteeGroup({
        name: groupName.trim(),
        description: groupDescription.trim(),
        memberNames: selectedGroupMembers,
      });
      toast.success(`Committee group "${groupName}" created!`);
    } else if (editingGroupId) {
      updateCommitteeGroup(editingGroupId, {
        name: groupName.trim(),
        description: groupDescription.trim(),
        memberNames: selectedGroupMembers,
      });
      toast.success(`Committee group updated!`);
    }
    cancelGroupEdit();
  };

  const toggleMember = (name: string) => {
    if (selectedGroupMembers.includes(name)) {
      setSelectedGroupMembers((prev) => prev.filter((m) => m !== name));
    } else {
      setSelectedGroupMembers((prev) => [...prev, name]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            Meeting Minutes & Committee Configuration
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure global default organizers, meeting locations, attendee committees, AI tone instructions, and print templates.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            if (confirm('Reset all meeting settings to default values?')) {
              resetSettings();
              toast.info('Meeting settings reset to defaults.');
            }
          }}
          className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1.5 self-start sm:self-auto"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Defaults</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Card 1: Default Meeting Metadata */}
        <Card className="border-border/80 shadow-2xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs sm:text-sm font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              General Meeting Defaults
            </CardTitle>
            <CardDescription className="text-xs">
              Pre-filled values automatically applied when drafting or generating new minutes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3.5 text-xs">
            <div className="space-y-1">
              <label className="font-medium text-foreground">Default Meeting Type</label>
              <select
                value={settings.defaultMeetingType}
                onChange={(e) => updateSettings({ defaultMeetingType: e.target.value })}
                className="w-full h-8 rounded-md border border-border bg-background px-2.5 text-xs text-foreground outline-none focus:border-teal-500"
              >
                <option value="HR">HR Meeting</option>
                <option value="Management">Management Meeting</option>
                <option value="Board">Board of Directors</option>
                <option value="HSE/Safety">HSE & Safety Committee</option>
                <option value="Departmental">Departmental Sync</option>
                <option value="Project">Project & Site Operations</option>
                <option value="Disciplinary">Disciplinary Committee</option>
                <option value="General">General Staff Assembly</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-medium text-foreground flex items-center gap-1">
                  <User className="w-3 h-3 text-muted-foreground" />
                  Default Chairperson / Host
                </label>
                <Input
                  value={settings.defaultChairPerson}
                  onChange={(e) => updateSettings({ defaultChairPerson: e.target.value })}
                  placeholder="e.g. Managing Director / HR Head"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-medium text-foreground flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-muted-foreground" />
                  Default Location / Platform
                </label>
                <Input
                  value={settings.defaultLocation}
                  onChange={(e) => updateSettings({ defaultLocation: e.target.value })}
                  placeholder="e.g. Boardroom / Zoom Link"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-medium text-foreground">Action Turnaround (Days)</label>
                <Input
                  type="number"
                  min={1}
                  max={90}
                  value={settings.defaultActionTurnaroundDays}
                  onChange={(e) => updateSettings({ defaultActionTurnaroundDays: Number(e.target.value) || 7 })}
                  className="h-8 text-xs"
                />
                <span className="text-[10px] text-muted-foreground block">
                  Default deadline added to meeting date.
                </span>
              </div>

              <div className="space-y-1">
                <label className="font-medium text-foreground">Default Action Priority</label>
                <select
                  value={settings.defaultPriority}
                  onChange={(e) => updateSettings({ defaultPriority: e.target.value as any })}
                  className="w-full h-8 rounded-md border border-border bg-background px-2.5 text-xs text-foreground outline-none focus:border-teal-500"
                >
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-medium text-foreground flex items-center gap-1">
                <Shield className="w-3 h-3 text-muted-foreground" />
                Default Confidentiality Classification
              </label>
              <select
                value={settings.confidentialityLevel}
                onChange={(e) => updateSettings({ confidentialityLevel: e.target.value as any })}
                className="w-full h-8 rounded-md border border-border bg-background px-2.5 text-xs text-foreground outline-none focus:border-teal-500"
              >
                <option value="Public">Public (Company-wide)</option>
                <option value="Internal">Internal (Staff Only)</option>
                <option value="Confidential">Confidential (Committee Members Only)</option>
                <option value="Strictly Confidential">Strictly Confidential (Board / Executive Only)</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Print & PDF Document Watermark */}
        <Card className="border-border/80 shadow-2xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs sm:text-sm font-semibold flex items-center gap-2">
              <Printer className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              Print, Export & Watermark Layout
            </CardTitle>
            <CardDescription className="text-xs">
              Branding and formal sign-off formatting for official exported PDF minutes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3.5 text-xs">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-foreground block">Watermark Background</span>
                  <span className="text-[11px] text-muted-foreground">Display company seal watermark across printed pages</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.showWatermark}
                  onChange={(e) => updateSettings({ showWatermark: e.target.checked })}
                  className="rounded border-border text-teal-600 focus:ring-teal-500 h-4 w-4 cursor-pointer"
                />
              </div>

              {settings.showWatermark && (
                <div className="space-y-1 pl-1">
                  <label className="text-[11px] text-muted-foreground">Watermark Subtitle / Label</label>
                  <Input
                    value={settings.watermarkText}
                    onChange={(e) => updateSettings({ watermarkText: e.target.value })}
                    placeholder="e.g. CONFIDENTIAL - CORPORATE MINUTES"
                    className="h-8 text-xs"
                  />
                </div>
              )}
            </div>

            <div className="space-y-2 pt-2 border-t border-border/50">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-foreground block">Executive Signature Lines</span>
                  <span className="text-[11px] text-muted-foreground">Include formal sign-off blocks at bottom of document</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.includeSignatureLines}
                  onChange={(e) => updateSettings({ includeSignatureLines: e.target.checked })}
                  className="rounded border-border text-teal-600 focus:ring-teal-500 h-4 w-4 cursor-pointer"
                />
              </div>

              {settings.includeSignatureLines && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <div className="space-y-1">
                    <label className="text-[11px] text-muted-foreground">Signatory 1 Title</label>
                    <Input
                      value={settings.signatory1Title}
                      onChange={(e) => updateSettings({ signatory1Title: e.target.value })}
                      placeholder="e.g. Prepared By (Secretary)"
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-muted-foreground">Signatory 2 Title</label>
                    <Input
                      value={settings.signatory2Title}
                      onChange={(e) => updateSettings({ signatory2Title: e.target.value })}
                      placeholder="e.g. Approved By (Chairperson)"
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Custom AI Prompt Instructions */}
            <div className="space-y-1.5 pt-2 border-t border-border/50">
              <label className="font-medium text-foreground flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                Custom Corporate AI Instructions (Optional)
              </label>
              <Textarea
                value={settings.customPromptGuidelines}
                onChange={(e) => updateSettings({ customPromptGuidelines: e.target.value })}
                placeholder="e.g. Always emphasize statutory compliance, financial milestones, and specific employee roles. Use concise British English."
                className="min-h-[75px] text-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                These rules are automatically passed into Gemini & Groq when synthesizing audio and text.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Card 3: Committee Groups & Distribution Lists */}
      <Card className="border-border/80 shadow-2xs">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xs sm:text-sm font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              Committee Presets & Distribution Groups
            </CardTitle>
            <CardDescription className="text-xs">
              Pre-defined attendee groups (e.g. Management Board, HR Panel). When creating a minute, 1 click populates all members.
            </CardDescription>
          </div>
          {!isAddingGroup && !editingGroupId && (
            <Button
              type="button"
              size="sm"
              onClick={startAddGroup}
              className="h-7 text-xs bg-teal-600 hover:bg-teal-700 text-white gap-1"
            >
              <Plus className="w-3 h-3" />
              <span>Add Committee</span>
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add or Edit Group Inline Form */}
          {(isAddingGroup || editingGroupId) && (
            <div className="p-4 rounded-xl border border-teal-500/40 bg-teal-500/5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-foreground">
                  {isAddingGroup ? 'Create New Committee Group' : `Edit Group: ${groupName}`}
                </h4>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={cancelGroupEdit}
                  className="h-6 text-[11px] text-muted-foreground"
                >
                  Cancel
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-foreground">Group Name</label>
                  <Input
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="e.g. Executive Committee"
                    className="h-8 text-xs bg-background"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-foreground">Description (Optional)</label>
                  <Input
                    value={groupDescription}
                    onChange={(e) => setGroupDescription(e.target.value)}
                    placeholder="e.g. Senior leadership & site engineers"
                    className="h-8 text-xs bg-background"
                  />
                </div>
              </div>

              {/* Members selector */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-medium text-foreground">
                    Select Members ({selectedGroupMembers.length} selected)
                  </label>
                  <Input
                    placeholder="Filter staff..."
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    className="h-6 w-36 text-[10px] bg-background"
                  />
                </div>

                <div className="max-h-36 overflow-y-auto border border-border/70 rounded-lg p-2 bg-background flex flex-wrap gap-1.5">
                  {employeeNames.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground p-1">No employees found in directory.</p>
                  ) : (
                    employeeNames
                      .filter((n) => n.toLowerCase().includes(memberSearch.toLowerCase()))
                      .map((name) => {
                        const isSelected = selectedGroupMembers.includes(name);
                        return (
                          <button
                            key={name}
                            type="button"
                            onClick={() => toggleMember(name)}
                            className={`text-xs px-2.5 py-1 rounded-md border transition-all flex items-center gap-1.5 ${
                              isSelected
                                ? 'bg-teal-500/20 text-teal-800 dark:text-teal-200 border-teal-500/40 font-semibold'
                                : 'bg-muted/40 text-muted-foreground border-border/60 hover:text-foreground'
                            }`}
                          >
                            <span>{name}</span>
                            {isSelected && <Check className="w-3 h-3 text-teal-600 dark:text-teal-400" />}
                          </button>
                        );
                      })
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={cancelGroupEdit}
                  className="h-7 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={saveGroup}
                  className="h-7 text-xs bg-teal-600 hover:bg-teal-700 text-white gap-1"
                >
                  <Check className="w-3 h-3" />
                  <span>Save Group</span>
                </Button>
              </div>
            </div>
          )}

          {/* Existing Groups Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {settings.committeeGroups.map((group) => (
              <div
                key={group.id}
                className="p-3.5 rounded-xl border border-border/70 bg-card hover:border-teal-500/40 transition-colors flex flex-col justify-between space-y-2.5 shadow-2xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-foreground">{group.name}</span>
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-muted/30">
                      {group.memberNames?.length || 0} members
                    </Badge>
                  </div>
                  {group.description && (
                    <p className="text-[11px] text-muted-foreground line-clamp-1">{group.description}</p>
                  )}
                </div>

                <div className="flex flex-wrap gap-1 max-h-14 overflow-hidden">
                  {group.memberNames && group.memberNames.length > 0 ? (
                    group.memberNames.slice(0, 4).map((m, i) => (
                      <span
                        key={i}
                        className="text-[10px] bg-muted/40 text-muted-foreground px-1.5 py-0.5 rounded border border-border/40"
                      >
                        {m}
                      </span>
                    ))
                  ) : (
                    <span className="text-[10px] text-muted-foreground italic">No members assigned</span>
                  )}
                  {group.memberNames && group.memberNames.length > 4 && (
                    <span className="text-[10px] text-muted-foreground font-medium self-center">
                      +{group.memberNames.length - 4} more
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-border/50">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => startEditGroup(group)}
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                    title="Edit group"
                  >
                    <Edit2 className="w-3 h-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm(`Delete group "${group.name}"?`)) {
                        deleteCommitteeGroup(group.id);
                        toast.info(`Group "${group.name}" removed.`);
                      }
                    }}
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                    title="Delete group"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
