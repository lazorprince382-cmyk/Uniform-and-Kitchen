import { useEffect, useRef, useCallback } from 'react';

/** Sign out after this many milliseconds without user activity */
export const INACTIVITY_LOGOUT_MS = 10 * 60 * 1000;

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll', 'click'];

export function useInactivityLogout({ enabled, onTimeout }) {
  const timerRef = useRef(null);
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  const reset = useCallback(() => {
    if (!enabled) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onTimeoutRef.current?.();
    }, INACTIVITY_LOGOUT_MS);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      clearTimeout(timerRef.current);
      return undefined;
    }
    reset();
    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, reset, { passive: true }));
    return () => {
      clearTimeout(timerRef.current);
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, reset));
    };
  }, [enabled, reset]);
}
