import React from 'react';
import { render } from 'ink';
import type { Instance } from 'ink';

export interface InkRenderer {
  rerender: (tree: React.ReactElement) => void;
  unmount: () => void;
  waitUntilExit: () => Promise<unknown>;
}

/**
 * Render an ink component to the terminal
 * @param component - React component to render
 * @returns InkRenderer instance with rerender, unmount, and waitUntilExit methods
 */
export function renderInk(component: React.ReactElement): InkRenderer {
  const instance: Instance = render(component);

  return {
    rerender: (tree: React.ReactElement) => instance.rerender(tree),
    unmount: () => instance.unmount(),
    waitUntilExit: () => instance.waitUntilExit(),
  };
}
