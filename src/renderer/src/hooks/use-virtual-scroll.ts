import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export type VirtualScrollOptions = {
  itemHeight: number | ((index: number) => number)
  overscan?: number
  containerHeight: number
  totalItems: number
}

export type VirtualScrollResult = {
  visibleStartIndex: number
  visibleEndIndex: number
  offsetY: number
  totalHeight: number
  containerRef: React.RefObject<HTMLDivElement | null>
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void
  visibleItems: Array<{ index: number; offsetTop: number }>
}

export function useVirtualScroll(options: VirtualScrollOptions): VirtualScrollResult {
  const { overscan = 5, containerHeight, totalItems } = options
  const [scrollTop, setScrollTop] = useState(0)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const getItemHeight = useCallback(
    (index: number): number => {
      if (typeof options.itemHeight === 'function') {
        return options.itemHeight(index)
      }
      return options.itemHeight
    },
    [options.itemHeight]
  )

  const itemOffsets = useMemo(() => {
    const offsets: number[] = []
    let offset = 0
    for (let i = 0; i < totalItems; i += 1) {
      offsets.push(offset)
      offset += getItemHeight(i)
    }
    return offsets
  }, [totalItems, getItemHeight])

  const totalHeight = itemOffsets.length > 0 ? itemOffsets[itemOffsets.length - 1] + getItemHeight(itemOffsets.length - 1) : 0

  const visibleStartIndex = useMemo(() => {
    let low = 0
    let high = totalItems - 1
    while (low <= high) {
      const mid = (low + high) >> 1
      const offset = itemOffsets[mid] ?? 0
      const height = getItemHeight(mid)
      if (offset + height < scrollTop) {
        low = mid + 1
      } else {
        high = mid - 1
      }
    }
    return Math.max(0, low - overscan)
  }, [scrollTop, itemOffsets, totalItems, overscan, getItemHeight])

  const visibleEndIndex = useMemo(() => {
    const viewEnd = scrollTop + containerHeight
    let low = 0
    let high = totalItems - 1
    while (low <= high) {
      const mid = (low + high) >> 1
      const offset = itemOffsets[mid] ?? 0
      if (offset < viewEnd) {
        low = mid + 1
      } else {
        high = mid - 1
      }
    }
    return Math.min(totalItems - 1, low + overscan)
  }, [scrollTop, containerHeight, itemOffsets, totalItems, overscan])

  const visibleItems = useMemo(() => {
    const items: Array<{ index: number; offsetTop: number }> = []
    const start = Math.max(0, visibleStartIndex)
    const end = Math.min(totalItems - 1, visibleEndIndex)
    for (let i = start; i <= end; i += 1) {
      items.push({ index: i, offsetTop: itemOffsets[i] ?? 0 })
    }
    return items
  }, [visibleStartIndex, visibleEndIndex, totalItems, itemOffsets])

  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      setScrollTop(el.scrollTop)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return {
    visibleStartIndex,
    visibleEndIndex,
    offsetY: itemOffsets[visibleStartIndex] ?? 0,
    totalHeight,
    containerRef,
    onScroll,
    visibleItems
  }
}