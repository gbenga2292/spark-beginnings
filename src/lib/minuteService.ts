import { supabase } from '@/src/integrations/supabase/client';
import { getWorkspaceAiKey, fileToBase64 } from '@/src/lib/aiImportService';
import type { MeetingMinute, MeetingActionItem, TranscriptionEngine } from '@/src/types/minute';

export interface MinuteGenerationResult {
  title: string;
  meetingType: 'HR' | 'Management' | 'Departmental' | 'Project' | 'Disciplinary' | 'General';
  chairPerson: string;
  attendees: string[];
  absentees: string[];
  executiveSummary: string;
  agendaTopics: Array<{
    id: string;
    topic: string;
    discussion: string;
    decisions?: string[];
  }>;
  keyDecisions: string[];
  actionItems: MeetingActionItem[];
  rawTranscript: string;
}

const SYSTEM_PROMPT = `You are an elite Executive Assistant and HR Documentation Specialist.
Your job is to transform raw meeting transcripts or meeting audio notes into a succinct, executive-level, professional standard company Meeting Minute.
Return STRICTLY valid JSON with no markdown wrapping, no code fences, no explanations.

The JSON schema must follow:
{
  "title": "Clear, professional meeting title",
  "meetingType": "HR" | "Management" | "Departmental" | "Project" | "Disciplinary" | "General",
  "chairPerson": "Name of host / chair or 'Not specified'",
  "attendees": ["Array of attendee names mentioned or identified"],
  "absentees": ["Array of absent members if mentioned"],
  "executiveSummary": "Succinct 3-5 sentence high-level executive briefing summarizing the essence of the meeting",
  "agendaTopics": [
    {
      "id": "1",
      "topic": "Topic Name",
      "discussion": "Succinct bullet points or cohesive summary of what was discussed",
      "decisions": ["Key conclusion or resolution for this topic"]
    }
  ],
  "keyDecisions": [
    "Formal resolution or key consensus reached 1",
    "Formal resolution or key consensus reached 2"
  ],
  "actionItems": [
    {
      "id": "1",
      "description": "Specific, actionable task description",
      "assigneeName": "Person responsible if identifiable, or empty",
      "dueDate": "YYYY-MM-DD if mentioned, or empty",
      "priority": "low" | "medium" | "high" | "urgent"
    }
  ]
}

Rules:
- Be concise, minimalist, and direct. Avoid rambling or verbatim filler.
- Action items MUST be clearly delineated with measurable outcomes.
- If audio or text is brief, still produce an orderly, complete structure.`;

/** Gladia Async Audio Transcription */
export async function transcribeWithGladia(
  audioFile: File,
  gladiaApiKey: string,
  onProgress?: (status: string) => void
): Promise<string> {
  onProgress?.('Uploading audio to Gladia API...');
  const formData = new FormData();
  formData.append('audio', audioFile);

  const uploadRes = await fetch('https://api.gladia.io/v2/upload', {
    method: 'POST',
    headers: {
      'x-gladia-key': gladiaApiKey,
    },
    body: formData,
  });

  if (!uploadRes.ok) {
    const errData = await uploadRes.json().catch(() => ({}));
    throw new Error(errData.message || `Gladia upload failed: ${uploadRes.statusText}`);
  }

  const { audio_url } = await uploadRes.json();
  onProgress?.('Initiating transcription with speaker diarization...');

  const preRes = await fetch('https://api.gladia.io/v2/pre-recorded', {
    method: 'POST',
    headers: {
      'x-gladia-key': gladiaApiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      audio_url,
      diarization: true,
      summarization: true,
    }),
  });

  if (!preRes.ok) {
    throw new Error(`Gladia pre-recorded transcription request failed: ${preRes.statusText}`);
  }

  const { result_url } = await preRes.json();
  onProgress?.('Transcribing audio (polling results)...');

  // Poll until ready
  let transcript = '';
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const pollRes = await fetch(result_url, {
      headers: { 'x-gladia-key': gladiaApiKey },
    });
    if (pollRes.ok) {
      const pollData = await pollRes.json();
      if (pollData.status === 'done') {
        const utterances = pollData.result?.transcription?.utterances;
        if (utterances && Array.isArray(utterances)) {
          transcript = utterances
            .map((u: any) => `[Speaker ${u.speaker ?? '?'}] (${Math.round(u.start)}s): ${u.text}`)
            .join('\n');
        } else {
          transcript = pollData.result?.transcription?.full_transcript || '';
        }
        break;
      } else if (pollData.status === 'error') {
        throw new Error(pollData.error || 'Gladia processing error');
      }
    }
  }

  if (!transcript) {
    throw new Error('Gladia transcription timed out. Please try again.');
  }

  return transcript;
}

