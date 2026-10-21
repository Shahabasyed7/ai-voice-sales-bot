import { NextRequest, NextResponse } from 'next/server';
import { analyzeCall } from '@/lib/geminiService';
import { TranscriptMessage } from '@/lib/types';

/**
 * GET /api/calls
 * Stateless endpoint - calls are persisted in client-side IndexedDB.
 */
export async function GET() {
  return NextResponse.json({ 
    calls: [], 
    message: 'Calls are stored locally in browser IndexedDB.' 
  });
}

/**
 * POST /api/calls
 * Performs post-call analysis on transcript text only.
 * No audio data is uploaded, and no files are written to disk.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const transcript: TranscriptMessage[] = body.transcript || [];
    const durationSeconds: number = Number(body.durationSeconds) || 0;

    // Run post-call analysis on transcript text only
    const analysis = await analyzeCall(transcript, durationSeconds);

    return NextResponse.json({ 
      success: true, 
      analysis 
    });
  } catch (error) {
    console.error('Error in call analysis route:', error);
    return NextResponse.json({ error: 'Failed to analyze call transcript' }, { status: 500 });
  }
}
