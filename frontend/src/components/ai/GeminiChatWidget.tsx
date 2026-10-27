// ==============================================================================
// AssetVault: Multi-Turn Gemini Chatbot Widget (Floating & Docked Drawer)
// Course: BCSE307L Database Systems (Fall 2026-27)
// Features: Multi-turn conversation history, scrollable thread, role-based system
// instructions, and Gemini model tier selector (gemini-4-argon, gemini-3.8-flash,
// gemini-3.1-flash-lite).
// ==============================================================================

import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  Send,
  Sparkles,
  X,
  Trash2,
  Maximize2,
  Minimize2,
  Zap,
  Cpu,
  ShieldCheck,
  Database,
  DollarSign,
  Loader2,
  MessageSquare,
  Mail,
} from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { openGmailModal } from '../notifications/SendGmailModal';

export interface ChatTurn {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  modelUsed?: string;
  persona?: string;
}

export type GeminiModelOption = 'gemini-3.8-flash' | 'gemini-3.1-flash-lite' | 'gemini-4-argon';
export type ChatbotPersona = 'DB_COPILOT' | 'SAM_AUDITOR' | 'COMPLIANCE_OFFICER';

const MODEL_OPTIONS: Array<{
  id: GeminiModelOption;
  label: string;
  badge: string;
  description: string;
}> = [
  {
    id: 'gemini-3.8-flash',
    label: 'Gemini 3.8 Flash',
    badge: 'General',
    description: 'Balanced speed & reasoning for general database queries',
  },
  {
    id: 'gemini-3.1-flash-lite',
    label: 'Gemini 3.1 Flash Lite',
    badge: 'Fast',
    description: 'Ultra-low latency for quick lookups & instant answers',
  },
  {
    id: 'gemini-4-argon',
    label: 'Gemini 4 Argon',
    badge: 'Complex',
    description: 'Deep multi-step reasoning for complex FinOps & compliance audits',
  },
];

const PERSONA_OPTIONS: Array<{
  id: ChatbotPersona;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
  starterPrompts: string[];
}> = [
  {
    id: 'DB_COPILOT',
    label: 'Database & Asset Copilot',
    shortLabel: 'DB Copilot',
    icon: <Database className="w-3.5 h-3.5" />,
    starterPrompts: [
      'Summarize our active software assets and license seat usage.',
      'Which licenses have the most available seats right now?',
      'List all vendors and their associated license keys.',
    ],
  },
  {
    id: 'SAM_AUDITOR',
    label: 'FinOps & License Auditor',
    shortLabel: 'FinOps Auditor',
    icon: <DollarSign className="w-3.5 h-3.5" />,
    starterPrompts: [
      'Where can we cut annual software spend by reclaiming idle seats?',
      'Which contracts have low seat utilization relative to their cost?',
      'Give me a FinOps breakdown of our highest-cost licenses.',
    ],
  },
  {
    id: 'COMPLIANCE_OFFICER',
    label: 'Compliance & Governance Advisor',
    shortLabel: 'Compliance',
    icon: <ShieldCheck className="w-3.5 h-3.5" />,
    starterPrompts: [
      'Are any licenses expiring soon or at risk of non-compliance?',
      'Check if all active software assets have valid license coverage.',
      'What auto-renewal contracts require procurement review?',
    ],
  },
];

const STORAGE_KEY = 'assetvault_gemini_chat_history';

