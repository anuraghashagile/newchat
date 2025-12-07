export enum ChatMode {
  IDLE = 'IDLE',
  SEARCHING = 'SEARCHING', // Looking for someone in DB
  WAITING = 'WAITING',     // Sitting in DB waiting for connection
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  ERROR = 'ERROR',
  FATAL_ERROR = 'FATAL_ERROR' // Database missing or misconfigured
}

export interface Message {
  id: string;
  text: string;
  sender: 'me' | 'stranger' | 'system';
  timestamp: number;
  isVanish?: boolean;
}

export type ChatType = 'ai' | 'human';

export interface ChatState {
  mode: ChatMode;
  isTyping: boolean;
  partnerTyping: boolean;
  vanishMode: boolean;
}

export interface PeerData {
  type: 'message' | 'typing' | 'disconnect';
  payload?: any;
}

export interface QueueRow {
  id: number;
  peer_id: string;
  created_at: string;
}