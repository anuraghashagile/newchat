import React from 'react';
import { Message } from '../types';
import { clsx } from 'clsx';

interface MessageBubbleProps {
  message: Message;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  if (message.sender === 'system') {
    return (
      <div className="flex justify-center my-4">
        <span className="text-xs font-medium text-slate-500 bg-slate-900/50 px-3 py-1 rounded-full uppercase tracking-wider">
          {message.text}
        </span>
      </div>
    );
  }

  const isMe = message.sender === 'me';

  return (
    <div className={clsx("flex w-full mb-4", isMe ? "justify-end" : "justify-start")}>
      <div 
        className={clsx(
          "max-w-[80%] px-4 py-3 rounded-2xl text-sm md:text-base leading-relaxed break-words shadow-md",
          isMe 
            ? "bg-brand-600 text-white rounded-tr-sm" 
            : "bg-slate-800 text-slate-200 rounded-tl-sm border border-slate-700"
        )}
      >
        {message.text}
      </div>
    </div>
  );
};