export const GeminiChatWidget: React.FC = () => {
  const toast = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedModel, setSelectedModel] = useState<GeminiModelOption>('gemini-3.8-flash');
  const [selectedPersona, setSelectedPersona] = useState<ChatbotPersona>('DB_COPILOT');
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);

  const [messages, setMessages] = useState<ChatTurn[]>(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [
      {
        id: 'welcome-msg',
        role: 'model',
        text: 'Hello! I am your AssetVault Gemini Assistant. Choose a specialist role and model tier above, or ask me anything about your digital assets, licenses, seat allocations, and annual spend.',
        timestamp: new Date().toISOString(),
        modelUsed: 'gemini-3.8-flash',
        persona: 'DB_COPILOT',
      },
    ];
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {}
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Allow opening the chatbot from anywhere via custom window event
  useEffect(() => {
    const handleToggleEvent = () => setIsOpen((prev) => !prev);
    const handleOpenEvent = () => setIsOpen(true);
    window.addEventListener('assetvault:toggle-ai-chat', handleToggleEvent);
    window.addEventListener('assetvault:open-ai-chat', handleOpenEvent);
    return () => {
      window.removeEventListener('assetvault:toggle-ai-chat', handleToggleEvent);
      window.removeEventListener('assetvault:open-ai-chat', handleOpenEvent);
    };
  }, []);

  const currentPersonaObj =
    PERSONA_OPTIONS.find((p) => p.id === selectedPersona) || PERSONA_OPTIONS[0];

  const handleSendMessage = async (promptText?: string) => {
    const trimmed = (promptText ?? input).trim();
    if (!trimmed || isSending) return;

    const userTurn: ChatTurn = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: trimmed,
      timestamp: new Date().toISOString(),
    };

    const historyForApi = messages
      .filter((m) => m.id !== 'welcome-msg')
      .map((m) => ({
        role: m.role,
        text: m.text,
      }));

    setMessages((prev) => [...prev, userTurn]);
    if (!promptText) setInput('');
    setIsSending(true);

    try {
      const res = await api.post<{
        data: {
          reply: string;
          modelUsed?: string;
          persona?: string;
          timestamp?: string;
        };
      }>('/ai/copilot', {
        prompt: trimmed,
        history: historyForApi,
        model: selectedModel,
        persona: selectedPersona,
      });

      const payload = (res as any)?.data || res;
      const modelTurn: ChatTurn = {
        id: `model-${Date.now()}`,
        role: 'model',
        text: payload?.reply || 'No response received from Gemini.',
        timestamp: payload?.timestamp || new Date().toISOString(),
        modelUsed: payload?.modelUsed || selectedModel,
        persona: payload?.persona || selectedPersona,
      };

      setMessages((prev) => [...prev, modelTurn]);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to reach Gemini AI service.', 'AI Chat Error');
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'model',
          text: `Unable to complete request: ${err?.message || 'Service unavailable'}. Please try again.`,
          timestamp: new Date().toISOString(),
          modelUsed: selectedModel,
          persona: selectedPersona,
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleClearChat = () => {
    const resetMsg: ChatTurn = {
      id: 'welcome-msg',
      role: 'model',
      text: `Conversation cleared. I am ready as your ${currentPersonaObj.label}. How can I help?`,
      timestamp: new Date().toISOString(),
      modelUsed: selectedModel,
      persona: selectedPersona,
    };
    setMessages([resetMsg]);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {}
  };

  return (
    <>
      {/* Floating Action Launcher Button (Bottom-Right) */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Open Gemini AI Chatbot"
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold text-xs shadow-xl shadow-indigo-600/30 border border-indigo-400/30 transition-all duration-200 cursor-pointer group"
        >
          <span className="relative flex items-center justify-center w-6 h-6 rounded-lg bg-white/15">
            <Sparkles className="w-4 h-4 text-indigo-100 group-hover:rotate-12 transition-transform" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-indigo-600" />
          </span>
          <span>Gemini Copilot</span>
        </button>
      )}

      {/* Multi-Turn Chat Window */}
      {isOpen && (
        <div
          className={`fixed z-50 flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl overflow-hidden transition-all duration-200 ${
            isExpanded
              ? 'inset-4 sm:inset-8 lg:inset-12'
              : 'bottom-5 right-5 w-[calc(100vw-2.5rem)] sm:w-[440px] h-[620px] max-h-[calc(100vh-3rem)]'
          }`}
        >
          {/* Header Bar */}
          <div className="px-4 py-3 bg-slate-950 text-white border-b border-slate-800 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs font-bold tracking-tight text-white truncate">
                    AssetVault Gemini Chat
                  </h3>
                  <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded">
                    Multi-Turn
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 truncate">
                  Live Tenant Database Context • Role-Guided Assistant
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={handleClearChat}
                title="Clear conversation history"
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsExpanded((prev) => !prev)}
                title={isExpanded ? 'Restore compact size' : 'Expand chat window'}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                {isExpanded ? (
                  <Minimize2 className="w-3.5 h-3.5" />
                ) : (
                  <Maximize2 className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Close chat"
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Role & Model Configuration Bar */}
          <div className="px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800 space-y-2 shrink-0">
            {/* Role Selector (System Instruction) */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {PERSONA_OPTIONS.map((persona) => {
                const active = selectedPersona === persona.id;
                return (
                  <button
                    key={persona.id}
                    type="button"
                    onClick={() => setSelectedPersona(persona.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all shrink-0 cursor-pointer border ${
                      active
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-xs'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    {persona.icon}
                    <span>{persona.shortLabel}</span>
                  </button>
                );
              })}
            </div>

            {/* Model Selector (Fast / General / Complex) */}
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1 shrink-0">
                <Cpu className="w-3 h-3 text-indigo-500" />
                Model:
              </span>
              <div className="flex items-center gap-1 flex-1 justify-end">
                {MODEL_OPTIONS.map((m) => {
                  const active = selectedModel === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelectedModel(m.id)}
                      title={`${m.label} — ${m.description}`}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer border ${
                        active
                          ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border-indigo-500/40'
                          : 'text-slate-500 dark:text-slate-400 border-transparent hover:bg-slate-200/60 dark:hover:bg-slate-800'
                      }`}
                    >
                      {m.badge} ({m.id.replace('gemini-', '')})
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Scrollable Message Thread */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-white dark:bg-slate-900">
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                      isUser
                        ? 'bg-indigo-600 text-white rounded-br-xs shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800/90 text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700/70 rounded-bl-xs'
                    }`}
                  >
                    {msg.text}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 px-1 text-[10px] text-slate-400">
                    <span>{isUser ? 'You' : 'Gemini'}</span>
                    {!isUser && msg.modelUsed && (
                      <>
                        <span>•</span>
                        <span className="font-mono text-indigo-400">{msg.modelUsed}</span>
                      </>
                    )}
                    {!isUser && msg.id !== 'welcome-msg' && (
                      <>
                        <span>•</span>
                        <button
                          type="button"
                          onClick={() =>
                            openGmailModal({
                              initialSubject: '[AssetVault] AI License & Compliance Report',
                              initialBody: msg.text,
                              notificationMessage: msg.text,
                            })
                          }
                          className="inline-flex items-center gap-1 text-indigo-500 hover:text-indigo-400 font-semibold cursor-pointer"
                          title="Email this AI insight via Gmail"
                        >
                          <Mail className="w-3 h-3" />
                          <span>Email via Gmail</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {isSending && (
              <div className="flex items-start gap-2">
                <div className="bg-slate-100 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 rounded-2xl rounded-bl-xs px-3.5 py-2.5 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                  <span>Thinking...</span>
                </div>
              </div>
            )}

            {/* Quick Starter Prompts when conversation is fresh */}
            {messages.length <= 1 && !isSending && (
              <div className="pt-2 space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-1">
                  Suggested Prompts ({currentPersonaObj.shortLabel})
                </p>
                {currentPersonaObj.starterPrompts.map((prompt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(prompt)}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/50 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-800 hover:border-indigo-500/40 transition-colors flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <span className="truncate">{prompt}</span>
                    <Zap className="w-3 h-3 text-indigo-400 shrink-0" />
                  </button>
                ))}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Composer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2 shrink-0"
          >
            <MessageSquare className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Ask ${currentPersonaObj.shortLabel}...`}
              disabled={isSending}
              className="flex-1 bg-transparent text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!input.trim() || isSending}
              aria-label="Send message"
              className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition-colors cursor-pointer shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}
    </>
  );
};
