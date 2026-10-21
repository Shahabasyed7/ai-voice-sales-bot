import { TranscriptMessage, ChatResponse, CallAnalysisResult, CallClassification } from './types';

export const PRODUCT_INFO = {
  name: 'LeadFlow AI',
  tagline: 'AI Sales Pipeline for B2B Teams',
  pricing: [
    { tier: 'Starter', price: '$99/month', includes: 'up to 500 leads' },
    { tier: 'Growth', price: '$299/month', includes: 'up to 2,500 leads + multichannel voice' },
    { tier: 'Enterprise', price: '$899', includes: 'Enterprise custom deployment' }
  ],
  trial: '14-day free pilot with 100 free verified leads.',
  integrations: ['HubSpot', 'Salesforce', 'Pipedrive', 'Zapier'],
  commonObjections: {
    pricing: 'Starter is $99/month for up to 500 leads, Growth is $299/month for up to 2,500 leads plus multichannel voice, and Enterprise is $899. We also offer a 14-day free pilot with 100 free verified leads.',
    complexity: 'LeadFlow AI integrates with HubSpot, Salesforce, Pipedrive, and Zapier.',
    security: 'All customer and lead data is processed securely.',
    aiQuality: 'Our voice assistant qualifies leads and syncs directly with your CRM.'
  }
};

export type DetectedLanguage = 'en' | 'hi' | 'hinglish';

export function detectLanguage(text: string): DetectedLanguage {
  const lower = text.toLowerCase();

  // Devanagari Unicode script range (\u0900-\u097F)
  const devanagariRegex = /[\u0900-\u097F]/;
  if (devanagariRegex.test(text)) {
    return 'hi';
  }

  // Common Hinglish markers
  const hinglishMarkers = [
    'kya', 'hai', 'hain', 'kaise', 'kitna', 'kitne', 'hume', 'hum', 'chahiye',
    'bhai', 'nahin', 'nahi', 'karo', 'karna', 'baat', 'dikhao', 'batao', 'daam',
    'samajh', 'shukriya', 'dhanyawad', 'kal', 'parso', 'bhejo', 'accha', 'achha',
    'namaste', 'shuru', 'karein', 'bol', 'paisa', 'paise', 'lagenga', 'lagega', 'abhi'
  ];

  const words = lower.split(/\s+/);
  const matchCount = words.filter(w => hinglishMarkers.includes(w)).length;
  if (matchCount >= 1) {
    return 'hinglish';
  }

  return 'en';
}

// ---- Helpers: safer matching + stage awareness ----
const DATE_TIME_REGEX = /o'?\s?clock|\b\d{1,2}\s?(?:am|pm)\b|\b\d{1,2}:\d{2}\b|\b\d{1,2}(?:st|nd|rd|th)\b|\b(?:jan(?:uary)?|feb(?:ruary)?|march|apr(?:il)?|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b|\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today|tonight|morning|afternoon|evening|noon)\b|बजे|\bbaje\b|कल|आज|परसों|\bkal\b|\baaj\b|\bparso\b/i;

export function looksLikeDateOrTime(text: string): boolean {
  return DATE_TIME_REGEX.test(text);
}

// Whole-word matching so "integrate"/"generate" never count as "rate", "explain" never as "plan"
export function mentionsPricing(text: string): boolean {
  return /\b(?:plans?|prices?|pricing|costs?|rates?|how much|budget|expensive|too much)\b/i.test(text);
}

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const SPOKEN_EMAIL_REGEX = /\b[a-z0-9._]+\s+at\s+(?:the\s+rate\s+)?[a-z0-9.]+\s+dot\s+[a-z]{2,}/i;

export function extractEmail(text: string): string | null {
  const m = text.match(EMAIL_REGEX);
  return m ? m[0] : null;
}

// True for typed emails ("a@b.com") and for spoken ones ("john at gmail dot com")
export function containsEmail(text: string): boolean {
  return EMAIL_REGEX.test(text) || SPOKEN_EMAIL_REGEX.test(text);
}

const SLOT_REGEX = /\b\d{1,2}(?:st|nd|rd|th)(?:\s+(?:of\s+)?[a-z]+)?|\b\d{1,2}(?::\d{2})?\s?(?:am|pm|o'?\s?clock)\b|\b(?:next\s+week|monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today|tonight|morning|afternoon|evening|noon)\b|\d{1,2}(?::\d{2})?\s?बजे|\b\d{1,2}\s?baje\b|कल|आज|परसों|शाम|सुबह|दोपहर|\bkal\b|\baaj\b|\bparso\b/gi;

// Pull the day/time words out of a reply such as "21st October at 3 o'clock"
export function extractSlotPhrase(text: string): string {
  const found = text.match(SLOT_REGEX) || [];
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const f of found) {
    const t = f.trim();
    if (t && !seen.has(t.toLowerCase())) {
      seen.add(t.toLowerCase());
      parts.push(t);
    }
  }
  return parts.join(', ');
}

// Single source of truth for "customer clearly agreed to start the pilot"
export function isPilotAgreementText(latestText: string, allBotTextJoined: string): boolean {
  return (
    latestText.includes('start the pilot') ||
    latestText.includes("let's start the pilot") ||
    latestText.includes('lets start the pilot') ||
    latestText.includes('start pilot') ||
    latestText.includes('begin the pilot') ||
    latestText.includes('begin pilot') ||
    latestText.includes('ready for the pilot') ||
    latestText.includes('sign up for the pilot') ||
    latestText.includes('want to start the pilot') ||
    latestText.includes('agree to start the pilot') ||
    latestText.includes('agree to the pilot') ||
    latestText.includes('try the pilot') ||
    latestText.includes('test the pilot') ||
    latestText.includes('पायलट शुरू करें') ||
    latestText.includes('पायलट शुरू करो') ||
    latestText.includes('पायलट शुरू') ||
    latestText.includes('पायलट आज़माना') ||
    latestText.includes('pilot shuru') ||
    latestText.includes('pilot start') ||
    ((latestText.includes("let's start") || latestText.includes('lets start') || latestText.includes('start karte hain') || latestText.includes('शुरू करते हैं')) &&
      (allBotTextJoined.includes('pilot') || allBotTextJoined.includes('पायलट')))
  );
}

export interface CustomerNumberInfo {
  numStr: string;
  val: number;
  timeUnit?: 'day' | 'week';
  unitPhrase?: string;
  monthlyVal: number;
}

// Helper to extract customer-mentioned lead numbers or ranges (e.g. "60 leads", "50 to 60", "526 per day")
export function extractCustomerNumber(text: string): CustomerNumberInfo | null {
  // "3 o'clock", "21st October", "4 बजे" are times/dates, not lead counts (unless the customer also says "leads")
  if (looksLikeDateOrTime(text) && !/\bleads?\b|लीड/i.test(text)) {
    return null;
  }

  // Detect time units: per day / daily / per week / weekly / a day / roz / har din
  let timeUnit: 'day' | 'week' | undefined;
  let unitPhrase: string | undefined;

  const dayMatch = text.match(/\b(per\s+day|daily|a\s+day|roz|har\s+din|har\s+roz|प्रति\s+दिन|हर\s+दिन|दिन\s+में|रोज़|रोज)\b/i);
  const weekMatch = text.match(/\b(per\s+week|weekly|a\s+week|har\s+hafte|hafte\s+me|प्रति\s+सप्ताह|हर\s+हफ्ते|हफ्ते\s+में)\b/i);

  if (dayMatch) {
    timeUnit = 'day';
    unitPhrase = dayMatch[1].toLowerCase();
  } else if (weekMatch) {
    timeUnit = 'week';
    unitPhrase = weekMatch[1].toLowerCase();
  }

  // Check range e.g. "50 to 60", "50-60", "50 se 60", "50 से 60"
  const rangeMatch = text.match(/\b(\d+)\s*(?:to|-|se|से)\s*(\d+)\b/i);
  if (rangeMatch) {
    const val = parseInt(rangeMatch[2], 10);
    const monthlyVal = timeUnit === 'day' ? val * 30 : (timeUnit === 'week' ? val * 4 : val);
    return { numStr: `${rangeMatch[1]}-${rangeMatch[2]}`, val, timeUnit, unitPhrase, monthlyVal };
  }

  // Check single number e.g. "60", "60 leads", "around 100", "526 per day"
  const singleMatch = text.match(/\b(\d+)\b/);
  if (singleMatch) {
    const val = parseInt(singleMatch[1], 10);
    // Ignore 14 if talking about 14-day trial
    if (val === 14 && (text.includes('14 day') || text.includes('14 days') || text.includes('14 दिन') || text.includes('14 din'))) {
      return null;
    }
    // Ignore tier pricing amounts if customer is asking about price
    if (val === 99 || val === 299 || val === 899) {
      return null;
    }
    if (val > 0 && val < 500000) {
      const monthlyVal = timeUnit === 'day' ? val * 30 : (timeUnit === 'week' ? val * 4 : val);
      return { numStr: singleMatch[1], val, timeUnit, unitPhrase, monthlyVal };
    }
  }

  // Devanagari numerals: e.g. ६०, ५०
  const devanagariDigits: Record<string, string> = {
    '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
    '५': '5', '६': '6', '७': '7', '८': '8', '९': '9'
  };
  const devMatch = text.match(/[०-९]+/);
  if (devMatch) {
    const converted = devMatch[0].split('').map(c => devanagariDigits[c] || c).join('');
    const val = parseInt(converted, 10);
    if (val > 0 && val < 500000) {
      const monthlyVal = timeUnit === 'day' ? val * 30 : (timeUnit === 'week' ? val * 4 : val);
      return { numStr: devMatch[0], val, timeUnit, unitPhrase, monthlyVal };
    }
  }

  return null;
}

/**
 * Deterministic sales conversational agent
 * Guaranteed ₹0 cost with zero API dependencies, handles questions, objections, and conversions.
 * Tracks asked qualifying questions so none are ever repeated; advances to pilot/demo offer.
 * Never claims it signed anyone up, activated a pilot, or booked a real demo directly (uses "our team will confirm / follow up").
 */
