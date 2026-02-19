export interface PtyBatchAccumulator {
  chunks: string[]
  bytes: number
}

export function appendPtyChunk(entry: PtyBatchAccumulator, data: string): number {
  entry.chunks.push(data)
  entry.bytes += Buffer.byteLength(data, 'utf8')
  return entry.bytes
}
