/**
 * Voice Alert Service
 *
 * Provides cross-platform speech synthesis:
 * 1. Web Speech API (window.speechSynthesis) with Chromium GC bug workaround.
 * 2. Electron fallback via native Windows System.Speech SAPI (guaranteed audio even when Chromium voices fail).
 * 3. Session throttling, audio chimes, volume/gender tone customization.
 */

export interface VoiceAlertSettings {
  enabled: boolean;
  sessionBriefing: boolean;
  realtimeAlerts: boolean;
  volume: number;        // 0.0 to 1.0
  rate: number;          // 0.8 to 1.2
  voiceGender: 'female' | 'male' | 'default';
  voiceName?: string;    // specific selected voice name/URI
}

export const DEFAULT_VOICE_SETTINGS: VoiceAlertSettings = {
  enabled: false,         // Opt-in by default
  sessionBriefing: true,
  realtimeAlerts: true,
  volume: 0.85,
  rate: 1.0,
  voiceGender: 'female',
  voiceName: '',
};

const STORAGE_KEY = 'dcel_voice_alert_settings';
const SPOKEN_HISTORY_KEY = 'dcel_voice_spoken_keys';

// Keep reference to prevent garbage collection halting speech in Chromium
let activeUtterance: SpeechSynthesisUtterance | null = null;
let audioContextInstance: AudioContext | null = null;

export function getStoredVoiceSettings(): VoiceAlertSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_VOICE_SETTINGS;
    return { ...DEFAULT_VOICE_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_VOICE_SETTINGS;
  }
}

export function saveVoiceSettings(settings: Partial<VoiceAlertSettings>): VoiceAlertSettings {
  const current = getStoredVoiceSettings();
  const updated = { ...current, ...settings };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('voice-settings-changed', { detail: updated }));
  } catch {}
  return updated;
}

/** Plays a crisp, audible notification chime before speaking */
export async function playChime(volume = 0.85): Promise<void> {
  return new Promise((resolve) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) {
        resolve();
        return;
      }
      if (!audioContextInstance || audioContextInstance.state === 'closed') {
        audioContextInstance = new AudioCtx();
      }

      const ctx = audioContextInstance;
      const play = () => {
        const now = ctx.currentTime;
        const gainLevel = Math.max(0.25, Math.min(1.0, volume)) * 0.7; // Clearly audible volume

        // Tone 1: 587.33 Hz (D5)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(587.33, now);
        gain1.gain.setValueAtTime(gainLevel, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.22);

        // Tone 2: 880 Hz (A5)
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(880, now + 0.09);
        gain2.gain.setValueAtTime(0.001, now);
        gain2.gain.setValueAtTime(gainLevel * 0.9, now + 0.09);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.09);
        osc2.stop(now + 0.4);

        setTimeout(resolve, 380);
      };

      if (ctx.state === 'suspended') {
        ctx.resume().then(play).catch(() => resolve());
      } else {
        play();
      }
    } catch {
      resolve();
    }
  });
}

/** Check if this utterance has already been spoken recently (throttling) */
function isSpokenRecently(dedupeKey: string, cooldownMs = 30 * 60 * 1000): boolean {
  try {
    const raw = sessionStorage.getItem(SPOKEN_HISTORY_KEY);
    const history: Record<string, number> = raw ? JSON.parse(raw) : {};
    const now = Date.now();
    if (history[dedupeKey] && now - history[dedupeKey] < cooldownMs) {
      return true;
    }
    history[dedupeKey] = now;
    sessionStorage.setItem(SPOKEN_HISTORY_KEY, JSON.stringify(history));
    return false;
  } catch {
    return false;
  }
}

let currentUtteranceId = 0;

