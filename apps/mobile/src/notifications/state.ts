/**
 * Whether this device can show our notifications: not a phone (the web app has only the bell), not asked
 * yet, said no (only the phone's Settings can change that now), or allowed.
 */
export type PushState = 'unsupported' | 'undetermined' | 'denied' | 'granted';
