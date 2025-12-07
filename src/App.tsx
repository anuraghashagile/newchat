import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Hash, Loader2, Play, Users, Copy, Check } from 'lucide-react';
import { Peer } from 'peerjs';
import { Message, ChatMode, ChatType } from './types';
import { INITIAL_GREETING, STRANGER_DISCONNECTED_MSG } from './constants';
import { Header } from './components/Header';
import { MessageBubble } from './components/MessageBubble';
import { Button } from './components/Button';

// Hook for Random Stranger Chat (AI)
const useStrangerChat = (active: boolean) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<ChatMode>(ChatMode.IDLE);
  const isTypingRef = useRef(false);

  const connect = useCallback(async () => {
    setStatus(ChatMode.SEARCHING);
    setMessages([]);
    
    // Simulate finding a match
    const delay = Math.floor(Math.random() * 2000) + 1000;
    setTimeout(() => {
      setStatus(ChatMode.CONNECTED);
      setMessages([INITIAL_GREETING]);
    }, delay);
  }, []);

  const disconnect = useCallback(() => {
    setStatus(ChatMode.DISCONNECTED);
    setMessages(prev => [...prev, STRANGER_DISCONNECTED_MSG]);
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      text,
      sender: 'me',
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, newMessage]);

    // Send to backend
    isTypingRef.current = true;
    try {
      // Prepare history for API
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

      // Create placeholder for stranger message
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
        
        // Update the last message
        setMessages(prev => prev.map(m => 
          m.id === responseId ? { ...m, text: accumulatedText } : m
        ));
      }
    } catch (err) {
      console.error("Failed to send message", err);
    } finally {
      isTypingRef.current = false;
    }
  }, [messages]);

  return { messages, status, connect, disconnect, sendMessage, setMessages, setStatus };
};

// Hook for Friend Chat (PeerJS)
const usePeerChat = (roomId: string | null) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<ChatMode>(ChatMode.IDLE);
  const [peerId, setPeerId] = useState<string | null>(null);
  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<any>(null);

  useEffect(() => {
    if (!roomId) return;

    setStatus(ChatMode.SEARCHING);
    
    // If we have a hash in URL that matches roomId (and it's not 'new'), we are guest
    // But for simplicity, we pass roomId. If it starts with 'host-', we are host.
    
    const isHost = !window.location.hash.includes('join=');
    const myId = isHost ? roomId : `${roomId}-guest-${Math.random().toString(36).substr(2, 5)}`;
    
    const peer = new Peer(myId, {
      debug: 1,
    });
    
    peerRef.current = peer;

    peer.on('open', (id) => {
      console.log('My peer ID is: ' + id);
      setPeerId(id);
      
      if (!isHost) {
        // We are guest, connect to host
        // The roomId passed to hook is the HOST id
        const conn = peer.connect(roomId);
        setupConnection(conn);
      }
    });

    peer.on('connection', (conn) => {
      // We are host, receiving connection
      setupConnection(conn);
    });

    peer.on('error', (err) => {
      console.error(err);
      setStatus(ChatMode.ERROR);
    });

    const setupConnection = (conn: any) => {
      connRef.current = conn;
      
      conn.on('open', () => {
        setStatus(ChatMode.CONNECTED);
        setMessages([INITIAL_GREETING]);
      });

      conn.on('data', (data: any) => {
        if (data.type === 'message') {
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            text: data.text,
            sender: 'stranger',
            timestamp: Date.now()
          }]);
        }
      });

      conn.on('close', () => {
        setStatus(ChatMode.DISCONNECTED);
        setMessages(prev => [...prev, STRANGER_DISCONNECTED_MSG]);
      });
    };

    return () => {
      peer.destroy();
    };
  }, [roomId]);

  const sendMessage = useCallback((text: string) => {
    if (connRef.current && status === ChatMode.CONNECTED) {
      const msg = { type: 'message', text };
      connRef.current.send(msg);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        text,
        sender: 'me',
        timestamp: Date.now()
      }]);
    }
  }, [status]);

  const disconnect = useCallback(() => {
    if (connRef.current) connRef.current.close();
    setStatus(ChatMode.IDLE);
  }, []);

  return { messages, status, sendMessage, disconnect, peerId };
};