export async function speakAlert(
  text: string, 
  options: {
    dedupeKey?: string;
    cooldownMs?: number;
    force?: boolean;
    withChime?: boolean;
  } = {}
): Promise<boolean> {
  const settings = getStoredVoiceSettings();
  if (!settings.enabled && !options.force) {
    return false;
  }

  if (options.dedupeKey && !options.force) {
    if (isSpokenRecently(options.dedupeKey, options.cooldownMs)) {
      return false;
    }
  }

  // Cancel any ongoing speech immediately so utterances never overlap
  stopSpeech();
  const thisUtteranceId = ++currentUtteranceId;

  const shouldChime = options.withChime !== false;

  // Check if running in Electron with native Windows Speech support
  const electronAPI = (window as any).electronAPI;
  if (electronAPI?.speakNative) {
    try {
      const res = await electronAPI.speakNative({
        text,
        voiceGender: settings.voiceGender,
        voiceName: settings.voiceName || '',
        volume: Math.round(settings.volume * 100),
        rate: settings.rate,
        withChime: shouldChime,
      });
      if (res?.success) return true;
    } catch (err) {
      console.warn('Native speech failed, falling back to Web Speech API:', err);
    }
  }

  // Fallback to browser SpeechSynthesis
  if (shouldChime) {
    await playChime(settings.volume);
  }

  // Check if another utterance started while chiming
  if (thisUtteranceId !== currentUtteranceId) {
    return false;
  }

  if (!('speechSynthesis' in window)) {
    return false;
  }

  return new Promise((resolve) => {
    try {
      window.speechSynthesis.cancel(); // Stop any pending utterances

      const utterance = new SpeechSynthesisUtterance(text);
      activeUtterance = utterance; // Prevent GC
      utterance.volume = settings.volume;
      utterance.rate = Math.min(Math.max(settings.rate * 0.98, 0.7), 1.3);
      utterance.pitch = 1.0; // Natural conversational human pitch

      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        let chosenVoice: SpeechSynthesisVoice | undefined;

        // 1. Exact user choice if specified
        if (settings.voiceName) {
          chosenVoice = voices.find(v => v.name === settings.voiceName || v.voiceURI === settings.voiceName);
        }

        // 2. Otherwise auto-select the best natural voice by gender
        if (!chosenVoice) {
          const naturalKeywords = ['natural', 'neural', 'online', 'google', 'aria', 'jenny'];
          if (settings.voiceGender === 'female') {
            chosenVoice = 
              voices.find(v => v.lang.startsWith('en') && naturalKeywords.some(k => v.name.toLowerCase().includes(k)) && !v.name.toLowerCase().includes('male')) ||
              voices.find(v => v.lang.startsWith('en') && (v.name.includes('Zira') || v.name.includes('Female') || v.name.includes('Samantha'))) ||
              voices.find(v => v.lang.startsWith('en'));
          } else if (settings.voiceGender === 'male') {
            chosenVoice = 
              voices.find(v => v.lang.startsWith('en') && naturalKeywords.some(k => v.name.toLowerCase().includes(k)) && (v.name.toLowerCase().includes('male') || v.name.toLowerCase().includes('guy') || v.name.toLowerCase().includes('david'))) ||
              voices.find(v => v.lang.startsWith('en') && (v.name.includes('David') || v.name.includes('Male') || v.name.includes('George') || v.name.includes('Mark'))) ||
              voices.find(v => v.lang.startsWith('en'));
          }
        }
        if (chosenVoice) utterance.voice = chosenVoice;
      }

      utterance.onend = () => {
        activeUtterance = null;
        resolve(true);
      };

      utterance.onerror = () => {
        activeUtterance = null;
        resolve(false);
      };

      window.speechSynthesis.speak(utterance);
    } catch {
      resolve(false);
    }
  });
}

/** Instantly stops any ongoing voice speech across Electron (native SAPI) and Web Speech API */
export function stopSpeech(): void {
  try {
    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.stopSpeechNative) {
      electronAPI.stopSpeechNative().catch(() => {});
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    activeUtterance = null;
  } catch {}
}

export interface BriefingResult {
  speechText: string;
  hasContent: boolean;
  key: string;
  counts: {
    siteInvoicesOverdue: number;
    siteInvoicesDueToday: number;
    siteInvoicesDueSoon: number;
    regularOverdue: number;
    refillsToday: number;
    refillsTomorrow: number;
  };
}

function formatEnglishList(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]}, and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

/**
 * Builds the executive audio briefing text for startup or on-demand listening.
 * Covers:
 * 1. Active site invoices overdue / overrun
 * 2. Active site invoices due today
 * 3. Active site invoices due within 2 days heads up
 * 4. General client invoices overdue
 * 5. Diesel refills needed TODAY and TOMORROW
 */
