// Small, checked edits to three's built-in shaders (from a material's onBeforeCompile). An anchor that is not there throws: a
// replace that silently misses leaves the patch out and the material quietly wrong.

import { ShaderChunk } from 'three';

/** Replace each anchor (its first occurrence) in a shader's source */
export function patch(source: string, edits: [anchor: string, replacement: string][]): string {
  for (const [anchor, replacement] of edits) {
    if (!source.includes(anchor)) throw new Error(`Shader patch: no "${anchor.slice(0, 60)}"`);
    source = source.replace(anchor, replacement);
  }
  return source;
}

/** Put a shader chunk's code in place of its #include, so lines inside the chunk can be patched (onBeforeCompile sees includes) */
export function expand(source: string, chunk: keyof typeof ShaderChunk): string {
  return patch(source, [[`#include <${chunk}>`, ShaderChunk[chunk]]]);
}
