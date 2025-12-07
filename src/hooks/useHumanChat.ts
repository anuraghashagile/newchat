import { useState, useCallback, useRef, useEffect } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { supabase } from '../lib/supabase';
import { Message, ChatMode, PeerData, QueueRow } from '../types';
import { 
  INITIAL_GREETING, 
  STRANGER_DISCONNECTED_MSG, 
  ICE_SERVERS
} from '../constants';

export const useHumanChat = (active: boolean) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<ChatMode>(ChatMode.IDLE);
  const [partnerTyping, setPartnerTyping] = useState(false);
  
  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);
  const myPeerIdRef = useRef<string | null>(null);
  
  // Track if we are currently sitting in the database queue
  const isQueuedRef = useRef(false);

  // --- CLEANUP ---
  const cleanup = useCallback(async () => {
    // If we were waiting in queue, remove ourselves
    if (isQueuedRef.current && myPeerIdRef.current) {
      await supabase.from('waiting_queue').delete().eq('peer_id', myPeerIdRef.current);
      isQueuedRef.current = false;
    }

    if (connRef.current) {
      try { connRef.current.close(); } catch (e) {}
      connRef.current = null;
    }

    if (peerRef.current) {
      try { peerRef.current.destroy(); } catch (e) {}
      peerRef.current = null;
    }
    
    myPeerIdRef.current = null;
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

  // --- PEER SETUP ---
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

  const setupConnection = useCallback(async (conn: DataConnection) => {
    // We found a match (either initiated or received).
    // If we were in queue, remove ourselves immediately.
    if (isQueuedRef.current && myPeerIdRef.current) {
      await supabase.from('waiting_queue').delete().eq('peer_id', myPeerIdRef.current);
      isQueuedRef.current = false;
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
      cleanup();
      setStatus(ChatMode.DISCONNECTED);
    });
  }, [handleData, cleanup, status]);


  // --- MATCHMAKING (SUPABASE) ---
  const findMatch = useCallback(async (peer: Peer, myId: string) => {
    setStatus(ChatMode.SEARCHING);
    
    // 1. Look for someone waiting in the queue (oldest first)
    // Filter out our own ID just in case
    const { data: potentialMatches, error } = await supabase
      .from('waiting_queue')
      .select('*')
      .neq('peer_id', myId)
      .order('created_at', { ascending: true })
      .limit(1);

    if (error) {
      console.error("Supabase error:", error);
      // Fallback: just wait if DB fails
      addToQueue(myId);
      return;
    }

    // 2. FOUND SOMEONE
    if (potentialMatches && potentialMatches.length > 0) {
      const target = potentialMatches[0];
      
      // 3. CLAIM THEM (Atomic Delete)
      // We try to delete their row. If we succeed, we own the connection.
      // If we fail (0 rows deleted), someone else grabbed them, so we try again.
      const { count } = await supabase
        .from('waiting_queue')
        .delete()
        .eq('id', target.id); // Delete by unique Row ID

      if (count && count > 0) {
        // Success! We claimed this user. Connect to them.
        console.log("Match found! Connecting to:", target.peer_id);
        const conn = peer.connect(target.peer_id, { reliable: true });
        setupConnection(conn);
      } else {
        // Race condition: Someone else grabbed them. Recursively try again.
        console.log("Match stolen, retrying...");
        findMatch(peer, myId);
      }
    } 
    // 3. NOBODY WAITING -> ADD SELF TO QUEUE
    else {
      addToQueue(myId);
    }
  }, [setupConnection]);

  const addToQueue = useCallback(async (myId: string) => {
    setStatus(ChatMode.WAITING);
    isQueuedRef.current = true;
    
    // Insert into Supabase
    const { error } = await supabase
      .from('waiting_queue')
      .insert([{ peer_id: myId }]);

    if (error) {
      console.error("Failed to add to queue:", error);
      // If we can't join DB, we can't be found.
      // Status remains 'WAITING' but effectively we are stuck until someone connects 
      // (if PeerJS signaling works directly) or user retries.
    }
    // Now we just wait for peer.on('connection')
  }, []);


  const connect = useCallback(() => {
    cleanup().then(() => {
      setStatus(ChatMode.SEARCHING);

      const peer = new Peer({
        debug: 0,
        config: { iceServers: ICE_SERVERS }
      });
      peerRef.current = peer;

      peer.on('open', (id) => {
        myPeerIdRef.current = id;
        findMatch(peer, id);
      });

      peer.on('connection', (conn) => {
        // Someone found us in the DB and connected!
        setupConnection(conn);
      });

      peer.on('error', (err) => {
        console.error("Peer Error:", err);
        // If fatal, cleanup
        if (err.type === 'peer-unavailable' || err.type === 'network' || err.type === 'server-error') {
           // Retry?
        }
      });
    });
  }, [cleanup, findMatch, setupConnection]);

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