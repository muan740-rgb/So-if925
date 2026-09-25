import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // ไม่ throw error ตอน build เพื่อไม่ให้ build บน Vercel ล้มเหลว
  // แต่จะเตือนใน console ถ้าลืมตั้งค่า env variable
  console.warn(
    '[supabaseClient] ไม่พบ NEXT_PUBLIC_SUPABASE_URL หรือ NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
      'กรุณาตั้งค่าใน .env.local (dev) หรือ Vercel Project Settings > Environment Variables (production)'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
