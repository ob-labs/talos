/**
 * Contract for serializing optional per-chunk stream callbacks so completion
 * resolves after all notified chunks are processed (ordered consumption).
 */

export interface StreamChunkChain {
  chainStream(
    handler: ((chunk: string) => void | Promise<void>) | undefined,
    chunk: string
  ): void;
  finish<T>(resolve: (value: T) => void, result: T): void;
}
