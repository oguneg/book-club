import { useSyncExternalStore } from 'react';
import { AccessibilityInfo, Animated, Platform } from 'react-native';
import type { Spring } from './tokens';

/** Transforms and opacity run on the native thread on phones; the web has no native driver. */
export const nativeDriver = Platform.OS !== 'web';

/** A spring to `toValue` in a style's feel (see Motion in tokens.ts). */
export function spring(value: Animated.Value, toValue: number, config: Spring) {
  return Animated.spring(value, { toValue, ...config, useNativeDriver: nativeDriver });
}

// Whether the device asks for less motion, watched once for the whole app (it can change while it's open).
let reduced = false;
let watching = false;
const listeners = new Set<() => void>();

function changed(value: boolean) {
  reduced = value;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!watching) {
    watching = true;
    AccessibilityInfo.isReduceMotionEnabled().then(changed, () => {});
    AccessibilityInfo.addEventListener('reduceMotionChanged', changed);
  }
  return () => {
    listeners.delete(listener);
  };
}

/** True when the person turned on Reduce Motion: things fade (or simply appear) instead of moving. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, () => reduced, () => reduced);
}
