
import { createClient } from '@supabase/supabase-js';

// Credentials injected for instant deployment
const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || "https://ivvglvpnryiwjdqdsvka.supabase.co";
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2dmdsdnBucnlpd2pkcWRzdmthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMTcxMzEsImV4cCI6MjA4MDY5MzEzMX0.RgQVnTVjptaZTArvv8OvdWxqc7rgnaQaoOhuZH4GtsA";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase credentials missing! Chat will not work.");
}

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);
