import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Loader2, Users, Bot, Zap, RefreshCw, EyeOff, MessageSquare } from 'lucide-react';
import { Message, ChatMode, ChatType } from './types';
import { useHumanChat } from './hooks/useHumanChat';
import { MessageBubble } from './components/MessageBubble';
import { Button } from './components/Button';
import { clsx } from 'clsx';

// --- AI Chat Hook (Simulated Stranger) ---
// Kept for "AI Companion" fallback if users want it
const useAiChat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<ChatMode>(ChatMode.IDLE);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const isTypingRef = useRef(false);

  const connect = useCallback(async () => {
    setStatus(ChatMode.SEARCHING);
    setMessages([]);
    setTimeout(() => {
      setStatus(ChatMode.CONNECTED);
      setMessages([{
        id: 'init-ai',
        text: "You're connected to an AI stranger. Say hi!",
        sender: 'system',
        timestamp: Date.now()
      }]);
    }, 1500);
  }, []);

  const disconnect = useCallback(() => {
    setStatus(ChatMode.DISCONNECTED);
    setMessages(prev => [...prev, {
      id: 'sys-disc-ai',
      text: "Stranger has disconnected.",
      sender: 'system',
      timestamp: Date.now()
    }]);
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      text,
      sender: 'me',
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, newMessage]);

    try {
      isTypingRef.current = true;
      setPartnerTyping(true);

      const history = messages.concat(newMessage).map(m => ({
        role: m.sender,
        content: m.text
      }));

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history })
      });

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = '';
      const responseId = (Date.now() + 1).toString();

      setPartnerTyping(false);
      setMessages(prev => [...prev, {
        id: responseId,
        text: '',
        sender: 'stranger',
        timestamp: Date.now()
      }]);

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        accumulatedText += chunk;
        setMessages(prev => prev.map(m => 
          m.id === responseId ? { ...m, text: accumulatedText } : m
        ));
      }
    } catch (err) {
      console.error("Failed to send message", err);
      setPartnerTyping(false);
    } finally {
      isTypingRef.current = false;
    }
  }, [messages]);

  return { messages, status, partnerTyping, connect, disconnect, sendMessage, sendTyping: () => {} };
};

