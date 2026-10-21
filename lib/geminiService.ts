import { TranscriptMessage, ChatResponse, CallAnalysisResult, CallClassification } from './types';
import { generateLocalSalesReply, generateLocalCallAnalysis } from './salesLogic';
import { SALES_SYSTEM_PROMPT } from './knowledge';

const VALID_STATUSES: CallClassification[] = [
  'Converted',
  'Interested',
  'Follow-up Required',
  'Not Interested',
  'Demo Requested',
  'No Response'
];

// Forbidden phrases claiming actions already executed (must only state 'our team will follow up/confirm')
const FORBIDDEN_CLAIMS_REGEX = /\b(booked|signed up|activated|sent you|has been sent|have been sent|we('ve| have) sent|i('ve| have) sent|scheduled your|booked your|activated your|signed you up|registered you)\b|भेज दिया|बुक कर दिया|शुरू कर दिया/i;

function getApiKey(): string | undefined {
  return process.env.GEMINI_API_KEY;
}

function getModelName(): string {
  return process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
}

export async function getSalesReply(transcript: TranscriptMessage[]): Promise<ChatResponse> {
  const apiKey = getApiKey();
  // If no Gemini key is provided, use guaranteed ₹0 local fallback immediately
  if (!apiKey) {
    return generateLocalSalesReply(transcript);
  }

  try {
    const model = getModelName();
    const systemInstruction = {
      parts: [
        {
          text: `${SALES_SYSTEM_PROMPT}

# RESPONSE FORMAT INSTRUCTIONS
You are speaking live on a phone call.
Respond ONLY in valid JSON matching this exact structure:
{
  "reply": "spoken text here",
  "shouldEndCall": false,
  "classificationSuggestion": "Interested"
}
Rules for JSON fields:
- "reply": 1 to 3 short sentences, spoken-style plain text ONLY. Absolutely NO markdown (no asterisks, bold, hashes), NO bullet points, NO emojis.
- "classificationSuggestion": MUST be one of: "Converted", "Interested", "Follow-up Required", "Not Interested", "Demo Requested", "No Response".
- "shouldEndCall": boolean. Set to true ONLY when closing the call (e.g. after customer says not interested, or after polite parting).`
        }
      ]
    };

    // Build alternating conversation history: customer = user, Alex = model
    const rawTurns: { role: 'user' | 'model'; text: string }[] = [];

    // If the very first utterance is from Alex/bot, Gemini requires the multiturn conversation to start with a 'user' turn
    if (transcript.length > 0 && transcript[0].sender === 'bot') {
      rawTurns.push({ role: 'user', text: '[Incoming sales call connected]' });
    }

    for (const msg of transcript) {
      const role = msg.sender === 'customer' ? 'user' : 'model';
      rawTurns.push({ role, text: msg.text });
    }

    // Ensure strictly alternating roles by combining consecutive turns of the same role
    const contents: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];
    for (const turn of rawTurns) {
      if (contents.length > 0 && contents[contents.length - 1].role === turn.role) {
        contents[contents.length - 1].parts[0].text += `\n${turn.text}`;
      } else {
        contents.push({ role: turn.role, parts: [{ text: turn.text }] });
      }
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction,
        contents,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.3,
        }
      }),
      signal: AbortSignal.timeout(6000)
    });

    if (!response.ok) {
      // 429 rate limit or any non-OK status: silently fall back to local sales engine
      return generateLocalSalesReply(transcript);
    }

    const data = await response.json();
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) {
      return generateLocalSalesReply(transcript);
    }

    let parsed: any;
    try {
      parsed = JSON.parse(candidateText);
    } catch {
      return generateLocalSalesReply(transcript);
    }

    const reply = (parsed.reply || parsed.text || '').trim();

    // Guardrail 1: reply must not be empty
    if (!reply || reply.length === 0) {
      return generateLocalSalesReply(transcript);
    }

    // Guardrail 2: reply must not exceed ~600 characters
    if (reply.length > 600) {
      return generateLocalSalesReply(transcript);
    }

    // Guardrail 3: reply must not contain markdown or bullet points
    const hasMarkdownOrBullets = /[*_#`~]|^\s*[-*•]\s|\n\s*[-*•]\s/m.test(reply);
    if (hasMarkdownOrBullets) {
      return generateLocalSalesReply(transcript);
    }

    // Guardrail 4: reply must not claim anything was sent, booked, signed up, or activated
    if (FORBIDDEN_CLAIMS_REGEX.test(reply)) {
      return generateLocalSalesReply(transcript);
    }

    let classificationSuggestion: CallClassification | undefined = undefined;
    if (parsed.classificationSuggestion && VALID_STATUSES.includes(parsed.classificationSuggestion)) {
      classificationSuggestion = parsed.classificationSuggestion;
    }

    return {
      reply,
      shouldEndCall: Boolean(parsed.shouldEndCall),
      classificationSuggestion,
      source: 'gemini'
    };
  } catch {
    // Silently fall back to guaranteed local sales engine on timeout, network error, or rate limits
    return generateLocalSalesReply(transcript);
  }
}

