import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContextStore {
  /** The tab/session that issued this request, from the `X-Client-Id` header. Not a
   *  trust boundary — it only decides whether a tab shows itself a "someone else
   *  changed this" banner for its own edit. */
  clientId: string | null;
}

/**
 * Carries per-request data (currently just the originating client id) from the
 * middleware that reads it off the HTTP request down into services several calls
 * deep, without threading a parameter through every intervening method signature.
 */
@Injectable()
export class RequestContextService {
  private readonly storage = new AsyncLocalStorage<RequestContextStore>();

  run<T>(store: RequestContextStore, callback: () => T): T {
    return this.storage.run(store, callback);
  }

  get(): RequestContextStore | undefined {
    return this.storage.getStore();
  }
}
