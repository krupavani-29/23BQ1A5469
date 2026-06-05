import { NextRequest, NextResponse } from 'next/server';
import { markAsRead } from '../../../../lib/notificationStore';

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { notificationIDs } = body;

  if (!Array.isArray(notificationIDs)) {
    return NextResponse.json({ success: false, error: 'notificationIDs must be an array' }, { status: 400 });
  }

  const updatedIDs = markAsRead(notificationIDs);
  return NextResponse.json({
    success: true,
    message: `${updatedIDs.length} notification(s) marked as read`,
    updatedIDs,
  });
}
