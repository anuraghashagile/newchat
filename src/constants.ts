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

// The number of "waiting rooms" in the distributed queue.
// Higher number = lower collision chance, but potentially longer wait times to find a match if traffic is low.
export const WAITING_SLOTS = 50; 
export const SLOT_PREFIX = 'anon-chat-lobby-v2-slot-';
