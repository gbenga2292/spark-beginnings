import { getWorkspaceAiKey, fileToBase64, detectProvider } from './aiImportService';

export interface ExtractedBusinessCardData {
  name: string;
  position: string;
  company: string;
  category: 'Client' | 'Vendor' | 'Partner' | 'Contractor' | 'Government' | 'Other';
  phone: string;
  phones: string[];
  email: string;
  emails: string[];
  address: string;
  addresses: string[];
  note: string;
  tags: string[];
  website?: string;
  cardImageUrl?: string;
}

const BUSINESS_CARD_EXTRACTION_PROMPT = `You are an expert AI business card scanner and data extraction assistant.
Extract all relevant contact details from this business card image with absolute precision.

Return ONLY a valid JSON object matching the following structure exactly (no markdown formatting, no code fences, no explanations):
{
  "name": "Full Name of person",
  "position": "Job Title or Position",
  "company": "Company or Organization Name",
  "category": "Client",
  "phones": ["+234...", "+234..."],
  "emails": ["example@company.com"],
  "addresses": ["123 Main Street, Victoria Island, Lagos, Nigeria"],
  "website": "www.example.com",
  "note": "Any additional information found on the card (slogan, services, registration number, RC number, social handles, etc.)",
  "tags": ["Executive", "Engineering"]
}

Guidelines:
1. "category": Choose the most fitting from: "Client", "Vendor", "Partner", "Contractor", "Government", "Other". Default to "Client".
2. "phones": Extract ALL phone numbers visible (mobile, office, WhatsApp, fax).
3. "emails": Extract ALL email addresses visible.
4. "addresses": Extract ALL physical or mailing addresses visible.
5. "name": The actual personal name of the contact person (not just the company name).
6. "company": The organization or business entity.
7. "position": The professional title (e.g. Managing Director, Principal Engineer, Sales Manager).
8. "note": Include useful notes such as website, RC number, branches, or specialties.
9. "tags": Add 1 to 3 short relevant tags.
10. If any field is not found on the card, return an empty string "" or empty array [].`;

/** Call Gemini Vision API */
async function callGeminiVision(
  apiKey: string,
  base64Data: string,
  mimeType: string,
  model: string = 'gemini-2.0-flash'
): Promise<string> {
  const activeModel = model.includes('gemini') ? model : 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: 'You are a specialized business card OCR and parser. Output ONLY valid raw JSON with no markdown wrapping.' }]
      },
      contents: [
        {
          parts: [
            { text: BUSINESS_CARD_EXTRACTION_PROMPT },
            { inlineData: { mimeType, data: base64Data } }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json'
      }
    })
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`Gemini API error (${res.status}): ${errorText || res.statusText}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

/** Call OpenAI Vision API */
async function callOpenAiVision(
  apiKey: string,
  base64Data: string,
  mimeType: string,
  model: string = 'gpt-4o-mini'
): Promise<string> {
  const activeModel = model.includes('gpt') ? model : 'gpt-4o-mini';
  const dataUrl = `data:${mimeType};base64,${base64Data}`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: activeModel,
      messages: [
        {
          role: 'system',
          content: 'You are a specialized business card OCR and parser. Output ONLY valid raw JSON.'
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: BUSINESS_CARD_EXTRACTION_PROMPT },
            { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } }
          ]
        }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    })
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`OpenAI API error (${res.status}): ${errorText || res.statusText}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

