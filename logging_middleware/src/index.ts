import axios from 'axios';
import { Request, Response, NextFunction } from 'express';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const LOG_ENDPOINT = process.env.LOG_API_URL || 'http://4.224.186.213/evaluation-service/logs';

// Allowed stacks
const ALLOWED_STACKS = ['backend', 'frontend'] as const;
export type Stack = typeof ALLOWED_STACKS[number];

// Allowed levels
const ALLOWED_LEVELS = ['debug', 'info', 'warn', 'error', 'fatal'] as const;
export type Level = typeof ALLOWED_LEVELS[number];

// Allowed packages mapping
const BACKEND_PACKAGES = ['cache', 'controller', 'cron_job', 'db', 'domain', 'handler', 'repository', 'route', 'service'] as const;
const FRONTEND_PACKAGES = ['api', 'component', 'hook', 'page', 'state', 'style'] as const;
const BOTH_PACKAGES = ['auth', 'config', 'middleware', 'utils'] as const;

export type BackendPackage = typeof BACKEND_PACKAGES[number];
export type FrontendPackage = typeof FRONTEND_PACKAGES[number];
export type BothPackage = typeof BOTH_PACKAGES[number];
export type Package = BackendPackage | FrontendPackage | BothPackage;

/**
 * Reusable function that makes an API call to the Test Server each time it is called.
 * Verifies lower-case constraints and stack-to-package mappings locally.
 */
export async function Log(
  stack: string,
  level: string,
  pkg: string,
  message: string
): Promise<void> {
  const normStack = stack.toLowerCase();
  const normLevel = level.toLowerCase();
  const normPkg = pkg.toLowerCase();

  // Validate stack
  if (!ALLOWED_STACKS.includes(normStack as Stack)) {
    throw new Error(`Invalid stack: "${stack}". Must be one of: ${ALLOWED_STACKS.join(', ')}`);
  }

  // Validate level
  if (!ALLOWED_LEVELS.includes(normLevel as Level)) {
    throw new Error(`Invalid level: "${level}". Must be one of: ${ALLOWED_LEVELS.join(', ')}`);
  }

  // Validate package based on stack
  if (normStack === 'backend') {
    const isAllowed = BACKEND_PACKAGES.includes(normPkg as BackendPackage) || BOTH_PACKAGES.includes(normPkg as BothPackage);
    if (!isAllowed) {
      throw new Error(`Invalid package "${pkg}" for stack "backend". Must be one of: ${[...BACKEND_PACKAGES, ...BOTH_PACKAGES].join(', ')}`);
    }
  } else if (normStack === 'frontend') {
    const isAllowed = FRONTEND_PACKAGES.includes(normPkg as FrontendPackage) || BOTH_PACKAGES.includes(normPkg as BothPackage);
    if (!isAllowed) {
      throw new Error(`Invalid package "${pkg}" for stack "frontend". Must be one of: ${[...FRONTEND_PACKAGES, ...BOTH_PACKAGES].join(', ')}`);
    }
  }

  const payload = {
    stack: normStack,
    level: normLevel,
    package: normPkg,
    message
  };

  try {
    const token = process.env.LOG_AUTH_TOKEN;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (token) {
      // Format Authorization header with Bearer prefix if missing
      headers['Authorization'] = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    }

    await axios.post(LOG_ENDPOINT, payload, { headers });
  } catch (error: any) {
    // Console log the error but do not throw to prevent breaking application execution
    console.error(`[Logging Middleware Error] Failed to submit log to remote server: ${error.message}`);
    if (error.response) {
      console.error(`[Logging Middleware Error] Response Data:`, JSON.stringify(error.response.data));
    }
  }
}

/**
 * Express middleware helper to log incoming requests and responses automatically
 */
export function requestLoggerMiddleware(stack: Stack = 'backend') {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    const method = req.method;
    const url = req.originalUrl || req.url;

    // Log the request arrival
    Log(stack, 'info', 'middleware', `Request started: ${method} ${url}`).catch(() => {});

    // Hook into response finish event
    res.on('finish', () => {
      const duration = Date.now() - start;
      const status = res.statusCode;
      const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
      
      Log(stack, level, 'middleware', `Request finished: ${method} ${url} | Status: ${status} | Duration: ${duration}ms`).catch(() => {});
    });

    next();
  };
}
