import { supabase } from '@/src/integrations/supabase/client';

export type AiProvider = "auto" | "openai" | "gemini" | "anthropic" | "grok" | "groq" | "unknown";

export interface ExtractedTransaction {
  date: string; // YYYY-MM-DD
  description: string;
  amount: number;
  type: "income" | "expense";
  category: string;
}

/** Detect provider from API key format */
export function detectProvider(apiKey: string): AiProvider {
  const trimmed = apiKey.trim();
  if (trimmed.startsWith("xai-")) return "grok";
  if (trimmed.startsWith("gsk_")) return "groq";
  if (trimmed.startsWith("sk-ant-")) return "anthropic";
  if (trimmed.startsWith("AIza")) return "gemini";
  if (trimmed.startsWith("sk-")) return "openai";
  return "unknown";
}

/** Helper to convert File to base64 string */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Extract text from PDF file client-side using pdfjs-dist */
export async function extractPdfText(
  file: File,
  password?: string,
  onProgress?: (status: string, percentage: number) => void
): Promise<string> {
  onProgress?.("Reading PDF file buffer...", 10);
  const buffer = await file.arrayBuffer();
  const uint8 = new Uint8Array(buffer);

  // Dynamically import pdfjs-dist
  onProgress?.("Initializing PDF decryption worker...", 15);
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

  let pdf;
  try {
    onProgress?.("Decrypting statement...", 20);
    pdf = await pdfjsLib.getDocument({
      data: uint8,
      ...(password ? { password } : {}),
    }).promise;
  } catch (err: any) {
    if (err.name === "PasswordException") {
      throw new Error("PasswordRequiredException");
    }
    throw err;
  }

  const pageTexts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const progressMsg = `Parsing page ${i} of ${pdf.numPages}...`;
    const pct = 25 + Math.round((i / pdf.numPages) * 35);
    onProgress?.(progressMsg, pct);

    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => ("str" in item ? item.str : ""))
      .join(" ");
    pageTexts.push(pageText);
  }

  return pageTexts.join("\n\n--- Page Break ---\n\n");
}

/** Call Gemini API to parse text statement */
async function callGeminiText(apiKey: string, prompt: string, model: string = "gemini-2.0-flash"): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{
            text:
              "You are a financial data extraction assistant. " +
              "Respond with ONLY raw pipe-separated values (CSV). " +
              "No markdown, no code fences, no headers, no explanations. Just the rows.",
          }],
        },
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0,
        },
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`Gemini error: ${res.statusText}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

/** Call Groq API to parse text statement */
async function callGroqText(apiKey: string, prompt: string, model: string = "llama-3.3-70b-versatile"): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are a financial data extraction assistant. Your output MUST be raw pipe-separated CSV and nothing else. " +
            "Do NOT wrap in markdown code fences. Do NOT add explanatory text or headers. " +
            "Extract ALL transactions — do not stop early or summarize. Include every single row.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0,
    }),
  });

  if (!res.ok) {
    throw new Error(`Groq error: ${res.statusText}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

