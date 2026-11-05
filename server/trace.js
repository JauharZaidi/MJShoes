import { AsyncLocalStorage } from 'async_hooks';
import crypto from 'crypto';

export const traceStorage = new AsyncLocalStorage();

/**
 * Express middleware mapping trace IDs into async continuity context.
 */
export function traceMiddleware(req, res, next) {
  const traceId = req.headers['x-trace-id'] || crypto.randomUUID();
  const context = { traceId, uid: 'anonymous', route: req.path };
  
  traceStorage.run(context, () => {
     res.setHeader('x-trace-id', traceId);

     // Dynamically attach authenticated mapping if verifyAuth passes later
     if (req.uid) {
         context.uid = req.uid;
     }

     next();
  });
}

/**
 * Retrieves the current execution context natively.
 */
export function getTraceContext() {
  return traceStorage.getStore() || null;
}
export function setTraceUserId(uid) {
  const store = traceStorage.getStore();
  if (store) store.uid = uid;
}
