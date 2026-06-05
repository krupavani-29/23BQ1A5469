import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

// Define configuration constants
const REGISTER_URL = 'http://4.224.186.213/evaluation-service/register';
const AUTH_URL = 'http://4.224.186.213/evaluation-service/auth';

const envFilePath = path.join(__dirname, '.env');

// Candidate information - derived from environment or prompt
const candidateConfig = {
  email: process.env.CANDIDATE_EMAIL || 'kavurikrupavani@gmail.com',
  name: process.env.CANDIDATE_NAME || 'Kavuri Krupavani',
  mobileNo: process.env.CANDIDATE_MOBILE || '9999999999', // Placeholder - please replace with your actual number
  githubUsername: process.env.CANDIDATE_GITHUB || 'krupavani-29',
  rollNo: process.env.CANDIDATE_ROLL_NO || '23BQ1A5469',
  accessCode: process.env.CANDIDATE_ACCESS_CODE || 'QQdEYy' // Placeholder - please replace with your email accessCode
};

async function main() {
  console.log('=== Assessment API Registration & Auth Helper ===\n');

  console.log('Candidate Data for Registration:');
  console.log(JSON.stringify(candidateConfig, null, 2));
  console.log('\nStarting registration request...');

  let clientID = process.env.CANDIDATE_CLIENT_ID || '';
  let clientSecret = process.env.CANDIDATE_CLIENT_SECRET || '';

  if (!clientID || !clientSecret) {
    try {
      const regRes = await axios.post(REGISTER_URL, candidateConfig, {
        headers: { 'Content-Type': 'application/json' }
      });

      console.log('Registration SUCCESSFUL!');
      clientID = regRes.data.clientID;
      clientSecret = regRes.data.clientSecret;
      console.log(`Received clientID: ${clientID}`);
      console.log(`Received clientSecret: ${clientSecret}`);
    } catch (error: any) {
      console.error('Registration FAILED!');
      if (error.response) {
        console.error('Server response:', JSON.stringify(error.response.data, null, 2));
      } else {
        console.error(error.message);
      }
      console.log('\nHint: If you are already registered, set CANDIDATE_CLIENT_ID and CANDIDATE_CLIENT_SECRET in your environment or this script.');
      return;
    }
  } else {
    console.log('Using pre-configured clientID and clientSecret.');
  }

  console.log('\nRequesting Authorization Token...');
  const authPayload = {
    email: candidateConfig.email,
    name: candidateConfig.name,
    rollNo: candidateConfig.rollNo,
    accessCode: candidateConfig.accessCode,
    clientID,
    clientSecret
  };

  try {
    const authRes = await axios.post(AUTH_URL, authPayload, {
      headers: { 'Content-Type': 'application/json' }
    });

    console.log('Authentication SUCCESSFUL!');
    const token = authRes.data.access_token;
    console.log('Generated token successfully.');

    // Save configuration to .env file
    const envContent = [
      `# Remote Logging API Configuration`,
      `LOG_API_URL=http://4.224.186.213/evaluation-service/logs`,
      `LOG_AUTH_TOKEN=Bearer ${token}`,
      `# Candidate registration details`,
      `CANDIDATE_CLIENT_ID=${clientID}`,
      `CANDIDATE_CLIENT_SECRET=${clientSecret}`
    ].join('\n');

    fs.writeFileSync(envFilePath, envContent, 'utf8');
    console.log(`\nSuccessfully wrote config and token to: ${envFilePath}`);
    console.log('The Logging Middleware will now automatically read this token for all API requests.');
  } catch (error: any) {
    console.error('Authentication FAILED!');
    if (error.response) {
      console.error('Server response:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
  }
}

main();
