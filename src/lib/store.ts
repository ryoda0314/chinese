// The learner's record on their device. Storage can be missing or refuse (a private window, cleared site data), so
// every read and write is guarded and the app works without it, starting fresh. When they are signed in with their
// ことのあめ account, src/lib/sync.ts listens to every save and keeps the account's copy in step.
import { emptyState, type State } from "./rain-core.ts";

const KEY = "kotonone:v1";

export function loadState(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as State;
    return parsed?.v === 1 ? { ...emptyState(), ...parsed } : emptyState();
  } catch {
    return emptyState();
  }
}

/** Keeps the record on the device only (for a record that came from the account). */
export function saveLocal(state: State): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Not kept this time; the rain goes on.
  }
}

const listeners = new Set<(state: State) => void>();

/** Called after every save of the learner's own doing. */
export function onSave(listener: (state: State) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Keeps the record on the device, and tells whoever listens (the account's copy). */
export function saveState(state: State): void {
  saveLocal(state);
  listeners.forEach((l) => l(state));
}

export function clearState(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
