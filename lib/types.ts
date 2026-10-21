export type CallClassification = 
  | 'Converted' 
  | 'Interested' 
  | 'Follow-up Required' 
  | 'Not Interested' 
  | 'Demo Requested' 
  | 'No Response';

export interface TranscriptMessage {
  id: string;
  sender: 'bot' | 'customer' | 'system';
  text: string;
  timestamp: string; // ISO string
}

export interface CallRecord {
  id: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  language?: string; // 'en-US' | 'hi-IN'
  status: CallClassification;
  summary: string;
  customerRequirements: string[];
  objectionsHandled: string[];
  nextSteps: string[];
  audioBlob?: Blob; // Stored natively in browser IndexedDB
  audioRecordingUrl?: string; // Transient in-memory Object URL for <audio> playback
  audioDurationSeconds?: number;
  audioSizeBytes?: number;
  recordingNote: string;
  transcript: TranscriptMessage[];
}

export interface ChatResponse {
  reply: string;
  shouldEndCall?: boolean;
  classificationSuggestion?: CallClassification;
  source: 'gemini' | 'local_fallback';
}

export interface CallAnalysisResult {
  status: CallClassification;
  summary: string;
  customerRequirements: string[];
  objectionsHandled: string[];
  nextSteps: string[];
}
