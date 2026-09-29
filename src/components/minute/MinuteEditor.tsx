import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Clock,
  User,
  Users,
  CheckCircle2,
  ListTodo,
  FileText,
  Plus,
  Trash2,
  CheckSquare,
  Square,
  Sparkles,
  Download,
  Printer,
  ChevronDown,
  Building2,
  Tag,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Textarea } from '@/src/components/ui/textarea';
import { Badge } from '@/src/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/src/components/ui/card';
import type { MeetingMinute, MeetingActionItem } from '@/src/types/minute';
import type { Employee } from '@/src/store/appStore';

interface MinuteEditorProps {
  minute: MeetingMinute;
  onChange: (updated: MeetingMinute) => void;
  onSave: () => void;
  onConvertToTasks: (selectedItems: MeetingActionItem[]) => void;
  onDiscard?: () => void;
  employees: Employee[];
  isConverting?: boolean;
  hideTopBar?: boolean;
}

export function MinuteEditor({
  minute,
  onChange,
  onSave,
  onConvertToTasks,
  onDiscard,
  employees,
  isConverting,
  hideTopBar = false,
}: MinuteEditorProps) {
  const [newAttendee, setNewAttendee] = useState('');
  const [newDecision, setNewDecision] = useState('');
  const [showChairDropdown, setShowChairDropdown] = useState(false);

  // Formatted list of all active employees
  const employeeOptions = useMemo(() => {
    return employees
      .map((e) => {
        const fullName = ((e as any).name || `${e.firstname || ''} ${e.surname || ''}`).trim();
        const role = (e as any).jobTitle || (e as any).department || '';
        return {
          id: e.id,
          fullName,
          role,
        };
      })
      .filter((e) => e.fullName.length > 0)
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [employees]);

  // Filter employees not yet in attendees list
  const unaddedEmployees = useMemo(() => {
    return employeeOptions.filter((emp) => !minute.attendees.includes(emp.fullName));
  }, [employeeOptions, minute.attendees]);

  const updateField = <K extends keyof MeetingMinute>(field: K, val: MeetingMinute[K]) => {
    onChange({
      ...minute,
      [field]: val,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleAddAttendee = (name: string) => {
    if (!name.trim()) return;
    if (!minute.attendees.includes(name.trim())) {
      updateField('attendees', [...minute.attendees, name.trim()]);
    }
    setNewAttendee('');
  };

  const handleRemoveAttendee = (index: number) => {
    updateField(
      'attendees',
      minute.attendees.filter((_, i) => i !== index)
    );
  };

  const handleAddDecision = () => {
    if (!newDecision.trim()) return;
    updateField('keyDecisions', [...minute.keyDecisions, newDecision.trim()]);
    setNewDecision('');
  };

  const handleRemoveDecision = (index: number) => {
    updateField(
      'keyDecisions',
      minute.keyDecisions.filter((_, i) => i !== index)
    );
  };

  const handleActionItemChange = (index: number, updates: Partial<MeetingActionItem>) => {
    const nextItems = minute.actionItems.map((item, i) =>
      i === index ? { ...item, ...updates } : item
    );
    updateField('actionItems', nextItems);
  };

  const handleAddActionItem = () => {
    const newItem: MeetingActionItem = {
      id: String(Date.now()),
      description: '',
      assigneeName: '',
      dueDate: new Date().toISOString().split('T')[0],
      priority: 'medium',
      selected: true,
    };
    updateField('actionItems', [...minute.actionItems, newItem]);
  };

  const handleRemoveActionItem = (index: number) => {
    updateField(
      'actionItems',
      minute.actionItems.filter((_, i) => i !== index)
    );
  };

  const toggleSelectAllActions = () => {
    const allSelected = minute.actionItems.every((a) => a.selected);
    const nextItems = minute.actionItems.map((a) => ({ ...a, selected: !allSelected }));
    updateField('actionItems', nextItems);
  };

  const selectedActionItems = minute.actionItems.filter((a) => a.selected && !a.convertedToTaskId);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      {!hideTopBar && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl bg-card border border-border shadow-xs">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="text-xs font-semibold px-2.5 py-0.5 border-teal-500/30 text-teal-600 dark:text-teal-400 bg-teal-50/50 dark:bg-teal-950/20"
          >
            {minute.meetingType} Meeting
          </Badge>
          <Badge variant="outline" className="text-xs text-muted-foreground">
            Engine: {minute.engineUsed.toUpperCase()}
          </Badge>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="h-8 gap-1.5 text-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            Print / Export PDF
          </Button>

          {onDiscard && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onDiscard}
              className="h-8 text-xs text-muted-foreground hover:text-destructive"
            >
              Discard
            </Button>
          )}

          <Button
            type="button"
            size="sm"
            onClick={onSave}
            className="h-8 gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Save to Catalog
          </Button>
        </div>
      </div>
      )}

      {/* Main Document Frame */}
      <div className="rounded-xl border border-border bg-card p-6 md:p-8 space-y-8 shadow-xs">
        {/* Document Header */}
        <div className="border-b border-border/80 pb-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <span className="text-[11px] font-bold tracking-wider uppercase text-teal-600 dark:text-teal-400">
              Corporate HR Meeting Documentation
            </span>
            <span className="text-xs text-muted-foreground">
              {new Date(minute.createdAt).toLocaleDateString()}
            </span>
          </div>

          <Input
            value={minute.title}
            onChange={(e) => updateField('title', e.target.value)}
            placeholder="Meeting Title..."
            className="text-xl md:text-2xl font-bold tracking-tight border-none px-0 shadow-none focus-visible:ring-0 h-auto"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 text-xs">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/40">
              <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
              <Input
                type="date"
                value={minute.date}
                onChange={(e) => updateField('date', e.target.value)}
                className="h-7 text-xs border-none bg-transparent p-0 shadow-none focus-visible:ring-0"
              />
            </div>

            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/40">
              <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
              <Input
                type="text"
                placeholder="Time (e.g. 10:00 AM)"
                value={minute.time || ''}
                onChange={(e) => updateField('time', e.target.value)}
                className="h-7 text-xs border-none bg-transparent p-0 shadow-none focus-visible:ring-0"
              />
            </div>

            <div className="relative flex items-center gap-2 p-2 rounded-lg bg-muted/40">
              <User className="w-4 h-4 text-muted-foreground shrink-0" />
              <Input
                type="text"
                placeholder="Chair / Organizer"
                value={minute.chairPerson}
                onChange={(e) => {
                  updateField('chairPerson', e.target.value);
                  setShowChairDropdown(true);
                }}
                onFocus={() => setShowChairDropdown(true)}
                onBlur={() => setTimeout(() => setShowChairDropdown(false), 150)}
                className="h-7 text-xs border-none bg-transparent p-0 shadow-none focus-visible:ring-0 w-full"
              />
              {showChairDropdown && employees.length > 0 && (
                <div className="absolute top-full left-0 z-50 mt-1 w-56 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
                  <div className="max-h-44 overflow-y-auto py-1">
                    {employees
                      .map((e) => ({
                        ...e,
                        fullName: ((e as any).name || `${e.firstname || ''} ${e.surname || ''}`).trim(),
                      }))
                      .filter((e) =>
                        !minute.chairPerson ||
                        e.fullName.toLowerCase().includes(minute.chairPerson.toLowerCase())
                      )
                      .slice(0, 12)
                      .map((emp) => (
                        <button
                          key={emp.id}
                          type="button"
                          onMouseDown={() => {
                            updateField('chairPerson', emp.fullName);
                            setShowChairDropdown(false);
                          }}
                          className="w-full text-left text-xs px-3 py-1.5 hover:bg-muted/60 truncate flex items-center gap-2"
                        >
                          <span className="w-5 h-5 rounded-full bg-teal-500/20 text-teal-700 dark:text-teal-300 flex items-center justify-center text-[10px] font-bold shrink-0">
                            {(emp.fullName || '?')[0].toUpperCase()}
                          </span>
                          {emp.fullName}
                        </button>
                      ))}
                    {employees
                      .map((e) => ((e as any).name || `${e.firstname || ''} ${e.surname || ''}`).trim())
                      .filter((fullName) =>
                        !minute.chairPerson ||
                        fullName.toLowerCase().includes(minute.chairPerson.toLowerCase())
                      ).length === 0 && (
                      <p className="text-[11px] text-muted-foreground px-3 py-2 italic">No match — press Enter to use typed name</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/40">
              <Tag className="w-4 h-4 text-muted-foreground shrink-0" />
              <select
                value={minute.meetingType}
                onChange={(e) => updateField('meetingType', e.target.value as any)}
                className="h-7 text-xs border-none bg-transparent p-0 focus:outline-none w-full text-foreground"
              >
                <option value="HR">HR Meeting</option>
                <option value="Management">Management</option>
                <option value="Departmental">Departmental</option>
                <option value="Project">Project Coordination</option>
                <option value="Disciplinary">Disciplinary / Conduct</option>
                <option value="General">General / All-Hands</option>
              </select>
            </div>
          </div>
        </div>

        {/* Attendees Section */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            Attendees & Participants
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            {minute.attendees.map((attendee, idx) => (
              <Badge
                key={idx}
                variant="secondary"
                className="text-xs pl-2.5 pr-1 py-1 gap-1.5 rounded-md"
              >
                {attendee}
                <button
                  type="button"
                  onClick={() => handleRemoveAttendee(idx)}
                  className="hover:text-destructive p-0.5"
                >
                  ×
                </button>
              </Badge>
            ))}

            {/* 1. Pick from all employee list */}
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  handleAddAttendee(e.target.value);
                }
              }}
              className="h-7 text-xs rounded-md border border-border/80 bg-background px-2.5 text-foreground font-medium outline-none focus:border-teal-500 cursor-pointer max-w-[220px]"
            >
              <option value="" disabled>
                {unaddedEmployees.length > 0
                  ? `+ Pick Employee (${unaddedEmployees.length})...`
                  : 'All employees added'}
              </option>
              {unaddedEmployees.map((emp) => (
                <option key={emp.id} value={emp.fullName}>
                  {emp.fullName} {emp.role ? `• ${emp.role}` : ''}
                </option>
              ))}
            </select>

            <span className="text-[11px] text-muted-foreground font-medium">or</span>

            {/* 2. Extra option to type custom attendee name */}
            <div className="flex items-center gap-1.5">
              <Input
                placeholder="Type attendee name..."
                value={newAttendee}
                onChange={(e) => setNewAttendee(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddAttendee(newAttendee);
                  }
                }}
                className="h-7 text-xs w-44"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleAddAttendee(newAttendee)}
                disabled={!newAttendee.trim()}
                className="h-7 px-2.5 text-xs gap-1"
              >
                <Plus className="w-3 h-3" />
                <span>Add</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Executive Summary */}
        <div className="space-y-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            Executive Summary
          </h3>
          <Textarea
            value={minute.executiveSummary}
            onChange={(e) => updateField('executiveSummary', e.target.value)}
            placeholder="High-level briefing summarizing the essence of the meeting..."
            className="min-h-[100px] text-xs leading-relaxed"
          />
        </div>

        {/* Discussion / Agenda Topics */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              Agenda & Key Discussion Points
            </h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const nextTopics = [
                  ...minute.agendaTopics,
                  {
                    id: String(Date.now()),
                    topic: `Topic ${minute.agendaTopics.length + 1}`,
                    discussion: '',
                  },
                ];
                updateField('agendaTopics', nextTopics);
              }}
              className="h-6 text-[11px] px-2 gap-1"
            >
              <Plus className="w-3 h-3" /> Add Topic
            </Button>
          </div>

          <div className="space-y-3">
            {minute.agendaTopics.map((item, idx) => (
              <div
                key={item.id || idx}
                className="p-3.5 rounded-lg border border-border/70 bg-muted/20 space-y-2 relative group"
              >
                <div className="flex items-center justify-between gap-2">
                  <Input
                    value={item.topic}
                    onChange={(e) => {
                      const nextTopics = [...minute.agendaTopics];
                      nextTopics[idx].topic = e.target.value;
                      updateField('agendaTopics', nextTopics);
                    }}
                    placeholder="Topic title..."
                    className="h-7 text-xs font-semibold bg-transparent border-none p-0 focus-visible:ring-0"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      updateField(
                        'agendaTopics',
                        minute.agendaTopics.filter((_, i) => i !== idx)
                      );
                    }}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive text-xs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <Textarea
                  value={item.discussion}
                  onChange={(e) => {
                    const nextTopics = [...minute.agendaTopics];
                    nextTopics[idx].discussion = e.target.value;
                    updateField('agendaTopics', nextTopics);
                  }}
                  placeholder="Key discussion notes, findings, or points raised..."
                  className="min-h-[70px] text-xs leading-relaxed bg-card"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Key Decisions */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            Key Decisions & Resolutions
          </h3>

          <ul className="space-y-2">
            {minute.keyDecisions.map((decision, idx) => (
              <li
                key={idx}
                className="flex items-start justify-between gap-2 p-2 rounded-md bg-muted/30 text-xs text-foreground group"
              >
                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-teal-100 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 flex items-center justify-center text-[10px] font-bold mt-0.5 shrink-0">
                    ✓
                  </span>
                  <span>{decision}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveDecision(idx)}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive text-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2">
            <Input
              placeholder="Add key decision or company resolution..."
              value={newDecision}
              onChange={(e) => setNewDecision(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddDecision()}
              className="h-8 text-xs"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddDecision}
              className="h-8 px-3 text-xs"
            >
              Add
            </Button>
          </div>
        </div>

        {/* Action Items with Direct Task Converter */}
        <div className="space-y-3.5 pt-2 border-t border-border">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <ListTodo className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                Action Items & Assigned Deliverables
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Select items to convert directly into official company tasks with assignees and due dates.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={toggleSelectAllActions}
                className="h-7 text-xs text-muted-foreground"
              >
                {minute.actionItems.every((a) => a.selected) ? 'Deselect All' : 'Select All'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddActionItem}
                className="h-7 text-xs gap-1"
              >
                <Plus className="w-3 h-3" /> Add Item
              </Button>
            </div>
          </div>

          <div className="space-y-2.5">
            {minute.actionItems.map((item, idx) => (
              <div
                key={item.id || idx}
                className={`p-3 rounded-lg border text-xs transition-colors ${
                  item.convertedToTaskId
                    ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800'
                    : item.selected
                    ? 'bg-card border-teal-500/40 shadow-2xs'
                    : 'bg-muted/30 border-border opacity-70'
                }`}
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    disabled={Boolean(item.convertedToTaskId)}
                    onClick={() => handleActionItemChange(idx, { selected: !item.selected })}
                    className="mt-1 text-teal-600 dark:text-teal-400 disabled:opacity-50"
                  >
                    {item.convertedToTaskId ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : item.selected ? (
                      <CheckSquare className="w-4 h-4" />
                    ) : (
                      <Square className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>

                  <div className="flex-1 space-y-2">
                    <Input
                      value={item.description}
                      onChange={(e) => handleActionItemChange(idx, { description: e.target.value })}
                      placeholder="Task description / deliverable..."
                      className="h-7 text-xs bg-transparent border-none p-0 focus-visible:ring-0 font-medium"
                    />

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3 h-3" />
                        <select
                          value={item.assigneeId || item.assigneeName || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            const emp = employees.find((emp) => emp.id === val);
                            if (emp) {
                              handleActionItemChange(idx, {
                                assigneeId: emp.id,
                                assigneeName: `${emp.firstname} ${emp.surname}`,
                              });
                            } else {
                              handleActionItemChange(idx, {
                                assigneeName: val,
                                assigneeId: undefined,
                              });
                            }
                          }}
                          className="h-6 text-xs bg-muted/60 dark:bg-muted/30 rounded px-1.5 border border-border"
                        >
                          <option value="">Select Assignee...</option>
                          {employees.map((emp) => (
                            <option key={emp.id} value={emp.id}>
                              {emp.firstname} {emp.surname} ({emp.department || 'General'})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3 h-3" />
                        <Input
                          type="date"
                          value={item.dueDate || ''}
                          onChange={(e) => handleActionItemChange(idx, { dueDate: e.target.value })}
                          className="h-6 text-xs w-32 p-1"
                        />
                      </div>

                      <div className="flex items-center gap-1.5">
                        <select
                          value={item.priority}
                          onChange={(e) =>
                            handleActionItemChange(idx, { priority: e.target.value as any })
                          }
                          className="h-6 text-xs bg-muted/60 dark:bg-muted/30 rounded px-1.5 border border-border"
                        >
                          <option value="low">Low Priority</option>
                          <option value="medium">Medium Priority</option>
                          <option value="high">High Priority</option>
                          <option value="urgent">Urgent</option>
                        </select>
                      </div>

                      {item.convertedToTaskId && (
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        >
                          Converted to Task ✓
                        </Badge>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveActionItem(idx)}
                    className="text-muted-foreground hover:text-destructive p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {selectedActionItems.length > 0 && (
            <div className="pt-2 flex justify-end">
              <Button
                type="button"
                onClick={() => onConvertToTasks(selectedActionItems)}
                disabled={isConverting}
                className="bg-teal-600 hover:bg-teal-700 text-white text-xs h-8 px-4 rounded-lg shadow-sm gap-1.5"
              >
                <ListTodo className="w-3.5 h-3.5" />
                {isConverting
                  ? 'Assigning Tasks...'
                  : `Convert (${selectedActionItems.length}) Action Items to Company Tasks`}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
