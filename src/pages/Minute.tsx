import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Mic,
  Square,
  UploadCloud,
  FileAudio,
  Sparkles,
  FileText,
  Search,
  Calendar,
  User,
  Users,
  ChevronRight,
  ArrowLeft,
  Trash2,
  Edit3,
  Loader2,
  Printer,
  CheckCircle2,
  Key,
  Cpu,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Settings as SettingsIcon,
} from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Textarea } from '@/src/components/ui/textarea';
import { Badge } from '@/src/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/src/components/ui/dialog';
import { toast } from '@/src/components/ui/toast';
import { useMinuteStore } from '@/src/store/minuteStore';
import { useAppStore } from '@/src/store/appStore';
import { useUserStore } from '@/src/store/userStore';
import { usePriv } from '@/src/hooks/usePriv';
import { useAppData } from '@/src/contexts/AppDataContext';
import { useAuth } from '@/src/hooks/useAuth';
import { useSetPageTitle } from '@/src/contexts/PageContext';
import { supabase } from '@/src/integrations/supabase/client';
import { cn } from '@/src/lib/utils';
import { getWorkspaceAiKey } from '@/src/lib/aiImportService';
import {
  transcribeWithGroqWhisper,
  processAudioWithGemini,
  generateMinuteFromText,
  transcribeWithGladia,
} from '@/src/lib/minuteService';
import { MetricHeroCard } from '@/src/components/ui/MetricHeroCard';
import { MinuteEditor } from '@/src/components/minute/MinuteEditor';
import { MinuteDetailView } from '@/src/components/minute/MinuteDetailView';
import { MinutePrintPreviewView, MinutePrintPreviewViewHandle } from '@/src/components/minute/MinutePrintPreviewView';
import { MeetingSettingsModal } from '@/src/components/minute/MeetingSettingsModal';
import { TaskDetailSheet } from '@/src/components/tasks/TaskDetailSheet';
import type { MeetingMinute, MeetingActionItem } from '@/src/types/minute';
import { useMeetingSettingsStore } from '@/src/store/meetingSettingsStore';

interface SavedApiKey {
  id: string;
  label: string;
  provider: string;
  keyValue: string;
  isDefault: boolean;
  defaultModel?: string;
}

interface ApiModelOption {
  id: string;
  label: string;
  tag?: string;
  isDefault?: boolean;
}

const ENGINE_DEFAULT_MODELS: Record<string, string> = {
  gemini: 'gemini-3.6-flash',
  groq: 'qwen/qwen3.8-27b',
  gladia: 'accurate',
};

