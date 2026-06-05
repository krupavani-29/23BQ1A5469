import { NextRequest, NextResponse } from 'next/server';
import { Log } from 'logging-middleware';

export async function POST(request: NextRequest) {
  try {
    const { stack, level, pkg, message } = await request.json();
    await Log(stack, level, pkg, message);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
