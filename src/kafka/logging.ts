import {LogEntry, logLevel} from 'kafkajs';
import {baseLogger} from '@logger';

const kafkaLogger = baseLogger.child({logger: 'kafkajs'});

export function logCreator(): (entry: LogEntry) => void {
  return ({namespace, level, log, label}: LogEntry) => {
    const bindings = {namespace, label};
    const msg = `[kafka] ${log.message}`;
    switch (level) {
      case logLevel.NOTHING:
        return;
      case logLevel.ERROR:
        kafkaLogger.error(bindings, msg);
        break;
        break;
      case logLevel.WARN:
        kafkaLogger.warn(bindings, msg);
        return 'warn';
      case logLevel.DEBUG:
        kafkaLogger.debug(bindings, msg);
        return 'debug';
      default:
        kafkaLogger.info(bindings, msg);
        break;
    }
  };
}
