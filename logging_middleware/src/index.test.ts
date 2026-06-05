import axios from 'axios';
import { Log, requestLoggerMiddleware } from './index';
import { Request, Response, NextFunction } from 'express';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Logging Middleware Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.LOG_AUTH_TOKEN = 'test-token-123';
  });

  describe('Constraint Validation', () => {
    test('should succeed for valid backend parameters', async () => {
      mockedAxios.post.mockResolvedValueOnce({ status: 200, data: { logID: '123', message: 'success' } });

      await Log('backend', 'info', 'db', 'Successful connection');

      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://4.224.186.213/evaluation-service/logs',
        {
          stack: 'backend',
          level: 'info',
          package: 'db',
          message: 'Successful connection'
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token-123'
          }
        }
      );
    });

    test('should succeed for valid frontend parameters', async () => {
      mockedAxios.post.mockResolvedValueOnce({ status: 200, data: { logID: '456', message: 'success' } });

      await Log('frontend', 'warn', 'component', 'Render latency detected');

      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://4.224.186.213/evaluation-service/logs',
        {
          stack: 'frontend',
          level: 'warn',
          package: 'component',
          message: 'Render latency detected'
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token-123'
          }
        }
      );
    });

    test('should throw error for invalid stack', async () => {
      await expect(Log('invalid-stack', 'info', 'db', 'msg')).rejects.toThrow('Invalid stack');
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    test('should throw error for invalid level', async () => {
      await expect(Log('backend', 'invalid-level', 'db', 'msg')).rejects.toThrow('Invalid level');
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    test('should throw error for invalid package on backend stack', async () => {
      await expect(Log('backend', 'info', 'component', 'msg')).rejects.toThrow('Invalid package "component" for stack "backend"');
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    test('should throw error for invalid package on frontend stack', async () => {
      await expect(Log('frontend', 'info', 'cron_job', 'msg')).rejects.toThrow('Invalid package "cron_job" for stack "frontend"');
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });
  });

  describe('Express Middleware', () => {
    test('should intercept request and response finish events', () => {
      mockedAxios.post.mockResolvedValue({ status: 200, data: {} });

      const req = {
        method: 'GET',
        originalUrl: '/api/test'
      } as Partial<Request> as Request;

      const finishCallbacks: (() => void)[] = [];
      const res = {
        statusCode: 200,
        on: (event: string, callback: () => void) => {
          if (event === 'finish') {
            finishCallbacks.push(callback);
          }
        }
      } as Partial<Response> as Response;

      const next = jest.fn() as NextFunction;

      const middleware = requestLoggerMiddleware('backend');
      middleware(req, res, next);

      // Verify log was triggered for incoming request
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledTimes(1);

      // Trigger response finish
      finishCallbacks.forEach(cb => cb());

      // Verify log was triggered for response finish
      expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    });
  });
});
