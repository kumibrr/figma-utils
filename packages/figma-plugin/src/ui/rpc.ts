import type { MethodName, Methods, RpcResponse } from '../shared/messages';

let nextId = 1;
const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();

window.addEventListener('message', (event: MessageEvent) => {
  const message = event.data?.pluginMessage as RpcResponse | undefined;
  if (!message || message.rpc !== 'response') {
    return;
  }
  const request = pending.get(message.id);
  if (!request) {
    return;
  }
  pending.delete(message.id);
  if (message.error !== undefined) {
    request.reject(new Error(message.error));
  } else {
    request.resolve(message.result);
  }
});

export function call<K extends MethodName>(
  method: K,
  ...params: Parameters<Methods[K]>
): Promise<Awaited<ReturnType<Methods[K]>>> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
    parent.postMessage({ pluginMessage: { rpc: 'request', id, method, params } }, '*');
  });
}
