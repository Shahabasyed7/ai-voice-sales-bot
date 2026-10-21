'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  PhoneCall, 
  PhoneOff, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Clock, 
  ShieldCheck, 
  Play, 
  Square, 
  AlertCircle, 
  CheckCircle2, 
  Sparkles, 
  ListFilter, 
  FileText, 
  Zap, 
  ArrowRight,
  Info,
  Calendar,
  Layers,
  ChevronRight,
  Send
} from 'lucide-react';
import { CallRecord, CallClassification, TranscriptMessage, CallAnalysisResult } from '@/lib/types';
import { PRODUCT_INFO } from '@/lib/salesLogic';
import { saveCallToIndexedDB, getCallsFromIndexedDB, clearAllCallsFromIndexedDB } from '@/lib/indexedDb';
import confetti from 'canvas-confetti';

export default function SalesBotApp() {
  // Call state
  const [isCalling, setIsCalling] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [callStatusText, setCallStatusText] = useState<'idle' | 'listening' | 'bot_thinking' | 'bot_speaking' | 'ended'>('idle');
  const [isListening, setIsListening] = useState<boolean>(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [consentGiven, setConsentGiven] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [callHistory, setCallHistory] = useState<CallRecord[]>([]);
  const [selectedCall, setSelectedCall] = useState<CallRecord | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [lastFinishedCall, setLastFinishedCall] = useState<CallRecord | null>(null);
  const [textInput, setTextInput] = useState('');
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [speechApiSupported, setSpeechApiSupported] = useState(true);
  const [voiceLanguage, setVoiceLanguage] = useState<'en-US' | 'hi-IN'>('en-US');
  const [aiSource, setAiSource] = useState<'gemini' | 'local'>('local');
  const [isConfirmingClear, setIsConfirmingClear] = useState<boolean>(false);
  const confirmClearTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Audio Recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [currentlyPlayingAudio, setCurrentlyPlayingAudio] = useState<string | null>(null);
  const [playingUtteranceId, setPlayingUtteranceId] = useState<string | null>(null);
  const [isPlayingConversation, setIsPlayingConversation] = useState<boolean>(false);
  const [isProcessingEndCall, setIsProcessingEndCall] = useState(false);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const playbackAbortedRef = useRef<boolean>(false);

  // Web Speech recognition & synthesis refs
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const accumulatedSpeechRef = useRef<string>('');
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const restartTimerRef = useRef<NodeJS.Timeout | null>(null);
  const micWatchdogTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasAutoRestartedMicRef = useRef<boolean>(false);
  const startTimeRef = useRef<number>(0);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Stale-closure safe refs that always mirror the latest state
  const transcriptRef = useRef<TranscriptMessage[]>([]);
  const isCallingRef = useRef<boolean>(false);
  const isBotSpeakingRef = useRef<boolean>(false);
  const isThinkingRef = useRef<boolean>(false);
  const voiceLanguageRef = useRef<'en-US' | 'hi-IN'>('en-US');
  const ttsEnabledRef = useRef<boolean>(true);

  // Keep refs synchronized with React state
  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    isCallingRef.current = isCalling;
  }, [isCalling]);

  useEffect(() => {
    voiceLanguageRef.current = voiceLanguage;
  }, [voiceLanguage]);

  useEffect(() => {
    ttsEnabledRef.current = ttsEnabled;
  }, [ttsEnabled]);

  // Watchdog helper to detect when no speech arrives after Alex speaks
  const clearMicWatchdog = () => {
    if (micWatchdogTimerRef.current) {
      clearTimeout(micWatchdogTimerRef.current);
      micWatchdogTimerRef.current = null;
    }
  };

  const armMicWatchdog = () => {
    clearMicWatchdog();
    if (!isCallingRef.current) return;
    micWatchdogTimerRef.current = setTimeout(() => {
      if (!isCallingRef.current || isBotSpeakingRef.current) return;
      setSpeechError("Can't hear you - tap to retry");
      if (!hasAutoRestartedMicRef.current) {
        hasAutoRestartedMicRef.current = true;
        startListeningSession();
      }
    }, 8000);
  };

  // Factory to cleanly start or restart SpeechRecognition without dead instances or abort lockups
  const startListeningSession = () => {
    if (!isCallingRef.current || isBotSpeakingRef.current) return;
    if (typeof window === 'undefined') return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    // Safely detach previous instance if any
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onstart = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.abort();
      } catch (e) {}
      recognitionRef.current = null;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = voiceLanguageRef.current;

      recognition.onstart = () => {
        setIsListening(true);
        setCallStatusText('listening');
        setSpeechError(null);
      };

      recognition.onresult = (event: any) => {
        if (isBotSpeakingRef.current) return;
        clearMicWatchdog();
        setSpeechError(null);

        let interim = '';
        let finals = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const res = event.results[i];
          if (res.isFinal) {
            finals += res[0].transcript;
          } else {
            interim += res[0].transcript;
          }
        }

        if (finals.trim()) {
          accumulatedSpeechRef.current = (accumulatedSpeechRef.current + ' ' + finals.trim()).trim();
        }

        const currentLive = (accumulatedSpeechRef.current + ' ' + interim.trim()).trim();
        setInterimTranscript(currentLive);

        // Debounce timer: wait 1.2s of silence before committing full utterance
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }

        silenceTimerRef.current = setTimeout(() => {
          const textToCommit = accumulatedSpeechRef.current.trim();
          accumulatedSpeechRef.current = '';
          setInterimTranscript('');

          if (textToCommit && textToCommit.length >= 2) {
            handleCustomerSpeech(textToCommit);
          }
        }, 1200);
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'no-speech') {
          // Standard browser silence timeout; ignore and let onend restart smoothly
          return;
        }
        console.warn("Speech recognition error:", event.error);
        setIsListening(false);
        if (event.error === 'audio-capture') {
          setSpeechError("No microphone found or audio capture failed. Tap to retry.");
        } else if (event.error === 'not-allowed') {
          setSpeechError("Microphone permission denied. Please allow microphone access in your browser.");
        } else if (event.error === 'network') {
          setSpeechError("Network error during speech recognition. Tap to retry.");
        } else {
          setSpeechError(`Speech recognition error (${event.error}). Tap to retry.`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        // Automatically restart fresh session if call is active and bot is not speaking
        if (isCallingRef.current && !isBotSpeakingRef.current) {
          if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
          restartTimerRef.current = setTimeout(() => {
            startListeningSession();
          }, 120);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn("Failed to initialize speech recognition:", err);
      if (isCallingRef.current && !isBotSpeakingRef.current) {
        if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
        restartTimerRef.current = setTimeout(() => {
          startListeningSession();
        }, 500);
      }
    }
  };

  // Manual retry handler when user taps "Not listening – tap to retry"
  const retryListening = () => {
    clearMicWatchdog();
    setSpeechError(null);
    if (!isCallingRef.current) return;
    if (isBotSpeakingRef.current) {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      isBotSpeakingRef.current = false;
    }
    setCallStatusText('listening');
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    startListeningSession();
    armMicWatchdog();
  };

  // Helper to reliably append a message to both ref and state
  const appendTranscriptMessage = (msg: TranscriptMessage): TranscriptMessage[] => {
    const updated = [...transcriptRef.current, msg];
    transcriptRef.current = updated;
    setTranscript(prev => [...prev, msg]);
    return updated;
  };

  // 1. Initial Load of History from client IndexedDB & Browser Capability Checks
  useEffect(() => {
    loadLocalHistory();
    // Check SpeechRecognition support
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setSpeechApiSupported(false);
      }
    }

    return () => {
      if (restartTimerRef.current) {
        clearTimeout(restartTimerRef.current);
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {}
      }
    };
  }, []);

  const loadLocalHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const calls = await getCallsFromIndexedDB();
      setCallHistory(calls);
      if (calls.length > 0 && !selectedCall) {
        setSelectedCall(calls[0]);
      }
    } catch (err) {
      console.error('Failed to load call history from IndexedDB:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Clear all call history from IndexedDB with two-click confirmation
  const handleClearHistory = async () => {
    if (!isConfirmingClear) {
      setIsConfirmingClear(true);
      if (confirmClearTimerRef.current) clearTimeout(confirmClearTimerRef.current);
      confirmClearTimerRef.current = setTimeout(() => {
        setIsConfirmingClear(false);
      }, 5000);
      return;
    }

    if (confirmClearTimerRef.current) {
      clearTimeout(confirmClearTimerRef.current);
      confirmClearTimerRef.current = null;
    }
    setIsConfirmingClear(false);

    try {
      await clearAllCallsFromIndexedDB();
      setSelectedCall(null);
      setLastFinishedCall(null);
      await loadLocalHistory();
    } catch (err) {
      console.error('Failed to clear call history:', err);
    }
  };

  // Active transcript to display in the transcript viewer (live call or selected call from history)
  const displayedTranscript = isCalling
    ? transcript
    : (selectedCall?.transcript && selectedCall.transcript.length > 0
        ? selectedCall.transcript
        : transcript);

  // Scroll transcript to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayedTranscript]);

  // 2. Start Call
  const startCall = async () => {
    if (!consentGiven) {
      alert("Please confirm explicit recording & microphone consent before starting the call.");
      return;
    }

    try {
      // Setup MediaRecorder for customer voice recording
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      streamRef.current = stream;
      audioChunksRef.current = [];

      // Determine best supported MIME type
      let mimeType = 'audio/webm';
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
          mimeType = 'audio/ogg;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        }
      }

      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // Request data chunks every 1 second so buffers are continually flushed
      mediaRecorder.start(1000);

      // Start call states
      isCallingRef.current = true;
      isBotSpeakingRef.current = false;
      setIsCalling(true);
      setIsListening(false);
      setSpeechError(null);
      setCallDuration(0);
      startTimeRef.current = Date.now();
      setRecordedAudioUrl(null);
      setLastFinishedCall(null);
      setCallStatusText('bot_speaking');

      // Timer
      callTimerRef.current = setInterval(() => {
        setCallDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);

      // Initial opening greeting from Alex based on selected language
      const openingText = voiceLanguageRef.current === 'hi-IN'
        ? "नमस्ते! मैं LeadFlow AI से एलेक्स बोल रहा हूँ। आप अपनी इनबाउंड सेल्स लीड्स को अभी कैसे क्वालिफाई कर रहे हैं?"
        : "Hi there! This is Alex calling from LeadFlow AI. I noticed your team has been scaling outreach. How are you currently qualifying your inbound sales leads?";

      const openingMessage: TranscriptMessage = {
        id: `msg-${Date.now()}`,
        sender: 'bot',
        text: openingText,
        timestamp: new Date().toISOString()
      };
      transcriptRef.current = [openingMessage];
      setTranscript([openingMessage]);
      speakText(openingMessage.text);

    } catch (err) {
      console.error("Microphone access error:", err);
      alert("Microphone access is required for real voice conversation. Please allow microphone access.");
    }
  };

  // 3. Text-to-Speech Helper with Multilingual Voice Selection
  const speakText = (text: string, onFinish?: () => void) => {
    clearMicWatchdog();
    hasAutoRestartedMicRef.current = false;

    if (!ttsEnabledRef.current || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      isBotSpeakingRef.current = false;
      if (onFinish) {
        onFinish();
      } else if (isCallingRef.current) {
        startListeningSession();
        armMicWatchdog();
      }
      return;
    }

    // Don't restart recognition while Alex is speaking to prevent feedback loops
    isBotSpeakingRef.current = true;
    setIsListening(false);
    setCallStatusText('bot_speaking');

    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }

    // Safely detach and abort previous recognition session to prevent echo loops
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onstart = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.abort();
      } catch (e) {}
      recognitionRef.current = null;
    }

    window.speechSynthesis.cancel(); // Stop any pending speech
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.02;
    utterance.pitch = 1.0;

    // Detect if text contains Devanagari Hindi characters
    const hasHindiScript = /[\u0900-\u097F]/.test(text);
    const targetLang = hasHindiScript ? 'hi-IN' : (voiceLanguageRef.current === 'hi-IN' ? 'hi-IN' : 'en-US');
    utterance.lang = targetLang;

    // Pick appropriate voice
    const voices = window.speechSynthesis.getVoices();
    if (hasHindiScript || targetLang === 'hi-IN') {
      const hindiVoice = voices.find(v => v.lang.includes('hi') || v.lang.includes('Hindi'));
      if (hindiVoice) {
        utterance.voice = hindiVoice;
      }
    } else {
      const preferredVoice = voices.find(v => v.lang.includes('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('David')));
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }
    }

    // Resume recognition immediately right after bot finishes speaking (no delay)
    // Listening... will only show once recognition.onstart has fired
    utterance.onend = () => {
      isBotSpeakingRef.current = false;
      if (onFinish) {
        onFinish();
      } else if (isCallingRef.current) {
        startListeningSession();
        armMicWatchdog();
      }
    };

    utterance.onerror = (e) => {
      console.warn("Speech synthesis error or cancelled:", e);
      isBotSpeakingRef.current = false;
      if (onFinish) {
        onFinish();
      } else if (isCallingRef.current) {
        startListeningSession();
        armMicWatchdog();
      }
    };

    window.speechSynthesis.speak(utterance);
  };

  // 4. Handle Customer Utterance
  const handleCustomerSpeech = async (spokenText: string) => {
    // Don't send a message if the committed text is empty or under 2 characters
    if (!spokenText || spokenText.trim().length < 2) return;

    const customerMsg: TranscriptMessage = {
      id: `msg-${Date.now()}`,
      sender: 'customer',
      text: spokenText.trim(),
      timestamp: new Date().toISOString()
    };

    // Append customer message to full conversation stream
    const updatedWithCustomer = appendTranscriptMessage(customerMsg);
    setCallStatusText('bot_thinking');
    isThinkingRef.current = true;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: updatedWithCustomer })
      });

      const data = await res.json();
      if (data.source === 'gemini') {
        setAiSource('gemini');
      } else {
        setAiSource('local');
      }
      const botReplyText = data.reply || "I'd love to show you how LeadFlow AI works. Would you be interested in a 14-day free pilot?";

      const botMsg: TranscriptMessage = {
        id: `msg-${Date.now() + 1}`,
        sender: 'bot',
        text: botReplyText,
        timestamp: new Date().toISOString()
      };

      // Append bot response to full conversation stream
      const finalTranscript = appendTranscriptMessage(botMsg);

      // Celebrate conversion if customer agreed
      if (data.classificationSuggestion === 'Converted') {
        confetti({ particleCount: 70, spread: 60, origin: { y: 0.7 } });
      }

      if (data.shouldEndCall) {
        // Speak the final closing response completely, THEN cleanly end the call
        speakText(botReplyText, () => {
          setTimeout(() => {
            endCall(finalTranscript);
          }, 800);
        });
      } else {
        speakText(botReplyText);
      }
    } catch (err) {
      console.error('Error getting sales reply:', err);
      if (isCallingRef.current) {
        startListeningSession();
      }
    } finally {
      isThinkingRef.current = false;
    }
  };

  // 5. End Call & Trigger Analysis & Save to IndexedDB
  const endCall = async (finalTranscriptOverride?: TranscriptMessage[]) => {
    if (!isCallingRef.current && !isCalling) return;

    // If chat request is currently in flight, wait briefly so Alex's pending response is captured
    if (isThinkingRef.current) {
      setCallStatusText('bot_thinking');
      for (let i = 0; i < 20; i++) {
        if (!isThinkingRef.current) break;
        await new Promise(r => setTimeout(r, 100));
      }
    }

    // Flush any pending spoken text in the buffer so caller's last utterance is not discarded
    if (accumulatedSpeechRef.current && accumulatedSpeechRef.current.trim().length >= 2) {
      const pendingText = accumulatedSpeechRef.current.trim();
      const pendingMsg: TranscriptMessage = {
        id: `msg-${Date.now()}`,
        sender: 'customer',
        text: pendingText,
        timestamp: new Date().toISOString()
      };
      appendTranscriptMessage(pendingMsg);
    }

    clearMicWatchdog();
    hasAutoRestartedMicRef.current = false;
    isCallingRef.current = false;
    isBotSpeakingRef.current = false;
    setIsCalling(false);
    setIsListening(false);
    setSpeechError(null);
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    // Clear silence debounce timer on End Call
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    accumulatedSpeechRef.current = '';
    setInterimTranscript('');

    setIsProcessingEndCall(true);
    setCallStatusText('ended');

    // Cancel TTS
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    // Stop recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onstart = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.abort();
      } catch (e) {}
      recognitionRef.current = null;
    }

    // Stop timer
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }

    // Await MediaRecorder final dataavailable and stop events
    let audioBlob: Blob | undefined = undefined;
    let audioDataUrl: string | undefined = undefined;
    let audioBlobSize = 0;

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      try {
        await new Promise<void>((resolve) => {
          let resolved = false;
          const finish = () => {
            if (!resolved) {
              resolved = true;
              resolve();
            }
          };

          recorder.addEventListener('stop', () => finish(), { once: true });
          // Force flush any buffered audio chunks before stopping
          try {
            if (recorder.state === 'recording') {
              recorder.requestData();
            }
          } catch (flushErr) {
            console.warn('Could not flush recorder buffer:', flushErr);
          }
          recorder.stop();
          // Fallback timeout in case event doesn't fire
          setTimeout(finish, 1000);
        });
      } catch (recErr) {
        console.warn('Error while stopping MediaRecorder:', recErr);
      }
    }

    // Release microphone tracks
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((track) => track.stop());
      } catch (streamErr) {
        console.warn('Error stopping audio tracks:', streamErr);
      }
      streamRef.current = null;
    }

    // Compile collected audio chunks into single native Blob
    if (audioChunksRef.current.length > 0) {
      const mime = recorder?.mimeType || 'audio/webm';
      audioBlob = new Blob(audioChunksRef.current, { type: mime });
      audioBlobSize = audioBlob.size;

      if (audioBlobSize > 0) {
        try {
          audioDataUrl = URL.createObjectURL(audioBlob);
          setRecordedAudioUrl(audioDataUrl);
        } catch (readErr) {
          console.error('Failed to create object URL for audio Blob:', readErr);
        }
      }
    }

    const duration = Math.max(1, Math.floor((Date.now() - startTimeRef.current) / 1000));
    const finalTranscript = finalTranscriptOverride || transcriptRef.current;

    // Send ONLY transcript text and duration to server for classification and summary (no audio payload!)
    try {
      const res = await fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          durationSeconds: duration,
          transcript: finalTranscript
        })
      });

      let analysis: CallAnalysisResult = {
        status: 'No Response',
        summary: 'Call ended.',
        customerRequirements: ['None stated'],
        objectionsHandled: ['None detected'],
        nextSteps: ['Follow up with initial introductory email.']
      };

      if (res.ok) {
        const result = await res.json();
        if (result.analysis) {
          analysis = result.analysis;
        }
      }

      const recordingNote = audioBlob && audioBlobSize > 0
        ? `Customer microphone audio captured directly via Web MediaRecorder (${(audioBlobSize / 1024).toFixed(1)} KB, ${recorder?.mimeType || 'audio/webm'}). Alex's spoken responses transcribed and archived verbatim.`
        : "Session audio captured and archived. Alex's spoken responses and customer turns recorded verbatim.";

      const callRecord: CallRecord = {
        id: `call-${Date.now()}`,
        startedAt: new Date(startTimeRef.current).toISOString(),
        endedAt: new Date().toISOString(),
        durationSeconds: duration,
        language: voiceLanguage,
        status: analysis.status,
        summary: analysis.summary,
        customerRequirements: analysis.customerRequirements,
        objectionsHandled: analysis.objectionsHandled,
        nextSteps: analysis.nextSteps,
        audioBlob: audioBlobSize > 0 ? audioBlob : undefined,
        audioRecordingUrl: audioDataUrl,
        audioDurationSeconds: duration,
        audioSizeBytes: audioBlobSize,
        recordingNote,
        transcript: finalTranscript
      };

      // Persist directly into browser-side IndexedDB (retains Blob without base64 overhead)
      await saveCallToIndexedDB(callRecord);

      setLastFinishedCall(callRecord);
      setSelectedCall(callRecord);
      await loadLocalHistory(); // refresh list from browser IndexedDB
    } catch (err) {
      console.error('Failed to analyze and save call:', err);
    } finally {
      setIsProcessingEndCall(false);
    }
  };

  // Playback audio recorder (Customer microphone track)
  const toggleAudioPlayback = (audioUrl: string) => {
    if (isPlayingConversation) {
      stopConversationPlayback();
    }
    if (currentlyPlayingAudio === audioUrl) {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      setCurrentlyPlayingAudio(null);
    } else {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      const audio = new Audio(audioUrl);
      audioPlayerRef.current = audio;
      audio.play();
      setCurrentlyPlayingAudio(audioUrl);
      audio.onended = () => setCurrentlyPlayingAudio(null);
    }
  };

  // Stop active full conversation playback
  const stopConversationPlayback = () => {
    playbackAbortedRef.current = true;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
    }
    setIsPlayingConversation(false);
    setPlayingUtteranceId(null);
  };

  // Play full conversation with synchronized utterance highlighting
  const playFullConversation = async (call: CallRecord) => {
    if (isPlayingConversation) {
      stopConversationPlayback();
      return;
    }

    if (!call.transcript || call.transcript.length === 0) return;

    if (currentlyPlayingAudio) {
      if (audioPlayerRef.current) audioPlayerRef.current.pause();
      setCurrentlyPlayingAudio(null);
    }

    playbackAbortedRef.current = false;
    setIsPlayingConversation(true);

    for (let i = 0; i < call.transcript.length; i++) {
      if (playbackAbortedRef.current) break;
      const msg = call.transcript[i];
      setPlayingUtteranceId(msg.id);

      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        await new Promise<void>((resolve) => {
          const utterance = new SpeechSynthesisUtterance(msg.text);
          utterance.rate = 1.05;
          const hasHindiScript = /[\u0900-\u097F]/.test(msg.text);
          const lang = hasHindiScript ? 'hi-IN' : (call.language === 'hi-IN' ? 'hi-IN' : 'en-US');
          utterance.lang = lang;

          const voices = window.speechSynthesis.getVoices();
          if (msg.sender === 'bot') {
            utterance.pitch = 1.0;
            if (hasHindiScript || lang === 'hi-IN') {
              const hv = voices.find(v => v.lang.includes('hi'));
              if (hv) utterance.voice = hv;
            } else {
              const bv = voices.find(v => v.lang.includes('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('David')));
              if (bv) utterance.voice = bv;
            }
          } else {
            utterance.pitch = 1.15;
            const cv = voices.find(v => v.lang.includes('en') && (v.name.includes('Zira') || v.name.includes('Samantha')));
            if (cv) utterance.voice = cv;
          }

          let done = false;
          const finish = () => {
            if (!done) {
              done = true;
              resolve();
            }
          };

          utterance.onend = finish;
          utterance.onerror = finish;
          window.speechSynthesis.speak(utterance);

          const words = msg.text.split(' ').length;
          const estimatedMs = Math.max(1800, words * 450);
          setTimeout(finish, estimatedMs);
        });
      } else {
        await new Promise(r => setTimeout(r, 2000));
      }

      if (playbackAbortedRef.current) break;
      await new Promise(r => setTimeout(r, 350));
    }

    setPlayingUtteranceId(null);
    setIsPlayingConversation(false);
  };

  // Format seconds to MM:SS
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  // Badge styling for status
  const getStatusBadge = (status: CallClassification) => {
    const styles: Record<CallClassification, string> = {
      'Converted': 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
      'Interested': 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
      'Demo Requested': 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30',
      'Follow-up Required': 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
      'Not Interested': 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
      'No Response': 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/30',
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles[status] || styles['Interested']}`}>
        {status}
      </span>
    );
  };

  // Filtered calls
  const filteredCalls = filterStatus === 'All' 
    ? callHistory 
    : callHistory.filter(c => c.status === filterStatus);



  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-indigo-500/30">
      {/* Top Navigation */}
      <header className="border-b border-zinc-800/80 bg-zinc-900/60 backdrop-blur-md sticky top-0 z-30 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">LeadFlow AI</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">Voice Agent</span>
              </div>
              <p className="text-xs text-zinc-400">Sankar Group AI Voice Sales Bot • Autonomous Qualification</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 text-xs bg-zinc-800/80 px-3 py-1.5 rounded-lg border border-zinc-700/60 text-zinc-300">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>{aiSource === 'gemini' ? 'AI replies: Gemini' : 'AI replies: Local engine'}</span>
            </div>
            
            <button
              onClick={() => setTtsEnabled(!ttsEnabled)}
              title={ttsEnabled ? "Voice Output Active" : "Voice Output Muted"}
              className={`p-2 rounded-lg border transition-all ${
                ttsEnabled 
                  ? 'bg-indigo-950/50 text-indigo-300 border-indigo-700/50' 
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700'
              }`}
            >
              {ttsEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto w-full p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
        
        {/* Left Column: Live Call Controller & Conversation (7 Cols) */}
        <section className="lg:col-span-7 flex flex-col gap-6">
          
          {/* Call Cockpit Card */}
          <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm relative overflow-hidden">
            {/* Visual ambient glow when active */}
            {isCalling && (
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />
            )}

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-zinc-800/80">
              <div className="flex items-center gap-3">
                <div className={`h-3 w-3 rounded-full ${
                  isCalling 
                    ? 'bg-emerald-500 animate-ping' 
                    : 'bg-zinc-600'
                }`} />
                <div>
                  <h2 className="text-base font-semibold text-zinc-100">Live Voice Sales Call</h2>
                  <div className="flex items-center gap-2 text-xs text-zinc-400 mt-0.5">
                    {isCalling ? (
                      callStatusText === 'bot_speaking' ? (
                        <span className="text-indigo-400 font-medium flex items-center gap-1.5">
                          <Volume2 className="h-3.5 w-3.5 animate-pulse" />
                          Alex is speaking...
                        </span>
                      ) : callStatusText === 'bot_thinking' ? (
                        <span className="text-violet-400 font-medium flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5 animate-spin" />
                          Alex is analyzing...
                        </span>
                      ) : isListening ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Listening…
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={retryListening}
                          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition-all cursor-pointer"
                          title="Click to restart voice recognition"
                        >
                          <MicOff className="h-3 w-3 text-amber-400" />
                          Not listening – tap to retry
                        </button>
                      )
                    ) : (
                      <span className="font-medium text-zinc-400">Call Disconnected</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Timer, Language & Controls */}
              <div className="flex items-center gap-3">
                {/* Language Mode Selector */}
                <select
                  value={voiceLanguage}
                  onChange={(e) => setVoiceLanguage(e.target.value as 'en-US' | 'hi-IN')}
                  disabled={isCalling}
                  title="Voice Recognition & Synthesis Language"
                  className="bg-zinc-950 border border-zinc-800 text-zinc-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 font-medium"
                >
                  <option value="en-US">English (US)</option>
                  <option value="hi-IN">Hindi / Hinglish (IN)</option>
                </select>

                <div className="flex items-center gap-2 bg-zinc-950 px-3 py-1.5 rounded-lg border border-zinc-800 text-sm font-mono text-zinc-300">
                  <Clock className="h-4 w-4 text-indigo-400" />
                  <span>{formatTime(callDuration)}</span>
                </div>

                {!isCalling ? (
                  <button
                    onClick={startCall}
                    disabled={!consentGiven}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all shadow-lg ${
                      consentGiven
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30 active:scale-95 cursor-pointer'
                        : 'bg-zinc-800 text-zinc-500 border border-zinc-700/50 cursor-not-allowed'
                    }`}
                  >
                    <PhoneCall className="h-4 w-4" />
                    <span>Start Call</span>
                  </button>
                ) : (
                  <button
                    onClick={() => endCall()}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-900/30 active:scale-95 transition-all cursor-pointer"
                  >
                    <PhoneOff className="h-4 w-4" />
                    <span>End Call</span>
                  </button>
                )}
              </div>
            </div>

            {/* Real-time Voice Recognition Error Banner */}
            {isCalling && speechError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-3 animate-in fade-in duration-200">
                <div className="flex items-center gap-2 min-w-0">
                  <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
                  <span className="truncate">{speechError}</span>
                </div>
                <button
                  type="button"
                  onClick={retryListening}
                  className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-semibold border border-rose-500/40 shrink-0 transition-colors cursor-pointer"
                >
                  Tap to retry
                </button>
              </div>
            )}

            {/* Mandatory Explicit Consent Checkbox */}
            <div className="mt-4 p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800 flex items-start gap-3">
              <input
                type="checkbox"
                id="consentCheck"
                checked={consentGiven}
                onChange={(e) => setConsentGiven(e.target.checked)}
                disabled={isCalling}
                className="mt-1 h-4 w-4 rounded border-zinc-700 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-zinc-900 bg-zinc-900 cursor-pointer"
              />
              <label htmlFor="consentCheck" className="text-xs text-zinc-300 leading-relaxed cursor-pointer select-none">
                <strong className="text-zinc-100 font-semibold block mb-0.5">Explicit Recording & Microphone Consent:</strong>
                I agree to enable the microphone and consent to this sales conversation being recorded for AI quality assurance, requirement capture, and conversion scoring.
              </label>
            </div>

            {/* Recording Truth in Advertising Notice & Browser-Only Storage Notice */}
            <div className="mt-2.5 text-[11px] text-zinc-400 flex flex-col gap-1 px-1">
              <div className="flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                <span>Recording captures your microphone audio directly. Synthesized bot speech is transcribed verbatim into the record.</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                <span>If AI replies are enabled, conversation text is processed by Google&apos;s Gemini API.</span>
              </div>
              <div className="flex items-center gap-1.5 text-indigo-400/90 font-medium">
                <ShieldCheck className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                <span>Call history and recordings are stored only in this browser.</span>
              </div>
            </div>

            {/* Web Speech Warning if unsupported */}
            {!speechApiSupported && (
              <div className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>Web Speech API is best supported in Google Chrome, Edge, and Safari. If speech recognition fails, you can also use the live text input below.</span>
              </div>
            )}
          </div>

          {/* Live & Historical Transcript Stream */}
          <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-5 flex flex-col h-[460px] shadow-xl backdrop-blur-sm">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-indigo-400" />
                <h3 className="text-sm font-semibold text-zinc-200">
                  {isCalling ? 'Live Transcript' : (selectedCall ? `Transcript · ${selectedCall.status}` : 'Transcript')}
                </h3>
              </div>
              <span className="text-xs text-zinc-500">{displayedTranscript.length} utterances</span>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
              {displayedTranscript.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500">
                  <Mic className="h-8 w-8 mb-2 stroke-1 text-zinc-600" />
                  <p className="text-sm font-medium">No call transcript yet</p>
                  <p className="text-xs text-zinc-600 max-w-sm mt-1">
                    Grant recording consent above and click &quot;Start Call&quot; to speak with Alex, our LeadFlow AI sales representative.
                  </p>
                </div>
              ) : (
                displayedTranscript.map((msg) => {
                  const isCurrentlyPlaying = playingUtteranceId === msg.id;
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col transition-all duration-200 ${
                        msg.sender === 'customer' 
                          ? 'items-end' 
                          : 'items-start'
                      } ${isCurrentlyPlaying ? 'scale-[1.01]' : ''}`}
                    >
                      <div className="flex items-center gap-1.5 mb-1 px-1">
                        <span className="text-[11px] font-semibold text-zinc-400 flex items-center gap-1">
                          {msg.sender === 'customer' ? 'Customer (You)' : 'Alex (LeadFlow AI)'}
                          {isCurrentlyPlaying && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] text-indigo-300 bg-indigo-500/20 px-1.5 py-0.5 rounded font-mono border border-indigo-500/30">
                              <Volume2 className="h-2.5 w-2.5 animate-pulse" /> Playing
                            </span>
                          )}
                        </span>
                        <span className="text-[10px] text-zinc-600">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>

                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed transition-all ${
                          msg.sender === 'customer'
                            ? `bg-indigo-600 text-white rounded-tr-sm shadow-md shadow-indigo-950/40 ${isCurrentlyPlaying ? 'ring-2 ring-indigo-300' : ''}`
                            : `bg-zinc-800/90 text-zinc-100 border border-zinc-700/60 rounded-tl-sm shadow-md ${isCurrentlyPlaying ? 'ring-2 ring-indigo-400 bg-zinc-800' : ''}`
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Optional Fallback Keyboard Input when in call */}
            {isCalling && (
              <div className="pt-3 border-t border-zinc-800 flex flex-col gap-1.5">
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (textInput.trim() && textInput.trim().length >= 2) {
                      handleCustomerSpeech(textInput.trim());
                      setTextInput('');
                    }
                  }}
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="Or type customer response if voice is quiet..."
                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="submit"
                    className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-1 border border-zinc-700 cursor-pointer"
                  >
                    <Send className="h-3 w-3" />
                    <span>Send</span>
                  </button>
                </form>
                {interimTranscript && (
                  <div className="text-[11px] text-indigo-300 italic px-1 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse shrink-0" />
                    <span>Hearing: &quot;{interimTranscript}&quot;</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Product Playbook Quick Reference */}
          <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5">
            <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Layers className="h-3.5 w-3.5 text-indigo-400" />
              <span>LeadFlow AI Value Propositions & Objection Handling</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80">
                <span className="text-indigo-400 font-semibold block mb-1">Pricing Tiers</span>
                <p className="text-zinc-400 text-[11px] leading-relaxed">
                  Starter ($99), Growth ($299), Enterprise ($899). 14-Day Free Pilot with 100 free verified leads.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80">
                <span className="text-indigo-400 font-semibold block mb-1">Integrations</span>
                <p className="text-zinc-400 text-[11px] leading-relaxed">
                  HubSpot, Salesforce, Pipedrive, and Zapier with 5-minute zero-code sync.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80">
                <span className="text-indigo-400 font-semibold block mb-1">Objection Counter</span>
                <p className="text-zinc-400 text-[11px] leading-relaxed">
                  Pays for itself with 1 closed deal. Low latency voice. Customer and lead data is processed securely.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Right Column: Post-Call Intelligence & History (5 Cols) */}
        <section className="lg:col-span-5 flex flex-col gap-6">

          {/* Post-Call Analysis Card (Selected or Latest Call) */}
          <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-indigo-400" />
                <h3 className="text-sm font-semibold text-zinc-100">Post-Call AI Summary</h3>
              </div>
              {selectedCall && getStatusBadge(selectedCall.status)}
            </div>

            {selectedCall ? (
              <div className="mt-4 space-y-4 text-xs">
                {/* Meta details */}
                <div className="grid grid-cols-2 gap-2 p-3 bg-zinc-950 rounded-xl border border-zinc-800 text-[11px]">
                  <div>
                    <span className="text-zinc-500 block">Duration</span>
                    <span className="text-zinc-200 font-medium font-mono">{formatTime(selectedCall.durationSeconds)}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Date</span>
                    <span className="text-zinc-200 font-medium">{new Date(selectedCall.endedAt).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Summary */}
                <div>
                  <h4 className="font-semibold text-zinc-300 mb-1">Executive Summary</h4>
                  <p className="text-zinc-400 leading-relaxed bg-zinc-950/60 p-3 rounded-xl border border-zinc-800/80">
                    {selectedCall.summary}
                  </p>
                </div>

                {/* Customer Requirements */}
                <div>
                  <h4 className="font-semibold text-zinc-300 mb-1.5 flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-indigo-400" />
                    <span>Customer Requirements</span>
                  </h4>
                  <ul className="space-y-1.5 pl-1">
                    {selectedCall.customerRequirements.map((req, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-zinc-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                        <span>{req}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Objections Handled */}
                <div>
                  <h4 className="font-semibold text-zinc-300 mb-1.5 flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
                    <span>Objections Handled</span>
                  </h4>
                  <ul className="space-y-1.5 pl-1">
                    {selectedCall.objectionsHandled.map((obj, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-zinc-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                        <span>{obj}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Next Steps */}
                <div>
                  <h4 className="font-semibold text-zinc-300 mb-1.5 flex items-center gap-1.5">
                    <ArrowRight className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Recommended Next Steps</span>
                  </h4>
                  <ul className="space-y-1.5 pl-1">
                    {selectedCall.nextSteps.map((step, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-zinc-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Audio Recording & Playback */}
                <div className="pt-2 border-t border-zinc-800">
                  <span className="font-semibold text-zinc-300 block mb-2">Audio Recording & Playback</span>
                  <div className="space-y-2">
                    {/* Option 1: Play Full Conversation (Alex + Customer) */}
                    {selectedCall.transcript && selectedCall.transcript.length > 0 && (
                      <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => playFullConversation(selectedCall)}
                            className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer transition-colors shadow-sm"
                            title="Play all conversation turns in order with active highlighting"
                          >
                            {isPlayingConversation ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                          </button>
                          <div className="flex flex-col">
                            <span className="text-zinc-200 text-xs font-medium">
                              {isPlayingConversation ? "Playing conversation..." : "Replay conversation (both sides)"}
                            </span>
                            <span className="text-[10px] text-zinc-500">
                              Synchronized audio playback with transcript highlighting ({selectedCall.transcript.length} turns)
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded font-mono border border-indigo-500/20">
                          Dual
                        </span>
                      </div>
                    )}

                    {/* Option 2: Listen to Customer Microphone Track */}
                    {selectedCall.audioRecordingUrl || recordedAudioUrl ? (
                      <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => toggleAudioPlayback(selectedCall.audioRecordingUrl || recordedAudioUrl!)}
                            className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 cursor-pointer transition-colors border border-zinc-700"
                            title="Play raw caller microphone recording"
                          >
                            {currentlyPlayingAudio ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                          </button>
                          <div className="flex flex-col">
                            <span className="text-zinc-300 text-xs">
                              {currentlyPlayingAudio ? "Playing caller microphone audio..." : "Listen to Recorded Caller Mic Audio"}
                            </span>
                            <span className="text-[10px] text-zinc-500">
                              Captured via Web MediaRecorder ({selectedCall.audioSizeBytes ? (selectedCall.audioSizeBytes / 1024).toFixed(1) + ' KB' : 'Opus WebM'})
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] text-zinc-500 font-mono">WebM</span>
                      </div>
                    ) : (
                      <p className="text-zinc-500 text-[11px] italic">No local microphone audio captured for this session.</p>
                    )}
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-2 leading-normal">
                    {selectedCall.recordingNote}
                  </p>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-zinc-500">
                <FileText className="h-8 w-8 mx-auto mb-2 stroke-1 text-zinc-600" />
                <p className="text-xs font-medium">Select a past call or finish a call to view AI analysis.</p>
              </div>
            )}
          </div>

          {/* Persistent Call History List */}
          <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-5 shadow-xl backdrop-blur-sm flex-1 flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800 gap-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-indigo-400 shrink-0" />
                <h3 className="text-sm font-semibold text-zinc-100 whitespace-nowrap">Call History</h3>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClearHistory}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all cursor-pointer font-medium whitespace-nowrap ${
                    isConfirmingClear
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30'
                      : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-zinc-200 hover:border-zinc-700'
                  }`}
                  title="Clear all saved calls and audio from browser IndexedDB"
                >
                  {isConfirmingClear ? 'Click again to confirm' : 'Clear history'}
                </button>

                {/* Classification filter */}
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 text-zinc-300 text-[11px] rounded-lg px-2 py-1 focus:outline-none focus:border-indigo-500"
                >
                  <option value="All">All Statuses</option>
                  <option value="Converted">Converted</option>
                  <option value="Interested">Interested</option>
                  <option value="Demo Requested">Demo Requested</option>
                  <option value="Follow-up Required">Follow-up Required</option>
                  <option value="Not Interested">Not Interested</option>
                  <option value="No Response">No Response</option>
                </select>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto mt-3 space-y-2 max-h-[320px] pr-1">
              {isLoadingHistory ? (
                <p className="text-xs text-zinc-500 text-center py-6">Loading call history...</p>
              ) : filteredCalls.length === 0 ? (
                <div className="text-center py-8 text-zinc-500 text-xs">
                  No calls found in history.
                </div>
              ) : (
                filteredCalls.map((call) => (
                  <div
                    key={call.id}
                    onClick={() => setSelectedCall(call)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                      selectedCall?.id === call.id
                        ? 'bg-indigo-950/40 border-indigo-700/60 shadow-md'
                        : 'bg-zinc-950/60 border-zinc-800/80 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        {getStatusBadge(call.status)}
                        <span className="text-[11px] font-mono text-zinc-400">
                          {formatTime(call.durationSeconds)}
                        </span>
                        {call.audioRecordingUrl && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
                            <Mic className="h-2.5 w-2.5" />
                            <span>Audio</span>
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-300 line-clamp-1 max-w-[240px]">
                        {call.summary || 'Sales discovery discussion'}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {call.audioRecordingUrl && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleAudioPlayback(call.audioRecordingUrl!);
                          }}
                          className={`p-1.5 rounded-lg border transition-colors ${
                            currentlyPlayingAudio === call.audioRecordingUrl
                              ? 'bg-indigo-600 text-white border-indigo-500'
                              : 'bg-zinc-900 text-zinc-400 border-zinc-700/80 hover:text-white'
                          }`}
                          title="Play recorded audio"
                        >
                          {currentlyPlayingAudio === call.audioRecordingUrl ? (
                            <Square className="h-3 w-3" />
                          ) : (
                            <Play className="h-3 w-3" />
                          )}
                        </button>
                      )}
                      <ChevronRight className="h-4 w-4 text-zinc-600 shrink-0" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/80 bg-zinc-950 px-6 py-3 text-center text-xs text-zinc-500">
        Sankar Group AI Voice Sales Bot • Fictional SaaS Product: LeadFlow AI • Guaranteed ₹0 Cost Architecture
      </footer>
    </div>
  );
}
