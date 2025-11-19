
import { AsyncContextStorage } from '@exprealty/cache'
import { NestWinstonLogger } from './nest-logger.js';

export class CorrelationIdLogger implements NestWinstonLogger {
    private context?: string

    setContext(context: string) {
        this.context = context
    }

    private formatMessage(message: any): string {
        const correlationId = AsyncContextStorage.getCorrelationId() || 'N/A';
        const ctx = this.context ? `[${this.context}]` : '';
        return `[${correlationId}]${ctx} ${message}`;
    }

    log(message: any, context?:string){
        console.log(this.formatMessage(message))
    }

    error(message: any, trace?: string, context?: string) {
        console.error(this.formatMessage(message), trace);
    }

    warn(message: any, context?: string) {
        console.warn(this.formatMessage(message));
    }

    debug(message: any, context?: string) {
        console.debug(this.formatMessage(message));
    }

    verbose(message: any, context?: string) {
        console.log(this.formatMessage(message));
    }
}