export function generateLocalSalesReply(transcript: TranscriptMessage[]): ChatResponse {
  // Extract customer and bot utterances
  const customerMessages = transcript.filter(m => m.sender === 'customer');
  if (customerMessages.length === 0) {
    return {
      reply: "Hi there! This is Alex calling from LeadFlow AI. How is your team currently qualifying new prospect inquiries?",
      source: 'local_fallback'
    };
  }

  const botMessages = transcript.filter(m => m.sender === 'bot');
  const botTexts = botMessages.map(m => m.text.toLowerCase());
  const allBotTextJoined = botTexts.join(' ');
  // Track if bot has already asked for email in this call
  const hasBotAskedEmail = botTexts.some(m => m.includes('email') || m.includes('ईमेल') || m.includes('gmail'));
  // Track if customer already provided an email in this call
  const hasCustomerGivenEmail = customerMessages.some(m => containsEmail(m.text));

  // Search across all customer messages in the transcript for any previously mentioned lead number
  let priorCustomerNumber: CustomerNumberInfo | null = null;
  for (const msg of customerMessages) {
    const extracted = extractCustomerNumber(msg.text);
    if (extracted) {
      priorCustomerNumber = extracted;
    }
  }

  const latestRaw = customerMessages[customerMessages.length - 1].text.trim();
  const latestText = latestRaw.toLowerCase();
  const lang = detectLanguage(latestRaw);
  const turnIndex = customerMessages.length;

  // ---- Conversation stage awareness ----
  const lastBotText = botTexts.length > 0 ? botTexts[botTexts.length - 1] : '';
  const botAskedForSlot = /what day and time|which day|day and time|कौन सा दिन|दिन और समय|kaunsa day|day aur time/.test(lastBotText);
  const demoContext =
    /demo|walkthrough|डेमो|वॉकथ्रू/.test(lastBotText) ||
    customerMessages.slice(0, -1).some(m => /demo|walkthrough|डेमो|schedule/i.test(m.text));
  const emailAskCount = botTexts.filter(m => m.includes('email') || m.includes('ईमेल')).length;
  const needEmailForPilot = !hasCustomerGivenEmail && emailAskCount < 2;
  const wantsDetailsNow = /send (?:me )?(?:the )?(?:details|info|information|email)|email me|details bhejo|email bhejo|ईमेल/i.test(latestRaw);
  const isComplaint =
    /\b(?:makes? no sense|fix (?:the |this )?(?:issue|problem|it)|that'?s wrong|not what i (?:asked|said)|you(?:'re| are) not (?:listening|answering|understanding)|not answering|wrong answer|didn'?t (?:ask|answer)|not helping|useless|stupid)\b/i.test(latestRaw) ||
    /गलत|सुन नहीं|समझ नहीं रहे|बकवास|\bgalat\b|sun nahi|samajh nahi/i.test(latestRaw);

  // 1. NOT INTERESTED (Clear decline without asking for details)
  if (
    !wantsDetailsNow && (
      latestText.includes('not interested') ||
      latestText.includes("don't need") ||
      latestText.includes('dont need') ||
      latestText.includes('no thanks') ||
      latestText.includes('stop calling') ||
      latestText.includes('interest nahi') ||
      latestText.includes('interest nahin') ||
      latestText.includes('दिलचस्पी नहीं') ||
      latestText.includes('नहीं चाहिए') ||
      latestText.includes('nahi chahiye') ||
      latestText.includes('nahin chahiye') ||
      latestText.includes('mat call')
    )) {
    let reply = "I completely respect that! Thank you for your time today. Our team will ensure your preference is recorded. Have a great day!";
    if (lang === 'hi') {
      reply = "मैं आपके निर्णय का पूरा सम्मान करता हूँ। समय देने के लिए धन्यवाद। हमारी टीम आपकी प्राथमिकता नोट कर लेगी। आपका दिन शुभ हो!";
    } else if (lang === 'hinglish') {
      reply = "Main bilkul samajhta hoon. Time dene ke liye shukriya! Hamari team aapka preference note kar legi. Have a great day!";
    }

    return {
      reply,
      classificationSuggestion: 'Not Interested',
      shouldEndCall: true,
      source: 'local_fallback'
    };
  }

  // 1b. CUSTOMER IS COMPLAINING ("that makes no sense", "fix the issue") -> apologise, get back on track
  if (isComplaint) {
    const slotInComplaint = extractSlotPhrase(latestRaw);
    let reply: string;
    if (demoContext) {
      const noted = slotInComplaint ? ` I have noted ${slotInComplaint} as your preferred time.` : '';
      if (lang === 'hi') {
        reply = `माफ़ कीजिए, मुझसे गलती हुई। आप डेमो वॉकथ्रू चाहते हैं।${slotInComplaint ? ` मैंने ${slotInComplaint} आपके पसंदीदा समय के रूप में नोट कर लिया है।` : ' आपके लिए कौन सा दिन और समय सही रहेगा?'} हमारी टीम कन्फर्म करने के लिए फॉलो-अप करेगी।`;
      } else if (lang === 'hinglish') {
        reply = `Sorry, meri galti thi. Aap demo walkthrough chahte hain.${slotInComplaint ? ` Maine ${slotInComplaint} aapke preferred time ke roop me note kar liya hai.` : ' Aapke liye kaunsa day aur time sahi rahega?'} Hamari team confirm karne ke liye follow-up karegi.`;
      } else {
        reply = `I'm sorry about that, you're right and I mixed that up. You'd like a demo walkthrough.${noted || ' What day and time works best for you?'} Our team will follow up to confirm.`;
      }
      return { reply, classificationSuggestion: 'Demo Requested', source: 'local_fallback' };
    }
    if (lang === 'hi') {
      reply = 'माफ़ कीजिए, मैं आपकी बात ठीक से नहीं समझ पाया। आप क्या जानना चाहेंगे: प्राइसिंग, 14 दिनों का मुफ़्त पायलट, CRM इंटीग्रेशन, या डेमो?';
    } else if (lang === 'hinglish') {
      reply = 'Sorry, main aapki baat theek se nahi samajh paaya. Aap kya jaanna chahenge: pricing, 14-day free pilot, CRM integrations, ya demo?';
    } else {
      reply = "I'm sorry about that, let me get back on track. What would you like to know about: pricing, the 14-day free pilot, CRM integrations, or a demo?";
    }
    return { reply, source: 'local_fallback' };
  }

  // 1c. DEMO SLOT: bot just asked "what day and time?" and the customer answers with a day/time (and maybe an email)
  if (botAskedForSlot && !wantsDetailsNow && (looksLikeDateOrTime(latestRaw) || containsEmail(latestRaw))) {
    const slot = extractSlotPhrase(latestRaw);
    const emailNow = containsEmail(latestRaw);
    const askEmail = !hasCustomerGivenEmail && !emailNow && emailAskCount < 2;
    let reply: string;
    if (lang === 'hi') {
      reply = `ठीक है, मैंने ${slot || 'यह समय'} आपके पसंदीदा डेमो समय के रूप में नोट कर लिया है। हमारी टीम इसे कन्फर्म करने के लिए फॉलो-अप करेगी।` + (askEmail ? ' कन्फर्मेशन भेजने के लिए आपका ईमेल एड्रेस क्या है?' : ' आपका दिन शुभ हो!');
    } else if (lang === 'hinglish') {
      reply = `Theek hai, maine ${slot || 'yeh time'} aapke preferred demo time ke roop me note kar liya hai. Hamari team ise confirm karne ke liye follow-up karegi.` + (askEmail ? ' Confirmation bhejne ke liye aapka email address kya hai?' : ' Have a great day!');
    } else {
      reply = `Perfect, I have noted ${slot || 'that time'} as your preferred demo time. Our team will follow up to confirm it.` + (askEmail ? ' What is the best email address for the confirmation?' : ' Have a great day!');
    }
    return { reply, classificationSuggestion: 'Demo Requested', shouldEndCall: !askEmail, source: 'local_fallback' };
  }

  // 2. FOLLOW-UP / SEND DETAILS / BUSY / EMAIL PROVIDED
  if (
    latestText.includes('send me details') ||
    latestText.includes('email me') ||
    latestText.includes('send info') ||
    latestText.includes('send details') ||
    latestText.includes('send email') ||
    latestText.includes('my email') ||
    latestText.includes('email is') ||
    latestText.includes('@') ||
    latestText.includes('gmail') ||
    latestText.includes('busy') ||
    latestText.includes('call me back') ||
    latestText.includes('call later') ||
    latestText.includes('call back') ||
    latestText.includes('later') ||
    latestText.includes('next week') ||
    latestText.includes('ईमेल') ||
    latestText.includes('बाद में') ||
    latestText.includes('baad me') ||
    latestText.includes('email bhejo') ||
    latestText.includes('details bhejo') ||
    containsEmail(latestRaw)
  ) {
    // Converted ONLY if the customer actually agreed to the pilot at some point (not merely because the bot mentioned it)
    const isPilotFollowup = customerMessages.some(m => isPilotAgreementText(m.text.toLowerCase(), allBotTextJoined));
    const isDemoFollowup = !isPilotFollowup && demoContext;

    let reply: string;
    if (!hasBotAskedEmail) {
      if (lang === 'hi') {
        reply = "कोई बात नहीं! आपका सबसे अच्छा ईमेल एड्रेस क्या रहेगा? हमारी टीम प्राइसिंग और पायलट डिटेल्स के साथ फॉलो-अप करेगी।";
      } else if (lang === 'hinglish') {
        reply = "Koi problem nahi! Aapka best email address kya hoga? Hamari team pricing aur pilot details ke saath follow-up karegi.";
      } else {
        reply = "No problem at all! What is the best email address for you? Our team will confirm and follow up with our pricing and pilot details.";
      }
    } else {
      if (isDemoFollowup) {
        if (lang === 'hi') {
          reply = "धन्यवाद! हमारी टीम आपके डेमो को कन्फर्म करने के लिए फॉलो-अप करेगी। आपका दिन शुभ हो!";
        } else if (lang === 'hinglish') {
          reply = "Shukriya! Hamari team aapka demo confirm karne ke liye follow-up karegi. Have a great day!";
        } else {
          reply = "Thank you! Our team will follow up to confirm your demo. Have a great day!";
        }
      } else if (isPilotFollowup) {
        if (lang === 'hi') {
          reply = "धन्यवाद! हमारी टीम 100 मुफ़्त वेरिफाइड लीड्स वाले 14 दिनों के मुफ़्त पायलट को कन्फर्म करने के लिए फॉलो-अप करेगी। आपका दिन शुभ हो!";
        } else if (lang === 'hinglish') {
          reply = "Shukriya! Hamari team 100 free verified leads ke saath 14-day free pilot confirm karne ke liye follow-up karegi. Have a great day!";
        } else {
          reply = "Thank you! Our team will follow up to confirm your 14-day free pilot with 100 free verified leads. Have a great day!";
        }
      } else {
        if (lang === 'hi') {
          reply = "कोई बात नहीं! हमारी टीम प्राइसिंग और पायलट डिटेल्स के साथ जल्द फॉलो-अप करेगी। आपका दिन शुभ हो!";
        } else if (lang === 'hinglish') {
          reply = "Koi problem nahi! Hamari team pricing aur pilot details ke saath follow-up karegi. Have a great day!";
        } else {
          reply = "No problem at all! Our team will follow up with our pricing and pilot details. Have a great day!";
        }
      }
    }

    return {
      reply,
      classificationSuggestion: isPilotFollowup ? 'Converted' : (isDemoFollowup ? 'Demo Requested' : 'Follow-up Required'),
      // Only end the call on the closing message, never on the turn that asks for the email
      shouldEndCall: hasBotAskedEmail,
      source: 'local_fallback'
    };
  }

  // 3. CUSTOMER ALREADY ANSWERED OR ASKS TO RECOMMEND
  const isAlreadyAnswered =
    latestText.includes('पहले ही बता') ||
    latestText.includes('पहले ही बोल') ||
    latestText.includes('पहले बता') ||
    latestText.includes('पहले बोला') ||
    latestText.includes('pehle hi bata') ||
    latestText.includes('pehle bataya') ||
    latestText.includes('pehle bola') ||
    latestText.includes('already told') ||
    latestText.includes('already answered') ||
    latestText.includes('already said') ||
    latestText.includes('told you already') ||
    latestText.includes('told you before') ||
    latestText.includes('i already told');

  const isAskingRecommendation =
    latestText.includes('आप बताइए') ||
    latestText.includes('आप बताओ') ||
    latestText.includes('आप बताएं') ||
    latestText.includes('aap bataiye') ||
    latestText.includes('aap batao') ||
    latestText.includes('aap batayein') ||
    latestText.includes('which one should i choose') ||
    latestText.includes('which one should we choose') ||
    latestText.includes('which plan should i choose') ||
    latestText.includes('what do you recommend') ||
    latestText.includes('which do you recommend') ||
    latestText.includes('which one do you recommend') ||
    latestText.includes('recommend') ||
    latestText.includes('suggest') ||
    latestText.includes('which plan') ||
    latestText.includes('which is best') ||
    latestText.includes('kaunsa plan') ||
    latestText.includes('kaun sa plan') ||
    latestText.includes('kaunsa lu') ||
    latestText.includes('kaunsa sahi');

  if (isAlreadyAnswered) {
    let reply = "My apologies, you're absolutely right! Based on volume, our Starter plan at $99/month covers up to 500 leads, while Growth at $299/month includes up to 2,500 leads plus multichannel voice. We also offer a 14-day free pilot with 100 free verified leads—would you like to try it?";
    if (priorCustomerNumber) {
      const priorCount = priorCustomerNumber.timeUnit
        ? `${priorCustomerNumber.numStr} ${priorCustomerNumber.unitPhrase || (priorCustomerNumber.timeUnit === 'day' ? 'per day' : 'per week')}`
        : `${priorCustomerNumber.numStr} leads`;
      if (priorCustomerNumber.monthlyVal <= 500) {
        reply = `My apologies, you're absolutely right! Based on your volume of around ${priorCount}, our Starter plan at $99/month covers up to 500 leads. We also offer a 14-day free pilot with 100 free verified leads—would you like to try it?`;
      } else if (priorCustomerNumber.monthlyVal <= 2500) {
        reply = `My apologies, you're absolutely right! Based on your volume of around ${priorCount}, our Growth plan at $299/month covers up to 2,500 leads plus multichannel voice. We also offer a 14-day free pilot with 100 free verified leads—would you like to try it?`;
      } else {
        reply = `My apologies, you're absolutely right! Based on your volume of around ${priorCount}, I recommend our Enterprise plan at $899, and our team will confirm the fit. We also offer a 14-day free pilot with 100 free verified leads—would you like to try it?`;
      }
    }

    if (lang === 'hi') {
      if (priorCustomerNumber) {
        const priorCount = priorCustomerNumber.timeUnit
          ? `${priorCustomerNumber.numStr} ${priorCustomerNumber.unitPhrase || (priorCustomerNumber.timeUnit === 'day' ? 'प्रति दिन' : 'प्रति सप्ताह')}`
          : `${priorCustomerNumber.numStr} लीड्स`;
        if (priorCustomerNumber.monthlyVal <= 500) {
          reply = `माफ़ कीजिए, आप बिल्कुल सही कह रहे हैं! आपके लगभग ${priorCount} के वॉल्यूम के अनुसार, स्टार्टर प्लान ($99/month) up to 500 leads कवर करता है। साथ ही 100 मुफ़्त वेरिफाइड लीड्स के साथ 14 दिनों का मुफ़्त पायलट भी है—क्या आप इसे आज़माना चाहेंगे?`;
        } else if (priorCustomerNumber.monthlyVal <= 2500) {
          reply = `माफ़ कीजिए, आप बिल्कुल सही कह रहे हैं! आपके लगभग ${priorCount} के वॉल्यूम के अनुसार, ग्रोथ प्लान ($299/month) up to 2,500 leads और मल्टीचैनल वॉयस कवर करता है। साथ ही 100 मुफ़्त वेरिफाइड लीड्स के साथ 14 दिनों का मुफ़्त पायलट भी है—क्या आप इसे आज़माना चाहेंगे?`;
        } else {
          reply = `माफ़ कीजिए, आप बिल्कुल सही कह रहे हैं! आपके लगभग ${priorCount} के वॉल्यूम के लिए मैं एंटरप्राइज प्लान ($899) की सिफारिश करूँगा, और हमारी टीम इसके लिए सही फिट की पुष्टि करेगी। साथ ही 100 मुफ़्त वेरिफाइड लीड्स के साथ 14 दिनों का मुफ़्त पायलट भी है—क्या आप इसे आज़माना चाहेंगे?`;
        }
      } else {
        reply = "माफ़ कीजिए, आप बिल्कुल सही कह रहे हैं! स्टार्टर प्लान ($99/month) up to 500 leads कवर करता है, और up to 2,500 leads तथा मल्टीचैनल वॉयस के लिए ग्रोथ प्लान ($299/month) है। साथ ही 100 मुफ़्त वेरिफाइड लीड्स के साथ 14 दिनों का मुफ़्त पायलट भी है—क्या आप इसे आज़माना चाहेंगे?";
      }
    } else if (lang === 'hinglish') {
      if (priorCustomerNumber) {
        const priorCount = priorCustomerNumber.timeUnit
          ? `${priorCustomerNumber.numStr} ${priorCustomerNumber.unitPhrase || (priorCustomerNumber.timeUnit === 'day' ? 'per day' : 'per week')}`
          : `${priorCustomerNumber.numStr} leads`;
        if (priorCustomerNumber.monthlyVal <= 500) {
          reply = `My apologies, aap bilkul sahi keh rahe hain! Aapke around ${priorCount} ke volume ke hisaab se, Starter plan ($99/month) up to 500 leads cover karta hai. Saath me 100 free verified leads ke saath 14-day free pilot bhi hai—kya aap test karna chahenge?`;
        } else if (priorCustomerNumber.monthlyVal <= 2500) {
          reply = `My apologies, aap bilkul sahi keh rahe hain! Aapke around ${priorCount} ke volume ke hisaab se, Growth plan ($299/month) up to 2,500 leads plus multichannel voice cover karta hai. Saath me 100 free verified leads ke saath 14-day free pilot bhi hai—kya aap test karna chahenge?`;
        } else {
          reply = `My apologies, aap bilkul sahi keh rahe hain! Aapke around ${priorCount} ke volume ke liye main Enterprise plan ($899) recommend karunga, aur hamari team fit confirm karegi. Saath me 100 free verified leads ke saath 14-day free pilot bhi hai—kya aap test karna chahenge?`;
        }
      } else {
        reply = "My apologies, aap bilkul sahi keh rahe hain! Starter plan ($99/month) up to 500 leads cover karta hai, aur up to 2,500 leads plus multichannel voice ke liye Growth plan ($299/month) hai. Saath me 100 free verified leads ke saath 14-day free pilot bhi hai—kya aap test karna chahenge?";
      }
    }

    return {
      reply,
      classificationSuggestion: 'Interested',
      source: 'local_fallback'
    };
  }

  if (isAskingRecommendation) {
    let reply = "I'd be glad to recommend! For up to 500 leads, our Starter plan at $99/month is a great fit. If you need up to 2,500 leads plus multichannel voice, our Growth plan at $299/month is ideal. We also offer a 14-day free pilot with 100 free verified leads—would you like to test it out?";

    if (priorCustomerNumber) {
      const priorCount = priorCustomerNumber.timeUnit
        ? `${priorCustomerNumber.numStr} ${priorCustomerNumber.unitPhrase || (priorCustomerNumber.timeUnit === 'day' ? 'per day' : 'per week')}`
        : `${priorCustomerNumber.numStr} leads`;
      if (priorCustomerNumber.monthlyVal <= 500) {
        reply = `Based on your volume of around ${priorCount}, I recommend our Starter plan at $99/month, which covers up to 500 leads. We also offer a 14-day free pilot with 100 free verified leads—would you like to test it out?`;
      } else if (priorCustomerNumber.monthlyVal <= 2500) {
        reply = `Based on your volume of around ${priorCount}, I recommend our Growth plan at $299/month, which covers up to 2,500 leads plus multichannel voice. We also offer a 14-day free pilot with 100 free verified leads—would you like to test it out?`;
      } else {
        reply = `For your volume of around ${priorCount}, I recommend our Enterprise plan at $899, and our team will confirm the fit. We also offer a 14-day free pilot with 100 free verified leads—would you like to test it out?`;
      }
    }

    if (lang === 'hi') {
      if (priorCustomerNumber) {
        const priorCount = priorCustomerNumber.timeUnit
          ? `${priorCustomerNumber.numStr} ${priorCustomerNumber.unitPhrase || (priorCustomerNumber.timeUnit === 'day' ? 'प्रति दिन' : 'प्रति सप्ताह')}`
          : `${priorCustomerNumber.numStr} लीड्स`;
        if (priorCustomerNumber.monthlyVal <= 500) {
          reply = `आपके लगभग ${priorCount} के वॉल्यूम के अनुसार, मैं हमारे स्टार्टर प्लान ($99/month) की सिफारिश करूँगा, जो up to 500 leads कवर करता है। साथ ही 100 मुफ़्त वेरिफाइड लीड्स के साथ 14 दिनों का मुफ़्त पायलट भी है—क्या आप इसे टेस्ट करना चाहेंगे?`;
        } else if (priorCustomerNumber.monthlyVal <= 2500) {
          reply = `आपके लगभग ${priorCount} के वॉल्यूम के अनुसार, मैं हमारे ग्रोथ प्लान ($299/month) की सिफारिश करूँगा, जो up to 2,500 leads और मल्टीचैनल वॉयस कवर करता है। साथ ही 100 मुफ़्त वेरिफाइड लीड्स के साथ 14 दिनों का मुफ़्त पायलट भी है—क्या आप इसे टेस्ट करना चाहेंगे?`;
        } else {
          reply = `आपके लगभग ${priorCount} के वॉल्यूम के लिए मैं एंटरप्राइज प्लान ($899) की सिफारिश करूँगा, और हमारी टीम इसके लिए सही फिट की पुष्टि करेगी। साथ ही 100 मुफ़्त वेरिफाइड लीड्स के साथ 14 दिनों का मुफ़्त पायलट भी है—क्या आप इसे टेस्ट करना चाहेंगे?`;
        }
      } else {
        reply = "जरूर! up to 500 leads के लिए स्टार्टर प्लान ($99/month) सबसे अच्छा विकल्प है। up to 2,500 leads और मल्टीचैनल वॉयस के लिए ग्रोथ प्लान ($299/month) सही रहेगा। साथ ही 100 मुफ़्त वेरिफाइड लीड्स के साथ 14 दिनों का मुफ़्त पायलट भी है—क्या आप इसे टेस्ट करना चाहेंगे?";
      }
    } else if (lang === 'hinglish') {
      if (priorCustomerNumber) {
        const priorCount = priorCustomerNumber.timeUnit
          ? `${priorCustomerNumber.numStr} ${priorCustomerNumber.unitPhrase || (priorCustomerNumber.timeUnit === 'day' ? 'per day' : 'per week')}`
          : `${priorCustomerNumber.numStr} leads`;
        if (priorCustomerNumber.monthlyVal <= 500) {
          reply = `Aapke around ${priorCount} ke volume ke hisaab se, main hamara Starter plan ($99/month) recommend karunga jo up to 500 leads cover karta hai. Saath me 100 free verified leads ke saath 14-day free pilot bhi hai—kya aap test karna chahenge?`;
        } else if (priorCustomerNumber.monthlyVal <= 2500) {
          reply = `Aapke around ${priorCount} ke volume ke hisaab se, main hamara Growth plan ($299/month) recommend karunga jo up to 2,500 leads plus multichannel voice cover karta hai. Saath me 100 free verified leads ke saath 14-day free pilot bhi hai—kya aap test karna chahenge?`;
        } else {
          reply = `Aapke around ${priorCount} ke volume ke liye main Enterprise plan ($899) recommend karunga, aur hamari team fit confirm karegi. Saath me 100 free verified leads ke saath 14-day free pilot bhi hai—kya aap test karna chahenge?`;
        }
      } else {
        reply = "Zaroor! up to 500 leads ke liye Starter plan ($99/month) best fit hai. up to 2,500 leads aur multichannel voice ke liye Growth plan ($299/month) recommended hai. Saath me 100 free verified leads ke saath 14-day free pilot bhi hai—kya aap test karna chahenge?";
      }
    }

    return {
      reply,
      classificationSuggestion: 'Interested',
      source: 'local_fallback'
    };
  }

  // 4. PRICING & OBJECTIONS ON PRICE (Comprehensive Hindi, Hinglish, English triggers)
  const isPricingInquiry =
    mentionsPricing(latestText) ||
    latestText.includes('kitna') ||
    latestText.includes('kitne') ||
    latestText.includes('paisa') ||
    latestText.includes('paise') ||
    latestText.includes('daam') ||
    latestText.includes('kharch') ||
    latestText.includes('kharcha') ||
    latestText.includes('lagega') ||
    // Hindi Devanagari triggers
    latestText.includes('प्लान') ||
    latestText.includes('प्राइस') ||
    latestText.includes('कीमत') ||
    latestText.includes('दाम') ||
    latestText.includes('रेट') ||
    latestText.includes('कितना') ||
    latestText.includes('कितने') ||
    latestText.includes('कितने पैसे') ||
    latestText.includes('खर्च') ||
    latestText.includes('कॉस्ट') ||
    latestText.includes('पैसा') ||
    latestText.includes('पैसे');

  if (isPricingInquiry) {
    if (latestText.includes('expensive') || latestText.includes('too much') || latestText.includes('mehnga') || latestText.includes('महंगा') || latestText.includes('budget')) {
      let reply: string;
      if (!hasBotAskedEmail) {
        if (lang === 'hi') {
          reply = "मैं बजट की बात समझता हूँ। हम 100 मुफ़्त वेरिफाइड लीड्स के साथ 14 दिनों का मुफ़्त पायलट ऑफर करते हैं ताकि आप पहले परिणाम देख सकें। आपका ईमेल एड्रेस क्या है ताकि हमारी टीम फॉलो-अप कर सके?";
        } else if (lang === 'hinglish') {
          reply = "Budget ki baat main samajhta hoon. Hum 100 free verified leads ke saath 14-day free pilot offer karte hain taaki aap pehle results dekh sakein. Aapka email address kya hai taaki hamari team follow-up kar sake?";
        } else {
          reply = "I understand budget considerations. We offer a 14-day free pilot with 100 free verified leads so you can evaluate the results first. What is your email address so our team can follow up with details?";
        }
      } else {
        if (lang === 'hi') {
          reply = "मैं बजट की बात समझता हूँ। हम 100 मुफ़्त वेरिफाइड लीड्स के साथ 14 दिनों का मुफ़्त पायलट ऑफर करते हैं ताकि आप पहले परिणाम देख सकें। क्या आप इसे आज़माना चाहेंगे?";
        } else if (lang === 'hinglish') {
          reply = "Budget ki baat main samajhta hoon. Hum 100 free verified leads ke saath 14-day free pilot offer karte hain taaki aap pehle results dekh sakein. Kya aap test karna chahenge?";
        } else {
          reply = "I understand budget considerations. We offer a 14-day free pilot with 100 free verified leads so you can evaluate the results first. Would you like to test it out?";
        }
      }
      return { reply, classificationSuggestion: 'Interested', source: 'local_fallback' };
    }

    let reply: string;
    if (!hasBotAskedEmail) {
      if (lang === 'hi') {
        reply = "LeadFlow AI के तीन प्लान हैं: स्टार्टर $99/month (up to 500 leads), ग्रोथ $299/month (up to 2,500 leads + multichannel voice), और एंटरप्राइज $899। साथ ही 100 मुफ़्त वेरिफाइड लीड्स के साथ 14 दिनों का मुफ़्त पायलट भी है। आपका ईमेल एड्रेस क्या है ताकि हमारी टीम डिटेल्स के साथ फॉलो-अप कर सके?";
      } else if (lang === 'hinglish') {
        reply = "LeadFlow AI ke teen plans hain: Starter $99/month (up to 500 leads), Growth $299/month (up to 2,500 leads + multichannel voice), aur Enterprise $899. Saath me 14-day free pilot aur 100 free verified leads bhi hain. Aapka email address kya hai taaki hamari team follow-up kar sake?";
      } else {
        reply = "LeadFlow AI has three plans: Starter at $99/month for up to 500 leads, Growth at $299/month for up to 2,500 leads plus multichannel voice, and Enterprise at $899. We also offer a 14-day free pilot with 100 free verified leads. What is your email address so our team can follow up with details?";
      }
    } else {
      if (lang === 'hi') {
        reply = "LeadFlow AI के तीन प्लान हैं: स्टार्टर $99/month (up to 500 leads), ग्रोथ $299/month (up to 2,500 leads + multichannel voice), और एंटरप्राइज $899। साथ ही 100 मुफ़्त वेरिफाइड लीड्स के साथ 14 दिनों का मुफ़्त पायलट भी है। क्या आप 14 दिनों के पायलट से शुरुआत करना चाहेंगे?";
      } else if (lang === 'hinglish') {
        reply = "LeadFlow AI ke teen plans hain: Starter $99/month (up to 500 leads), Growth $299/month (up to 2,500 leads + multichannel voice), aur Enterprise $899. Saath me 14-day free pilot aur 100 free verified leads bhi hain. Kya aap 14-day pilot se shuru karna chahenge?";
      } else {
        reply = "LeadFlow AI has three plans: Starter at $99/month for up to 500 leads, Growth at $299/month for up to 2,500 leads plus multichannel voice, and Enterprise at $899. We also offer a 14-day free pilot with 100 free verified leads. Would you like to start with our 14-day free pilot?";
      }
    }

    return { reply, classificationSuggestion: 'Interested', source: 'local_fallback' };
  }

  // 5. CUSTOMER GIVES A NUMBER (e.g. "60 leads", "around 50 to 60", "200", "526 per day")
  const customerNumber = extractCustomerNumber(latestText);
  if (customerNumber) {
    let reply: string;
    const effectiveVal = customerNumber.monthlyVal;

    let countPhrase: string;
    if (customerNumber.timeUnit) {
      if (/\bleads?\b|लीड/i.test(latestText)) {
        countPhrase = `${customerNumber.numStr} leads ${customerNumber.unitPhrase || (customerNumber.timeUnit === 'day' ? 'per day' : 'per week')}`;
      } else {
        countPhrase = `${customerNumber.numStr} ${customerNumber.unitPhrase || (customerNumber.timeUnit === 'day' ? 'per day' : 'per week')}`;
      }
    } else {
      countPhrase = `${customerNumber.numStr} leads`;
    }

    if (effectiveVal <= 500) {
      if (lang === 'hi') {
        reply = `समझ गया, लगभग ${countPhrase}! हमारा स्टार्टर प्लान $99/month में up to 500 leads कवर करता है, जो आपके वॉल्यूम के लिए बिल्कुल उपयुक्त रहेगा। साथ ही 100 मुफ़्त वेरिफाइड लीड्स के साथ 14 दिनों का मुफ़्त पायलट भी है—क्या आप इसे आज़माना चाहेंगे?`;
      } else if (lang === 'hinglish') {
        reply = `Got it, around ${countPhrase}! Hamara Starter plan $99/month me up to 500 leads cover karta hai, jo aapke volume ke liye perfect rahega. Saath me 100 free verified leads ke saath 14-day free pilot bhi hai—kya aap test karna chahenge?`;
      } else {
        reply = `Got it, around ${countPhrase}! Our Starter plan covers up to 500 leads for $99/month, which easily fits your volume. We also offer a 14-day free pilot with 100 free verified leads—would you like to test it out?`;
      }
    } else if (effectiveVal <= 2500) {
      if (lang === 'hi') {
        reply = `समझ गया, लगभग ${countPhrase}! उस वॉल्यूम के लिए हमारा ग्रोथ प्लान $299/month में up to 2,500 leads और मल्टीचैनल वॉयस कवर करता है। साथ ही 100 मुफ़्त वेरिफाइड लीड्स के साथ 14 दिनों का मुफ़्त पायलट भी है—क्या आप इसे देखना चाहेंगे?`;
      } else if (lang === 'hinglish') {
        reply = `Got it, around ${countPhrase}! Is volume ke liye hamara Growth plan $299/month me up to 2,500 leads plus multichannel voice cover karta hai. Saath me 100 free verified leads ke saath 14-day free pilot bhi hai—kya aap test karna chahenge?`;
      } else {
        reply = `Got it, around ${countPhrase}! For that volume, our Growth plan covers up to 2,500 leads plus multichannel voice for $299/month. We also offer a 14-day free pilot with 100 free verified leads—would you like to test it out?`;
      }
    } else {
      if (lang === 'hi') {
        reply = `समझ गया, लगभग ${countPhrase}! उस वॉल्यूम के लिए मैं हमारे एंटरप्राइज प्लान ($899) की सिफारिश करूँगा, और हमारी टीम इसके लिए सही फिट की पुष्टि करेगी। साथ ही 100 मुफ़्त वेरिफाइड लीड्स के साथ 14 दिनों का मुफ़्त पायलट भी है—क्या आप इसे आज़माना चाहेंगे?`;
      } else if (lang === 'hinglish') {
        reply = `Got it, around ${countPhrase}! Is volume ke liye main hamara Enterprise plan ($899) recommend karunga, aur hamari team fit confirm karegi. Saath me 100 free verified leads ke saath 14-day free pilot bhi hai—kya aap test karna chahenge?`;
      } else {
        reply = `Got it, around ${countPhrase}! For that volume, I recommend our Enterprise plan at $899, and our team will confirm the fit. We also offer a 14-day free pilot with 100 free verified leads—would you like to test it out?`;
      }
    }

    return {
      reply,
      classificationSuggestion: 'Interested',
      source: 'local_fallback'
    };
  }

  // 6. CONVERSION / CLEARLY AGREED TO START PILOT
  const isAgreeingToPilot = isPilotAgreementText(latestText, allBotTextJoined);

  if (isAgreeingToPilot) {
    let reply: string;
    // Ask for email once if not collected yet and not already asked
    if (needEmailForPilot) {
      if (lang === 'hi') {
        reply = "बहुत बढ़िया! हमारी टीम 100 मुफ़्त वेरिफाइड लीड्स वाले 14 दिनों के मुफ़्त पायलट को कन्फर्म करने के लिए फॉलो-अप करेगी। कन्फर्मेशन के लिए आपका सबसे अच्छा ईमेल एड्रेस क्या रहेगा?";
      } else if (lang === 'hinglish') {
        reply = "Superb! Hamari team 100 free verified leads ke saath 14-day free pilot confirm karne ke liye follow-up karegi. Confirmation ke liye aapka best email address kya hoga?";
      } else {
        reply = "That's great! Our team will follow up to confirm your 14-day free pilot with 100 free verified leads. What is the best email address for our team to confirm with you?";
      }
    } else {
      if (lang === 'hi') {
        reply = "बहुत बढ़िया! हमारी टीम 100 मुफ़्त वेरिफाइड लीड्स वाले 14 दिनों के मुफ़्त पायलट को कन्फर्म करने के लिए फॉलो-अप करेगी। आपका दिन शुभ हो!";
      } else if (lang === 'hinglish') {
        reply = "Superb! Hamari team 100 free verified leads ke saath 14-day free pilot confirm karne ke liye follow-up karegi. Have a great day!";
      } else {
        reply = "That's great! Our team will follow up to confirm your 14-day free pilot with 100 free verified leads. Have a great day!";
      }
    }

    return {
      reply,
      classificationSuggestion: 'Converted',
      shouldEndCall: !needEmailForPilot,
      source: 'local_fallback'
    };
  }

  // 7. FREE PILOT / "14 DAYS" / FREE LEADS ("tell me about the free pilot", "hello hello 14 days")
  if (
    latestText.includes('14 day') ||
    latestText.includes('14 days') ||
    latestText.includes('free pilot') ||
    latestText.includes('free trial') ||
    latestText.includes('free leads') ||
    latestText.includes('pilot') ||
    latestText.includes('मुफ़्त') ||
    latestText.includes('ट्रायल')
  ) {
    let reply = "We offer a 14-day free pilot with 100 free verified leads. I can arrange for our team to follow up with details—would you like to test it out?";
    if (lang === 'hi') {
      reply = "हम 100 मुफ़्त वेरिफाइड लीड्स के साथ 14 दिनों का मुफ़्त पायलट ऑफर करते हैं। मैं अपनी टीम से डिटेल्स के साथ फॉलो-अप करवा सकता हूँ—क्या आप इसे टेस्ट करना चाहेंगे?";
    } else if (lang === 'hinglish') {
      reply = "Hum 100 free verified leads ke saath 14-day free pilot offer karte hain. Main hamari team se details ke saath follow-up karwa sakta hoon—kya aap test karna chahenge?";
    }
    return {
      reply,
      classificationSuggestion: 'Interested',
      source: 'local_fallback'
    };
  }

  // 8. DEMO REQUEST ("can I get a demo?", "demo chahiye", "walkthrough")
  if (
    latestText.includes('demo') ||
    latestText.includes('walkthrough') ||
    latestText.includes('see it in action') ||
    latestText.includes('show me') ||
    latestText.includes('schedule a call') ||
    latestText.includes('schedule a demo') ||
    latestText.includes('schedule') ||
    latestText.includes('डेमो') ||
    latestText.includes('दिखाओ') ||
    latestText.includes('dikhao')
  ) {
    const slotGiven = looksLikeDateOrTime(latestRaw) ? extractSlotPhrase(latestRaw) : '';
    if (slotGiven) {
      const askEmailNow = !hasCustomerGivenEmail && !containsEmail(latestRaw) && emailAskCount < 2;
      let slotReply: string;
      if (lang === 'hi') {
        slotReply = `ठीक है, मैंने ${slotGiven} आपके पसंदीदा डेमो समय के रूप में नोट कर लिया है। हमारी टीम इसे कन्फर्म करने के लिए फॉलो-अप करेगी।` + (askEmailNow ? ' कन्फर्मेशन भेजने के लिए आपका ईमेल एड्रेस क्या है?' : ' आपका दिन शुभ हो!');
      } else if (lang === 'hinglish') {
        slotReply = `Theek hai, maine ${slotGiven} aapke preferred demo time ke roop me note kar liya hai. Hamari team ise confirm karne ke liye follow-up karegi.` + (askEmailNow ? ' Confirmation bhejne ke liye aapka email address kya hai?' : ' Have a great day!');
      } else {
        slotReply = `Perfect, I have noted ${slotGiven} as your preferred demo time. Our team will follow up to confirm it.` + (askEmailNow ? ' What is the best email address for the confirmation?' : ' Have a great day!');
      }
      return { reply: slotReply, classificationSuggestion: 'Demo Requested', shouldEndCall: !askEmailNow, source: 'local_fallback' };
    }

    let reply: string;
    if (!hasBotAskedEmail) {
      if (lang === 'hi') {
        reply = "मुझे आपके लिए डेमो वॉकथ्रू अरेंज करने में खुशी होगी! आपके लिए कौन सा दिन और समय सबसे अच्छा रहेगा, और आपका ईमेल एड्रेस क्या है? हमारी टीम कन्फर्म करने के लिए फॉलो-अप करेगी।";
      } else if (lang === 'hinglish') {
        reply = "Main aapke liye demo walkthrough arrange karwa deta hoon! Aapke liye kaunsa day aur time suit karega, aur aapka email address kya hai? Hamari team confirm karne ke liye follow-up karegi.";
      } else {
        reply = "I would be glad to arrange a demo walkthrough for you! What day and time suits you best, and what is your email address? Our team will follow up to confirm.";
      }
    } else {
      if (lang === 'hi') {
        reply = "मुझे आपके लिए डेमो वॉकथ्रू अरेंज करने में खुशी होगी! आपके लिए कौन सा दिन और समय सबसे अच्छा रहेगा? हमारी टीम कन्फर्म करने के लिए फॉलो-अप करेगी।";
      } else if (lang === 'hinglish') {
        reply = "Main aapke liye demo walkthrough arrange karwa deta hoon! Aapke liye kaunsa day aur time suit karega? Hamari team confirm karne ke liye follow-up karegi.";
      } else {
        reply = "I would be glad to arrange a demo walkthrough for you! What day and time suits you best? Our team will follow up to confirm.";
      }
    }

    return {
      reply,
      classificationSuggestion: 'Demo Requested',
      source: 'local_fallback'
    };
  }

  // 9. INTEGRATIONS ("HubSpot", "Salesforce", "Pipedrive", "Zapier")
  if (
    latestText.includes('hubspot') ||
    latestText.includes('salesforce') ||
    latestText.includes('crm') ||
    latestText.includes('integrate') ||
    latestText.includes('zapier') ||
    latestText.includes('pipedrive') ||
    latestText.includes('connect')
  ) {
    let reply = "LeadFlow AI integrates with HubSpot, Salesforce, Pipedrive, and Zapier. Which CRM does your sales team currently use?";
    if (lang === 'hi') {
      reply = "LeadFlow AI HubSpot, Salesforce, Pipedrive और Zapier के साथ इंटीग्रेट करता है। आपकी सेल्स टीम अभी कौन सा CRM इस्तेमाल करती है?";
    } else if (lang === 'hinglish') {
      reply = "LeadFlow AI HubSpot, Salesforce, Pipedrive aur Zapier ke saath integrate karta hai. Aapki sales team currently kaunsa CRM use karti hai?";
    }
    return { reply, source: 'local_fallback' };
  }

  // 10. HESITATION / "I'll think about it"
  if (
    latestText.includes('think about it') ||
    latestText.includes('not sure') ||
    latestText.includes('maybe') ||
    latestText.includes('sochunga') ||
    latestText.includes('सोचूंगा')
  ) {
    let reply: string;
    if (!hasBotAskedEmail) {
      if (lang === 'hi') {
        reply = "आप पूरा समय लें। आपका ईमेल एड्रेस क्या है ताकि हमारी टीम रिव्यू के लिए प्लान ओवरव्यू के साथ फॉलो-अप कर सके?";
      } else if (lang === 'hinglish') {
        reply = "Aap bilkul time lijiye. Aapka email address kya hai taaki hamari team plan overview ke saath follow-up kar sake?";
      } else {
        reply = "Take all the time you need. What is your email address so our team can follow up with our plan overview for you to review?";
      }
    } else {
      if (lang === 'hi') {
        reply = "आप पूरा समय लें। हमारी टीम रिव्यू के लिए प्लान ओवरव्यू के साथ फॉलो-अप करेगी। आपका दिन शुभ हो!";
      } else if (lang === 'hinglish') {
        reply = "Aap bilkul time lijiye. Hamari team plan overview ke saath follow-up karegi. Have a great day!";
      } else {
        reply = "Take all the time you need. Our team will follow up with our plan overview for you to review. Have a great day!";
      }
    }
    return {
      reply,
      classificationSuggestion: 'Follow-up Required',
      source: 'local_fallback'
    };
  }

  // 11. POSITIVE AGREEMENT ("yes", "sure", "okay")
  if (
    latestText.includes('yes') ||
    latestText.includes('sure') ||
    latestText.includes('okay') ||
    latestText.includes('sounds good') ||
    latestText.includes('tell me more') ||
    latestText.includes('interested') ||
    latestText.includes('हाँ') ||
    latestText.includes('haan') ||
    latestText.includes('thik hai')
  ) {
    let reply: string;
    if (!hasBotAskedEmail) {
      if (lang === 'hi') {
        reply = "बहुत अच्छा! आपका ईमेल एड्रेस क्या है ताकि हमारी टीम 100 मुफ़्त वेरिफाइड लीड्स वाले 14 दिनों के मुफ़्त पायलट के लिए फॉलो-अप कर सके या डेमो कन्फर्म कर सके?";
      } else if (lang === 'hinglish') {
        reply = "Badhiya! Aapka email address kya hai taaki hamari team 14-day free pilot (100 free verified leads) ke liye follow-up kar sake ya demo confirm kar sake?";
      } else {
        reply = "Great! What is your email address so our team can follow up regarding our 14-day free pilot with 100 free verified leads, or confirm a demo session?";
      }
    } else {
      if (lang === 'hi') {
        reply = "बहुत अच्छा! हमारी टीम 100 मुफ़्त वेरिफाइड लीड्स वाले 14 दिनों के मुफ़्त पायलट के लिए फॉलो-अप करेगी या डेमो कन्फर्म करेगी।";
      } else if (lang === 'hinglish') {
        reply = "Badhiya! Hamari team 14-day free pilot (100 free verified leads) ke liye follow-up karegi ya demo confirm karegi.";
      } else {
        reply = "Great! Our team will follow up regarding our 14-day free pilot with 100 free verified leads, or confirm a demo session.";
      }
    }

    return {
      reply,
      classificationSuggestion: 'Interested',
      source: 'local_fallback'
    };
  }

  // 11b. "CAN I GET MORE INFORMATION", "WHAT IS THIS", "CAN YOU HELP ME" -> actually answer instead of asking a random question
  const isInfoRequest = /\b(?:more (?:info|information|details)|tell me (?:more )?about|what is (?:this|it)|what does (?:it|this|leadflow)|about (?:this|it|your product)|what do you (?:offer|sell))\b/i.test(latestRaw) ||
    /इसके बारे में|और जानकारी|जानकारी चाहिए|batao is ke baare|iske baare me|more info chahiye/i.test(latestRaw);
  const isProblemHelp = /\b(?:help me|can you help|how can you help|overcome|issues?|problems?|challenges?|struggl\w+)\b/i.test(latestRaw) ||
    /मदद|समस्या|दिक्कत|\bmadad\b|\bproblem\b/i.test(latestRaw);

  if (isInfoRequest) {
    let reply = "LeadFlow AI is an AI voice sales assistant for B2B teams. It talks to your inbound leads, qualifies them, and syncs the results to HubSpot, Salesforce, Pipedrive, or Zapier, so your reps only speak with high-intent buyers. Plans start at $99/month, and there is a 14-day free pilot with 100 free verified leads. Would you like to hear about pricing, the pilot, or see a demo?";
    if (lang === 'hi') {
      reply = "LeadFlow AI B2B टीमों के लिए एक AI वॉयस सेल्स असिस्टेंट है। यह आपकी इनबाउंड लीड्स से बात करके उन्हें क्वालिफाई करता है और नतीजे HubSpot, Salesforce, Pipedrive या Zapier में सिंक करता है। प्लान $99/month से शुरू होते हैं, और 100 मुफ़्त वेरिफाइड लीड्स के साथ 14 दिनों का मुफ़्त पायलट भी है। क्या आप प्राइसिंग, पायलट, या डेमो के बारे में जानना चाहेंगे?";
    } else if (lang === 'hinglish') {
      reply = "LeadFlow AI B2B teams ke liye ek AI voice sales assistant hai. Yeh aapki inbound leads se baat karke unhe qualify karta hai aur results HubSpot, Salesforce, Pipedrive ya Zapier me sync karta hai. Plans $99/month se start hote hain, aur 100 free verified leads ke saath 14-day free pilot bhi hai. Kya aap pricing, pilot, ya demo ke baare me jaanna chahenge?";
    }
    return { reply, classificationSuggestion: 'Interested', source: 'local_fallback' };
  }

  if (isProblemHelp) {
    const alreadyAskedAboutIssue = allBotTextJoined.includes('slow follow-up') || allBotTextJoined.includes('धीमा फॉलो-अप') || allBotTextJoined.includes('slow follow-up');
    let reply: string;
    if (!alreadyAskedAboutIssue) {
      if (lang === 'hi') {
        reply = "ज़रूर, मैं मदद करना चाहूँगा। LeadFlow AI पहले स्टेप को ऑटोमेट करता है: यह आपकी इनबाउंड लीड्स से वॉयस पर बात करके उन्हें क्वालिफाई करता है, ताकि आपकी टीम सिर्फ़ गंभीर खरीदारों से बात करे। क्या आपकी समस्या धीमा फॉलो-अप है, बहुत सारी अनक्वालिफाइड लीड्स हैं, या कुछ और?";
      } else if (lang === 'hinglish') {
        reply = "Zaroor, main help karna chahunga. LeadFlow AI pehla step automate karta hai: yeh aapki inbound leads se voice par baat karke unhe qualify karta hai, taaki aapki team sirf serious buyers se baat kare. Kya issue slow follow-up hai, bahut saari unqualified leads hain, ya kuch aur?";
      } else {
        reply = "I'd be glad to help. LeadFlow AI automates the first step of sales: it talks to your inbound leads by voice and qualifies them, so your reps only speak with high-intent buyers. Is your issue slow follow-up, too many unqualified leads, or something else?";
      }
    } else {
      if (lang === 'hi') {
        reply = "बताने के लिए धन्यवाद। अगला अच्छा कदम 100 मुफ़्त वेरिफाइड लीड्स के साथ हमारा 14 दिनों का मुफ़्त पायलट या एक डेमो वॉकथ्रू हो सकता है। आप कौन सा पसंद करेंगे?";
      } else if (lang === 'hinglish') {
        reply = "Batane ke liye shukriya. Agla accha step 100 free verified leads ke saath hamara 14-day free pilot ya ek demo walkthrough ho sakta hai. Aap kaunsa prefer karenge?";
      } else {
        reply = "Thanks for explaining. A good next step would be our 14-day free pilot with 100 free verified leads, or a quick demo walkthrough. Which would you prefer?";
      }
    }
    return { reply, classificationSuggestion: 'Interested', source: 'local_fallback' };
  }

  // 12. GENERAL QUESTIONS / HOW IT WORKS ("how does it work", "features", "what do you do")
  if (
    latestText.includes('how does it work') ||
    latestText.includes('what do you do') ||
    latestText.includes('features') ||
    latestText.includes('what is leadflow') ||
    latestText.includes('kaise kaam') ||
    latestText.includes('क्या करता है') ||
    latestText.includes('काम कैसे')
  ) {
    let reply = "LeadFlow AI qualifies inbound leads through conversational voice and syncs with your CRM. Would you like our team to arrange a walkthrough?";
    if (lang === 'hi') {
      reply = "LeadFlow AI वॉयस कॉल के ज़रिए इनबाउंड लीड्स को क्वालिफाई करता है और आपके CRM में सिंक करता है। क्या आप चाहेंगे कि हमारी टीम एक वॉकथ्रू अरेंज करे?";
    } else if (lang === 'hinglish') {
      reply = "LeadFlow AI conversational voice ke through inbound leads qualify karta hai aur CRM me sync karta hai. Kya aap chahenge ki hamari team walkthrough arrange kare?";
    }

    return {
      reply,
      classificationSuggestion: 'Interested',
      source: 'local_fallback'
    };
  }

  // 13. GREETINGS & SMALL TALK (Only if message is essentially JUST a greeting)
  const greetingPatterns = [
    'hi', 'hello', 'hey', 'darling', 'alex', 'good morning', 'good afternoon',
    'good evening', 'who is this', 'who are you', 'namaste', 'kya haal'
  ];
  const hasGreetingWord = greetingPatterns.some(gp => {
    const regex = new RegExp(`\\b${gp}\\b`, 'i');
    return regex.test(latestText);
  });

  const greetingTokens = new Set([
    'hi', 'hello', 'hey', 'darling', 'alex', 'there', 'good', 'morning',
    'afternoon', 'evening', 'who', 'is', 'this', 'are', 'you', 'namaste',
    'kya', 'haal', 'hai', 'bhai', 'leadflow', 'bot', 'namashkar', 'ji'
  ]);
  const cleanedWords = latestText
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const nonGreetingWords = cleanedWords.filter(w => !greetingTokens.has(w));
  const isEssentiallyJustGreeting = hasGreetingWord && (
    nonGreetingWords.length === 0 ||
    (cleanedWords.length <= 3 && nonGreetingWords.length <= 1)
  );

  const hasSpecificIntent =
    isPricingInquiry ||
    isAlreadyAnswered ||
    isAskingRecommendation ||
    customerNumber !== null ||
    latestText.includes('pilot') ||
    latestText.includes('14 day') ||
    latestText.includes('14 days') ||
    latestText.includes('demo') ||
    latestText.includes('hubspot') ||
    latestText.includes('salesforce') ||
    latestText.includes('crm') ||
    latestText.includes('integrate') ||
    latestText.includes('zapier') ||
    latestText.includes('pipedrive') ||
    latestText.includes('start') ||
    latestText.includes('buy') ||
    latestText.includes('busy') ||
    latestText.includes('email') ||
    latestText.includes('not interested') ||
    latestText.includes('interest nahi') ||
    latestText.includes('कीमत') ||
    latestText.includes('डेमो') ||
    latestText.includes('दिखाओ') ||
    latestText.includes('chahiye');

  if (isEssentiallyJustGreeting && !hasSpecificIntent) {
    const greetingsEn = [
      "Hello! Great to connect with you. I'm Alex from LeadFlow AI. How is your team currently qualifying new prospect inquiries?",
      "Hi there! Alex here from LeadFlow AI. Are you currently handling lead qualification manually or with an automated tool?",
      "Hey! Thanks for connecting. I'm Alex from LeadFlow AI. Are you exploring voice AI for your sales pipeline?"
    ];
    const greetingsHi = [
      "नमस्ते! आपसे बात करके बहुत अच्छा लगा। मैं LeadFlow AI से एलेक्स हूँ। क्या आपकी टीम अभी इनबाउंड लीड्स को मैन्युअली क्वालिफाई करती है?",
      "नमस्ते! मैं LeadFlow AI से एलेक्स बोल रहा हूँ। आप अपनी इनबाउंड सेल्स लीड्स को अभी कैसे क्वालिफाई कर रहे हैं?"
    ];
    const greetingsHinglish = [
      "Hello! Aapse baat karke accha laga. Main LeadFlow AI se Alex hoon. Kya aapki team abhi inbound leads manually qualify kar rahi hai?",
      "Hi! Alex here from LeadFlow AI. Aapki team new prospect leads kaise qualify kar rahi hai currently?"
    ];

    const list = lang === 'hi' ? greetingsHi : (lang === 'hinglish' ? greetingsHinglish : greetingsEn);
    const reply = list[turnIndex % list.length];
    return { reply, source: 'local_fallback' };
  }

  // 14. DIVERSE QUALIFYING QUESTIONS (Tracked to never repeat; advance to pilot/demo)
  const qualifyingQuestionsEn = [
    {
      id: 'bottleneck',
      text: "I understand. What is the single biggest bottleneck your sales team faces when qualifying inbound leads today?",
      matches: ['bottleneck', 'biggest challenge', 'qualifying inbound leads today']
    },
    {
      id: 'volume',
      text: "Got it. How many inbound sales leads does your team typically process?",
      matches: ['how many inbound', 'leads does your team', 'leads do you']
    },
    {
      id: 'inbound_outbound',
      text: "Understood. Are you primarily looking to automate inbound lead calls, or outbound prospecting as well?",
      matches: ['inbound lead calls, or outbound', 'outbound prospecting']
    },
    {
      id: 'crm',
      text: "Understood. What is the main CRM or tool your team relies on for lead tracking?",
      matches: ['main crm', 'relies on for lead tracking']
    },
    {
      id: 'speed',
      text: "Got it. How quickly does your sales team currently follow up with new inbound leads?",
      matches: ['how quickly', 'follow up with new inbound']
    }
  ];

  const qualifyingQuestionsHi = [
    {
      id: 'bottleneck',
      text: "मैं समझ गया। आज आपकी सेल्स टीम को इनबाउंड लीड्स क्वालिफाई करने में सबसे बड़ी चुनौती क्या आ रही है?",
      matches: ['सबसे बड़ी चुनौती', 'चुनौती क्या आ रही है']
    },
    {
      id: 'volume',
      text: "ठीक है। आपकी टीम आमतौर पर कितनी इनबाउंड लीड्स हैंडल करती है?",
      matches: ['कितनी इनबाउंड लीड्स', 'आमतौर पर कितनी']
    },
    {
      id: 'inbound_outbound',
      text: "समझ गया। क्या आप इनबाउंड लीड्स को ऑटोमेट करना चाहते हैं या आउटबाउंड के लिए भी देख रहे हैं?",
      matches: ['आउटबाउंड के लिए भी', 'इनबाउंड लीड्स को ऑटोमेट']
    },
    {
      id: 'crm',
      text: "समझ गया। आपकी टीम लीड ट्रैकिंग के लिए मुख्य रूप से कौन सा CRM इस्तेमाल करती है?",
      matches: ['कौन सा crm', 'लीड ट्रैकिंग के लिए']
    },
    {
      id: 'speed',
      text: "ठीक है। नई लीड्स आने पर आपकी टीम कितनी जल्दी उनसे संपर्क करती है?",
      matches: ['कितनी जल्दी', 'संपर्क करती है']
    }
  ];

  const qualifyingQuestionsHinglish = [
    {
      id: 'bottleneck',
      text: "Samajh gaya. Aaj aapki sales team ko inbound leads qualify karne me sabse bada challenge kya aata hai?",
      matches: ['sabse bada challenge', 'qualify karne me']
    },
    {
      id: 'volume',
      text: "Got it. Aapki team kitni inbound leads process karti hai?",
      matches: ['kitni inbound leads']
    },
    {
      id: 'inbound_outbound',
      text: "Samajh gaya. Kya aap primarily inbound calls automate karna chahte hain ya outbound outreach bhi?",
      matches: ['outbound outreach', 'inbound calls automate']
    },
    {
      id: 'crm',
      text: "Understood. Lead tracking ke liye aapki sales team kaunsa CRM use karti hai?",
      matches: ['kaunsa crm', 'lead tracking ke liye']
    },
    {
      id: 'speed',
      text: "Got it. New leads aane par aapki sales team currently kitni jaldi respond karti hai?",
      matches: ['kitni jaldi respond', 'new leads aane par']
    }
  ];

  // Check which questions were already asked across the entire call
  const askedQuestionIds = new Set<string>();

  const checkMatches = (matches: string[]) => matches.some(m => allBotTextJoined.includes(m.toLowerCase()));

  for (let i = 0; i < qualifyingQuestionsEn.length; i++) {
    const qId = qualifyingQuestionsEn[i].id;
    if (
      checkMatches(qualifyingQuestionsEn[i].matches) ||
      checkMatches(qualifyingQuestionsHi[i].matches) ||
      checkMatches(qualifyingQuestionsHinglish[i].matches)
    ) {
      askedQuestionIds.add(qId);
    }
  }

  // Filter to questions that have NOT been asked in this call
  const questionsList = lang === 'hi' ? qualifyingQuestionsHi : (lang === 'hinglish' ? qualifyingQuestionsHinglish : qualifyingQuestionsEn);
  const unaskedQuestions = questionsList.filter(q => !askedQuestionIds.has(q.id));

  // Count how many qualifying questions bot has already asked
  const qualifyingAskedCount = askedQuestionIds.size;

  // If there are unasked questions and we haven't asked more than 2 qualifying questions yet, ask the next unasked question
  if (unaskedQuestions.length > 0 && qualifyingAskedCount < 2) {
    return {
      reply: unaskedQuestions[0].text,
      source: 'local_fallback'
    };
  }

  // Otherwise, advance toward the pilot / demo offer! Never repeat a question.
  let advanceReply = "Based on what you've shared, LeadFlow AI could be a great fit for your pipeline. Would you like to try our 14-day free pilot with 100 free verified leads, or see a quick demo walkthrough?";
  if (lang === 'hi') {
    advanceReply = "जो आपने बताया उसके अनुसार LeadFlow AI आपकी टीम के लिए बहुत उपयोगी रहेगा। क्या आप 100 मुफ़्त वेरिफाइड लीड्स के साथ हमारा 14 दिनों का मुफ़्त पायलट देखना चाहेंगे या एक डेमो वॉकथ्रू?";
  } else if (lang === 'hinglish') {
    advanceReply = "Aapke requirements ke hisaab se LeadFlow AI kaafi useful rahega. Kya aap 100 free verified leads ke saath hamara 14-day free pilot try karna chahenge ya demo walkthrough dekhna chahenge?";
  }

  return {
    reply: advanceReply,
    classificationSuggestion: 'Interested',
    source: 'local_fallback'
  };
}