// --- Main App ---
export default function App() {
  const [mode, setMode] = useState<ChatType | null>(null);
  const [onlineCount] = useState(() => Math.floor(Math.random() * 500) + 120);
  const [inputText, setInputText] = useState('');
  const [vanishMode, setVanishMode] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize Hooks
  const humanChat = useHumanChat(mode === 'human');
  const aiChat = useAiChat();

  // Determine active chat controller
  const activeChat = mode === 'human' ? humanChat : aiChat;

  // Auto-scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeChat.messages, activeChat.partnerTyping]);

  // Handle Vanish Mode
  useEffect(() => {
    if (vanishMode && (activeChat.status === ChatMode.DISCONNECTED || activeChat.status === ChatMode.IDLE)) {
      // Clear messages if vanish mode is on and we disconnect
      // This logic is handled by the component re-rendering empty states, 
      // but conceptually we want the UI to respect "vanish" by not showing old history
    }
  }, [vanishMode, activeChat.status]);

  const handleStart = (type: ChatType) => {
    setMode(type);
    if (type === 'human') humanChat.connect();
    else aiChat.connect();
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    activeChat.sendMessage(inputText);
    setInputText('');
    activeChat.sendTyping(false);
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    
    if (mode === 'human') {
      activeChat.sendTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        activeChat.sendTyping(false);
      }, 1000);
    }
  };

  const handleNewChat = () => {
    activeChat.disconnect();
    setTimeout(() => {
      if (mode === 'human') humanChat.connect();
      else aiChat.connect();
    }, 100);
  };

  const handleExit = () => {
    activeChat.disconnect();
    setMode(null);
    setInputText('');
  };

  // --- 1. Landing Screen ---
  if (!mode) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[100px]"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[100px]"></div>
        </div>

        <div className="z-10 w-full max-w-md space-y-8">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center p-4 bg-slate-900 rounded-2xl mb-4 shadow-xl shadow-black/50 border border-slate-800">
              <MessageSquare className="w-10 h-10 text-brand-500" />
            </div>
            <h1 className="text-4xl font-bold text-white tracking-tight">Talk to Strangers</h1>
            <p className="text-slate-400">Anonymous, 1-on-1, Disappearing messages.</p>
          </div>

          <div className="space-y-4">
            <Button 
              onClick={() => handleStart('human')} 
              fullWidth 
              className="h-16 text-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 border-0"
            >
              <div className="flex items-center gap-3">
                <Users className="w-6 h-6" />
                <div className="flex flex-col items-start">
                  <span className="font-bold">Start Chatting</span>
                  <span className="text-xs opacity-75 font-normal">Connect with a random person</span>
                </div>
              </div>
            </Button>

            <Button 
              onClick={() => handleStart('ai')} 
              fullWidth 
              variant="secondary"
              className="h-14"
            >
              <div className="flex items-center gap-3">
                <Bot className="w-5 h-5" />
                <span>Practice with AI</span>
              </div>
            </Button>
          </div>

          <div className="flex justify-center pt-8">
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-500 bg-emerald-500/10 px-3 py-1.5 rounded-full">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              {onlineCount.toLocaleString()} people online now
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- 2. Searching Screen ---
  if (activeChat.status === ChatMode.SEARCHING || activeChat.status === ChatMode.PAIRING) {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-brand-500 blur-2xl opacity-20 animate-pulse"></div>
          <Loader2 className="w-16 h-16 text-brand-500 animate-spin relative z-10" />
        </div>
        
        <h2 className="text-2xl font-bold text-white mb-2">Looking for someone...</h2>
        <p className="text-slate-500 max-w-xs mx-auto animate-pulse">
          {activeChat.status === ChatMode.PAIRING 
            ? 'Waiting for partner to connect...' 
            : 'Searching for an available partner in the queue...'}
        </p>
        
        <Button variant="ghost" onClick={handleExit} className="mt-8">
          Cancel
        </Button>
      </div>
    );
  }

  // --- 3. Chat Screen ---
  return (
    <div className="flex flex-col h-screen bg-slate-950">
      {/* Header */}
      <header className="h-16 px-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <div>
            <h3 className="font-bold text-white text-sm">
              {activeChat.status === ChatMode.CONNECTED ? 'Stranger' : 'Disconnected'}
            </h3>
            {activeChat.partnerTyping && (
              <p className="text-xs text-brand-400 font-medium animate-pulse">typing...</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
           <button
             onClick={() => setVanishMode(!vanishMode)}
             className={clsx(
               "p-2 rounded-lg transition-colors",
               vanishMode ? "bg-purple-500/20 text-purple-400" : "hover:bg-slate-800 text-slate-500"
             )}
             title="Vanish Mode: Messages disappear on disconnect"
           >
             <EyeOff size={20} />
           </button>
           
           <Button 
             variant="danger" 
             className="px-4 py-1.5 h-9 text-xs"
             onClick={handleExit}
           >
             Stop
           </Button>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeChat.messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        
        {/* Disconnect State */}
        {activeChat.status === ChatMode.DISCONNECTED && (
          <div className="py-8 flex flex-col items-center gap-4">
            <p className="text-slate-500 text-sm">Conversation ended.</p>
            <div className="flex gap-3">
              <Button onClick={handleNewChat} className="shadow-lg shadow-brand-500/20">
                <RefreshCw size={18} />
                New Chat
              </Button>
              <Button variant="secondary" onClick={handleExit}>
                Home
              </Button>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-slate-900 border-t border-slate-800 shrink-0">
        <form onSubmit={handleSendMessage} className="flex gap-2 max-w-4xl mx-auto">
          <input
            type="text"
            value={inputText}
            onChange={handleTyping}
            disabled={activeChat.status !== ChatMode.CONNECTED}
            placeholder={activeChat.status === ChatMode.CONNECTED ? "Type a message..." : "Stranger has disconnected"}
            className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 text-white focus:outline-none focus:border-brand-500 transition-colors disabled:opacity-50"
            autoFocus
          />
          <button
            type="submit"
            disabled={!inputText.trim() || activeChat.status !== ChatMode.CONNECTED}
            className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 disabled:hover:bg-brand-500 text-white rounded-xl p-3 transition-colors"
          >
            <Send size={20} />
          </button>
        </form>
      </div>
    </div>
  );
}
