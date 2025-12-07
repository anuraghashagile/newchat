
import { useState, useCallback, useRef, useEffect } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Message, ChatMode, PeerData, PresenceState } from '../types';
import { 
  INITIAL_GREETING, 
  STRANGER_DISCONNECTED_MSG, 
  ICE_SERVERS
} from '../constants';

const MATCHMAKING_CHANNEL = 'global-lobby-v1';

export const useHumanChat = (active: boolean) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<ChatMode>(ChatMode.IDLE);
  const [partnerTyping, setPartnerTyping] = useState(false);
  
  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const myPeerIdRef = useRef<string | null>(null);
  const isMatchmakerRef = useRef(false);

  // --- CLEANUP ---
  const cleanup = useCallback(() => {
    // 1. Leave Supabase Channel
    if (channelRef.current) {
      channelRef.current.untrack(); // Remove self from lobby
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // 2. Close PeerJS Connection
    if (connRef.current) {
      try { connRef.current.close(); } catch (e) {}
      connRef.current = null;
    }

    // 3. Destroy Peer
    if (peerRef.current) {
      try { peerRef.current.destroy(); } catch (e) {}
      peerRef.current = null;
    }
    
    myPeerIdRef.current = null;
    isMatchmakerRef.current = false;
    setPartnerTyping(false);
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

  // --- PEER DATA HANDLING ---
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
    // If we were waiting in lobby, leave it now
    if (channelRef.current) {
      channelRef.current.untrack();
    }

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
      // If connection fails during setup, go back to searching
      if (status !== ChatMode.CONNECTED) {
        // Retry logic could go here, but for now safe fail
      }
      cleanup();
      setStatus(ChatMode.DISCONNECTED);
    });
  }, [handleData, cleanup, status]);

  // --- MATCHMAKING LOGIC ---
  const joinLobby = useCallback((myId: string) => {
    setStatus(ChatMode.SEARCHING);
    
    const channel = supabase.channel(MATCHMAKING_CHANNEL, {
      config: { presence: { key: myId } }
    });
    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        // 1. Get state
        const newState = channel.presenceState<PresenceState>();
        
        // 2. If I am already connecting/connected, ignore updates
        if (isMatchmakerRef.current || connRef.current?.open) return;

        // 3. Find a target
        const users = Object.values(newState).flat();
        
        // Filter: Not me, and Status is 'waiting'
        const potentialPartner = users.find(u => 
          u.peerId !== myId && u.status === 'waiting'
        );

        if (potentialPartner) {
          // 4. FOUND SOMEONE - I AM THE HUNTER
          console.log("Found partner:", potentialPartner.peerId);
          isMatchmakerRef.current = true; // Stop hunting
          
          // Connect to them
          const conn = peerRef.current?.connect(potentialPartner.peerId, { reliable: true });
          if (conn) {
            setupConnection(conn);
          }
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Initial join: Broadcast that I am waiting
          await channel.track({
            peerId: myId,
            status: 'waiting',
            timestamp: Date.now()
          });
          setStatus(ChatMode.WAITING);
        }
      });

  }, [setupConnection]);


  const connect = useCallback(() => {
    cleanup(); // Clean old sessions
    
    // Create new Peer
    const peer = new Peer({
      debug: 0,
      config: { iceServers: ICE_SERVERS }
    });
    peerRef.current = peer;

    peer.on('open', (id) => {
      myPeerIdRef.current = id;
      joinLobby(id);
    });

    // If someone connects to ME (I was the waiter)
    peer.on('connection', (conn) => {
      isMatchmakerRef.current = true; // Stop listening to presence
      setupConnection(conn);
    });

    peer.on('error', (err) => {
      console.error("Peer Error:", err);
      // If fatal error, we might want to restart
      setStatus(ChatMode.ERROR);
    });

  }, [cleanup, joinLobby, setupConnection]);

  const disconnect = useCallback(() => {
    if (connRef.current && connRef.current.open) {
      connRef.current.send({ type: 'disconnect' });
    }
    cleanup();
    setStatus(ChatMode.IDLE);
    setMessages([]);
  }, [cleanup]);

  useEffect(() => {
    return () => { cleanup(); };
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
