
export enum ChatMode {
  IDLE = 'IDLE',
  SEARCHING = 'SEARCHING',
  WAITING = 'WAITING',
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  ERROR = 'ERROR'
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

// Presence state for the lobby
export interface PresenceState {
  peerId: string;
  status: 'waiting' | 'paired';
  timestamp: number;
}
