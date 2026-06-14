import { useCallback, useEffect, useRef } from 'react'

export function useDebounce<T extends (...args: unknown[]) => void>(
  callback: T,
  delayMs: number
): T {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return useCallback(
    ((...args: unknown[]) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => callbackRef.current(...args), delayMs)
    }) as T,
    [delayMs]
  )
}

export function useThrottle<T extends (...args: unknown[]) => void>(
  callback: T,
  intervalMs: number
): T {
  const lastCallRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return useCallback(
    ((...args: unknown[]) => {
      const now = Date.now()
      const elapsed = now - lastCallRef.current

      if (elapsed >= intervalMs) {
        lastCallRef.current = now
        callbackRef.current(...args)
      } else if (!timerRef.current) {
        timerRef.current = setTimeout(() => {
          lastCallRef.current = Date.now()
          timerRef.current = null
          callbackRef.current(...args)
        }, intervalMs - elapsed)
      }
    }) as T,
    [intervalMs]
  )
}