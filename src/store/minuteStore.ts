import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/src/integrations/supabase/client';
import type { MeetingMinute } from '@/src/types/minute';

interface MinuteStore {
  minutes: MeetingMinute[];
  activeMinute: MeetingMinute | null;
  selectedEngine: 'gemini' | 'groq' | 'gladia' | 'notebooklm';
  selectedModel: string;
  customGladiaKey: string;
  isLoadingFromDb: boolean;
  loadMinutesFromDb: () => Promise<void>;
  addMinute: (minute: MeetingMinute) => Promise<void>;
  updateMinute: (id: string, updates: Partial<MeetingMinute>) => Promise<void>;
  deleteMinute: (id: string) => Promise<void>;
  setActiveMinute: (minute: MeetingMinute | null) => void;
  setSelectedEngine: (engine: 'gemini' | 'groq' | 'gladia' | 'notebooklm') => void;
  setSelectedModel: (model: string) => void;
  setCustomGladiaKey: (key: string) => void;
}

// Convert DB snake_case record to Minute TypeScript interface
function dbToMinute(row: any): MeetingMinute {
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    time: row.time || '',
    location: row.location || '',
    meetingType: row.meeting_type || 'HR',
    chairPerson: row.chair_person || 'HR Admin',
    attendees: Array.isArray(row.attendees) ? row.attendees : [],
    absentees: Array.isArray(row.absentees) ? row.absentees : [],
    executiveSummary: row.executive_summary || '',
    agendaTopics: Array.isArray(row.agenda_topics) ? row.agenda_topics : [],
    keyDecisions: Array.isArray(row.key_decisions) ? row.key_decisions : [],
    actionItems: Array.isArray(row.action_items) ? row.action_items : [],
    rawTranscript: row.raw_transcript || '',
    engineUsed: row.engine_used || 'gemini',
    status: row.status || 'draft',
    createdBy: row.created_by || '',
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

// Convert Minute TypeScript interface to DB snake_case record
function minuteToDb(m: MeetingMinute) {
  return {
    id: m.id,
    title: m.title,
    date: m.date,
    time: m.time || null,
    location: m.location || null,
    meeting_type: m.meetingType,
    chair_person: m.chairPerson,
    attendees: m.attendees,
    absentees: m.absentees || [],
    executive_summary: m.executiveSummary,
    agenda_topics: m.agendaTopics,
    key_decisions: m.keyDecisions,
    action_items: m.actionItems,
    raw_transcript: m.rawTranscript || null,
    engine_used: m.engineUsed,
    status: m.status,
    created_by: m.createdBy || null,
    updated_at: new Date().toISOString(),
  };
}

export const useMinuteStore = create<MinuteStore>()(
  persist(
    (set, get) => ({
      minutes: [],
      activeMinute: null,
      selectedEngine: 'gemini',
      selectedModel: 'gemini-2.0-flash',
      customGladiaKey: '',
      isLoadingFromDb: false,

      loadMinutesFromDb: async () => {
        set({ isLoadingFromDb: true });
        try {
          const { data, error } = await supabase
            .from('meeting_minutes' as any)
            .select('*')
            .order('date', { ascending: false });

          if (!error && data) {
            const mapped = data.map(dbToMinute);
            set({ minutes: mapped });
          }
        } catch (err) {
          console.warn('Failed to fetch meeting_minutes from Supabase, relying on local storage cache:', err);
        } finally {
          set({ isLoadingFromDb: false });
        }
      },

      addMinute: async (minute) => {
        // Optimistic local state update
        set((state) => ({
          minutes: [minute, ...state.minutes.filter((m) => m.id !== minute.id)],
          activeMinute: minute,
        }));

        // Async sync to Supabase database
        try {
          const payload = minuteToDb(minute);
          await supabase.from('meeting_minutes' as any).upsert(payload, { onConflict: 'id' });
        } catch (err) {
          console.error('Failed to sync minute to Supabase:', err);
        }
      },

      updateMinute: async (id, updates) => {
        set((state) => {
          const updated = state.minutes.map((m) =>
            m.id === id ? { ...m, ...updates, updatedAt: new Date().toISOString() } : m
          );
          return {
            minutes: updated,
            activeMinute:
              state.activeMinute?.id === id
                ? { ...state.activeMinute, ...updates, updatedAt: new Date().toISOString() }
                : state.activeMinute,
          };
        });

        try {
          const current = get().minutes.find((m) => m.id === id);
          if (current) {
            const payload = minuteToDb(current);
            await supabase.from('meeting_minutes' as any).upsert(payload, { onConflict: 'id' });
          }
        } catch (err) {
          console.error('Failed to update minute on Supabase:', err);
        }
      },

      deleteMinute: async (id) => {
        set((state) => ({
          minutes: state.minutes.filter((m) => m.id !== id),
          activeMinute: state.activeMinute?.id === id ? null : state.activeMinute,
        }));

        try {
          await supabase.from('meeting_minutes' as any).delete().eq('id', id);
        } catch (err) {
          console.error('Failed to delete minute from Supabase:', err);
        }
      },

      setActiveMinute: (minute) => set({ activeMinute: minute }),
      setSelectedEngine: (engine) => set({ selectedEngine: engine }),
      setSelectedModel: (model) => set({ selectedModel: model }),
      setCustomGladiaKey: (key) => set({ customGladiaKey: key }),
    }),
    {
      name: 'dcel-hr-minutes-store',
    }
  )
);
