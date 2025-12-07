import { useState, useCallback, useRef, useEffect } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { Message, ChatMode, PeerData } from '../types';
import { INITIAL_GREETING, STRANGER_DISCONNECTED_MSG, WAITING_SLOTS, SLOT_PREFIX } from '../constants';

export const useHumanChat = (active: boolean) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<ChatMode>(ChatMode.IDLE);
  const [partnerTyping, setPartnerTyping] = useState(false);
  
  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);
  const cleanupRef = useRef<NodeJS.Timeout | null>(null);

  // cleanup function to destroy connections
  const cleanup = useCallback(() => {
    if (cleanupRef.current) clearTimeout(cleanupRef.current);
    
    if (connRef.current) {
      try { connRef.current.close(); } catch (e) {}
      connRef.current = null;
    }
    
    if (peerRef.current) {
      try { peerRef.current.destroy(); } catch (e) {}
      peerRef.current = null;
    }
    
    setPartnerTyping(false);
  }, []);

  // Send a text message
  const sendMessage = useCallback((text: string) => {
    if (connRef.current && status === ChatMode.CONNECTED) {
      const payload: PeerData = { type: 'message', payload: text };
      connRef.current.send(payload);
      
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        text,
        sender: 'me',
        timestamp: Date.now()
      }]);
    }
  }, [status]);

  // Send typing status
  const sendTyping = useCallback((isTyping: boolean) => {
    if (connRef.current && status === ChatMode.CONNECTED) {
      const payload: PeerData = { type: 'typing', payload: isTyping };
      connRef.current.send(payload);
    }
  }, [status]);

  // Handle incoming data
  const handleData = useCallback((data: PeerData) => {
    if (data.type === 'message') {
      setPartnerTyping(false);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        text: data.payload,
        sender: 'stranger',
        timestamp: Date.now()
      }]);
    } else if (data.type === 'typing') {
      setPartnerTyping(data.payload);
    } else if (data.type === 'disconnect') {
      setStatus(ChatMode.DISCONNECTED);
      setMessages(prev => [...prev, STRANGER_DISCONNECTED_MSG]);
    }
  }, []);

  // Setup connection handlers
  const setupConnection = useCallback((conn: DataConnection) => {
    connRef.current = conn;

    conn.on('open', () => {
      setStatus(ChatMode.CONNECTED);
      setMessages([INITIAL_GREETING]);
    });

    conn.on('data', (data: any) => handleData(data));

    conn.on('close', () => {
      setStatus(ChatMode.DISCONNECTED);
      setMessages(prev => [...prev, STRANGER_DISCONNECTED_MSG]);
      setPartnerTyping(false);
    });
    
    conn.on('error', () => {
      setStatus(ChatMode.DISCONNECTED);
    });
  }, [handleData]);

  // The Core Matchmaking Logic
  // Strategy: Randomly try to occupy a slot. If occupied, connect to the occupier.
  const findStranger = useCallback(() => {
    cleanup();
    setStatus(ChatMode.SEARCHING);
    setMessages([]);

    // 1. Pick a random slot
    const slotId = Math.floor(Math.random() * WAITING_SLOTS);
    const myPeerId = `${SLOT_PREFIX}${slotId}`;

    const peer = new Peer(myPeerId, {
      debug: 0,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]
      }
    });
    peerRef.current = peer;

    // A. If we successfully open with ID, we are the HOST (Waiting in queue)
    peer.on('open', () => {
      setStatus(ChatMode.PAIRING); // Pairing means "Waiting for someone to join me"
    });

    peer.on('connection', (conn) => {
      // Someone found us!
      setupConnection(conn);
    });

    // B. If error 'unavailable-id', someone is already there. Connect to them (GUEST).
    peer.on('error', (err: any) => {
      if (err.type === 'unavailable-id') {
        // Destroy the failed peer first
        peer.destroy();
        
        // Create a new anonymous peer to connect as guest
        const guestPeer = new Peer({
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:global.stun.twilio.com:3478' }
            ]
          }
        });
        peerRef.current = guestPeer;

        guestPeer.on('open', () => {
          const conn = guestPeer.connect(myPeerId, { reliable: true });
          
          // If the connection hangs for 5s, retry
          const timeout = setTimeout(() => {
             if (status !== ChatMode.CONNECTED) {
               guestPeer.destroy();
               findStranger(); // Retry
             }
          }, 5000);
          
          conn.on('open', () => {
            clearTimeout(timeout);
            setupConnection(conn);
          });
          
          conn.on('error', () => {
             clearTimeout(timeout);
             findStranger(); // Retry
          });
        });
      } else {
        // Other errors (network), retry
        setTimeout(findStranger, 2000);
      }
    });

  }, [cleanup, setupConnection]);

  const disconnect = useCallback(() => {
    if (connRef.current && connRef.current.open) {
      connRef.current.send({ type: 'disconnect' });
    }
    cleanup();
    setStatus(ChatMode.IDLE);
    setMessages([]);
  }, [cleanup]);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  return { 
    messages, 
    status, 
    partnerTyping,
    sendMessage, 
    sendTyping,
    connect: findStranger, 
    disconnect 
  };
};
