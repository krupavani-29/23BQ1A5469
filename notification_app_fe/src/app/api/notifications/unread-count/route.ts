import { NextResponse } from 'next/server';
import axios from 'axios';

const BACKEND_URL = 'http://localhost:3001/evaluation-service/notifications/unread-count';
const AUTH_TOKEN = 'Bearer student_token_23bq1a5469';

export async function GET() {
  try {
    const response = await axios.get(BACKEND_URL, {
      headers: { Authorization: AUTH_TOKEN }
    });
    return NextResponse.json(response.data);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
