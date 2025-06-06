const logLevel = process.env.LOG_LEVEL || 'info';

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
} as const;

type LogLevel = keyof typeof LOG_LEVELS;

const currentLevel = LOG_LEVELS[logLevel as LogLevel] ?? LOG_LEVELS.info;

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] <= currentLevel;
}

function formatLog(level: string, name: string, message: string, ...args: any[]): void {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] ${level.toUpperCase()} [${name}]:`;
  console.log(prefix, message, ...args);
}

class Logger {
  constructor(private name: string) {}

  error(message: string, ...args: any[]): void {
    if (shouldLog('error')) {
      formatLog('error', this.name, message, ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (shouldLog('warn')) {
      formatLog('warn', this.name, message, ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (shouldLog('info')) {
      formatLog('info', this.name, message, ...args);
    }
  }

  debug(message: string, ...args: any[]): void {
    if (shouldLog('debug')) {
      formatLog('debug', this.name, message, ...args);
    }
  }
}

export function createLogger(name: string): Logger {
  return new Logger(name);
}

export const logger = createLogger('default'); 