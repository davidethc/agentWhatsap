import { AsyncLocalStorage } from "node:async_hooks";
export const transactionContext = new AsyncLocalStorage<{ db: unknown; afterCommit: (() => void)[] }>();
export function afterCommit(effect: () => void): void {
  const context = transactionContext.getStore();
  if (context) context.afterCommit.push(effect);
  else effect();
}
