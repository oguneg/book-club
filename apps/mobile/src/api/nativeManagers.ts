import { focusManager, onlineManager } from '@tanstack/react-query';
import * as Network from 'expo-network';
import { AppState, Platform } from 'react-native';

/**
 * Phones have no window to focus and no browser online events: tell React Query when the app comes to the
 * front (to refresh what's on screen) and when the connection comes and goes (to pause and resume).
 * The web keeps React Query's own browser listeners.
 */
export function setUpNativeQueryManagers() {
  if (Platform.OS === 'web') return;
  focusManager.setEventListener((setFocused) => {
    const subscription = AppState.addEventListener('change', (status) => setFocused(status === 'active'));
    return () => subscription.remove();
  });
  onlineManager.setEventListener((setOnline) => {
    const subscription = Network.addNetworkStateListener((state) => setOnline(state.isConnected !== false && state.isInternetReachable !== false));
    return () => subscription.remove();
  });
}
