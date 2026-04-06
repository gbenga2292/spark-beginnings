import { useState } from "react";
import { motion } from "framer-motion";
import { X, Search, CheckCircle2, Users } from 'lucide-react';
import type { AppUser } from "@/src/types/tasks";

interface AssignUserDialogProps {
  currentAssignees: string[];
  users: AppUser[];
  onAssign: (uids: string[]) => void;
  onClose: () => void;
}

export function AssignUserDialog({ currentAssignees, users, onAssign, onClose }: AssignUserDialogProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set(currentAssignees));
  const [search, setSearch] = useState('');

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (uid: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(uid) ? next.delete(uid) : next.add(uid);
      return next;
    });
  };

  const selectedUsers = users.filter(u => selected.has(u.id));

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Assign Subtask</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {selected.size === 0 ? 'Select one or more assignees' : `${selected.size} selected`}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-muted"><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>

        {/* Selected pills */}
        {selectedUsers.length > 0 && (
          <div className="px-4 py-2.5 flex flex-wrap gap-1.5 border-b border-border bg-muted/30 flex-shrink-0">
            {selectedUsers.map(u => (
              <button
                key={u.id}
                onClick={() => toggle(u.id)}
                className={`flex items-center gap-1.5 pl-2 pr-1.5 py-1 rounded-full text-[11px] font-semibold text-white ${u.avatarColor ?? 'bg-slate-500'} hover:opacity-80 transition-opacity`}
              >
                {u.name.split(' ')[0]}
                <X className="w-3 h-3" />
              </button>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="px-4 py-3 border-b border-border flex-shrink-0">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search users…"
              className="w-full pl-8 pr-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        {/* User list */}
        <div className="overflow-y-auto flex-1 p-2 space-y-0.5">
          {/* Unassign option */}
          <button
            onClick={() => setSelected(new Set())}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-left transition-colors ${
              selected.size === 0 ? 'bg-primary/10 border border-primary/20' : 'hover:bg-muted'
            }`}
          >
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
              <Users className="w-4 h-4 text-muted-foreground" />
            </div>
            <span className="text-muted-foreground italic">Unassign</span>
            {selected.size === 0 && <CheckCircle2 className="w-4 h-4 text-primary ml-auto" />}
          </button>

          {filtered.map(u => {
            const isSelected = selected.has(u.id);
            return (
              <button
                key={u.id}
                onClick={() => toggle(u.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-left transition-all ${
                  isSelected ? 'bg-primary/10 border border-primary/20' : 'hover:bg-muted'
                }`}
              >
                <div className={`w-8 h-8 rounded-full ${u.avatarColor ?? 'bg-slate-400'} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                  {u.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{u.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                </div>
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                  isSelected ? 'bg-primary border-primary' : 'border-border'
                }`}>
                  {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-center text-xs text-muted-foreground py-6">No users match your search</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border flex-shrink-0 flex items-center justify-between gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted transition-colors">Cancel</button>
          <button
            onClick={() => onAssign([...selected])}
            className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            Done{selected.size > 0 ? ` (${selected.size})` : ''}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
