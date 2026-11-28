type ActivityUpdateListener = (userId?: string) => void;

type GlobalWithActivityPubSub = typeof globalThis & {
  __ccvActivityListeners?: Set<ActivityUpdateListener>;
};

function getListeners(): Set<ActivityUpdateListener> {
  const g = globalThis as GlobalWithActivityPubSub;
  if (!g.__ccvActivityListeners) {
    g.__ccvActivityListeners = new Set<ActivityUpdateListener>();
  }
  return g.__ccvActivityListeners;
}

export function publishActivityUpdate(userId?: string) {
  const listeners = getListeners();
  for (const listener of listeners) {
    try {
      listener(userId);
    } catch {
      // ignore individual subscriber errors
    }
  }
}

export function subscribeActivityUpdates(listener: ActivityUpdateListener): () => void {
  const listeners = getListeners();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
