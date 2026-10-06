/**
 * Everything a shared room needs from Automerge, in one module so it can
 * be imported lazily: `room.ts` loads it only when a room starts or is
 * joined, and Vite splits it (and Automerge's inline wasm) into its own
 * chunk. A player who never shares never downloads it.
 */
export { Repo, Presence, isValidAutomergeUrl } from '@automerge/automerge-repo'
export type { DocHandle, PeerId, AutomergeUrl } from '@automerge/automerge-repo'
export { WebSocketClientAdapter } from '@automerge/automerge-repo-network-websocket'
export { BroadcastChannelNetworkAdapter } from '@automerge/automerge-repo-network-broadcastchannel'
export { automergeSyncPlugin } from '@automerge/automerge-codemirror'
// Not re-exported by the package's index: marks the plugin's own
// transactions (`collab/editor`).
export { reconcileAnnotationType } from '@automerge/automerge-codemirror/dist/plugin.js'