export default function App() {
  const [mode, setMode] = useState<ChatType | null>(null);
  const [onlineCount] = useState(() => Math.floor(Math.random() * 5000) + 12000);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Peer State
  const [peerRoomId, setPeerRoomId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Initialize URL check for friend join
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('join=')) {
      const id = hash.split('join=')[1];
      if (id) {
        setMode('peer');
        setPeerRoomId(id);
      }
    }
  }, []);

  // Hooks
  const aiChat = useStrangerChat(mode === 'ai');
  const peerChat = usePeerChat(mode === 'peer' ? peerRoomId : null);

  const activeChat = mode === 'ai' ? aiChat : peerChat;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeChat.messages]);

  const handleStartStranger = () => {
    setMode('ai');
    aiChat.connect();
  };

  const handleStartFriend = () => {
    const newRoomId = `anon-${Math.random().toString(36).substr(2, 9)}`;
    setPeerRoomId(newRoomId);
    setMode('peer');
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    activeChat.sendMessage(inputText);
    setInputText('');
  };

  const handleDisconnect = () => {
    activeChat.disconnect();
    setMode(null);
    setPeerRoomId(null);
    window.location.hash = '';
  };

  const copyInviteLink = () => {
    const url = `${window.location.origin}/#join=${peerChat.peerId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Renders

  if (!mode) {
    return (
      <div className="flex flex-col h-screen bg-slate-950 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950">
        <Header onlineCount={onlineCount} mode={ChatMode.IDLE} chatType={null} onDisconnect={() => {}} />
        
        <main className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-2xl mx-auto w-full">
          <div className="mb-8 relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-brand-500 to-purple-600 rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative bg-slate-950 rounded-full p-6 border border-slate-800">
              <Ghost size={64} className="text-brand-500" />
            </div>
          </div>
          
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
            Talk to Strangers
          </h2>
          <p className="text-slate-400 text-lg mb-12 max-w-md mx-auto">
            Experience anonymous, real-time conversations. No login required. Safe and instant.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
            <Button 
              onClick={handleStartStranger} 
              fullWidth 
              className="h-14 text-lg"
            >
              <Users className="w-5 h-5" />
              Start Random Chat
            </Button>
            
            <Button 
              variant="secondary" 
              onClick={handleStartFriend} 
              fullWidth 
              className="h-14 text-lg"
            >
              <Hash className="w-5 h-5" />
              Chat with Friend
            </Button>
          </div>
          
          <p className="mt-8 text-xs text-slate-600 uppercase tracking-widest font-semibold">
            {onlineCount.toLocaleString()} Users Online Now
          </p>
        </main>
      </div>
    );
  }

  // Searching / Loading Screen
  if (activeChat.status === ChatMode.SEARCHING) {
    return (
      <div className="flex flex-col h-screen bg-slate-950">
        <Header onlineCount={onlineCount} mode={ChatMode.SEARCHING} chatType={mode} onDisconnect={handleDisconnect} />
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <Loader2 className="w-12 h-12 text-brand-500 animate-spin mb-6" />
          <h3 className="text-xl font-medium text-white mb-2">
            {mode === 'ai' ? 'Looking for a random stranger...' : 'Waiting for connection...'}
          </h3>
          <p className="text-slate-500">
            {mode === 'ai' ? 'Matching you with someone with similar interests.' : 'Share the link below with your friend.'}
          </p>

          {mode === 'peer' && peerChat.peerId && (
            <div className="mt-8 bg-slate-900 border border-slate-800 p-4 rounded-xl w-full max-w-md">
              <p className="text-sm text-slate-400 mb-2">Send this link to your friend:</p>
              <div className="flex gap-2">
                <input 
                  readOnly 
                  value={`${window.location.origin}/#join=${peerChat.peerId}`}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-300 font-mono focus:outline-none"
                />
                <button 
                  onClick={copyInviteLink}
                  className="bg-brand-500 hover:bg-brand-600 text-white rounded px-3 transition-colors flex items-center justify-center min-w-[44px]"
                >
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                </button>
              </div>
            </div>
          )}
          
          <Button variant="ghost" onClick={handleDisconnect} className="mt-8">
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // Main Chat Interface
  return (
    <div className="flex flex-col h-screen bg-slate-950">
      <Header 
        onlineCount={onlineCount} 
        mode={activeChat.status} 
        chatType={mode}
        onDisconnect={handleDisconnect} 
      />

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
        {activeChat.messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {activeChat.status === ChatMode.DISCONNECTED && (
          <div className="flex justify-center mt-8">
            <Button onClick={mode === 'ai' ? handleStartStranger : handleStartFriend}>
              Find New Partner
            </Button>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-slate-950 border-t border-slate-800">
        <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex gap-3 relative">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={activeChat.status !== ChatMode.CONNECTED}
            placeholder={activeChat.status === ChatMode.CONNECTED ? "Type a message..." : "Disconnected"}
            className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || activeChat.status !== ChatMode.CONNECTED}
            className="bg-brand-500 hover:bg-brand-600 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-xl px-5 flex items-center justify-center transition-all transform active:scale-95"
          >
            <Send size={20} />
          </button>
        </form>
      </div>
    </div>
  );
}

function Ghost({ className, size }: { className?: string, size?: number }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size || 24} 
      height={size || 24} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M9 10h.01" />
      <path d="M15 10h.01" />
      <path d="M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z" />
    </svg>
  );
}