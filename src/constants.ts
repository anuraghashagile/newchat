import { Message } from './types';

export const INITIAL_GREETING: Message = {
  id: 'init-1',
  text: "You are now connected with a stranger. Say hello!",
  sender: 'system',
  timestamp: Date.now(),
};

export const STRANGER_DISCONNECTED_MSG: Message = {
  id: 'sys-disc',
  text: "Stranger has disconnected.",
  sender: 'system',
  timestamp: Date.now(),
};

// Reduced slots to increase collision probability
export const WAITING_SLOTS = 15; 
export const SLOT_PREFIX = 'anon-chat-lobby-v3-slot-';

// Timings for the Hunter-Gatherer Protocol
export const HUNT_TIMEOUT_MS = 1500; // How long to wait for a connection when hunting a specific slot
export const HOST_DURATION_MS = 10000; // How long to wait in a room before giving up and hunting again

// Massive list of free STUN servers to punch through Mobile NATs
export const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' },
  { urls: 'stun:stun.ekiga.net' },
  { urls: 'stun:stun.ideasip.com' },
  { urls: 'stun:stun.schlund.de' },
  { urls: 'stun:stun.voiparound.com' },
  { urls: 'stun:stun.voipbuster.com' },
  { urls: 'stun:stun.voipstunt.com' },
  { urls: 'stun:stun.voxgratia.org' }
];