/**
 * Deterministic post-call analysis fallback
 * Strictly derives summary, requirements, objections, next steps, and status ONLY from actual customer utterances.
 * Never invents requirements, objections, or interest from thin air.
 * Exactly six statuses: Converted, Interested, Follow-up Required, Not Interested, Demo Requested, No Response.
 */
export function generateLocalCallAnalysis(transcript: TranscriptMessage[], durationSeconds: number): CallAnalysisResult {
  const customerMessages = transcript.filter(m => m.sender === 'customer');
  const customerUtterances = customerMessages.map(m => m.text.trim()).filter(t => t.length > 0);
  const fullCustomerText = customerUtterances.join(' ').toLowerCase();

  // 1. NO SPEECH AT ALL -> Exactly "No Response"
  if (customerUtterances.length === 0) {
    return {
      status: 'No Response',
      summary: 'Customer did not speak during the call.',
      customerRequirements: ['None stated'],
      objectionsHandled: ['None detected'],
      nextSteps: ['Attempt secondary outreach at a later time.']
    };
  }

  // Check for meaningless single letters / gibberish or pure greetings
  const pureGreetingWords = ['hi', 'hello', 'hey', 'darling', 'alex', 'a', 'hi darling', 'hi alex', 'namaste', 'test', 'नमस्ते'];
  const isOnlyGreetingOrGibberish = customerUtterances.every(u => {
    const clean = u.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '').trim();
    return pureGreetingWords.includes(clean) || (clean.length <= 2 && !/[\u0900-\u097F]/.test(clean));
  });

  // 2. GREETING ONLY / GIBBERISH ONLY -> Exactly "No Response"
  if (isOnlyGreetingOrGibberish) {
    return {
      status: 'No Response',
      summary: `Customer only exchanged initial greeting or brief utterances ("${customerUtterances.join(', ')}") without discussing business requirements.`,
      customerRequirements: ['None stated'],
      objectionsHandled: ['None detected'],
      nextSteps: ['Follow up with initial introductory email.']
    };
  }

  // 2b. FINAL STANCE WINS: if the customer's last words are a clear decline (and they are not asking for details), it ends as Not Interested
  const lastUtterance = customerUtterances[customerUtterances.length - 1].toLowerCase();
  const lastAsksForDetails = /send (?:me )?(?:the )?(?:details|info|information|email)|email me|details bhejo|email bhejo|ईमेल/.test(lastUtterance);
  const declinedAtEnd = !lastAsksForDetails && (
    lastUtterance.includes('not interested') ||
    lastUtterance.includes("don't need") ||
    lastUtterance.includes('dont need') ||
    lastUtterance.includes('no thanks') ||
    lastUtterance.includes('stop calling') ||
    lastUtterance.includes('interest nahi') ||
    lastUtterance.includes('interest nahin') ||
    lastUtterance.includes('दिलचस्पी नहीं') ||
    lastUtterance.includes('नहीं चाहिए') ||
    lastUtterance.includes('nahi chahiye') ||
    lastUtterance.includes('nahin chahiye') ||
    lastUtterance.includes('mat call')
  );
  if (declinedAtEnd) {
    return {
      status: 'Not Interested',
      summary: 'Customer declined at the end of the call and stated they are not interested in LeadFlow AI.',
      customerRequirements: ['None stated'],
      objectionsHandled: ['Customer expressed lack of current need; respected polite closing.'],
      nextSteps: ['Update CRM record to Not Interested; avoid unwanted contact.']
    };
  }

  // 3. CLEARLY AGREED TO START PILOT -> Exactly "Converted"
  const clearlyAgreedToPilot =
    fullCustomerText.includes('start the pilot') ||
    fullCustomerText.includes("let's start the pilot") ||
    fullCustomerText.includes('lets start the pilot') ||
    fullCustomerText.includes('start pilot') ||
    fullCustomerText.includes('begin the pilot') ||
    fullCustomerText.includes('begin pilot') ||
    fullCustomerText.includes('ready for the pilot') ||
    fullCustomerText.includes('sign up for the pilot') ||
    fullCustomerText.includes('want to start the pilot') ||
    fullCustomerText.includes('agree to start the pilot') ||
    fullCustomerText.includes('agree to the pilot') ||
    fullCustomerText.includes('पायलट शुरू करें') ||
    fullCustomerText.includes('पायलट शुरू करो') ||
    fullCustomerText.includes('पायलट शुरू') ||
    fullCustomerText.includes('pilot shuru') ||
    fullCustomerText.includes('pilot start');

  if (clearlyAgreedToPilot) {
    return {
      status: 'Converted',
      summary: 'Customer agreed to start the 14-day free pilot of LeadFlow AI.',
      customerRequirements: ['14-day free pilot with 100 free verified leads'],
      objectionsHandled: ['None detected'],
      nextSteps: ['Our team will follow up to confirm details.']
    };
  }

  // 4. ASKS FOR DEMO / WALKTHROUGH -> Exactly "Demo Requested"
  if (
    fullCustomerText.includes('demo') ||
    fullCustomerText.includes('walkthrough') ||
    fullCustomerText.includes('see it in action') ||
    fullCustomerText.includes('schedule a call') ||
    fullCustomerText.includes('schedule a demo') ||
    fullCustomerText.includes('डेमो') ||
    fullCustomerText.includes('दिखाओ') ||
    fullCustomerText.includes('dikhao')
  ) {
    const requirements: string[] = ['Product walkthrough of LeadFlow AI'];
    if (fullCustomerText.includes('crm') || fullCustomerText.includes('hubspot') || fullCustomerText.includes('salesforce')) {
      requirements.push('Demonstration of CRM integration capabilities');
    }

    return {
      status: 'Demo Requested',
      summary: 'Customer requested a live product demonstration walkthrough of LeadFlow AI.',
      customerRequirements: requirements,
      objectionsHandled: ['None detected'],
      nextSteps: [`Our team will follow up to confirm a demo time${extractSlotPhrase(customerUtterances.join(' ')) ? ` (customer suggested: ${extractSlotPhrase(customerUtterances.join(' '))})` : ''} and session link.`]
    };
  }

  // 5. BUSY / SEND DETAILS / FOLLOW UP LATER (includes "not interested but send me details") -> Exactly "Follow-up Required"
  if (
    fullCustomerText.includes('send me details') ||
    fullCustomerText.includes('email me') ||
    fullCustomerText.includes('send info') ||
    fullCustomerText.includes('send details') ||
    fullCustomerText.includes('send email') ||
    fullCustomerText.includes('busy') ||
    fullCustomerText.includes('call back') ||
    fullCustomerText.includes('call later') ||
    fullCustomerText.includes('later') ||
    fullCustomerText.includes('next week') ||
    fullCustomerText.includes('think about it') ||
    fullCustomerText.includes('ईमेल') ||
    fullCustomerText.includes('बाद में') ||
    fullCustomerText.includes('baad me') ||
    fullCustomerText.includes('email bhejo') ||
    fullCustomerText.includes('details bhejo')
  ) {
    const hasPriceInquiry =
      mentionsPricing(fullCustomerText) ||
      fullCustomerText.includes('kitna') ||
      fullCustomerText.includes('paisa') ||
      fullCustomerText.includes('कीमत') ||
      fullCustomerText.includes('प्लान') ||
      fullCustomerText.includes('दाम');

    const requirements: string[] = [];
    if (hasPriceInquiry) {
      requirements.push('Information on plan tiers ($99 Starter, $299 Growth, $899 Enterprise)');
    }
    requirements.push('Requested product information and pricing details sent via email');

    const objections: string[] = [];
    if (fullCustomerText.includes('not interested')) {
      objections.push('Initial hesitation: customer expressed reluctance on phone but requested details via email');
    } else if (fullCustomerText.includes('busy') || fullCustomerText.includes('later') || fullCustomerText.includes('next week')) {
      objections.push('Time constraint: customer was busy or requested callback at a later date');
    } else {
      objections.push('None detected');
    }

    const summary = hasPriceInquiry
      ? 'Customer inquired about pricing plans ($99 Starter, $299 Growth, $899 Enterprise) and requested product details to be sent via email.'
      : 'Customer requested product details to be sent via email or asked for a follow-up call at a later time.';

    return {
      status: 'Follow-up Required',
      summary,
      customerRequirements: requirements,
      objectionsHandled: objections,
      nextSteps: ['Our team will follow up with pricing and pilot overview via email.']
    };
  }

  // 6. CLEARLY DECLINED -> Exactly "Not Interested"
  if (
    fullCustomerText.includes('not interested') ||
    fullCustomerText.includes("don't need") ||
    fullCustomerText.includes('dont need') ||
    fullCustomerText.includes('stop calling') ||
    fullCustomerText.includes('no thanks') ||
    fullCustomerText.includes('interest nahi') ||
    fullCustomerText.includes('interest nahin') ||
    fullCustomerText.includes('दिलचस्पी नहीं') ||
    fullCustomerText.includes('नहीं चाहिए') ||
    fullCustomerText.includes('nahi chahiye') ||
    fullCustomerText.includes('nahin chahiye') ||
    fullCustomerText.includes('mat call')
  ) {
    return {
      status: 'Not Interested',
      summary: 'Customer explicitly declined the offering and stated they are not interested in LeadFlow AI.',
      customerRequirements: ['None stated'],
      objectionsHandled: ['Customer expressed lack of current need; respected polite closing.'],
      nextSteps: ['Update CRM record to Not Interested; avoid unwanted contact.']
    };
  }

  // 7. ASKS PRODUCT / PRICING / PILOT QUESTIONS -> Exactly "Interested"
  const requirements: string[] = [];
  const objections: string[] = [];

  const isPricingMentioned =
    mentionsPricing(fullCustomerText) ||
    fullCustomerText.includes('kitna') ||
    fullCustomerText.includes('kitne') ||
    fullCustomerText.includes('paisa') ||
    fullCustomerText.includes('paise') ||
    fullCustomerText.includes('daam') ||
    fullCustomerText.includes('kharch') ||
    fullCustomerText.includes('कीमत') ||
    fullCustomerText.includes('प्लान') ||
    fullCustomerText.includes('प्राइस') ||
    fullCustomerText.includes('दाम') ||
    fullCustomerText.includes('रेट') ||
    fullCustomerText.includes('कितना') ||
    fullCustomerText.includes('खर्च') ||
    fullCustomerText.includes('कॉस्ट') ||
    fullCustomerText.includes('पैसा');

  if (isPricingMentioned) {
    requirements.push('Information on plan tiers ($99 Starter, $299 Growth, $899 Enterprise)');
  }

  // Read the lead volume per utterance so a date/time elsewhere in the call cannot hide or fake it
  let customerNum: { numStr: string; val: number } | null = null;
  for (const u of customerUtterances) {
    const found = extractCustomerNumber(u.toLowerCase());
    if (found) customerNum = found;
  }
  if (customerNum) {
    requirements.push(`Lead volume: ~${customerNum.numStr} leads`);
  }

  if (
    fullCustomerText.includes('pilot') ||
    fullCustomerText.includes('14 day') ||
    fullCustomerText.includes('14 days') ||
    fullCustomerText.includes('trial') ||
    fullCustomerText.includes('free leads') ||
    fullCustomerText.includes('मुफ़्त')
  ) {
    requirements.push('Details on 14-day free pilot with 100 free verified leads');
  }
  if (
    fullCustomerText.includes('crm') ||
    fullCustomerText.includes('hubspot') ||
    fullCustomerText.includes('salesforce') ||
    fullCustomerText.includes('pipedrive') ||
    fullCustomerText.includes('zapier')
  ) {
    requirements.push('CRM integration specifications (HubSpot, Salesforce, Pipedrive, Zapier)');
  }

  if (/\b(?:more (?:info|information|details)|tell me (?:more )?about|what is (?:this|it)|help me|can you help|overcome)\b|और जानकारी|इसके बारे में|मदद/i.test(fullCustomerText)) {
    requirements.push('General product information and help with their lead-qualification challenges');
  }

  if (
    fullCustomerText.includes('expensive') ||
    fullCustomerText.includes('too much') ||
    fullCustomerText.includes('mehnga') ||
    fullCustomerText.includes('budget')
  ) {
    objections.push('Pricing concern: asked about budget and plan fit');
  }

  // If customer inquired about something meaningful, treat as Interested
  if (requirements.length > 0) {
    return {
      status: 'Interested',
      summary: `Customer inquired about ${requirements.map(r => r.toLowerCase()).join(' and ')}.`,
      customerRequirements: requirements,
      objectionsHandled: objections.length > 0 ? objections : ['None detected'],
      nextSteps: ['Our team will follow up with requested plan details and pilot information.']
    };
  }

  // Fallback for general unclassified input
  return {
    status: 'Follow-up Required',
    summary: `Customer discussed: "${customerUtterances.join('; ')}".`,
    customerRequirements: ['None stated'],
    objectionsHandled: ['None detected'],
    nextSteps: ['Our team will follow up to qualify specific requirements.']
  };
}