import { NextRequest, NextResponse } from 'next/server';
import { getSalesReply } from '@/lib/geminiService';
import { TranscriptMessage } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const transcript: TranscriptMessage[] = body.transcript || [];

    const reply = await getSalesReply(transcript);
    return NextResponse.json(reply);
  } catch (error) {
    console.error('Error in chat API route:', error);
    return NextResponse.json({
      reply: "I apologize, could you please repeat that? I want to make sure I get your requirements right.",
      source: 'local_fallback'
    }, { status: 200 });
  }
}
