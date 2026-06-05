import axios from 'axios';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { Log } from './index';

// Load environmental config from the local .env
dotenv.config({ path: path.join(__dirname, '../.env') });

const NOTIFICATIONS_API_LOCAL = 'http://localhost:3001/evaluation-service/notifications';
const NOTIFICATIONS_API_REMOTE = 'http://4.224.186.213/evaluation-service/notifications';
const AUTH_TOKEN = process.env.LOG_AUTH_TOKEN || '';

interface RawNotification {
  ID: string;
  Type: 'Placement' | 'Result' | 'Event' | string;
  Message: string;
  Timestamp: string;
}

interface RankedNotification extends RawNotification {
  priorityScore: number;
}

// Weights mapping
const WEIGHTS: Record<string, number> = {
  Placement: 3,
  Result: 2,
  Event: 1
};

/**
 * Calculates priority score using category weight and timestamp recency.
 * Score = (Category Weight * Seconds In A Day) + EpochSeconds
 * This ensures that higher-weighted categories rank higher unless a lower-weighted
 * category is significantly more recent.
 */
function calculatePriorityScore(type: string, timestampStr: string): number {
  const weight = WEIGHTS[type] || 0;
  
  // Parse timestamp format "2026-04-22 17:51:30"
  // Replace space with T to make it ISO-compliant for Date parser
  const isoStr = timestampStr.replace(' ', 'T');
  const epochSeconds = Math.floor(new Date(isoStr).getTime() / 1000);
  
  // Weight factor: 86400 seconds (1 day) per weight point
  const weightScore = weight * 86400;
  
  return weightScore + epochSeconds;
}

async function getPriorityInbox() {
  // MANDATORY logging integration: first function call in execution path
  try {
    await Log('backend', 'info', 'service', 'Fetch priority inbox started');
  } catch (err: any) {
    console.error('Failed to log transaction startup:', err.message);
  }

  try {
    let response;
    const headers = AUTH_TOKEN ? {
      'Authorization': AUTH_TOKEN.startsWith('Bearer ') ? AUTH_TOKEN : `Bearer ${AUTH_TOKEN}`
    } : undefined;

    try {
      response = await axios.get(NOTIFICATIONS_API_LOCAL, { headers });
    } catch (localErr: any) {
      console.warn(`Local API offline (${localErr.message}). Attempting remote fallback...`);
      response = await axios.get(NOTIFICATIONS_API_REMOTE, { headers });
    }

    const rawNotifications: RawNotification[] = 
      (response.data as any).notifications || 
      (response.data as any).data?.notifications || 
      [];
    
    // Process and calculate scores
    const rankedNotifications: RankedNotification[] = rawNotifications.map(n => ({
      ...n,
      priorityScore: calculatePriorityScore(n.Type, n.Timestamp)
    }));

    // Sort descending by priorityScore
    rankedNotifications.sort((a, b) => b.priorityScore - a.priorityScore);

    // Retrieve top 10 notifications
    const top10 = rankedNotifications.slice(0, 10);

    // Log complete process success
    await Log('backend', 'info', 'service', `Sorted & sliced top 10 of ${rawNotifications.length} items`);

    console.log('\n================== PRIORITY INBOX (TOP 10) ==================\n');
    top10.forEach((n, idx) => {
      console.log(`[${idx + 1}] Score: ${n.priorityScore} | Type: ${n.Type} | Time: ${n.Timestamp}`);
      console.log(`    Msg: ${n.Message}`);
      console.log(`    ID : ${n.ID}\n`);
    });
    console.log('=============================================================\n');

  } catch (error: any) {
    const errSummary = `Failed: ${error.message}`.slice(0, 48);
    await Log('backend', 'error', 'handler', errSummary);
    console.error('Error fetching/processing notifications:', error.message);
    if (error.response) {
      console.error('API Response status:', error.response.status);
      console.error('API Response details:', error.response.data);
    }
  }
}

getPriorityInbox();
