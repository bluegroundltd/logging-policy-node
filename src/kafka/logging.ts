import {baseLogger} from '@logger';
import {LogEntry, logLevel} from 'kafkajs';

const kafkaLogger = baseLogger.child({logger: 'kafkajs'});

function mapLevel(level: logLevel) {
  switch (level) {
    case logLevel.ERROR:
      return 'error';
      break;
    case logLevel.NOTHING:
      return 'silent';
      break;
    case logLevel.INFO:
      return 'info';
      break;
    case logLevel.DEBUG:
      return 'debug';
      break;
    case logLevel.WARN:
      return 'warn';
      break;
  }
}

export function logCreator() {
  return (logEntry: LogEntry) => {
    const {namespace, level, label, log} = logEntry;
    kafkaLogger[mapLevel(level)]({namespace, label}, `[kafka] ${log.message}`);
  };
}
