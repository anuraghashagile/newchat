export enum ChatMode {
  IDLE = 'IDLE',
  SEARCHING = 'SEARCHING',
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  ERROR = 'ERROR'
}

export interface Message {
  id: string;
  text: string;
  sender: 'me' | 'stranger' | 'system';
  timestamp: number;
}

export interface PeerState {
  isHost: boolean;
  roomId: string | null;
}

export type ChatType = 'ai' | 'peer';