export async function analyzeCall(transcript: TranscriptMessage[], durationSeconds: number): Promise<CallAnalysisResult> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return generateLocalCallAnalysis(transcript, durationSeconds);
  }

  try {
    const model = getModelName();
    const prompt = `Analyze this sales call transcript for LeadFlow AI.
The call duration was ${durationSeconds} seconds.
Classify the call as EXACTLY ONE of: "Converted", "Interested", "Follow-up Required", "Not Interested", "Demo Requested", "No Response".

CRITICAL RULES:
- Never use call duration to decide status. Status must be based solely on customer intent expressed in the transcript.
- Never invent requirements or objections that the customer did not actually say.
- Status guidelines:
  * "Converted": Customer clearly agreed to start the 14-day free pilot.
  * "Demo Requested": Customer requested a product demonstration or walkthrough.
  * "Follow-up Required": Customer asked for details/email or callback, or said they are busy / need time.
  * "Not Interested": Customer declined or said not interested (and did not ask for details).
  * "Interested": Customer asked questions or engaged positively about the product.
  * "No Response": Empty or unintelligible call.

TRANSCRIPT:
${transcript.map(t => `${t.sender.toUpperCase()}: ${t.text}`).join('\n')}

Output ONLY valid JSON matching this schema:
{
  "status": "Interested",
  "summary": "1-2 sentences summarizing the call",
  "customerRequirements": ["list of explicit requirements stated by customer"],
  "objectionsHandled": ["list of objections raised by customer and addressed"],
  "nextSteps": ["actionable next steps for team follow-up"]
}`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
        }
      }),
      signal: AbortSignal.timeout(6000)
    });

    if (!response.ok) {
      return generateLocalCallAnalysis(transcript, durationSeconds);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return generateLocalCallAnalysis(transcript, durationSeconds);
    }

    let result: any;
    try {
      result = JSON.parse(text);
    } catch {
      return generateLocalCallAnalysis(transcript, durationSeconds);
    }

    if (!result || !VALID_STATUSES.includes(result.status)) {
      return generateLocalCallAnalysis(transcript, durationSeconds);
    }
    if (!result.summary || typeof result.summary !== 'string') {
      return generateLocalCallAnalysis(transcript, durationSeconds);
    }
    if (!Array.isArray(result.customerRequirements) || !Array.isArray(result.objectionsHandled) || !Array.isArray(result.nextSteps)) {
      return generateLocalCallAnalysis(transcript, durationSeconds);
    }

    return {
      status: result.status,
      summary: result.summary,
      customerRequirements: result.customerRequirements.map(String),
      objectionsHandled: result.objectionsHandled.map(String),
      nextSteps: result.nextSteps.map(String)
    };
  } catch {
    return generateLocalCallAnalysis(transcript, durationSeconds);
  }
}
