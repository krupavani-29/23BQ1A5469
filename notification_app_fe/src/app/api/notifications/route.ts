import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const BACKEND_URL = 'http://localhost:3001/evaluation-service/notifications';
const AUTH_TOKEN = 'Bearer student_token_23bq1a5469';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '10';
    const page = searchParams.get('page') || '1';
    const notification_type = searchParams.get('notification_type');
    const is_read = searchParams.get('is_read');

    const params: Record<string, string> = { limit, page };
    if (notification_type && notification_type !== 'all') {
      params.notification_type = notification_type;
    }
    if (is_read && is_read !== 'all') {
      params.is_read = is_read;
    }

    const response = await axios.get(BACKEND_URL, {
      params,
      headers: { Authorization: AUTH_TOKEN }
    });

    return NextResponse.json(response.data);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