export function generateBriefingText(
  alerts: Array<{ id: string; text: string; category?: string }>,
  userName = 'Director'
): BriefingResult {
  const siteInvoicesOverdue = alerts.filter(a => a.id.startsWith('site-inv-overdue-'));
  const siteInvoicesDueToday = alerts.filter(a => a.id.startsWith('site-inv-due-today-'));
  const siteInvoicesDueSoon = alerts.filter(a => a.id.startsWith('site-inv-due-soon-'));
  const regularOverdue = alerts.filter(a => a.id.startsWith('inv-ov-'));

  const refillsToday = alerts.filter(a => a.category === 'operations' && a.id.startsWith('refill-today-'));
  const refillsTomorrow = alerts.filter(a => a.category === 'operations' && a.id.startsWith('refill-tom-'));

  const parts: string[] = [];

  const extractName = (text: string, pattern: RegExp) => {
    const m = text.match(pattern);
    return m ? m[1].trim() : '';
  };

  // 1. Overdue Site Invoices
  const countSiteOverdue = siteInvoicesOverdue.length;
  if (countSiteOverdue > 0) {
    if (countSiteOverdue === 1) {
      const siteName = extractName(siteInvoicesOverdue[0].text, /Overdue:\s*([^(]+)/);
      parts.push(siteName ? `1 active site invoice overdue for ${siteName}` : `1 active site invoice overdue`);
    } else if (countSiteOverdue === 2) {
      const name1 = extractName(siteInvoicesOverdue[0].text, /Overdue:\s*([^(]+)/);
      const name2 = extractName(siteInvoicesOverdue[1].text, /Overdue:\s*([^(]+)/);
      if (name1 && name2) {
        parts.push(`2 active site invoices overdue for ${name1} and ${name2}`);
      } else {
        parts.push(`2 active site invoices overdue`);
      }
    } else {
      parts.push(`${countSiteOverdue} active site invoices overdue`);
    }
  }

  // 2. Site Invoices Due Today
  const countDueToday = siteInvoicesDueToday.length;
  if (countDueToday > 0) {
    if (countDueToday === 1) {
      const siteName = extractName(siteInvoicesDueToday[0].text, /Today:\s*([^(]+)/);
      parts.push(siteName ? `1 site invoice due today for ${siteName}` : `1 site invoice due today`);
    } else {
      parts.push(`${countDueToday} site invoices due today`);
    }
  }

  // 3. Site Invoices Due within 2 Days Heads Up
  const countDueSoon = siteInvoicesDueSoon.length;
  if (countDueSoon > 0) {
    if (countDueSoon === 1) {
      const siteName = extractName(siteInvoicesDueSoon[0].text, /in [^:]+:\s*([^(]+)/) || extractName(siteInvoicesDueSoon[0].text, /Due [^:]+:\s*([^(]+)/);
      parts.push(siteName ? `1 site invoice due within 2 days heads up for ${siteName}` : `1 site invoice due within 2 days heads up`);
    } else {
      parts.push(`${countDueSoon} site invoices due within 2 days heads up`);
    }
  }

  // 4. Other Standard Client Overdue Invoices
  const countRegOverdue = regularOverdue.length;
  if (countRegOverdue > 0) {
    parts.push(countRegOverdue === 1 ? `1 general client invoice overdue` : `${countRegOverdue} general client invoices overdue`);
  }

  // 5. Diesel Refills for TODAY and TOMORROW
  const countRefillsToday = refillsToday.length;
  const countRefillsTom = refillsTomorrow.length;

  if (countRefillsToday > 0 && countRefillsTom > 0) {
    parts.push(
      `${countRefillsToday} machine${countRefillsToday === 1 ? '' : 's'} due for diesel refill today, and ${countRefillsTom} due tomorrow`
    );
  } else if (countRefillsToday > 0) {
    parts.push(`${countRefillsToday} machine${countRefillsToday === 1 ? '' : 's'} due for diesel refill today`);
  } else if (countRefillsTom > 0) {
    parts.push(`${countRefillsTom} machine${countRefillsTom === 1 ? '' : 's'} due for diesel refill tomorrow`);
  }

  if (parts.length === 0) {
    return {
      speechText: '',
      hasContent: false,
      key: '',
      counts: {
        siteInvoicesOverdue: 0,
        siteInvoicesDueToday: 0,
        siteInvoicesDueSoon: 0,
        regularOverdue: 0,
        refillsToday: 0,
        refillsTomorrow: 0,
      }
    };
  }

  const formattedItems = formatEnglishList(parts);
  const speechText = `Good day ${userName}. You have ${formattedItems}.`;
  const key = `${countSiteOverdue}-${countDueToday}-${countDueSoon}-${countRegOverdue}-${countRefillsToday}-${countRefillsTom}`;

  return {
    speechText,
    hasContent: true,
    key,
    counts: {
      siteInvoicesOverdue: countSiteOverdue,
      siteInvoicesDueToday: countDueToday,
      siteInvoicesDueSoon: countDueSoon,
      regularOverdue: countRegOverdue,
      refillsToday: countRefillsToday,
      refillsTomorrow: countRefillsTom,
    }
  };
}

