import { NextResponse } from 'next/server';
export function GET(){const configured=Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL&&process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);return NextResponse.json({ok:true,configured,version:process.env.VERCEL_GIT_COMMIT_SHA||'local'},{headers:{'Cache-Control':'no-store'}})}
