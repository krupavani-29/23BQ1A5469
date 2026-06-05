import { NextRequest, NextResponse } from 'next/server';
import { getNotifications } from '../../../lib/notificationStore';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '10', 10);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const notification_type = (searchParams.get('notification_type') || 'all') as 'Placement' | 'Result' | 'Event' | 'all';
  const is_read_raw = searchParams.get('is_read');
  const is_read = is_read_raw === 'true' ? true : is_read_raw === 'false' ? false : 'all';

  const data = getNotifications({
    limit,
    page,
    notification_type,
    is_read,
  });

  return NextResponse.json({
    success: true,
    data,
  });
}
