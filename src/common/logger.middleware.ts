import { Injectable, NestMiddleware, Logger } from '@nestjs/common';

// Only the fields we actually use from req/res — avoids needing @types/express
interface Req {
  method: string;
  originalUrl: string;
}

interface Res {
  statusCode: number;
  on(event: string, cb: () => void): void;
}

// Logs every HTTP request: method, path, status code, and how long it took.
// Example output: [HTTP] POST /send-message 200 - 43ms
@Injectable()
export class HttpLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Req, res: Res, next: () => void): void {
    const { method, originalUrl } = req;
    const start = Date.now();

    // Log after the response finishes so we can include the status code
    res.on('finish', () => {
      const ms = Date.now() - start;
      this.logger.log(`${method} ${originalUrl} ${res.statusCode} - ${ms}ms`);
    });

    next();
  }
}
