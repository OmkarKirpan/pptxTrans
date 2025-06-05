import pino from 'pino';

const logLevel = process.env.LOG_LEVEL || 'info';

const transport = pino.transport({
  target: 'pino-pretty',
  options: {
    colorize: true,
    translateTime: 'SYS:standard',
    ignore: 'pid,hostname',
  },
});

const baseLogger = pino({
  level: logLevel,
  transport,
});

export function createLogger(name: string) {
  return baseLogger.child({ name });
}

export const logger = createLogger('default'); 