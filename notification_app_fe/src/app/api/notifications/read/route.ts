import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const BACKEND_URL = 'http://localhost:3001/evaluation-service/notifications/read';
const AUTH_TOKEN = 'Bearer student_token_23bq1a5469';

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const response = await axios.patch(BACKEND_URL, body, {
      headers: { Authorization: AUTH_TOKEN }
    });
    return NextResponse.json(response.data);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
