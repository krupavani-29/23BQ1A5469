import axios from 'axios';

export async function clientLog(
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal',
  pkg: 'api' | 'component' | 'hook' | 'page' | 'state' | 'style' | 'auth' | 'config' | 'middleware' | 'utils',
  message: string
) {
  try {
    await axios.post('/api/logs', {
      stack: 'frontend',
      level,
      pkg,
      message: message.slice(0, 48) // Ensure messages adhere to the 48-character limit
    });
  } catch (error) {
    console.error('Client logging failed:', error);
  }
}
