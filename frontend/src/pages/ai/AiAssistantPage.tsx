// ==============================================================================
// AssetVault: Conversational & Voice AI Assistant Page
// Course: BCSE307L Database Systems (Fall 2026-27)
// Server-side @google/genai integration for natural voice & text conversation,
// grounded database querying, license optimization audits, and contract parsing
// ==============================================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Cpu,
  RefreshCw,
  Send,
  FileText,
  Copy,
  Check,
  AlertTriangle,
  Download,
  Trash2,
  ArrowUpRight,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  PhoneCall,
  PhoneOff,
  Sparkles,
  Bot,
  User as UserIcon,
  Square,
} from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';

type WorkspaceMode = 'copilot' | 'optimize' | 'extractor';
type PriorityFilter = 'ALL' | 'HIGH' | 'MEDIUM' | 'LOW';
type VoiceState = 'idle' | 'listening' | 'transcribing' | 'thinking' | 'speaking';

interface ContextSummary {
  tenantId: string | null;
  assetsCount: number;
  licensesCount: number;
  totalSeats: number;
  allocatedSeats: number;
  unallocatedSeats: number;
  utilizationPct: number;
  totalAnnualSpend: number;
}

interface OptimizationRecommendation {
  id: string;
  title: string;
  category: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW' | string;
  affectedResource: string;
  currentUtilization: string;
  estimatedSavingsUsd: number;
  suggestedAction: string;
  rationale: string;
}

interface OptimizationAuditResult {
  executiveSummary: string;
  estimatedAnnualSavings: number;
  healthScore: number;
  recommendations: OptimizationRecommendation[];
  snapshotMetrics?: ContextSummary;
  generatedAt: string;
}

interface CopilotMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  isVoice?: boolean;
}

interface ExtractedContractMetadata {
  vendorName: string;
  vendorContactEmail: string;
  vendorWebsite: string;
  assetName: string;
  assetType: string;
  licenseKeySuggestion: string;
  licenseType: string;
  totalSeats: number;
  annualCostUsd: number;
  currency: string;
  expirationDate: string;
  autoRenew: boolean;
  suggestedTags: string[];
  complianceSummary: string;
}

const SAMPLE_CONTRACT_TEXT = `ENTERPRISE SOFTWARE LICENSE & SUBSCRIPTION SCHEDULE
Vendor: JetBrains s.r.o. (sales@jetbrains.com | https://www.jetbrains.com)
Customer: Acme Corporation — Platform Engineering Division
Product: All Products Pack Enterprise (IntelliJ IDEA Ultimate, DataGrip, WebStorm, GoLand)
Contract Reference / License Key: JB-ALLPACK-2026-ENT-7742
License Model: Seat-Based Annual Subscription (Named User Seats)
Total Authorized Seats: 45 Seats
Annual Subscription Fee: $12,960.00 USD ($288.00 per seat/year)
Effective Term: 2026-03-01 through 2027-03-01
Renewal Policy: Automatic annual renewal unless written notice is provided 30 days prior to expiration.
Compliance & Audit Terms: Restricted to internal engineering and QA staff. Quarterly seat reconciliation required.`;

const INITIAL_CONVERSATION_STARTERS = [
  'Hi Aria! Give me a quick briefing on our organization workspace.',
  'Which licenses have the lowest seat utilization right now?',
  'Summarize our total annual software spend and where we can save money.',
  'Who are the active team members in my organization?',
  'List all digital assets and vendors in our catalog.',
];

const VOICE_OPTIONS = [
  { id: 'Puck', label: 'Puck (Natural & Warm)' },
  { id: 'Kore', label: 'Kore (Clear & Articulate)' },
  { id: 'Aoede', label: 'Aoede (Conversational)' },
  { id: 'Fenrir', label: 'Fenrir (Deep & Executive)' },
  { id: 'Charon', label: 'Charon (Calm & Analytical)' },
];

const CHAT_HISTORY_STORAGE_KEY = 'assetvault_ai_chat_history_v1';

