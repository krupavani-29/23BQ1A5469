import { NextResponse } from 'next/server';
import { getUnreadCount } from '../../../../lib/notificationStore';

export async function GET() {
  return NextResponse.json({
    success: true,
    unreadCount: getUnreadCount(),
  });
}
