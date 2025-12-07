import { Message } from './types';

export const INITIAL_GREETING: Message = {
  id: 'init-1',
  text: "You're now chatting with a random stranger. Say hi!",
  sender: 'system',
  timestamp: Date.now(),
};

export const STRANGER_DISCONNECTED_MSG: Message = {
  id: 'sys-disc',
  text: "Stranger has disconnected.",
  sender: 'system',
  timestamp: Date.now(),
};
