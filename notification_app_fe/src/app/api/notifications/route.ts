import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { Log } from 'logging-middleware';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = searchParams.get('limit') || '10';
  const page = searchParams.get('page') || '1';
  
  // Log request start using frontend stack with 'api' package
  await Log('frontend', 'info', 'api', `Fetch notifications request started`);

  const NOTIFICATIONS_API_URL = process.env.NOTIFICATIONS_API_URL || 'http://4.224.186.213/evaluation-service/notifications';
  const AUTH_TOKEN = process.env.LOG_AUTH_TOKEN || '';

  try {
    const res = await axios.get(NOTIFICATIONS_API_URL, {
      headers: {
        'Authorization': AUTH_TOKEN.startsWith('Bearer ') ? AUTH_TOKEN : `Bearer ${AUTH_TOKEN}`
      }
    });

    const allNotifications = res.data.notifications || [];
    
    // Log success
    await Log('frontend', 'info', 'api', `Fetched ${allNotifications.length} items successfully`);

    return NextResponse.json({
      success: true,
      notifications: allNotifications
    });
  } catch (error: any) {
    const errMsg = `Fetch failed: ${error.message}`.slice(0, 48);
    await Log('frontend', 'error', 'api', errMsg);
    return NextResponse.json({ error: error.message }, { status: error.response?.status || 500 });
  }
}
