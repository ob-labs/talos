/**
 * Serializes optional per-chunk stream callbacks so completion resolves after
 * all notified chunks are processed (ordered logs, no tool-specific names).
 */

import type { StreamChunkChain } from '@talos/types';

export function createStreamChunkChain(): StreamChunkChain {
  let streamNotifyChain: Promise<void> = Promise.resolve();

  return {
    chainStream(handler, chunk) {
      if (!handler) return;
      streamNotifyChain = streamNotifyChain.then(() =>
        Promise.resolve(handler(chunk)).then(() => undefined)
      );
    },
    finish(resolve, result) {
      streamNotifyChain
        .then(() => {
          resolve(result);
        })
        .catch(() => {
          resolve(result);
        });
    },
  };
}