export const AiAssistantPage: React.FC = () => {
  const toast = useToast();
  const { user, tenant } = useAuth();

  // Default to 'copilot' (Talk & Chat with AI Assistant) so user can immediately talk to the AI
  const [activeMode, setActiveMode] = useState<WorkspaceMode>('copilot');

  // Tenant database snapshot metrics
  const [summary, setSummary] = useState<ContextSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState<boolean>(true);

  // Mode 1 (Primary): Conversational & Voice AI Assistant state
  const [copilotInput, setCopilotInput] = useState<string>('');
  const [messages, setMessages] = useState<CopilotMessage[]>(() => {
    try {
      const saved = sessionStorage.getItem(CHAT_HISTORY_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    const firstName = user?.fullName ? user.fullName.split(' ')[0] : 'there';
    return [
      {
        id: 'welcome-aria',
        role: 'model',
        text: `Hi ${firstName}! I'm Aria, your AssetVault AI Assistant. You can talk to me with your voice using the microphone button or type any question below.\n\nI'm connected to ${
          tenant?.name || 'your organization'
        }'s live database—ask me about your software licenses, digital assets, seat utilization, vendors, team members, or cost optimization!`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ];
  });
  const [loadingCopilot, setLoadingCopilot] = useState<boolean>(false);
  const [copilotError, setCopilotError] = useState<string | null>(null);
  const [suggestedFollowUps, setSuggestedFollowUps] = useState<string[]>(INITIAL_CONVERSATION_STARTERS);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  // Voice & Talk Mode State
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [liveCallActive, setLiveCallActive] = useState<boolean>(false);
  const [handsFreeContinuous, setHandsFreeContinuous] = useState<boolean>(true);
  const [autoSpeakReplies, setAutoSpeakReplies] = useState<boolean>(true);
  const [selectedVoice, setSelectedVoice] = useState<string>('Puck');
  const [useGeminiTts, setUseGeminiTts] = useState<boolean>(true);
  const [liveTranscript, setLiveTranscript] = useState<string>('');
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);

  // Refs for voice & audio handling
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const liveCallActiveRef = useRef<boolean>(false);
  const handsFreeRef = useRef<boolean>(true);
  const autoSpeakRef = useRef<boolean>(true);
  const messagesRef = useRef<CopilotMessage[]>(messages);

  useEffect(() => {
    liveCallActiveRef.current = liveCallActive;
  }, [liveCallActive]);

  useEffect(() => {
    handsFreeRef.current = handsFreeContinuous;
  }, [handsFreeContinuous]);

  useEffect(() => {
    autoSpeakRef.current = autoSpeakReplies;
  }, [autoSpeakReplies]);

  useEffect(() => {
    messagesRef.current = messages;
    try {
      sessionStorage.setItem(CHAT_HISTORY_STORAGE_KEY, JSON.stringify(messages.slice(-30)));
    } catch {}
  }, [messages]);

  // Mode 2: License Optimization state
  const [focusArea, setFocusArea] = useState<string>(
    'Identify idle seat reclamation opportunities, over-provisioned subscriptions, and upcoming renewal risks'
  );
  const [auditResult, setAuditResult] = useState<OptimizationAuditResult | null>(null);
  const [loadingAudit, setLoadingAudit] = useState<boolean>(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Mode 3: Smart Contract Extractor state
  const [contractText, setContractText] = useState<string>(SAMPLE_CONTRACT_TEXT);
  const [extractedData, setExtractedData] = useState<ExtractedContractMetadata | null>(null);
  const [loadingExtract, setLoadingExtract] = useState<boolean>(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [copiedJson, setCopiedJson] = useState<boolean>(false);

  const fetchContextSummary = async () => {
    setLoadingSummary(true);
    try {
      const res = await api.get<{ data: ContextSummary }>('/ai/context-summary');
      if (res?.data) {
        setSummary(res.data);
      }
    } catch {
      // Keep page resilient
    } finally {
      setLoadingSummary(false);
    }
  };

  useEffect(() => {
    fetchContextSummary();
    return () => {
      stopAllVoiceActivity();
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, loadingCopilot, liveTranscript]);

  // Stop any ongoing speech playback or microphone recording
  const stopSpeaking = useCallback(() => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.currentTime = 0;
      audioPlayerRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setSpeakingMsgId(null);
    setVoiceState((prev) => (prev === 'speaking' ? 'idle' : prev));
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    setLiveTranscript('');
    setVoiceState((prev) => (prev === 'listening' ? 'idle' : prev));
  }, []);

  const stopAllVoiceActivity = useCallback(() => {
    setLiveCallActive(false);
    liveCallActiveRef.current = false;
    stopListening();
    stopSpeaking();
    setVoiceState('idle');
  }, [stopListening, stopSpeaking]);

  // Speak text aloud using Gemini TTS (with browser SpeechSynthesis fallback)
  const speakText = useCallback(
    async (text: string, messageId?: string, onFinished?: () => void) => {
      stopSpeaking();
      const cleanText = text
        .replace(/[*#_`~>-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (!cleanText) {
        onFinished?.();
        return;
      }

      setVoiceState('speaking');
      if (messageId) setSpeakingMsgId(messageId);

      const finishSpeaking = () => {
        setSpeakingMsgId(null);
        setVoiceState('idle');
        onFinished?.();
      };

      if (useGeminiTts) {
        try {
          const res = await api.post<{ data: { audioBase64: string; mimeType: string } }>('/ai/tts', {
            text: cleanText.slice(0, 900),
            voiceName: selectedVoice,
          });
          if (res?.data?.audioBase64) {
            const audioSrc = `data:${res.data.mimeType || 'audio/wav'};base64,${res.data.audioBase64}`;
            const audio = new Audio(audioSrc);
            audioPlayerRef.current = audio;
            audio.onended = finishSpeaking;
            audio.onerror = () => {
              fallbackBrowserSpeak(cleanText, finishSpeaking);
            };
            await audio.play();
            return;
          }
        } catch {
          // Fallback to instant browser speech synthesis if Gemini TTS fails
        }
      }

      fallbackBrowserSpeak(cleanText, finishSpeaking);
    },
    [selectedVoice, stopSpeaking, useGeminiTts]
  );

  const fallbackBrowserSpeak = (cleanText: string, onDone: () => void) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.rate = 1.03;
        utterance.pitch = 1.0;
        const voices = window.speechSynthesis.getVoices();
        const preferred = voices.find(
          (v) =>
            v.lang.startsWith('en') &&
            (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha'))
        );
        if (preferred) utterance.voice = preferred;
        utterance.onend = onDone;
        utterance.onerror = onDone;
        window.speechSynthesis.speak(utterance);
        return;
      } catch {}
    }
    onDone();
  };

  // Send message to AI Assistant (used by both text input and voice talk)
  const handleAskCopilot = useCallback(
    async (questionText?: string, fromVoice: boolean = false) => {
      const query = (questionText ?? copilotInput).trim();
      if (!query || loadingCopilot) return;

      stopSpeaking();
      const userMsg: CopilotMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        text: query,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isVoice: fromVoice,
      };

      const currentHistory = messagesRef.current;
      setMessages((prev) => [...prev, userMsg]);
      if (!questionText) {
        setCopilotInput('');
      }
      setLiveTranscript('');
      setLoadingCopilot(true);
      setVoiceState('thinking');
      setCopilotError(null);

      try {
        const res = await api.post<{
          data: {
            reply: string;
            suggestedFollowUps?: string[];
            snapshotMetrics?: ContextSummary;
            timestamp: string;
          };
        }>('/ai/copilot', {
          prompt: query,
          userName: user?.fullName,
          history: currentHistory.slice(-10).map((m) => ({ role: m.role, text: m.text })),
        });

        const replyText = res?.data?.reply || 'I am here and ready to help!';
        const modelMsgId = `model-${Date.now()}`;
        const modelMsg: CopilotMessage = {
          id: modelMsgId,
          role: 'model',
          text: replyText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isVoice: fromVoice || autoSpeakRef.current,
        };

        setMessages((prev) => [...prev, modelMsg]);
        if (res?.data?.suggestedFollowUps && res.data.suggestedFollowUps.length > 0) {
          setSuggestedFollowUps(res.data.suggestedFollowUps);
        }
        if (res?.data?.snapshotMetrics) {
          setSummary(res.data.snapshotMetrics);
        }

        setLoadingCopilot(false);

        // Speak response aloud if triggered via voice or Auto-Speak is enabled
        if (fromVoice || autoSpeakRef.current || liveCallActiveRef.current) {
          await speakText(replyText, modelMsgId, () => {
            // If in live voice call & hands-free continuous mode, start listening again automatically
            if (liveCallActiveRef.current && handsFreeRef.current) {
              setTimeout(() => {
                if (liveCallActiveRef.current) {
                  startListeningForSpeech();
                }
              }, 400);
            }
          });
        } else {
          setVoiceState('idle');
        }
      } catch (err: any) {
        const msg = err?.message || 'AI Assistant encountered an issue generating a response.';
        setCopilotError(msg);
        setLoadingCopilot(false);
        setVoiceState('idle');
        toast.error(msg);
      }
    },
    [copilotInput, loadingCopilot, speakText, stopSpeaking, toast, user?.fullName]
  );

  // Start microphone listening (Web Speech API with MediaRecorder + Gemini Transcribe fallback)
  const startListeningForSpeech = useCallback(async () => {
    stopSpeaking();
    setCopilotError(null);
    setLiveTranscript('');

    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognitionAPI) {
      try {
        const recognition = new SpeechRecognitionAPI();
        recognitionRef.current = recognition;
        recognition.lang = 'en-US';
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;
        recognition.continuous = false;

        let finalTranscript = '';

        recognition.onstart = () => {
          setVoiceState('listening');
        };

        recognition.onresult = (event: any) => {
          let interim = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcriptPiece = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcriptPiece + ' ';
            } else {
              interim += transcriptPiece;
            }
          }
          const combined = (finalTranscript + interim).trim();
          setLiveTranscript(combined);
        };

        recognition.onerror = (event: any) => {
          if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            toast.error('Microphone access was blocked. Please allow microphone permission in your browser.');
            setVoiceState('idle');
            setLiveCallActive(false);
          } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
            // Fallback to MediaRecorder + Gemini transcription
            startMediaRecorderFallback();
          } else {
            setVoiceState('idle');
          }
        };

        recognition.onend = () => {
          const spoken = finalTranscript.trim();
          if (spoken) {
            handleAskCopilot(spoken, true);
          } else {
            setVoiceState('idle');
          }
        };

        recognition.start();
        return;
      } catch {
        // Fallback to MediaRecorder below
      }
    }

    await startMediaRecorderFallback();
  }, [handleAskCopilot, stopSpeaking, toast]);

  // MediaRecorder fallback that sends recorded audio to /api/ai/transcribe (gemini-3.5-transcribe)
  const startMediaRecorderFallback = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, {
          type: mediaRecorder.mimeType || 'audio/webm',
        });
        if (audioBlob.size < 500) {
          setVoiceState('idle');
          return;
        }
        setVoiceState('transcribing');
        setLiveTranscript('Transcribing your voice with Gemini 3.5 Transcribe...');

        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            const base64Audio = String(reader.result || '');
            const res = await api.post<{ data: { text: string } }>('/ai/transcribe', {
              audioBase64: base64Audio,
              mimeType: audioBlob.type || 'audio/webm',
            });
            const text = res?.data?.text?.trim() || '';
            if (text) {
              setLiveTranscript(text);
              handleAskCopilot(text, true);
            } else {
              toast.info('Could not hear any clear speech. Please try speaking again.');
              setVoiceState('idle');
              setLiveTranscript('');
            }
          } catch {
            toast.error('Voice transcription failed. Please try again or type your message.');
            setVoiceState('idle');
            setLiveTranscript('');
          }
        };
        reader.readAsDataURL(audioBlob);
      };

      mediaRecorder.start();
      setVoiceState('listening');
      setLiveTranscript('Listening... Click Stop when you finish speaking.');
    } catch {
      toast.error('Microphone permission is required to talk to the AI Assistant.');
      setVoiceState('idle');
      setLiveCallActive(false);
    }
  };

  const handleToggleMic = () => {
    if (voiceState === 'listening') {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      } else if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      } else {
        stopListening();
      }
    } else {
      startListeningForSpeech();
    }
  };

  const handleToggleLiveCall = () => {
    if (liveCallActive) {
      stopAllVoiceActivity();
      toast.info('Ended live voice session with Aria');
    } else {
      setLiveCallActive(true);
      liveCallActiveRef.current = true;
      setAutoSpeakReplies(true);
      autoSpeakRef.current = true;
      toast.success('Live Voice Mode active — start speaking to Aria!');
      startListeningForSpeech();
    }
  };

  // Mode 2 Handler: Run Gemini Optimization Audit
  const handleRunOptimizationAudit = async () => {
    setLoadingAudit(true);
    setAuditError(null);
    try {
      const res = await api.post<{ data: OptimizationAuditResult }>('/ai/optimize', {
        focusArea,
      });
      if (res?.data) {
        setAuditResult(res.data);
        if (res.data.snapshotMetrics) {
          setSummary(res.data.snapshotMetrics);
        }
        toast.success('AI License Optimization Audit completed');
      }
    } catch (err: any) {
      const msg = err?.message || 'Failed to run Gemini optimization audit.';
      setAuditError(msg);
      toast.error(msg);
    } finally {
      setLoadingAudit(false);
    }
  };

  // Mode 3 Handler: Extract Contract Metadata
  const handleExtractContract = async () => {
    if (!contractText.trim() || loadingExtract) return;
    setLoadingExtract(true);
    setExtractError(null);
    try {
      const res = await api.post<{
        data: { extracted: ExtractedContractMetadata; processedAt: string };
      }>('/ai/extract-contract', {
        rawText: contractText,
      });
      if (res?.data?.extracted) {
        setExtractedData(res.data.extracted);
        toast.success('Structured license metadata extracted');
      }
    } catch (err: any) {
      const msg = err?.message || 'Failed to extract metadata from contract text.';
      setExtractError(msg);
      toast.error(msg);
    } finally {
      setLoadingExtract(false);
    }
  };

  const handleCopyMessage = (msg: CopilotMessage) => {
    navigator.clipboard.writeText(msg.text);
    setCopiedMsgId(msg.id);
    toast.success('Response copied to clipboard');
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  const handleClearConversation = () => {
    stopAllVoiceActivity();
    const firstName = user?.fullName ? user.fullName.split(' ')[0] : 'there';
    const resetMessages: CopilotMessage[] = [
      {
        id: `welcome-${Date.now()}`,
        role: 'model',
        text: `Conversation cleared! Hi ${firstName}, I'm ready whenever you want to talk or ask about your organization's assets, licenses, vendors, or users.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ];
    setMessages(resetMessages);
    setSuggestedFollowUps(INITIAL_CONVERSATION_STARTERS);
    try {
      sessionStorage.removeItem(CHAT_HISTORY_STORAGE_KEY);
    } catch {}
  };

  const handleCopyRecommendation = (rec: OptimizationRecommendation) => {
    const text = `${rec.title} (${rec.priority}) — ${rec.affectedResource}\nCurrent Utilization: ${rec.currentUtilization}\nEstimated Annual Savings: $${rec.estimatedSavingsUsd.toLocaleString()}\nAction: ${rec.suggestedAction}`;
    navigator.clipboard.writeText(text);
    setCopiedId(rec.id);
    toast.success('Recommendation copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportAuditJson = () => {
    if (!auditResult) return;
    const blob = new Blob([JSON.stringify(auditResult, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `assetvault-ai-audit-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyExtractedJson = () => {
    if (!extractedData) return;
    navigator.clipboard.writeText(JSON.stringify(extractedData, null, 2));
    setCopiedJson(true);
    toast.success('Extracted schema JSON copied to clipboard');
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const filteredRecommendations = (auditResult?.recommendations || []).filter((rec) => {
    if (priorityFilter === 'ALL') return true;
    return String(rec.priority).toUpperCase() === priorityFilter;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header & Workspace Mode Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-slate-800 pb-6">
        <div className="space-y-2 max-w-2xl">
          <div className="flex items-center gap-2 text-xs text-indigo-400 font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Aria Conversational AI</span>
            <span aria-hidden="true">·</span>
            <span>Voice &amp; Chat Enabled</span>
            <span aria-hidden="true">·</span>
            <span>Live Tenant Context</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100">
            Talk to Aria — AI Assistant
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            Speak naturally using your microphone or chat in real time with Aria about your
            organization&apos;s software licenses, digital assets, team members, and cost savings.
          </p>
        </div>

        {/* Segmented Mode Control */}
        <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg self-start lg:self-auto">
          <button
            type="button"
            onClick={() => setActiveMode('copilot')}
            className={`px-3.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 ${
              activeMode === 'copilot'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            01. Talk &amp; Chat with AI
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('optimize')}
            className={`px-3.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeMode === 'optimize'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            02. Optimization Advisor
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('extractor')}
            className={`px-3.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeMode === 'extractor'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            03. Contract Extractor
          </button>
        </div>
      </div>

      {/* Live Tenant Database Snapshot Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50">
          <div className="text-xs text-slate-400">Cataloged Assets &amp; Contracts</div>
          <div className="mt-1.5 text-2xl font-semibold text-slate-100 font-mono tabular-nums">
            {loadingSummary
              ? '—'
              : `${summary?.assetsCount ?? 4} Assets · ${summary?.licensesCount ?? 4} Licenses`}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Active tenant relational records
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50">
          <div className="text-xs text-slate-400">Seat Allocation Ratio</div>
          <div className="mt-1.5 text-2xl font-semibold text-slate-100 font-mono tabular-nums">
            {loadingSummary
              ? '—'
              : `${summary?.allocatedSeats ?? 6} / ${summary?.totalSeats ?? 180}`}
          </div>
          <div className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            {summary?.unallocatedSeats ?? 174} unallocated seats available
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50">
          <div className="text-xs text-slate-400">Overall Seat Utilization</div>
          <div className="mt-1.5 text-2xl font-semibold text-amber-400 font-mono tabular-nums">
            {loadingSummary ? '—' : `${summary?.utilizationPct ?? 3}%`}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Target efficiency benchmark: 75%
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50">
          <div className="text-xs text-slate-400">Annual License Spend</div>
          <div className="mt-1.5 text-2xl font-semibold text-emerald-400 font-mono tabular-nums">
            {loadingSummary
              ? '—'
              : `$${Number(summary?.totalAnnualSpend ?? 3598).toLocaleString()}`}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Evaluated across active subscriptions
          </div>
        </div>
      </div>

      {/* MODE 1 (PRIMARY): TALK & CHAT WITH AI ASSISTANT */}
      {activeMode === 'copilot' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column (4 cols on desktop): Interactive Voice Call & Controls Studio */}
          <div className="lg:col-span-4 space-y-4">
            <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/70 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                    Voice Conversation
                  </span>
                  <h2 className="text-base font-semibold text-slate-100 mt-0.5">
                    Talk to Aria Live
                  </h2>
                </div>
                <span
                  className={`px-2.5 py-1 text-xs font-medium rounded-md border ${
                    voiceState === 'listening'
                      ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                      : voiceState === 'speaking'
                      ? 'bg-indigo-950/60 border-indigo-500/40 text-indigo-300'
                      : voiceState === 'thinking' || voiceState === 'transcribing'
                      ? 'bg-amber-950/60 border-amber-500/40 text-amber-300'
                      : 'bg-slate-800/80 border-slate-700 text-slate-400'
                  }`}
                >
                  {voiceState === 'listening'
                    ? 'Listening to you...'
                    : voiceState === 'transcribing'
                    ? 'Transcribing...'
                    : voiceState === 'thinking'
                    ? 'Aria is Thinking...'
                    : voiceState === 'speaking'
                    ? 'Aria is Speaking...'
                    : liveCallActive
                    ? 'Voice Call Active'
                    : 'Ready to Talk'}
                </span>
              </div>

              {/* Interactive Animated Voice Orb */}
              <div className="py-6 flex flex-col items-center justify-center text-center space-y-4">
                <div className="relative flex items-center justify-center">
                  {(voiceState === 'listening' || voiceState === 'speaking') && (
                    <>
                      <span
                        className={`absolute w-32 h-32 rounded-full animate-ping opacity-20 ${
                          voiceState === 'listening' ? 'bg-emerald-500' : 'bg-indigo-500'
                        }`}
                      />
                      <span
                        className={`absolute w-28 h-28 rounded-full animate-pulse opacity-30 ${
                          voiceState === 'listening' ? 'bg-emerald-500' : 'bg-indigo-500'
                        }`}
                      />
                    </>
                  )}
                  <button
                    type="button"
                    onClick={handleToggleMic}
                    disabled={voiceState === 'thinking' || voiceState === 'transcribing'}
                    title={
                      voiceState === 'listening'
                        ? 'Click to stop listening and send'
                        : 'Click to speak to Aria'
                    }
                    className={`relative z-10 w-24 h-24 rounded-full flex flex-col items-center justify-center transition-all cursor-pointer shadow-lg border-2 ${
                      voiceState === 'listening'
                        ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-300 text-white scale-105'
                        : voiceState === 'speaking'
                        ? 'bg-indigo-600 hover:bg-indigo-500 border-indigo-300 text-white'
                        : voiceState === 'thinking' || voiceState === 'transcribing'
                        ? 'bg-amber-600/80 border-amber-400 text-white opacity-80'
                        : 'bg-slate-800 hover:bg-indigo-600 border-slate-700 hover:border-indigo-400 text-slate-100'
                    }`}
                  >
                    {voiceState === 'listening' ? (
                      <MicOff className="w-8 h-8" />
                    ) : voiceState === 'speaking' ? (
                      <Volume2 className="w-8 h-8 animate-bounce" />
                    ) : voiceState === 'thinking' || voiceState === 'transcribing' ? (
                      <RefreshCw className="w-8 h-8 animate-spin" />
                    ) : (
                      <Mic className="w-8 h-8" />
                    )}
                    <span className="text-[11px] font-semibold mt-1">
                      {voiceState === 'listening'
                        ? 'Stop'
                        : voiceState === 'speaking'
                        ? 'Speaking'
                        : 'Tap to Talk'}
                    </span>
                  </button>
                </div>

                {/* Live Speech Preview Box */}
                <div className="w-full min-h-[52px] p-3 rounded-lg bg-slate-950/90 border border-slate-800 flex items-center justify-center">
                  {liveTranscript ? (
                    <p className="text-xs text-emerald-300 italic leading-relaxed">
                      &ldquo;{liveTranscript}&rdquo;
                    </p>
                  ) : voiceState === 'listening' ? (
                    <p className="text-xs text-emerald-400 animate-pulse">
                      Speak now... I&apos;m listening to your question.
                    </p>
                  ) : voiceState === 'speaking' ? (
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-indigo-300">
                        Aria is speaking her response aloud...
                      </span>
                      <button
                        type="button"
                        onClick={stopSpeaking}
                        className="px-2.5 py-1 text-xs font-medium bg-rose-600/80 hover:bg-rose-600 text-white rounded flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <Square className="w-3 h-3" />
                        Stop
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">
                      Click the microphone orb above to talk with your voice, or start a hands-free
                      Live Voice Call below.
                    </p>
                  )}
                </div>

                {/* Start / End Hands-Free Voice Call Button */}
                <div className="w-full flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleToggleLiveCall}
                    className={`w-full py-2.5 px-4 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer ${
                      liveCallActive
                        ? 'bg-rose-600 hover:bg-rose-500 text-white'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                    }`}
                  >
                    {liveCallActive ? (
                      <>
                        <PhoneOff className="w-4 h-4" />
                        End Live Voice Call
                      </>
                    ) : (
                      <>
                        <PhoneCall className="w-4 h-4" />
                        Start Hands-Free Voice Call
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Voice Settings & Persona Controls */}
              <div className="pt-4 border-t border-slate-800 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-medium">Auto-Speak AI Responses</span>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !autoSpeakReplies;
                      setAutoSpeakReplies(next);
                      if (!next) stopSpeaking();
                    }}
                    className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                      autoSpeakReplies
                        ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {autoSpeakReplies ? (
                      <>
                        <Volume2 className="w-3.5 h-3.5" />
                        Voice On
                      </>
                    ) : (
                      <>
                        <VolumeX className="w-3.5 h-3.5" />
                        Muted
                      </>
                    )}
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-medium">Continuous Hands-Free Loop</span>
                  <button
                    type="button"
                    onClick={() => setHandsFreeContinuous(!handsFreeContinuous)}
                    className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                      handsFreeContinuous
                        ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {handsFreeContinuous ? 'Enabled' : 'Push-to-Talk'}
                  </button>
                </div>

                <div className="space-y-1.5 pt-1">
                  <label htmlFor="ai-voice-select" className="block text-slate-400">
                    Aria Voice Persona (Gemini TTS)
                  </label>
                  <select
                    id="ai-voice-select"
                    value={selectedVoice}
                    onChange={(e) => setSelectedVoice(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                  >
                    {VOICE_OPTIONS.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-slate-400">Speech Engine</span>
                  <button
                    type="button"
                    onClick={() => setUseGeminiTts(!useGeminiTts)}
                    className="text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                  >
                    {useGeminiTts ? 'Gemini 3.8 Neural Audio' : 'Instant Browser Voice'}
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Conversation Starters */}
            <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/50 space-y-3">
              <div className="text-xs font-semibold text-slate-300">
                Suggested Things to Ask Aria
              </div>
              <div className="space-y-2">
                {suggestedFollowUps.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => handleAskCopilot(q, false)}
                    disabled={loadingCopilot}
                    className="w-full p-2.5 text-left text-xs text-slate-300 hover:text-white bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800 rounded-lg transition-colors flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <span className="line-clamp-2">{q}</span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column (8 cols on desktop): Interactive Conversational Stream */}
          <div className="lg:col-span-8 p-6 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-100">
                    Aria — AssetVault Conversational Assistant
                  </h2>
                  <p className="text-xs text-slate-400">
                    Connected to {tenant?.name || 'Organization'} live database · Speaks &amp;
                    listens in real time
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {speakingMsgId && (
                  <button
                    type="button"
                    onClick={stopSpeaking}
                    className="px-3 py-1.5 text-xs font-medium text-rose-200 bg-rose-950/60 hover:bg-rose-900/80 border border-rose-500/40 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <VolumeX className="w-3.5 h-3.5" />
                    Stop Speaking
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleClearConversation}
                  className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Reset Chat
                </button>
              </div>
            </div>

            {/* Conversation Messages Stream */}
            <div className="min-h-[420px] max-h-[540px] overflow-y-auto space-y-4 p-4 rounded-xl bg-slate-950 border border-slate-800">
              {messages.map((msg) => {
                const isUser = msg.role === 'user';
                const isThisMsgSpeaking = speakingMsgId === msg.id;

                return (
                  <div
                    key={msg.id}
                    className={`p-4 rounded-xl border transition-colors ${
                      isUser
                        ? 'bg-indigo-950/40 border-indigo-500/30 ml-auto max-w-2xl'
                        : 'bg-slate-900/90 border-slate-800 mr-auto max-w-3xl'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-400 mb-2">
                      <div className="flex items-center gap-2">
                        {isUser ? (
                          <UserIcon className="w-3.5 h-3.5 text-indigo-400" />
                        ) : (
                          <Bot className="w-3.5 h-3.5 text-emerald-400" />
                        )}
                        <span className="font-semibold text-slate-200">
                          {isUser ? user?.fullName || 'You' : 'Aria (AI Assistant)'}
                        </span>
                        {msg.isVoice && (
                          <span className="px-1.5 py-0.5 text-[10px] rounded bg-slate-800 text-slate-300">
                            Voice
                          </span>
                        )}
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{msg.timestamp}</span>
                      </div>

                      {/* Message Action Buttons (Speak Aloud & Copy) */}
                      <div className="flex items-center gap-1.5">
                        {!isUser && (
                          <button
                            type="button"
                            onClick={() =>
                              isThisMsgSpeaking ? stopSpeaking() : speakText(msg.text, msg.id)
                            }
                            className={`px-2 py-1 rounded text-xs flex items-center gap-1 transition-colors cursor-pointer ${
                              isThisMsgSpeaking
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white'
                            }`}
                            title={isThisMsgSpeaking ? 'Stop speaking' : 'Read this response aloud'}
                          >
                            {isThisMsgSpeaking ? (
                              <>
                                <VolumeX className="w-3 h-3" />
                                <span>Stop</span>
                              </>
                            ) : (
                              <>
                                <Volume2 className="w-3 h-3" />
                                <span>Listen</span>
                              </>
                            )}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleCopyMessage(msg)}
                          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                          title="Copy message"
                        >
                          {copiedMsgId === msg.id ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
                      {msg.text}
                    </div>
                  </div>
                );
              })}

              {loadingCopilot && (
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-900 max-w-xl space-y-2">
                  <div className="flex items-center gap-2 text-xs text-indigo-400 font-medium">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Aria is thinking and checking your live workspace data...</span>
                  </div>
                  <div className="h-3 w-3/4 bg-slate-800 rounded animate-pulse" />
                  <div className="h-3 w-1/2 bg-slate-800 rounded animate-pulse" />
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {copilotError && (
              <div className="text-xs text-rose-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{copilotError}</span>
              </div>
            )}

            {/* Message Input + Inline Voice Mic Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAskCopilot( undefined, false );
              }}
              className="flex items-center gap-2.5 pt-1"
            >
              <button
                type="button"
                onClick={handleToggleMic}
                disabled={loadingCopilot}
                title={
                  voiceState === 'listening'
                    ? 'Stop voice input'
                    : 'Speak your message using microphone'
                }
                className={`p-3 rounded-lg border transition-colors shrink-0 cursor-pointer flex items-center justify-center ${
                  voiceState === 'listening'
                    ? 'bg-emerald-600 border-emerald-400 text-white animate-pulse'
                    : 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                {voiceState === 'listening' ? (
                  <MicOff className="w-4 h-4" />
                ) : (
                  <Mic className="w-4 h-4" />
                )}
              </button>

              <input
                type="text"
                value={copilotInput}
                onChange={(e) => setCopilotInput(e.target.value)}
                placeholder={
                  voiceState === 'listening'
                    ? 'Listening to your voice... speak now'
                    : 'Talk to Aria — say hello, or ask about your licenses, assets, users, or spend...'
                }
                className="flex-1 px-4 py-3 text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />

              <button
                type="submit"
                disabled={loadingCopilot || !copilotInput.trim()}
                className="px-5 py-3 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                Send Message
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODE 2: LICENSE OPTIMIZATION & COMPLIANCE ADVISOR */}
      {activeMode === 'optimize' && (
        <div className="space-y-6">
          <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/60 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  02. Automated License Optimization &amp; Compliance Audit
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Evaluates seat allocation ratios, contract costs, and renewal windows using structured Gemini schema output.
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {auditResult && (
                  <button
                    type="button"
                    onClick={handleExportAuditJson}
                    className="px-3.5 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export Audit JSON
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleRunOptimizationAudit}
                  disabled={loadingAudit}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingAudit ? 'animate-spin' : ''}`} />
                  {loadingAudit ? 'Analyzing Database...' : 'Run License & Compliance Audit'}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <label
                htmlFor="audit-focus-input"
                className="block text-xs font-medium text-slate-400 mb-1.5"
              >
                Audit Focus Directive
              </label>
              <input
                id="audit-focus-input"
                type="text"
                value={focusArea}
                onChange={(e) => setFocusArea(e.target.value)}
                placeholder="e.g., Focus on reclaiming unused JetBrains and Adobe seats before renewal"
                className="w-full px-3.5 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {auditError && (
            <div className="p-4 rounded-xl border border-rose-500/40 bg-rose-950/20 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-semibold text-rose-200">
                    Optimization Audit Error
                  </div>
                  <div className="text-xs text-rose-300/90 mt-1">{auditError}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRunOptimizationAudit}
                className="px-3 py-1.5 text-xs font-medium text-rose-100 bg-rose-900/50 hover:bg-rose-900 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
              >
                Retry Audit
              </button>
            </div>
          )}

          {loadingAudit && (
            <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/40 space-y-4">
              <div className="h-5 w-64 bg-slate-800 rounded animate-pulse" />
              <div className="h-4 w-full bg-slate-800/70 rounded animate-pulse" />
              <div className="h-4 w-4/5 bg-slate-800/70 rounded animate-pulse" />
              <div className="pt-4 space-y-3">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="h-24 w-full bg-slate-800/50 rounded-lg animate-pulse" />
                ))}
              </div>
            </div>
          )}

          {!loadingAudit && !auditResult && !auditError && (
            <div className="p-10 rounded-xl border border-slate-800 bg-slate-900/30 text-center space-y-4">
              <Cpu className="w-8 h-8 text-indigo-400 mx-auto" />
              <div className="space-y-1 max-w-lg mx-auto">
                <h3 className="text-base font-semibold text-slate-200">
                  Ready to Audit Tenant License Utilization
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Click &ldquo;Run License &amp; Compliance Audit&rdquo; above to evaluate your live
                  PostgreSQL/tenant catalog and generate prioritized cost-saving recommendations.
                </p>
              </div>
              <button
                type="button"
                onClick={handleRunOptimizationAudit}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Run First Optimization Audit
              </button>
            </div>
          )}

          {!loadingAudit && auditResult && (
            <div className="space-y-6">
              {/* Executive Audit Summary Strip */}
              <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/60 space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                  <div className="space-y-1">
                    <div className="text-xs text-slate-400">
                      <span>Executive Audit Report</span>
                      <span className="mx-2" aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        Generated {new Date(auditResult.generatedAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <h3 className="text-base font-semibold text-slate-100">
                      FinOps &amp; Compliance Assessment
                    </h3>
                  </div>

                  <div className="flex items-center gap-6">
                    <div>
                      <div className="text-xs text-slate-400">Estimated Annual Savings</div>
                      <div className="text-xl font-bold text-emerald-400 font-mono tabular-nums">
                        ${Number(auditResult.estimatedAnnualSavings || 0).toLocaleString()} / yr
                      </div>
                    </div>
                    <div className="h-8 w-px bg-slate-800" />
                    <div>
                      <div className="text-xs text-slate-400">Efficiency Score</div>
                      <div className="text-xl font-bold text-indigo-400 font-mono tabular-nums">
                        {auditResult.healthScore} / 100
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => speakText(auditResult.executiveSummary)}
                      className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center gap-1.5 cursor-pointer"
                    >
                      <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
                      Read Summary Aloud
                    </button>
                  </div>
                </div>

                <p className="text-sm text-slate-300 leading-relaxed">
                  {auditResult.executiveSummary}
                </p>
              </div>

              {/* Filter Bar & Recommendations Table/List */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-slate-200">
                    Actionable Optimization Recommendations ({filteredRecommendations.length})
                  </h3>
                  <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg">
                    {(['ALL', 'HIGH', 'MEDIUM', 'LOW'] as PriorityFilter[]).map((prio) => (
                      <button
                        key={prio}
                        type="button"
                        onClick={() => setPriorityFilter(prio)}
                        className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          priorityFilter === prio
                            ? 'bg-slate-800 text-white'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {prio === 'ALL' ? 'All Priorities' : prio}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl bg-slate-900/50 overflow-hidden">
                  {filteredRecommendations.map((rec, idx) => (
                    <div
                      key={rec.id || idx}
                      className="p-5 hover:bg-slate-800/30 transition-colors space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <span
                              className={
                                String(rec.priority).toUpperCase() === 'HIGH'
                                  ? 'text-rose-400 font-semibold'
                                  : String(rec.priority).toUpperCase() === 'MEDIUM'
                                  ? 'text-amber-400 font-semibold'
                                  : 'text-emerald-400 font-semibold'
                              }
                            >
                              {String(rec.priority).toUpperCase()} PRIORITY
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{rec.category}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums text-slate-300">
                              {rec.affectedResource}
                            </span>
                          </div>
                          <h4 className="text-base font-semibold text-slate-100">{rec.title}</h4>
                        </div>

                        <div className="flex items-center gap-4 self-start sm:self-center shrink-0">
                          <div className="text-right">
                            <div className="text-xs text-slate-400">Potential Savings</div>
                            <div className="text-sm font-semibold text-emerald-400 font-mono tabular-nums">
                              ${Number(rec.estimatedSavingsUsd || 0).toLocaleString()} / yr
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCopyRecommendation(rec)}
                            className="p-2 text-slate-400 hover:text-slate-100 bg-slate-800/80 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                            title="Copy recommendation details"
                          >
                            {copiedId === rec.id ? (
                              <Check className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed">{rec.rationale}</p>

                      <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs border-t border-slate-800/80">
                        <div className="text-slate-300">
                          <span className="text-slate-400">Recommended Action: </span>
                          <span className="font-medium text-indigo-300">{rec.suggestedAction}</span>
                        </div>
                        <div className="text-slate-400 font-mono tabular-nums shrink-0">
                          Utilization: {rec.currentUtilization}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODE 3: SMART CONTRACT & VENDOR QUOTE AUTO-EXTRACTOR */}
      {activeMode === 'extractor' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          {/* Left Panel: Raw Agreement / Invoice Input */}
          <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold text-slate-100">
                    03. Smart Contract &amp; Quote Extractor
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Paste raw vendor quotes, license schedules, or invoice text to extract schema-validated database fields.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setContractText(SAMPLE_CONTRACT_TEXT)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Load Sample Quote
                </button>
              </div>

              <textarea
                rows={11}
                value={contractText}
                onChange={(e) => setContractText(e.target.value)}
                placeholder="Paste software license contract, invoice, or procurement quote text here..."
                className="w-full p-3.5 text-xs font-mono bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 leading-relaxed"
              />
            </div>

            {extractError && (
              <div className="text-xs text-rose-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{extractError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setContractText('');
                  setExtractedData(null);
                }}
                className="px-3.5 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Clear Text
              </button>
              <button
                type="button"
                onClick={handleExtractContract}
                disabled={loadingExtract || !contractText.trim()}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                {loadingExtract ? 'Extracting Schema...' : 'Extract License Metadata'}
              </button>
            </div>
          </div>

          {/* Right Panel: Structured Database Schema Output */}
          <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-semibold text-slate-100">
                  Extracted Relational Schema Output
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Validated against AssetVault&apos;s Vendor, Asset, and License tables
                </p>
              </div>
              {extractedData && (
                <button
                  type="button"
                  onClick={handleCopyExtractedJson}
                  className="px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {copiedJson ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {copiedJson ? 'Copied JSON' : 'Copy JSON'}
                </button>
              )}
            </div>

            {loadingExtract && (
              <div className="space-y-3 py-6">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <div key={n} className="h-8 w-full bg-slate-800/60 rounded animate-pulse" />
                ))}
              </div>
            )}

            {!loadingExtract && !extractedData && (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-12 space-y-2">
                <FileText className="w-7 h-7 text-slate-500" />
                <p className="text-sm font-medium text-slate-300">
                  No contract metadata extracted yet
                </p>
                <p className="text-xs text-slate-500 max-w-sm">
                  Click &ldquo;Extract License Metadata&rdquo; to parse the agreement text into
                  structured PostgreSQL columns.
                </p>
              </div>
            )}

            {!loadingExtract && extractedData && (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                    <div className="text-slate-400">Vendor Name</div>
                    <div className="text-slate-100 font-semibold mt-1">
                      {extractedData.vendorName}
                    </div>
                    <div className="text-slate-500 mt-0.5 truncate">
                      {extractedData.vendorContactEmail}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                    <div className="text-slate-400">Digital Asset</div>
                    <div className="text-slate-100 font-semibold mt-1">
                      {extractedData.assetName}
                    </div>
                    <div className="text-slate-500 mt-0.5">{extractedData.assetType}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                    <div className="text-slate-400">License Key &amp; Model</div>
                    <div className="text-indigo-300 font-mono tabular-nums font-semibold mt-1">
                      {extractedData.licenseKeySuggestion}
                    </div>
                    <div className="text-slate-500 mt-0.5">{extractedData.licenseType}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                    <div className="text-slate-400">Seats &amp; Annual Cost</div>
                    <div className="text-emerald-400 font-mono tabular-nums font-semibold mt-1">
                      {extractedData.totalSeats} Seats · $
                      {Number(extractedData.annualCostUsd || 0).toLocaleString()}{' '}
                      {extractedData.currency}
                    </div>
                    <div className="text-slate-500 mt-0.5 font-mono tabular-nums">
                      Expires: {extractedData.expirationDate} · Auto-Renew:{' '}
                      {extractedData.autoRenew ? 'Yes' : 'No'}
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
                  <div className="text-slate-400">Compliance &amp; Audit Clauses</div>
                  <p className="text-slate-200 leading-relaxed">
                    {extractedData.complianceSummary}
                  </p>
                </div>

                <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
                  <div className="text-slate-400">Suggested Taxonomy Tags</div>
                  <div className="text-slate-300">
                    {(extractedData.suggestedTags || []).join(' · ') || 'Enterprise · Software'}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
