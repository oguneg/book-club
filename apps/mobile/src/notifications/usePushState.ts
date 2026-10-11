import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { enablePush, pushState, type PushState } from './push';

/**
 * Whether this phone shows our notifications, checked again whenever the app comes back to the front (the
 * person may have just changed it in Settings); and a way to ask. Null until known.
 */
export function usePushState() {
  const [state, setState] = useState<PushState | null>(null);
  useEffect(() => {
    let live = true;
    const check = () => void pushState().then((s) => live && setState(s), () => live && setState('unsupported'));
    check();
    const subscription = AppState.addEventListener('change', (s) => s === 'active' && check());
    return () => {
      live = false;
      subscription.remove();
    };
  }, []);
  return { state, enable: async () => setState(await enablePush()) };
}