const PRESET_MODELS: Record<string, { id: string; label: string; tag?: string }[]> = {
  gemini: [
    { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash', tag: 'Fast & High Capacity' },
    { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash', tag: 'Stable Production' },
    { id: 'gemini-flash-lite-latest', label: 'Gemini Flash Lite', tag: 'Ultra-Fast' },
    { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite', tag: 'Lightweight' },
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', tag: 'Standard' },
    { id: 'gemini-3.7-flash', label: 'Gemini 3.7 Flash', tag: 'Preview' },
  ],
  groq: [
    { id: 'qwen/qwen3.8-27b', label: 'Qwen 3.8 27B', tag: 'Verified & Fast' },
    { id: 'openai/gpt-oss-120b', label: 'GPT OSS 120B', tag: 'Large Context' },
    { id: 'openai/gpt-oss-20b', label: 'GPT OSS 20B', tag: 'Ultra-Fast' },
    { id: 'whisper-large-v3', label: 'Whisper Large v3', tag: 'Whisper Audio' },
  ],
  gladia: [
    { id: 'accurate', label: 'Gladia Accurate (v2)', tag: 'Diarization Focus' },
    { id: 'fast', label: 'Gladia Fast (v2)', tag: 'Low Latency' },
    { id: 'solaria', label: 'Gladia Solaria', tag: 'Multilingual' },
  ],
};

// Fetch live available models directly from provider API endpoint
const fetchProviderModels = async (provider: string, apiKey: string): Promise<ApiModelOption[]> => {
  if (!apiKey || apiKey.length < 8) return [];
  try {
    if (provider === 'gemini') {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      if (!res.ok) {
        console.warn(`Gemini models endpoint returned status ${res.status}`);
        return [];
      }
      const data = await res.json();
      if (data.models && Array.isArray(data.models)) {
        return data.models
          .filter((m: any) => !m.supportedGenerationMethods || m.supportedGenerationMethods.includes('generateContent'))
          .map((m: any) => {
            const cleanId = m.name.replace(/^models\//, '');
            return {
              id: cleanId,
              label: m.displayName ? `${m.displayName} (${cleanId})` : cleanId,
              tag: cleanId.includes('flash') ? 'Flash' : cleanId.includes('pro') ? 'Pro' : cleanId.includes('lite') ? 'Lite' : undefined,
            };
          });
      }
    } else if (provider === 'groq') {
      const res = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) {
        console.warn(`Groq models endpoint returned status ${res.status}`);
        return [];
      }
      const data = await res.json();
      if (data.data && Array.isArray(data.data)) {
        return data.data.map((m: any) => ({
          id: m.id,
          label: m.id,
        }));
      }
    }
  } catch (err) {
    console.warn(`Failed to fetch live models for ${provider}:`, err);
  }
  return [];
};

export function Minute() {
  const { user } = useAuth();
  const currentUser = useUserStore((s) => s.getCurrentUser());
  const priv = usePriv('minute');
  const employees = useAppStore((s) => s.employees);
  const { createMainTask, addSubtask } = useAppData();

  const {
    minutes,
    activeMinute,
    addMinute,
    updateMinute,
    deleteMinute,
    setActiveMinute,
    loadMinutesFromDb,
    selectedEngine,
    setSelectedEngine,
  } = useMinuteStore();

  useEffect(() => {
    loadMinutesFromDb();
  }, [loadMinutesFromDb]);

  // Reset edit mode and print preview whenever the user opens a different minute (always land in View mode)
  useEffect(() => {
    if (!activeMinute) {
      setIsEditing(false);
      setIsPrintPreview(false);
    }
  }, [activeMinute?.id]);

  // Meeting settings store
  const meetingSettings = useMeetingSettingsStore((s) => s.settings);

  // Meeting settings modal
  const [isMeetingSettingsOpen, setIsMeetingSettingsOpen] = useState(false);

  // Modal for new minute
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<'upload' | 'record' | 'paste'>('upload');

  // Print preview page view with watermark
  const [isPrintPreview, setIsPrintPreview] = useState(false);
  const previewRef = useRef<MinutePrintPreviewViewHandle>(null);

  // View mode vs Edit mode for active minute
  const [isEditing, setIsEditing] = useState(false);
  const [isDiscardDialogOpen, setIsDiscardDialogOpen] = useState(false);
  const originalMinuteRef = useRef<MeetingMinute | null>(null);
  const isNewMinuteRef = useRef<boolean>(false);

  // Track if current active minute has unsaved changes compared to baseline
  const hasUnsavedChanges = useMemo(() => {
    if (!isEditing || !activeMinute || !originalMinuteRef.current) return false;
    return JSON.stringify(activeMinute) !== JSON.stringify(originalMinuteRef.current);
  }, [isEditing, activeMinute]);

  // Active task detail sheet state
  const [viewingTaskId, setViewingTaskId] = useState<string | null>(null);

  // Input states
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  // Attendee picker state for new minute modal
  const [modalAttendees, setModalAttendees] = useState<string[]>([]);
  const [attendeeSearch, setAttendeeSearch] = useState('');
  const [customAttendeeInput, setCustomAttendeeInput] = useState('');
  const [showAttendeeDropdown, setShowAttendeeDropdown] = useState(false);

  const addAttendee = (name: string) => {
    const trimmed = name.trim();
    if (trimmed && !modalAttendees.includes(trimmed)) {
      setModalAttendees((prev) => [...prev, trimmed]);
    }
    setAttendeeSearch('');
    setCustomAttendeeInput('');
    setShowAttendeeDropdown(false);
  };

  const addAttendees = (names: string[]) => {
    setModalAttendees((prev) => {
      const next = [...prev];
      for (const n of names) {
        const trimmed = n.trim();
        if (trimmed && !next.includes(trimmed)) {
          next.push(trimmed);
        }
      }
      return next;
    });
  };

  const removeAttendee = (name: string) => {
    setModalAttendees((prev) => prev.filter((a) => a !== name));
  };

  // Filtered employee list for attendee dropdown
  const filteredEmployees = useMemo(() => {
    const q = attendeeSearch.toLowerCase();
    return employees
      .filter((e) => {
        const fullName = [e.firstname, e.surname].filter(Boolean).join(' ');
        return fullName.toLowerCase().includes(q) && !modalAttendees.includes(fullName);
      })
      .slice(0, 10);
  }, [employees, attendeeSearch, modalAttendees]);

  // Recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordSec, setRecordSec] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [isConvertingTasks, setIsConvertingTasks] = useState(false);

  // AI Keys and Models loaded from AI Settings
  const [savedAiKeys, setSavedAiKeys] = useState<SavedApiKey[]>([]);
  const [selectedKeyId, setSelectedKeyId] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [customModel, setCustomModel] = useState<string>('');
  const [isCustomModelActive, setIsCustomModelActive] = useState<boolean>(false);
  const [manualKeyInput, setManualKeyInput] = useState<string>('');
  const [isLoadingKeys, setIsLoadingKeys] = useState<boolean>(false);

  // Load keys from AI Settings (api_keys table + localStorage fallbacks)
  const loadSavedAiKeys = async () => {
    setIsLoadingKeys(true);
    try {
      const { data } = await supabase.from('api_keys').select('*').order('is_default', { ascending: false });
      const keys: SavedApiKey[] = (data || []).map((k: any) => ({
        id: k.id,
        label: k.label || '',
        provider: (k.provider || '').toLowerCase(),
        keyValue: k.key_value || '',
        isDefault: !!k.is_default,
        defaultModel: k.default_model || '',
      }));

      // Fallbacks
      const groqLs = localStorage.getItem('GROQ_API_KEY');
      if (groqLs && !keys.some((k) => k.provider === 'groq')) {
        keys.push({ id: 'ls-groq', label: 'Local Groq Key', provider: 'groq', keyValue: groqLs, isDefault: true, defaultModel: 'llama-3.3-70b-versatile' });
      }
      const geminiLs = localStorage.getItem('GEMINI_API_KEY');
      if (geminiLs && !keys.some((k) => k.provider === 'gemini')) {
        keys.push({ id: 'ls-gemini', label: 'Local Gemini Key', provider: 'gemini', keyValue: geminiLs, isDefault: true, defaultModel: 'gemini-2.0-flash' });
      }
      const gladiaLs = localStorage.getItem('GLADIA_API_KEY');
      if (gladiaLs && !keys.some((k) => k.provider === 'gladia')) {
        keys.push({ id: 'ls-gladia', label: 'Local Gladia Key', provider: 'gladia', keyValue: gladiaLs, isDefault: true, defaultModel: 'accurate' });
      }

      setSavedAiKeys(keys);
    } catch (err) {
      console.error('Failed to load AI keys in Minute:', err);
    } finally {
      setIsLoadingKeys(false);
    }
  };

  useEffect(() => {
    loadSavedAiKeys();
  }, [isOpen]);

  // Keys matching active selected engine
  const matchingKeys = useMemo(() => {
    return savedAiKeys.filter(
      (k) => k.provider.toLowerCase() === selectedEngine.toLowerCase()
    );
  }, [savedAiKeys, selectedEngine]);

  const activeKey = useMemo(() => {
    return matchingKeys.find((k) => k.id === selectedKeyId) || matchingKeys.find((k) => k.isDefault) || matchingKeys[0] || null;
  }, [matchingKeys, selectedKeyId]);

  // Active API key (either saved in AI Settings or manually typed)
  const effectiveApiKey = activeKey?.keyValue || manualKeyInput.trim();

  // Cache of live fetched models from provider API
  const [apiModelsByProvider, setApiModelsByProvider] = useState<Record<string, ApiModelOption[]>>({});
  const [isFetchingModels, setIsFetchingModels] = useState<boolean>(false);

  // Function to load live models from API
  const fetchLiveModels = async (provider: string, apiKey: string) => {
    if (!apiKey || apiKey.length < 8) return;
    setIsFetchingModels(true);
    try {
      const models = await fetchProviderModels(provider, apiKey);
      if (models.length > 0) {
        setApiModelsByProvider((prev) => ({
          ...prev,
          [provider]: models,
        }));
      }
    } finally {
      setIsFetchingModels(false);
    }
  };

  // Automatically fetch live models when modal is open and engine or key changes
  useEffect(() => {
    if (!isOpen) return;
    if (selectedEngine === 'gemini' || selectedEngine === 'groq') {
      if (effectiveApiKey) {
        fetchLiveModels(selectedEngine, effectiveApiKey);
      }
    }
  }, [isOpen, selectedEngine, effectiveApiKey]);

  // Combined available models list: Live API models + presets + ensuring AI settings default model is included
  const availableModels = useMemo<ApiModelOption[]>(() => {
    const defaultModelId = activeKey?.defaultModel;
    const fetched = apiModelsByProvider[selectedEngine] || [];
    const presets = PRESET_MODELS[selectedEngine] || [];

    const map = new Map<string, ApiModelOption>();

    // 1. Add default model if configured in AI Settings
    if (defaultModelId) {
      map.set(defaultModelId, {
        id: defaultModelId,
        label: defaultModelId,
        tag: 'Default in AI Settings',
        isDefault: true,
      });
    }

    // 2. Add all live models fetched from API link
    for (const m of fetched) {
      const isDef = m.id === defaultModelId;
      map.set(m.id, {
        ...m,
        tag: isDef ? 'Default in AI Settings' : m.tag,
        isDefault: isDef,
      });
    }

    // 3. Fallback to preset models if API models are not yet loaded
    if (fetched.length === 0) {
      for (const p of presets) {
        const isDef = p.id === defaultModelId;
        map.set(p.id, {
          ...p,
          tag: isDef ? 'Default in AI Settings' : p.tag,
          isDefault: isDef,
        });
      }
    }

    const list = Array.from(map.values());

    // Sort: Default model from AI Settings always comes first, then alphabetically
    list.sort((a, b) => {
      if (a.isDefault) return -1;
      if (b.isDefault) return 1;
      return a.label.localeCompare(b.label);
    });

    return list;
  }, [selectedEngine, apiModelsByProvider, activeKey?.defaultModel]);

  // Sync selectedModel with the default model saved in AI Settings
  useEffect(() => {
    if (activeKey) {
      setSelectedKeyId(activeKey.id);
      if (activeKey.defaultModel && !isCustomModelActive) {
        setSelectedModel(activeKey.defaultModel);
      } else if (!selectedModel || !availableModels.some((m) => m.id === selectedModel)) {
        setSelectedModel(activeKey.defaultModel || availableModels[0]?.id || ENGINE_DEFAULT_MODELS[selectedEngine] || '');
      }
    } else {
      setSelectedKeyId('');
      if (!isCustomModelActive) {
        setSelectedModel(availableModels[0]?.id || ENGINE_DEFAULT_MODELS[selectedEngine] || '');
      }
    }
  }, [selectedEngine, activeKey, availableModels]);

  // Search & filter
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  // Start editing existing minute
  const handleStartEdit = () => {
    if (activeMinute) {
      originalMinuteRef.current = JSON.parse(JSON.stringify(activeMinute));
      isNewMinuteRef.current = false;
    }
    setIsEditing(true);
  };

  // Create a blank minute directly (uses Meeting Settings defaults)
  const handleCreateBlank = () => {
    if (priv && !priv.canAdd) {
      toast.error('You do not have permission to create minutes.');
      return;
    }
    const defaultAttendees =
      modalAttendees.length > 0
        ? modalAttendees
        : currentUser?.name
        ? [currentUser.name]
        : [meetingSettings.defaultChairPerson || 'HR Admin'];
    const blank: MeetingMinute = {
      id: `minute-${Date.now()}`,
      title: 'Executive Meeting Minute',
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      meetingType: meetingSettings.defaultMeetingType || 'HR',
      chairPerson: currentUser?.name || user?.email || meetingSettings.defaultChairPerson || 'HR Admin',
      location: meetingSettings.defaultLocation || 'Conference Room',
      confidentiality: meetingSettings.confidentialityLevel,
      attendees: defaultAttendees,
      absentees: [],
      agendaTopics: [
        { id: '1', topic: 'Meeting Review', discussion: '', decisions: [] },
      ],
      executiveSummary: '',
      keyDecisions: [],
      actionItems: [],
      rawTranscript: '',
      status: 'draft',
      engineUsed: 'manual',
      createdBy: currentUser?.name || user?.email || 'HR Admin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    originalMinuteRef.current = JSON.parse(JSON.stringify(blank));
    isNewMinuteRef.current = true;
    setActiveMinute(blank);
    setIsEditing(true);
    setIsOpen(false);
    setModalAttendees([]);
    toast.success('Blank minute opened for editing.');
  };

  // Save changes & complete editing (for both new minutes and editing existing minutes)
  const handleDoneOrSave = () => {
    if (!activeMinute) return;
    addMinute(activeMinute);
    originalMinuteRef.current = JSON.parse(JSON.stringify(activeMinute));
    isNewMinuteRef.current = false;
    setIsEditing(false);
    toast.success('Minute saved to Catalog.');
  };

  // Cancel edit mode: if changes exist, ask to discard; otherwise cancel directly
  const handleCancelEdit = () => {
    if (hasUnsavedChanges) {
      setIsDiscardDialogOpen(true);
    } else {
      executeCancel();
    }
  };

  const executeCancel = () => {
    if (isNewMinuteRef.current) {
      // Discard newly created blank minute
      setActiveMinute(null);
    } else if (originalMinuteRef.current) {
      // Revert existing minute back to baseline snapshot
      setActiveMinute(originalMinuteRef.current);
    }
    isNewMinuteRef.current = false;
    setIsEditing(false);
    setIsDiscardDialogOpen(false);
    toast.info('Changes discarded.');
  };

  // Set top header button & back button before title description
  useSetPageTitle(
    activeMinute
      ? isPrintPreview
        ? 'Print Preview & Export'
        : (activeMinute.title || 'Meeting Minute')
      : 'Meeting Minutes',
    activeMinute
      ? isPrintPreview
        ? `${activeMinute.title} • Watermarked at 50% opacity with corporate header`
        : `${activeMinute.meetingType} Meeting • ${activeMinute.date}${activeMinute.chairPerson ? ` • Chair: ${activeMinute.chairPerson}` : ''}`
      : 'Standardized corporate minutes & task allocation',
    activeMinute ? (
      isPrintPreview ? (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsPrintPreview(false)}
            className="h-8 text-xs border-border/80"
          >
            Close
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => previewRef.current?.handlePrint()}
            className="h-8 px-3.5 text-xs bg-teal-600 hover:bg-teal-700 text-white gap-1.5 shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print / Save PDF</span>
          </Button>
        </div>
      ) : isEditing ? (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCancelEdit}
            className="h-8 text-xs text-muted-foreground hover:text-foreground border-border/80"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleDoneOrSave}
            className="h-8 gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Done</span>
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsPrintPreview(true)}
            className="h-8 gap-1.5 text-xs border-border/80"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print / PDF</span>
          </Button>
          {(!priv || priv.canEdit) && (
            <Button
              type="button"
              size="sm"
              onClick={handleStartEdit}
              className="h-8 gap-1.5 text-xs bg-teal-600 hover:bg-teal-700 text-white"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Minute</span>
            </Button>
          )}
        </div>
      )
    ) : (
      (!priv || priv.canAdd) ? (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            title="Meeting Settings"
            onClick={() => setIsMeetingSettingsOpen(true)}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          >
            <SettingsIcon className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1 border-border/80"
            onClick={handleCreateBlank}
          >
            <Edit3 className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Write Blank</span>
          </Button>
          <Button
            size="sm"
            className="h-8 px-3 text-xs bg-teal-600 hover:bg-teal-700 text-white gap-1.5 shadow-xs"
            onClick={() => {
              setFile(null);
              setText('');
              setIsOpen(true);
            }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>New Minute</span>
          </Button>
        </div>
      ) : null
    ),
    [priv, isOpen, activeMinute, isEditing, isPrintPreview, hasUnsavedChanges],
    activeMinute ? () => {
      if (isPrintPreview) {
        setIsPrintPreview(false);
      } else if (isEditing) {
        handleCancelEdit();
      } else {
        setActiveMinute(null);
      }
    } : false
  );

  // Mic recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const recFile = new File([blob], `recording-${Date.now()}.webm`, { type: 'audio/webm' });
        setFile(recFile);
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordSec(0);
      timerRef.current = setInterval(() => setRecordSec((s) => s + 1), 1000);
    } catch {
      toast.error('Unable to access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  // Generate with AI (using selected key and model from AI Settings)
  const handleGenerate = async () => {
    if (priv && !priv.canAdd) {
      toast.error('You do not have permission to generate minutes.');
      return;
    }

    setIsProcessing(true);
    setStatusText('Preparing AI Engine...');

    try {
      const provider = selectedEngine;
      const apiKey = activeKey?.keyValue || manualKeyInput.trim();
      const model = (isCustomModelActive ? customModel.trim() : selectedModel) || activeKey?.defaultModel || ENGINE_DEFAULT_MODELS[provider] || 'gemini-3.6-flash';

      if (!apiKey && provider !== 'notebooklm') {
        throw new Error(`No ${provider.toUpperCase()} API key provided. Please select or add an API key in Settings > AI Settings.`);
      }

      let generated: any = null;

      if (provider === 'gladia') {
        // Gladia AI Speech-to-Text with Speaker Diarization
        if (tab === 'paste') {
          // Gladia is audio-focused; for notes, synthesize with available LLM (Gemini or Groq)
          const geminiKeyObj = savedAiKeys.find((k) => k.provider === 'gemini');
          const groqKeyObj = savedAiKeys.find((k) => k.provider === 'groq');
          const llm = geminiKeyObj ? 'gemini' : groqKeyObj ? 'groq' : null;
          if (!llm) {
            throw new Error('A Gemini or Groq API key is required in AI Settings to synthesize pasted meeting notes into executive minutes.');
          }
          generated = await generateMinuteFromText(
            text,
            llm,
            {
              geminiKey: geminiKeyObj?.keyValue,
              groqKey: groqKeyObj?.keyValue,
              model: geminiKeyObj?.defaultModel || 'gemini-3.6-flash',
              customPromptGuidelines: meetingSettings.customPromptGuidelines,
            },
            setStatusText
          );
        } else {
          if (!file) throw new Error('Please upload an audio file or record voice.');
          const transcript = await transcribeWithGladia(file, apiKey, setStatusText);
          // Synthesize using LLM
          const geminiKeyObj = savedAiKeys.find((k) => k.provider === 'gemini');
          const groqKeyObj = savedAiKeys.find((k) => k.provider === 'groq');
          const llm = geminiKeyObj ? 'gemini' : groqKeyObj ? 'groq' : null;
          if (!llm) {
            throw new Error('Audio transcribed with Gladia! However, a Gemini or Groq key in AI Settings is required to structure it into minutes. Please add one in Settings > AI Settings.');
          }
          generated = await generateMinuteFromText(
            transcript,
            llm,
            {
              geminiKey: geminiKeyObj?.keyValue,
              groqKey: groqKeyObj?.keyValue,
              model: (llm === 'gemini' ? geminiKeyObj?.defaultModel : groqKeyObj?.defaultModel) || (llm === 'gemini' ? 'gemini-3.6-flash' : 'qwen/qwen3.8-27b'),
              customPromptGuidelines: meetingSettings.customPromptGuidelines,
            },
            setStatusText
          );
        }
      } else if (provider === 'groq') {
        if (tab === 'paste') {
          if (!text.trim()) throw new Error('Please enter meeting notes or dialogue.');
          generated = await generateMinuteFromText(
            text,
            'groq',
            {
              groqKey: apiKey,
              model,
              customPromptGuidelines: meetingSettings.customPromptGuidelines,
            },
            setStatusText
          );
        } else {
          if (!file) throw new Error('Please upload an audio file or record voice.');
          const transcript = await transcribeWithGroqWhisper(file, apiKey, setStatusText);
          generated = await generateMinuteFromText(
            transcript,
            'groq',
            {
              groqKey: apiKey,
              model,
              customPromptGuidelines: meetingSettings.customPromptGuidelines,
            },
            setStatusText
          );
        }
      } else if (provider === 'gemini') {
        if (tab === 'paste') {
          if (!text.trim()) throw new Error('Please enter meeting notes or dialogue.');
          generated = await generateMinuteFromText(
            text,
            'gemini',
            {
              geminiKey: apiKey,
              model,
              customPromptGuidelines: meetingSettings.customPromptGuidelines,
            },
            setStatusText
          );
        } else {
          if (!file) throw new Error('Please upload an audio file or record voice.');
          generated = await processAudioWithGemini(
            file,
            apiKey,
            model,
            setStatusText,
            meetingSettings.customPromptGuidelines
          );
        }
      } else {
        // notebooklm or manual notes
        if (!text.trim()) throw new Error('Please paste your meeting notes or study transcript in the text area.');
        const geminiKeyObj = savedAiKeys.find((k) => k.provider === 'gemini');
        const groqKeyObj = savedAiKeys.find((k) => k.provider === 'groq');
        const llm = geminiKeyObj ? 'gemini' : groqKeyObj ? 'groq' : null;
        if (!llm) throw new Error('A Gemini or Groq API key is required to synthesize minutes.');
        generated = await generateMinuteFromText(
          text,
          llm,
          {
            geminiKey: geminiKeyObj?.keyValue,
            groqKey: groqKeyObj?.keyValue,
            model: geminiKeyObj?.defaultModel || 'gemini-3.6-flash',
            customPromptGuidelines: meetingSettings.customPromptGuidelines,
          },
          setStatusText
        );
      }

      if (generated) {
        // Merge manually-selected attendees with any AI-extracted attendees
        const aiAttendees: string[] = Array.isArray(generated.attendees) ? generated.attendees : [];
        const mergedAttendees = [
          ...modalAttendees,
          ...aiAttendees.filter((a: string) => !modalAttendees.includes(a)),
        ];
        const created: MeetingMinute = {
          id: `minute-${Date.now()}`,
          date: new Date().toISOString().split('T')[0],
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: 'draft',
          engineUsed: provider as any,
          createdBy: currentUser?.name || user?.email || 'HR Admin',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          ...generated,
          chairPerson: (generated.chairPerson && generated.chairPerson !== 'Not specified')
            ? generated.chairPerson
            : (meetingSettings.defaultChairPerson || currentUser?.name || 'HR Admin'),
          location: generated.location || meetingSettings.defaultLocation || 'Conference Room',
          meetingType: generated.meetingType || meetingSettings.defaultMeetingType || 'HR',
          confidentiality: (generated as any).confidentiality || meetingSettings.confidentialityLevel || 'Confidential',
          attendees: mergedAttendees.length > 0 ? mergedAttendees : aiAttendees,
        };
        addMinute(created);
        setActiveMinute(created);
        setIsEditing(false);
        setIsOpen(false);
        setModalAttendees([]);
        setAttendeeSearch('');
        setCustomAttendeeInput('');
        toast.success(`Meeting minute generated successfully with ${provider.toUpperCase()} (${model})!`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate minute.');
    } finally {
      setIsProcessing(false);
      setStatusText('');
    }
  };

  // Convert to tasks
  const handleConvertToTasks = async (selectedItems: MeetingActionItem[]) => {
    if (!activeMinute) return;
    setIsConvertingTasks(true);
    try {
      const defaultPriority = meetingSettings.defaultPriority || 'medium';
      const mainTask = await createMainTask({
        title: `Meeting Action Items: ${activeMinute.title}`,
        description: `Deliverables from ${activeMinute.title} on ${activeMinute.date}. Chair: ${activeMinute.chairPerson}`,
        priority: defaultPriority,
        is_hr_task: true,
      });

      const turnaroundDays = meetingSettings.defaultActionTurnaroundDays || 7;
      const defaultDueDate = new Date(Date.now() + turnaroundDays * 86400000).toISOString().split('T')[0];

      const updated = [...activeMinute.actionItems];
      for (const item of selectedItems) {
        const sub = await addSubtask({
          main_task_id: mainTask?.id,
          title: item.description,
          description: `Deliverable from ${activeMinute.title}`,
          assigned_to: item.assigneeId || null,
          due_date: item.dueDate || defaultDueDate,
          priority: item.priority || defaultPriority,
          status: 'todo',
        });
        const idx = updated.findIndex((a) => a.id === item.id);
        if (idx !== -1) updated[idx].convertedToTaskId = sub?.id || 'done';
      }

      const updatedMin = { ...activeMinute, actionItems: updated };
      updateMinute(activeMinute.id, updatedMin);
      setActiveMinute(updatedMin);
      toast.success(`Converted ${selectedItems.length} action item(s) to HR tasks!`);
    } catch (e: any) {
      toast.error('Failed to convert tasks: ' + (e.message || ''));
    } finally {
      setIsConvertingTasks(false);
    }
  };

  const filteredMinutes = minutes.filter((m) => {
    const q = search.toLowerCase();
    const matchesSearch =
      m.title.toLowerCase().includes(q) ||
      m.executiveSummary.toLowerCase().includes(q) ||
      m.chairPerson.toLowerCase().includes(q);
    const matchesType = typeFilter === 'all' || m.meetingType.toLowerCase() === typeFilter.toLowerCase();
    return matchesSearch && matchesType;
  });

  return (
    <div className="container max-w-5xl mx-auto py-5 px-4 space-y-5">
      {/* Print Preview, Editor, or View Mode */}
      {activeMinute ? (
        isPrintPreview ? (
          <MinutePrintPreviewView
            ref={previewRef}
            minute={activeMinute}
          />
        ) : isEditing ? (
          <MinuteEditor
            minute={activeMinute}
            onChange={(m) => setActiveMinute(m)}
            onSave={handleDoneOrSave}
            onConvertToTasks={handleConvertToTasks}
            onDiscard={handleCancelEdit}
            employees={employees}
            isConverting={isConvertingTasks}
            hideTopBar={true}
          />
        ) : (
          <MinuteDetailView
            minute={activeMinute}
            onEdit={handleStartEdit}
            onConvertToTasks={handleConvertToTasks}
            onOpenTask={(taskId) => setViewingTaskId(taskId)}
            isConverting={isConvertingTasks}
          />
        )
      ) : (
        /* Minutes List */
        <div className="space-y-4">
          {/* Executive Metrics Overview Hero Card */}
          <MetricHeroCard
            primary={{
              label: 'Total Minutes',
              value: minutes.length,
              period: `${new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}`,
              sparklineData: [
                Math.max(1, Math.round(minutes.length * 0.35)),
                Math.max(1, Math.round(minutes.length * 0.6)),
                Math.max(1, Math.round(minutes.length * 0.8)),
                minutes.length,
              ],
              delta: minutes.length > 0 ? 'Target Met' : 'Archive Ready',
              deltaType: minutes.length > 0 ? 'positive' : 'neutral',
            }}
            secondary={[
              {
                label: 'Action Items',
                value: minutes.reduce((acc, m) => acc + (m.actionItems?.length || 0), 0),
                period: `${Math.max(0, minutes.reduce((acc, m) => acc + (m.actionItems?.length || 0), 0) - minutes.reduce((acc, m) => acc + (m.actionItems?.filter((a) => a.convertedToTaskId).length || 0), 0))} pending review`,
                sparklineData: [
                  Math.max(0, minutes.reduce((acc, m) => acc + (m.actionItems?.length || 0), 0) - 4),
                  Math.max(0, minutes.reduce((acc, m) => acc + (m.actionItems?.length || 0), 0) - 1),
                  minutes.reduce((acc, m) => acc + (m.actionItems?.length || 0), 0),
                ],
                delta: (minutes.reduce((acc, m) => acc + (m.actionItems?.length || 0), 0) - minutes.reduce((acc, m) => acc + (m.actionItems?.filter((a) => a.convertedToTaskId).length || 0), 0)) > 0 ? 'In Progress' : 'Nominal',
                deltaType: (minutes.reduce((acc, m) => acc + (m.actionItems?.length || 0), 0) - minutes.reduce((acc, m) => acc + (m.actionItems?.filter((a) => a.convertedToTaskId).length || 0), 0)) > 0 ? 'neutral' : 'positive',
              },
              {
                label: 'Converted to Tasks',
                value: minutes.reduce((acc, m) => acc + (m.actionItems?.filter((a) => a.convertedToTaskId).length || 0), 0),
                period: minutes.reduce((acc, m) => acc + (m.actionItems?.length || 0), 0) > 0
                  ? `${Math.round((minutes.reduce((acc, m) => acc + (m.actionItems?.filter((a) => a.convertedToTaskId).length || 0), 0) / minutes.reduce((acc, m) => acc + (m.actionItems?.length || 0), 0)) * 100)}% Conversion Rate`
                  : 'In-flight Operations',
                delta: minutes.reduce((acc, m) => acc + (m.actionItems?.filter((a) => a.convertedToTaskId).length || 0), 0) > 0 ? 'In Execution' : 'Awaiting Actions',
                deltaType: minutes.reduce((acc, m) => acc + (m.actionItems?.filter((a) => a.convertedToTaskId).length || 0), 0) > 0 ? 'positive' : 'neutral',
              },
              {
                label: 'Draft Minutes',
                value: minutes.filter((m) => m.status === 'draft').length,
                period: `${minutes.filter((m) => m.status === 'finalized' || m.status === 'reviewed').length} on approved record`,
                delta: minutes.filter((m) => m.status === 'draft').length > 0 ? 'Action Required' : 'Nominal',
                deltaType: minutes.filter((m) => m.status === 'draft').length > 0 ? 'negative' : 'positive',
              },
            ]}
          />

          {/* Search & Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 p-2.5 rounded-xl bg-card border border-border/80">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search minutes by title or name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 text-xs bg-muted/20 border-border/60"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto">
              {['all', 'hr', 'management', 'departmental', 'project'].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTypeFilter(t)}
                  className={`text-[11px] px-2.5 py-1 rounded-md transition-colors capitalize shrink-0 ${
                    typeFilter === t
                      ? 'bg-muted text-foreground font-semibold shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

          </div>

          {/* Cards */}
          {filteredMinutes.length === 0 ? (
            <div className="p-12 text-center border-2 border-dashed rounded-xl border-border/70 text-muted-foreground space-y-3 bg-muted/5">
              <FileText className="w-8 h-8 mx-auto text-teal-600 dark:text-teal-400" />
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-foreground">No Minutes Found</p>
                <p className="text-[11px] text-muted-foreground">Upload meeting audio or paste notes to generate your first minute.</p>
              </div>
              {(!priv || priv.canAdd) && (
                <Button
                  size="sm"
                  onClick={() => {
                    setFile(null);
                    setText('');
                    setIsOpen(true);
                  }}
                  className="h-8 text-xs bg-teal-600 hover:bg-teal-700 text-white gap-1"
                >
                  <Sparkles className="w-3 h-3" />
                  Create First Minute
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredMinutes.map((m) => (
                <div
                  key={m.id}
                  onClick={() => {
                    setActiveMinute(m);
                    setIsEditing(false);
                  }}
                  className="rounded-xl border border-border/80 bg-card p-4 space-y-3 hover:border-teal-500/60 hover:shadow-xs cursor-pointer transition-all flex flex-col justify-between group"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <Badge variant="outline" className="text-[10px] px-2 py-0 border-teal-500/30 text-teal-700 dark:text-teal-300 bg-teal-500/10 font-medium">
                        {m.meetingType}
                      </Badge>
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        <span>{m.date}</span>
                        {(!priv || priv.canDelete) && (
                          <button
                            type="button"
                            title="Delete"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm(`Delete "${m.title}"?`)) {
                                deleteMinute(m.id);
                                toast.success('Minute deleted.');
                              }
                            }}
                            className="p-1 rounded text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    <h4 className="text-sm font-semibold text-foreground line-clamp-1 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                      {m.title}
                    </h4>
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {m.executiveSummary || 'No summary. Click to view.'}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground truncate max-w-[120px]">
                      <User className="w-3 h-3 shrink-0" />
                      <span className="truncate">{m.chairPerson || 'HR Admin'}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {m.actionItems && m.actionItems.length > 0 && (
                        <Badge variant="outline" className="text-[10px] py-0 px-1 text-teal-700 dark:text-teal-300 border-teal-500/30">
                          {m.actionItems.length} tasks
                        </Badge>
                      )}
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMinute(m);
                          setIsEditing(false);
                        }}
                        className="h-6 text-[11px] bg-teal-600/10 text-teal-700 dark:text-teal-400 hover:bg-teal-600 hover:text-white px-2 transition-colors gap-0.5"
                      >
                        Open <ChevronRight className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Minimalist New Minute Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md p-0 gap-0 flex flex-col max-h-[85vh] overflow-hidden">

          {/* ── Sticky Header ── */}
          <div className="shrink-0 px-5 pt-5 pb-3 border-b border-border/60">
            <DialogHeader className="p-0 space-y-1">
              <DialogTitle className="text-sm font-bold flex items-center gap-1.5">
                <FileAudio className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                New Meeting Minute
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Provide audio or meeting notes to automatically synthesize executive minutes using your AI Settings.
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* ── Scrollable Body ── */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

            {/* Minimalist AI Engine & Model Control Strip */}
            <div className="space-y-1.5">
              {/* Row 1: Compact Horizontal Segmented Engine Selector */}
              <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg border border-border/60">
                {(
                  [
                    { value: 'gemini', label: 'Gemini', icon: '✦' },
                    { value: 'groq', label: 'Groq', icon: '⚡' },
                    { value: 'gladia', label: 'Gladia', icon: '🎙' },
                    { value: 'notebooklm', label: 'NbLM', icon: '📓' },
                  ] as const
                ).map((eng) => {
                  const isSelected = selectedEngine === eng.value;
                  return (
                    <button
                      key={eng.value}
                      type="button"
                      onClick={() => setSelectedEngine(eng.value)}
                      className={cn(
                        'flex-1 flex items-center justify-center gap-1.5 h-6 rounded-md text-[11px] font-medium transition-all',
                        isSelected
                          ? 'bg-background text-teal-600 dark:text-teal-400 font-semibold shadow-2xs border border-border/70'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <span className="text-[11px] leading-none">{eng.icon}</span>
                      <span>{eng.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Row 2: Minimalist Single-Line Model & Key Bar */}
              {selectedEngine === 'notebooklm' ? (
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/20 px-2.5 py-1.5 rounded-md border border-border/50">
                  <span className="shrink-0">📓</span>
                  <span className="truncate">Process in Google NotebookLM, then paste notes in the <strong>Paste</strong> tab below.</span>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    {/* Model Selector Dropdown */}
                    <div className="flex-1 min-w-0">
                      {!isCustomModelActive ? (
                        <div className="relative">
                          <select
                            value={selectedModel}
                            onChange={(e) => {
                              if (e.target.value === '__custom__') {
                                setIsCustomModelActive(true);
                              } else {
                                setSelectedModel(e.target.value);
                              }
                            }}
                            className="w-full h-7 text-[11px] bg-background border border-border/70 rounded-md pl-2 pr-6 outline-none text-foreground font-medium truncate focus:border-teal-500"
                          >
                            {availableModels.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.isDefault ? '★ ' : ''}
                                {m.label}
                                {m.isDefault ? ' (Default)' : m.tag ? ` — ${m.tag}` : ''}
                              </option>
                            ))}
                            <option value="__custom__">⚙ Custom Model ID...</option>
                          </select>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <Input
                            placeholder={`e.g. ${selectedEngine === 'groq' ? 'qwen/qwen3.8-27b' : selectedEngine === 'gemini' ? 'gemini-3.6-flash' : 'accurate'}`}
                            value={customModel}
                            onChange={(e) => setCustomModel(e.target.value)}
                            className="h-7 text-[11px] font-mono bg-background flex-1"
                          />
                          <button
                            type="button"
                            onClick={() => setIsCustomModelActive(false)}
                            className="text-[10px] text-teal-600 hover:underline px-1 shrink-0 font-medium"
                          >
                            List
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Saved Key Status Badge / Selector */}
                    {matchingKeys.length > 1 ? (
                      <select
                        value={activeKey?.id}
                        onChange={(e) => setSelectedKeyId(e.target.value)}
                        className="h-7 text-[10px] font-mono bg-muted/30 border border-border/70 rounded-md px-1.5 outline-none text-foreground shrink-0 max-w-[120px] truncate"
                        title="Select API Key"
                      >
                        {matchingKeys.map((k) => (
                          <option key={k.id} value={k.id}>
                            {k.label || 'Key'} ({k.keyValue.slice(0, 4)}•••{k.keyValue.slice(-3)})
                          </option>
                        ))}
                      </select>
                    ) : activeKey ? (
                      <div
                        title={`Saved in AI Settings: ${activeKey.label || selectedEngine}`}
                        className="shrink-0 flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/30 border border-border/60 px-2 py-0.5 rounded-md h-7 select-none"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                        <span className="font-mono text-[10px] truncate max-w-[110px]">
                          {activeKey.label ? `${activeKey.label} • ` : ''}
                          {activeKey.keyValue.slice(0, 4)}•••{activeKey.keyValue.slice(-3)}
                        </span>
                      </div>
                    ) : (
                      <span className="shrink-0 text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md h-7 flex items-center gap-1 font-medium">
                        <AlertCircle className="w-3 h-3" />
                        No Key
                      </span>
                    )}

                    {/* Refresh Live Models Button */}
                    {(selectedEngine === 'gemini' || selectedEngine === 'groq') && effectiveApiKey && (
                      <button
                        type="button"
                        onClick={() => fetchLiveModels(selectedEngine, effectiveApiKey)}
                        disabled={isFetchingModels}
                        title="Reload live models from API"
                        className="shrink-0 h-7 w-7 flex items-center justify-center text-muted-foreground hover:text-foreground rounded-md border border-border/60 hover:bg-muted/40 transition-colors disabled:opacity-50"
                      >
                        <RefreshCw className={cn("w-3 h-3", isFetchingModels && "animate-spin text-teal-600")} />
                      </button>
                    )}
                  </div>

                  {/* Fallback input only if user has no saved key in AI Settings */}
                  {!effectiveApiKey && (
                    <Input
                      type="password"
                      placeholder={`Enter ${selectedEngine.toUpperCase()} API Key (or configure in Settings)...`}
                      value={manualKeyInput}
                      onChange={(e) => setManualKeyInput(e.target.value)}
                      className="h-7 text-[11px] font-mono bg-background"
                    />
                  )}
                </div>
              )}
            </div>

            {/* Simple Tab Switcher */}
            <div className="flex items-center bg-muted/60 p-0.5 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setTab('upload')}
                className={`flex-1 py-1.5 rounded-md font-medium transition-colors ${
                  tab === 'upload' ? 'bg-card text-foreground shadow-2xs font-semibold' : 'text-muted-foreground'
                }`}
              >
                Upload Audio
              </button>
              <button
                type="button"
                onClick={() => setTab('record')}
                className={`flex-1 py-1.5 rounded-md font-medium transition-colors ${
                  tab === 'record' ? 'bg-card text-foreground shadow-2xs font-semibold' : 'text-muted-foreground'
                }`}
              >
                Record Mic
              </button>
              <button
                type="button"
                onClick={() => setTab('paste')}
                className={`flex-1 py-1.5 rounded-md font-medium transition-colors ${
                  tab === 'paste' ? 'bg-card text-foreground shadow-2xs font-semibold' : 'text-muted-foreground'
                }`}
              >
                Paste Notes
              </button>
            </div>

            {/* Tab 1: Upload File */}
            {tab === 'upload' && (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const dropped = e.dataTransfer.files?.[0];
                  if (dropped) setFile(dropped);
                }}
                className={`border-2 border-dashed rounded-xl p-5 text-center transition-colors space-y-2 ${
                  isDragging ? 'border-teal-500 bg-teal-500/10' : 'border-border/80 bg-muted/10'
                }`}
              >
                <input
                  type="file"
                  id="audio-file-input"
                  accept="audio/*,video/mp4"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setFile(f);
                  }}
                  className="hidden"
                />
                <label htmlFor="audio-file-input" className="cursor-pointer block space-y-1.5">
                  <UploadCloud className="w-7 h-7 mx-auto text-teal-600 dark:text-teal-400" />
                  <p className="text-xs font-semibold text-foreground">
                    {file ? file.name : 'Click to select or drag audio file here'}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    MP3, M4A, WAV, AAC, Voice Notes (up to 20MB)
                  </p>
                </label>
                {file && (
                  <div className="pt-2 text-[11px] text-muted-foreground flex items-center justify-center gap-1.5">
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                      {(file.size / (1024 * 1024)).toFixed(1)} MB
                    </Badge>
                    <button
                      type="button"
                      onClick={() => setFile(null)}
                      className="text-destructive hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Mic Recording */}
            {tab === 'record' && (
              <div className="border border-border/80 rounded-xl p-6 text-center bg-muted/10 space-y-3">
                <button
                  type="button"
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`w-12 h-12 rounded-full mx-auto flex items-center justify-center transition-transform active:scale-95 shadow-sm ${
                    isRecording ? 'bg-rose-600 text-white animate-pulse' : 'bg-teal-600 hover:bg-teal-700 text-white'
                  }`}
                >
                  {isRecording ? <Square className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>
                <div className="text-xs font-semibold text-foreground">
                  {isRecording ? (
                    <span className="text-rose-600">
                      Recording: {Math.floor(recordSec / 60)}:{(recordSec % 60).toString().padStart(2, '0')}
                    </span>
                  ) : file ? (
                    <span className="text-emerald-600">Voice recorded ({file.name})</span>
                  ) : (
                    'Click microphone to record'
                  )}
                </div>
              </div>
            )}

            {/* Tab 3: Paste Text */}
            {tab === 'paste' && (
              <Textarea
                placeholder="Paste meeting dialogue, zoom notes, or transcript here..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="min-h-[140px] text-xs font-mono"
              />
            )}

            {/* Attendee Picker */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <User className="w-3 h-3" />
                Attendees
                {modalAttendees.length > 0 && (
                  <span className="normal-case tracking-normal font-normal text-teal-600 dark:text-teal-400">
                    ({modalAttendees.length} added)
                  </span>
                )}
              </p>

              {/* Selected attendee chips */}
              {modalAttendees.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-1">
                  {modalAttendees.map((name) => (
                    <span
                      key={name}
                      className="inline-flex items-center gap-1 text-[11px] bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20 px-2 py-0.5 rounded-full font-medium"
                    >
                      {name}
                      <button
                        type="button"
                        onClick={() => removeAttendee(name)}
                        className="ml-0.5 text-teal-500 hover:text-rose-500 transition-colors leading-none"
                        title="Remove"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Employee picker dropdown + custom text input */}
              <div className="relative">
                <div className="flex gap-1.5">
                  <div className="relative flex-1">
                    <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search employees..."
                      value={attendeeSearch}
                      onChange={(e) => {
                        setAttendeeSearch(e.target.value);
                        setShowAttendeeDropdown(true);
                      }}
                      onFocus={() => setShowAttendeeDropdown(true)}
                      onBlur={() => setTimeout(() => setShowAttendeeDropdown(false), 150)}
                      className="w-full h-8 pl-7 pr-2.5 text-xs bg-background border border-border/70 rounded-md outline-none text-foreground placeholder:text-muted-foreground"
                    />
                    {showAttendeeDropdown && filteredEmployees.length > 0 && (
                      <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-popover border border-border/80 rounded-lg shadow-lg overflow-hidden max-h-40 overflow-y-auto">
                        {filteredEmployees.map((emp) => {
                          const fullName = [emp.firstname, emp.surname].filter(Boolean).join(' ');
                          return (
                            <button
                              key={emp.id}
                              type="button"
                              onMouseDown={() => addAttendee(fullName)}
                              className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent/50 transition-colors flex items-center gap-2"
                            >
                              <span className="w-5 h-5 rounded-full bg-teal-500/20 text-teal-700 dark:text-teal-300 text-[10px] font-bold flex items-center justify-center shrink-0">
                                {(emp.firstname || '?')[0]}
                              </span>
                              <span className="font-medium">{fullName}</span>
                              {emp.position && (
                                <span className="text-[10px] text-muted-foreground ml-auto shrink-0">{emp.position}</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Manual free-text entry */}
                  <div className="flex gap-1">
                    <input
                      type="text"
                      placeholder="Or type name"
                      value={customAttendeeInput}
                      onChange={(e) => setCustomAttendeeInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && customAttendeeInput.trim()) {
                          addAttendee(customAttendeeInput);
                        }
                      }}
                      className="h-8 w-28 px-2.5 text-xs bg-background border border-border/70 rounded-md outline-none text-foreground placeholder:text-muted-foreground"
                    />
                    <button
                      type="button"
                      onClick={() => customAttendeeInput.trim() && addAttendee(customAttendeeInput)}
                      className="h-8 px-2.5 text-xs bg-teal-600 hover:bg-teal-700 text-white rounded-md font-medium transition-colors shrink-0"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>

              {/* Committee Groups Quick Add */}
              {meetingSettings.committeeGroups && meetingSettings.committeeGroups.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                    <Users className="w-2.5 h-2.5 text-teal-600" />
                    Quick Add Group:
                  </span>
                  {meetingSettings.committeeGroups.map((group) => (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => addAttendees(group.memberNames || [])}
                      className="text-[10px] px-2 py-0.5 rounded-full border border-border/80 bg-muted/30 hover:bg-teal-500/10 hover:text-teal-700 dark:hover:text-teal-300 hover:border-teal-500/30 transition-colors flex items-center gap-1 font-medium"
                      title={`Add members: ${(group.memberNames || []).join(', ')}`}
                    >
                      <span>{group.name}</span>
                      <span className="text-[9px] opacity-60">({(group.memberNames || []).length})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

          </div>{/* end scrollable body */}

          {/* ── Sticky Footer ── */}
          <div className="shrink-0 px-5 py-3 border-t border-border/70 bg-card flex items-center justify-end gap-2">

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsOpen(false);
                  setModalAttendees([]);
                  setAttendeeSearch('');
                  setCustomAttendeeInput('');
                }}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleGenerate}
                disabled={isProcessing || (tab === 'paste' ? !text.trim() : !file)}
                className="h-8 px-3.5 text-xs bg-teal-600 hover:bg-teal-700 text-white gap-1.5 shadow-xs"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{statusText || 'Synthesizing...'}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Generate Minute</span>
                  </>
                )}
              </Button>
            </div>
          </div>

        </DialogContent>
      </Dialog>



      {/* Task Detail Sheet for viewing live HR task progress */}
      <TaskDetailSheet
        subtaskId={viewingTaskId}
        onClose={() => setViewingTaskId(null)}
      />

      {/* Discard Confirmation Dialog */}
      <Dialog open={isDiscardDialogOpen} onOpenChange={setIsDiscardDialogOpen}>
        <DialogContent className="max-w-sm p-5 space-y-4">
          <DialogHeader className="p-0 space-y-1.5">
            <DialogTitle className="text-sm font-bold flex items-center gap-2 text-destructive">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
              Discard Unsaved Changes?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
              You have unsaved changes in this minute. Discarding will lose all modifications made during this editing session.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsDiscardDialogOpen(false)}
              className="h-8 text-xs border-border/80"
            >
              Keep Editing
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={executeCancel}
              className="h-8 text-xs gap-1.5 shadow-xs"
            >
              <Trash2 className="w-3 h-3" />
              <span>Discard Changes</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Meeting Settings Quick-Access Modal */}
      <MeetingSettingsModal
        open={isMeetingSettingsOpen}
        onOpenChange={setIsMeetingSettingsOpen}
      />
    </div>
  );
}

export default Minute;
