import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { stack, level, pkg, message } = await request.json();
    const timestamp = new Date().toISOString();
    console.log(`[LOG] ${timestamp} | ${stack} | ${level} | ${pkg} | ${message}`);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
