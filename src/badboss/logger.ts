import pino from 'pino';

console.log('LOG_LEVEL', process.env.LOG_LEVEL);
const logger = pino({
  level: 'debug',
  // level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  },
}, process.stdout);

export default logger; 