/** Groq Whisper Audio Transcription */
export async function transcribeWithGroqWhisper(
  audioFile: File,
  groqApiKey: string,
  onProgress?: (status: string) => void
): Promise<string> {
  onProgress?.('Transcribing with Groq Whisper-large-v3...');
  const formData = new FormData();
  formData.append('file', audioFile);
  formData.append('model', 'whisper-large-v3');
  formData.append('response_format', 'verbose_json');

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${groqApiKey}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Groq Whisper failed: ${res.statusText}`);
  }

  const data = await res.json();
  if (data.segments && Array.isArray(data.segments)) {
    return data.segments
      .map((s: any) => `[${Math.round(s.start)}s - ${Math.round(s.end)}s]: ${s.text}`)
      .join('\n');
  }
  return data.text || '';
}

const VERIFIED_GEMINI_FALLBACKS = [
  'gemini-3.5-flash',
  'gemini-flash-lite-latest',
  'gemini-3.6-flash',
  'gemini-3.1-flash-lite',
  'gemini-3-flash-preview',
];

function buildGeminiCandidates(requestedModel: string): string[] {
  const list = [requestedModel];
  for (const fb of VERIFIED_GEMINI_FALLBACKS) {
    if (!list.includes(fb)) list.push(fb);
  }
  return list;
}

function extractGeminiText(data: any): string {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const textPart = parts.find((p: any) => p.text && !p.thought) || parts[parts.length - 1] || parts[0];
  return textPart?.text ?? '{}';
}

/** Process Audio with Gemini directly */
export async function processAudioWithGemini(
  audioFile: File,
  geminiApiKey: string,
  model: string = 'gemini-3.6-flash',
  onProgress?: (status: string) => void,
  customPromptGuidelines?: string
): Promise<MinuteGenerationResult> {
  const effectiveSystemPrompt = customPromptGuidelines?.trim()
    ? `${SYSTEM_PROMPT}\n\nOrganization / Custom Meeting Guidelines:\n${customPromptGuidelines.trim()}`
    : SYSTEM_PROMPT;

  // Check file size: Gemini inlineData payload is capped at ~20MB
  const maxInlineBytes = 22 * 1024 * 1024;
  if (audioFile.size > maxInlineBytes) {
    const sizeMb = (audioFile.size / (1024 * 1024)).toFixed(1);
    throw new Error(
      `Audio recording is ${sizeMb}MB. Gemini direct inline API has a 20MB payload limit. For long recordings (e.g. 30-60+ min), please select "NotebookLM Bridge" in the engine options to upload your audio source directly, or compress the audio file.`
    );
  }

  onProgress?.('Encoding audio for Gemini...');
  const base64Data = await fileToBase64(audioFile);

  // Normalize audio MIME type (especially WhatsApp audio files which are often .mp4/.m4a)
  let mimeType = audioFile.type || '';
  const ext = audioFile.name.split('.').pop()?.toLowerCase();
  if (!mimeType || mimeType === 'video/mp4' || mimeType === 'application/octet-stream') {
    if (ext === 'mp3') mimeType = 'audio/mp3';
    else if (ext === 'm4a' || ext === 'mp4' || ext === 'aac') mimeType = 'audio/mp4';
    else if (ext === 'wav') mimeType = 'audio/wav';
    else if (ext === 'ogg' || ext === 'oga' || ext === 'opus') mimeType = 'audio/ogg';
    else if (ext === 'webm') mimeType = 'audio/webm';
    else mimeType = 'audio/mp4';
  }

  const candidateModels = buildGeminiCandidates(model);
  let res: Response | null = null;
  let lastErrorMsg = '';

  for (const m of candidateModels) {
    onProgress?.(`Analyzing speech and synthesizing minutes with ${m}...`);
    try {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: effectiveSystemPrompt }],
            },
            contents: [
              {
                parts: [
                  {
                    inlineData: {
                      mimeType,
                      data: base64Data,
                    },
                  },
                  {
                    text: 'Listen to this meeting recording. Transcribe the dialogue internally and produce a complete, standard structured meeting minute in exact JSON format.',
                  },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.2,
            },
          }),
        }
      );

      if (res.ok) {
        break;
      }

      const err = await res.json().catch(() => ({}));
      lastErrorMsg = err.error?.message || `${res.status} ${res.statusText}`;

      if (res.status === 413 || lastErrorMsg.toLowerCase().includes('payload') || lastErrorMsg.toLowerCase().includes('too large')) {
        throw new Error('Audio file payload exceeded Gemini size limits. Please select "NotebookLM Bridge" to analyze this long meeting audio.');
      }

      if (
        res.status >= 500 ||
        res.status === 404 ||
        res.status === 400 ||
        res.status === 429 ||
        lastErrorMsg.toLowerCase().includes('capacity') ||
        lastErrorMsg.toLowerCase().includes('demand') ||
        lastErrorMsg.toLowerCase().includes('overloaded') ||
        lastErrorMsg.toLowerCase().includes('unavailable') ||
        lastErrorMsg.toLowerCase().includes('not found') ||
        lastErrorMsg.toLowerCase().includes('not supported')
      ) {
        console.warn(`Model ${m} returned ${res.status} (${lastErrorMsg}). Retrying fallback model...`);
        onProgress?.(`Google model ${m} is temporarily busy (${res.status}). Switching to stable model...`);
        await new Promise((r) => setTimeout(r, 400));
        continue;
      } else {
        throw new Error(lastErrorMsg || `Gemini audio processing failed (${res.status}): ${res.statusText}`);
      }
    } catch (e: any) {
      if (e.message?.includes('payload') || e.message?.includes('exceeded')) throw e;
      lastErrorMsg = e.message;
    }
  }

  if (!res || !res.ok) {
    throw new Error(
      `Google Gemini is temporarily overloaded for this model (${lastErrorMsg || '503 Service Unavailable'}). Please try "Gemini 3.6 Flash" or select Groq as your AI Engine.`
    );
  }

  const data = await res.json();
  const rawText = extractGeminiText(data);
  return parseMinuteJson(rawText, 'Audio processed directly via Gemini.');
}

/** Synthesize Minute from raw text/transcript using LLM (Gemini, Groq, etc.) */
export async function generateMinuteFromText(
  transcriptText: string,
  engine: 'gemini' | 'groq' | 'gladia' | 'notebooklm',
  options?: {
    geminiKey?: string;
    groqKey?: string;
    model?: string;
    customPromptGuidelines?: string;
  },
  onProgress?: (status: string) => void
): Promise<MinuteGenerationResult> {
  onProgress?.(`Structuring meeting minutes using ${engine.toUpperCase()}...`);

  const effectiveSystemPrompt = options?.customPromptGuidelines?.trim()
    ? `${SYSTEM_PROMPT}\n\nOrganization / Custom Meeting Guidelines:\n${options.customPromptGuidelines.trim()}`
    : SYSTEM_PROMPT;

  // If engine is Groq or Gemini:
  if (engine === 'groq' && options?.groqKey) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: options.model || 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: effectiveSystemPrompt },
          {
            role: 'user',
            content: `Here is the meeting text/transcript. Extract standard corporate meeting minutes:\n\n${transcriptText}`,
          },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) {
      throw new Error(`Groq LLM failed: ${res.statusText}`);
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || '{}';
    return parseMinuteJson(raw, transcriptText);
  }

  // Default to Gemini for text structuring
  const geminiKey = options?.geminiKey;
  if (!geminiKey) {
    throw new Error('Gemini API key is required to structure this transcript.');
  }

  const initialModel = options?.model || 'gemini-3.6-flash';
  const candidateModels = buildGeminiCandidates(initialModel);

  let res: Response | null = null;
  let lastErrorMsg = '';

  for (const m of candidateModels) {
    onProgress?.(`Structuring meeting minutes using ${m}...`);
    try {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: effectiveSystemPrompt }] },
            contents: [
              {
                parts: [
                  {
                    text: `Here is the meeting text/transcript. Transform it into a pristine, succinct executive minute:\n\n${transcriptText}`,
                  },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.2,
            },
          }),
        }
      );

      if (res.ok) {
        break;
      }

      const errJson = await res.json().catch(() => ({}));
      lastErrorMsg = errJson.error?.message || `${res.status} ${res.statusText}`;

      if (res.status === 503 || res.status === 404 || res.status === 429 || lastErrorMsg.toLowerCase().includes('capacity') || lastErrorMsg.toLowerCase().includes('overloaded')) {
        console.warn(`Model ${m} returned ${res.status} (${lastErrorMsg}). Retrying with fallback model...`);
        onProgress?.(`Google model ${m} is currently busy (${res.status}). Switching to verified model...`);
        await new Promise((r) => setTimeout(r, 600));
        continue;
      } else {
        throw new Error(lastErrorMsg || `Gemini LLM failed (${res.status}): ${res.statusText}`);
      }
    } catch (e: any) {
      if (e.message?.includes('API key')) throw e;
      lastErrorMsg = e.message;
    }
  }

  if (!res || !res.ok) {
    throw new Error(
      `Google Gemini is temporarily overloaded for this model (${lastErrorMsg || '503 Service Unavailable'}). Please try "Gemini 3.6 Flash" or select Groq as your AI Engine.`
    );
  }

  const data = await res.json();
  const rawText = extractGeminiText(data);
  return parseMinuteJson(rawText, transcriptText);
}

function parseMinuteJson(jsonStr: string, originalTranscript: string): MinuteGenerationResult {
  const cleaned = jsonStr
    .replace(/^```json\s*/gi, '')
    .replace(/^```\s*/gi, '')
    .replace(/\s*```$/gi, '')
    .trim();

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    console.error('Failed to parse JSON minute output:', cleaned);
    throw new Error('The AI response was not formatted in standard JSON. Please retry or adjust transcript.');
  }

  return {
    title: parsed.title || 'Executive Meeting Minute',
    meetingType: parsed.meetingType || 'HR',
    chairPerson: parsed.chairPerson || 'HR Chairperson',
    attendees: Array.isArray(parsed.attendees) ? parsed.attendees : [],
    absentees: Array.isArray(parsed.absentees) ? parsed.absentees : [],
    executiveSummary: parsed.executiveSummary || '',
    agendaTopics: Array.isArray(parsed.agendaTopics)
      ? parsed.agendaTopics.map((a: any, idx: number) => ({
          id: String(idx + 1),
          topic: a.topic || `Agenda Item ${idx + 1}`,
          discussion: a.discussion || '',
          decisions: Array.isArray(a.decisions) ? a.decisions : [],
        }))
      : [],
    keyDecisions: Array.isArray(parsed.keyDecisions) ? parsed.keyDecisions : [],
    actionItems: Array.isArray(parsed.actionItems)
      ? parsed.actionItems.map((item: any, idx: number) => ({
          id: String(idx + 1),
          description: item.description || 'Action item',
          assigneeName: item.assigneeName || '',
          dueDate: item.dueDate || '',
          priority: ['low', 'medium', 'high', 'urgent'].includes(item.priority) ? item.priority : 'medium',
          selected: true,
        }))
      : [],
    rawTranscript: originalTranscript,
  };
}
