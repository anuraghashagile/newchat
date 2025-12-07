import { useState, useCallback, useRef, useEffect } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { Message, ChatMode, PeerData } from '../types';
import { 
  INITIAL_GREETING, 
  STRANGER_DISCONNECTED_MSG, 
  WAITING_SLOTS, 
  SLOT_PREFIX, 
  ICE_SERVERS,
  HUNT_TIMEOUT_MS,
  HOST_DURATION_MS
} from '../constants';

export const useHumanChat = (active: boolean) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<ChatMode>(ChatMode.IDLE);
  const [partnerTyping, setPartnerTyping] = useState(false);
  
  // Refs to keep track of instances without triggering re-renders
  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);
  const cycleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const huntTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // State to track debug info (optional, but good for stability)
  const isHostRef = useRef(false);

  // --- CLEANUP ---
  const cleanup = useCallback(() => {
    if (cycleTimeoutRef.current) clearTimeout(cycleTimeoutRef.current);
    if (huntTimeoutRef.current) clearTimeout(huntTimeoutRef.current);

    if (connRef.current) {
      try { connRef.current.close(); } catch (e) {}
      connRef.current = null;
    }

    if (peerRef.current) {
      try { peerRef.current.destroy(); } catch (e) {}
      peerRef.current = null;
    }
    
    setPartnerTyping(false);
    isHostRef.current = false;
  }, []);

  // --- MESSAGING ---
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

  const sendTyping = useCallback((isTyping: boolean) => {
    if (connRef.current && status === ChatMode.CONNECTED) {
      const payload: PeerData = { type: 'typing', payload: isTyping };
      connRef.current.send(payload);
    }
  }, [status]);

  // --- EVENT HANDLERS ---
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
      cleanup();
    }
  }, [cleanup]);

  const setupConnection = useCallback((conn: DataConnection) => {
    // Clear any pending matchmaking cycles
    if (cycleTimeoutRef.current) clearTimeout(cycleTimeoutRef.current);
    if (huntTimeoutRef.current) clearTimeout(huntTimeoutRef.current);
    
    connRef.current = conn;
    
    conn.on('open', () => {
      setStatus(ChatMode.CONNECTED);
      setMessages([INITIAL_GREETING]);
    });

    conn.on('data', (data: any) => handleData(data));

    conn.on('close', () => {
      if (status === ChatMode.CONNECTED) {
        setStatus(ChatMode.DISCONNECTED);
        setMessages(prev => [...prev, STRANGER_DISCONNECTED_MSG]);
      }
      cleanup();
    });
    
    conn.on('error', () => {
      cleanup();
      setStatus(ChatMode.DISCONNECTED);
    });
  }, [handleData, cleanup, status]);

  // --- MATCHMAKING LOGIC ---

  // Phase 2: HOSTING (Gatherer)
  // We open a room with a specific ID and wait for a Hunter to find us.
  const startHosting = useCallback(() => {
    cleanup();
    setStatus(ChatMode.PAIRING); // "Waiting for partner..."
    isHostRef.current = true;

    // Pick a random slot to host
    const slotId = Math.floor(Math.random() * WAITING_SLOTS);
    const myPeerId = `${SLOT_PREFIX}${slotId}`;

    const peer = new Peer(myPeerId, {
      debug: 0,
      config: { iceServers: ICE_SERVERS }
    });
    peerRef.current = peer;

    peer.on('open', () => {
      // We successfully claimed the slot. Wait for connection.
      // If nobody joins in HOST_DURATION_MS, we give up and switch to hunting.
      cycleTimeoutRef.current = setTimeout(() => {
        // console.log("Host timed out, switching to Hunter");
        startHunting();
      }, HOST_DURATION_MS);
    });

    peer.on('connection', (conn) => {
      // Success! Someone connected to us.
      setupConnection(conn);
    });

    peer.on('error', (err: any) => {
      // If ID is taken ('unavailable-id'), it means someone else is hosting this slot.
      // We should switch to hunting immediately to try and connect to them.
      if (err.type === 'unavailable-id') {
        startHunting();
      } else {
        // Other errors, just retry hosting different slot
        cycleTimeoutRef.current = setTimeout(startHosting, 1000);
      }
    });
  }, [cleanup, setupConnection]);

  // Phase 1: HUNTING (Client)
  // We act as a client and try to connect to random slots.
  const startHunting = useCallback(() => {
    cleanup();
    setStatus(ChatMode.SEARCHING); // "Searching for partner..."
    isHostRef.current = false;

    // Create an anonymous peer to be the hunter
    const peer = new Peer({
      debug: 0,
      config: { iceServers: ICE_SERVERS }
    });
    peerRef.current = peer;

    peer.on('open', () => {
      // Try to connect to a random slot
      const targetSlot = Math.floor(Math.random() * WAITING_SLOTS);
      const targetPeerId = `${SLOT_PREFIX}${targetSlot}`;
      
      const conn = peer.connect(targetPeerId, { reliable: true });

      // If connection opens, we are good!
      conn.on('open', () => {
        setupConnection(conn);
      });

      // If connection fails/closes immediately (nobody home), try next or switch to host
      conn.on('close', () => {
         // This might fire if we connect but they disconnect immediately
      });
      
      conn.on('error', () => {
        // Connection failed
      });

      // Set a timeout. If we don't connect within HUNT_TIMEOUT_MS, try another slot or switch to hosting.
      // We'll flip a coin: 70% chance to keep hunting, 30% chance to start hosting.
      // This prevents everyone from getting stuck in "Hunt" mode.
      huntTimeoutRef.current = setTimeout(() => {
        if (connRef.current && connRef.current.open) return; // Already connected
        
        // Destroy this attempt
        conn.close();
        
        // Decision: Hunt again or Host?
        if (Math.random() > 0.3) {
           startHunting(); // Recursively hunt again
        } else {
           startHosting(); // Switch to hosting
        }
      }, HUNT_TIMEOUT_MS);
    });

    peer.on('error', () => {
      // Peer creation failed, retry
      cycleTimeoutRef.current = setTimeout(startHunting, 1000);
    });

  }, [cleanup, setupConnection, startHosting]); // Added startHosting to dep array via circular logic handling below

  // Circular dependency fix: startHosting needs startHunting, and vice versa.
  // We use a ref or simple function hoisting, but since they are in same scope, it's fine.
  // However, for useEffect, we need a stable entry point.
  
  const connect = useCallback(() => {
    // Start by hunting. It feels faster for the user.
    startHunting();
  }, [startHunting]);

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
    connect, 
    disconnect 
  };
};