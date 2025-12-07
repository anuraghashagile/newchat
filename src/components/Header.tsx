import React from 'react';
import { Ghost, Users } from 'lucide-react';
import { ChatMode, ChatType } from '../types';

interface HeaderProps {
  onlineCount: number;
  mode: ChatMode;
  chatType: ChatType | null;
  onDisconnect: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onlineCount, mode, chatType, onDisconnect }) => {
  return (
    <header className="h-16 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md flex items-center justify-between px-4 sticky top-0 z-10">
      <div className="flex items-center gap-2">
        <div className="bg-brand-500/10 p-2 rounded-lg">
          <Ghost className="w-6 h-6 text-brand-500" />
        </div>
        <div>
          <h1 className="font-bold text-lg leading-tight text-white">AnonChat</h1>
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-xs text-slate-400">{onlineCount.toLocaleString()} online</span>
          </div>
        </div>
      </div>

      {mode === ChatMode.CONNECTED && (
        <button 
          onClick={onDisconnect}
          className="text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 px-3 py-1.5 rounded-full transition-colors uppercase tracking-wide"
        >
          Disconnect
        </button>
      )}
    </header>
  );
};