/** Extract transactions from pipe-separated CSV text */
function parseCsvRows(raw: string): ExtractedTransaction[] {
  const stripped = raw
    .replace(/```csv\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  const lines = stripped.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  const transactions: ExtractedTransaction[] = [];

  for (const line of lines) {
    if (line.toLowerCase().includes("merchant") || line.toLowerCase().includes("date|") || line.toLowerCase().includes("description")) {
      continue;
    }

    const parts = line.split("|").map(p => p.trim());
    if (parts.length >= 5) {
      const [date, desc, amountStr, typeStr, category] = parts;
      const amount = Math.abs(Number(amountStr.replace(/[^0-9.-]+/g, "")));
      const type = typeStr.toLowerCase() === "income" ? "income" : "expense";
      
      if (date && desc && !isNaN(amount)) {
        transactions.push({
          date,
          description: desc,
          amount,
          type,
          category: category || "Other",
        });
      }
    }
  }

  return transactions;
}

/** Build the prompt for statement parser */
function buildStatementPrompt(rawText: string, categories: string[]): string {
  return `You are a financial data extraction assistant. I will give you raw text extracted from a bank statement. Your job is to extract every transaction and return them as a pipe-separated CSV.

Rules:
1. Each transaction must be on a new line in this EXACT format:
YYYY-MM-DD|Merchant/Description|Amount|type|category

2. Amount must be a positive number (no currency symbols or commas).
3. Type must be strictly "income" or "expense".
4. Category must be the best-fit from the list of available categories below.
5. Ignore header rows, balance summaries, and non-transaction text.
6. Clean up descriptions/merchant names to be human readable.
7. Do NOT output a header row. ONLY output the data rows. No markdown fences.

Available Categories:
${categories.join(", ")}

Bank statement text:
---
${rawText}
---

Return CSV rows only:`;
}

/** Main entry point for PDF statement text parsing */
export async function parsePdfStatementWithAI(
  file: File,
  apiKey: string,
  categories: string[],
  password?: string,
  model?: string,
  onProgress?: (status: string, percentage: number) => void
): Promise<ExtractedTransaction[]> {
  onProgress?.("Extracting text contents from statement...", 5);
  const rawText = await extractPdfText(file, password, onProgress);
  if (!rawText.trim()) {
    throw new Error("Empty PDF text — it might be a scanned image. Please try the 'Scan Photo' option instead.");
  }

  onProgress?.("Detecting API credentials...", 65);
  const provider = detectProvider(apiKey);
  const prompt = buildStatementPrompt(rawText, categories);

  let response = "";
  if (provider === "gemini") {
    onProgress?.("Uploading statement payload to Gemini...", 75);
    response = await callGeminiText(apiKey, prompt, model || "gemini-2.0-flash");
  } else if (provider === "groq") {
    onProgress?.("Uploading statement payload to Groq...", 75);
    response = await callGroqText(apiKey, prompt, model || "llama-3.3-70b-versatile");
  } else {
    throw new Error(`AI Provider '${provider}' is not supported for text parsing yet. Please use Gemini or Groq.`);
  }

  onProgress?.("AI analysis complete! Generating review list...", 95);
  return parseCsvRows(response);
}

/** AI multimodal statement/receipt image scanner (Gemini exclusive) */
export async function parseImageWithAI(
  file: File,
  apiKey: string,
  categories: string[],
  model?: string,
  onProgress?: (status: string, percentage: number) => void
): Promise<ExtractedTransaction[]> {
  onProgress?.("Reading image file properties...", 15);
  const base64 = await fileToBase64(file);
  const mimeType = file.type || "image/jpeg";

  const prompt = `You are an expert bank statement and receipt data extractor. Extract all transaction details from this image.
Return ONLY valid JSON matching this structure:
{
  "transactions": [
    {
      "type": "expense",
      "date": "YYYY-MM-DD",
      "name": "Merchant/Sender Name",
      "category": "Pick the best category",
      "amount": 12.50
    }
  ]
}

Available categories: ${categories.join(", ")}
Rules:
- If this is money received, set type to "income". If money spent, set type to "expense".
- Amount must be a positive number.
- Name should be the merchant, person, or sender. Clean it up to be human-readable.
- Date MUST be YYYY-MM-DD. Use the most logical recent year if missing.
- Return ONLY JSON. No markdown fences.`;

  const activeModel = model || "gemini-2.0-flash";
  onProgress?.(`Uploading statement image to Gemini (${activeModel})...`, 45);
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: "Return only raw JSON. No markdown." }] },
        contents: [
          {
            parts: [
              { text: prompt },
              { inlineData: { mimeType, data: base64 } }
            ]
          }
        ],
        generationConfig: { temperature: 0 },
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to contact Gemini API: ${res.statusText}`);
  }

  onProgress?.("Parsing scanner OCR responses...", 90);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) {
      throw new Error("No JSON object found in response");
    }
    
    const jsonStr = text.slice(start, end + 1);
    const parsed = JSON.parse(jsonStr) as { transactions: any[] };
    
    if (!Array.isArray(parsed.transactions)) {
      throw new Error("Response does not contain a transactions list.");
    }

    return parsed.transactions.map((tx) => {
      const type = tx.type === "income" ? "income" : "expense";
      return {
        date: tx.date || new Date().toISOString().slice(0, 10),
        description: tx.name || "Image Scan Item",
        amount: Math.abs(Number(tx.amount)) || 0,
        type,
        category: categories.includes(tx.category) ? tx.category : "Other",
      };
    });
  } catch (err) {
    throw new Error("AI returned invalid data format. Please parse another file or fill details manually.");
  }
}
