// lib/supabase-types.ts
// Minimal shim to satisfy `import type { Database } from "@/lib/supabase-types"`
export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type Database = {
  // put your tables here if you want typed DB access.
  // For now the shim keeps builds happy:
  public: {
    Tables: Record<string, { Row: Record<string, any>; Insert: Record<string, any>; Update: Record<string, any> }>;
    Views: Record<string, any>;
    Functions: Record<string, any>;
    Enums: Record<string, any>;
  };
};