/** Sanitize and parse JSON result into structured business card contact */
function parseExtractionJson(rawText: string): ExtractedBusinessCardData {
  let cleaned = rawText.trim();
  // Strip code fences if present
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }

  const startIdx = cleaned.indexOf('{');
  const endIdx = cleaned.lastIndexOf('}');
  if (startIdx === -1 || endIdx === -1) {
    throw new Error('AI was unable to locate contact details in the image. Please make sure the business card is clearly visible and well-lit.');
  }

  const jsonStr = cleaned.slice(startIdx, endIdx + 1);
  const parsed = JSON.parse(jsonStr);

  const phones: string[] = Array.isArray(parsed.phones)
    ? parsed.phones.map((p: any) => String(p).trim()).filter(Boolean)
    : parsed.phone ? [String(parsed.phone).trim()] : [];

  const emails: string[] = Array.isArray(parsed.emails)
    ? parsed.emails.map((e: any) => String(e).trim()).filter(Boolean)
    : parsed.email ? [String(parsed.email).trim()] : [];

  const addresses: string[] = Array.isArray(parsed.addresses)
    ? parsed.addresses.map((a: any) => String(a).trim()).filter(Boolean)
    : parsed.address ? [String(parsed.address).trim()] : [];

  const tags: string[] = Array.isArray(parsed.tags)
    ? parsed.tags.map((t: any) => String(t).trim()).filter(Boolean)
    : [];

  const validCategories = ['Client', 'Vendor', 'Partner', 'Contractor', 'Government', 'Other'] as const;
  const category = validCategories.includes(parsed.category) ? parsed.category : 'Client';

  return {
    name: String(parsed.name || '').trim(),
    position: String(parsed.position || '').trim(),
    company: String(parsed.company || '').trim(),
    category,
    phone: phones[0] || '',
    phones,
    email: emails[0] || '',
    emails,
    address: addresses[0] || '',
    addresses,
    website: String(parsed.website || '').trim(),
    note: [
      parsed.website ? `Website: ${parsed.website}` : null,
      parsed.note ? String(parsed.note).trim() : null
    ].filter(Boolean).join('\n'),
    tags
  };
}

/**
 * Scan a business card image (File or base64 Data URL) using the configured workspace AI
 */
export async function scanBusinessCardWithAI(
  imageSource: File | string,
  onProgress?: (message: string) => void
): Promise<ExtractedBusinessCardData> {
  onProgress?.('Retrieving active AI settings from workspace...');
  const keyConfig = await getWorkspaceAiKey();

  if (!keyConfig || !keyConfig.apiKey) {
    throw new Error(
      'No AI API key found. Please navigate to Settings > AI Settings and configure an API key (e.g. Google Gemini or OpenAI) to enable business card scanning.'
    );
  }

  onProgress?.('Preparing business card image...');
  let base64Data = '';
  let mimeType = 'image/jpeg';
  let dataUrl = '';

  if (typeof imageSource === 'string') {
    // String might be a base64 Data URL or raw base64
    if (imageSource.startsWith('data:')) {
      dataUrl = imageSource;
      const parts = imageSource.split(',');
      const match = imageSource.match(/data:([^;]+);/);
      if (match) mimeType = match[1];
      base64Data = parts[1] || '';
    } else {
      base64Data = imageSource;
      dataUrl = `data:${mimeType};base64,${base64Data}`;
    }
  } else {
    base64Data = await fileToBase64(imageSource);
    mimeType = imageSource.type || 'image/jpeg';
    dataUrl = `data:${mimeType};base64,${base64Data}`;
  }

  const detected = detectProvider(keyConfig.apiKey);
  const provider = keyConfig.provider || (detected !== 'unknown' ? detected : 'gemini');
  const model = keyConfig.model || (provider === 'gemini' ? 'gemini-2.0-flash' : 'gpt-4o-mini');

  onProgress?.(`Analyzing card image with ${provider.toUpperCase()} AI (${model})...`);

  let rawJson = '';
  if (provider === 'gemini') {
    rawJson = await callGeminiVision(keyConfig.apiKey, base64Data, mimeType, model);
  } else if (provider === 'openai') {
    rawJson = await callOpenAiVision(keyConfig.apiKey, base64Data, mimeType, model);
  } else {
    // For other providers, try Gemini if key format allows, or OpenAI
    if (keyConfig.apiKey.startsWith('AIza') || keyConfig.apiKey.startsWith('AQ.')) {
      rawJson = await callGeminiVision(keyConfig.apiKey, base64Data, mimeType, 'gemini-2.0-flash');
    } else if (keyConfig.apiKey.startsWith('sk-')) {
      rawJson = await callOpenAiVision(keyConfig.apiKey, base64Data, mimeType, 'gpt-4o-mini');
    } else {
      throw new Error(`AI Provider "${provider}" does not currently support image vision extraction. Please use a Google Gemini or OpenAI key in Settings > AI Settings.`);
    }
  }

  onProgress?.('Extracting contact fields and formatting...');
  const result = parseExtractionJson(rawJson);
  result.cardImageUrl = dataUrl;
  return result;
}
