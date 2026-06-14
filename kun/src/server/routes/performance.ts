import { jsonResponse } from '../response.js'
import { getPerformanceMonitor } from '../../telemetry/performance-monitor.js'

export function performanceMetricsJsonResponse(): ReturnType<typeof jsonResponse> {
  const monitor = getPerformanceMonitor()
  return jsonResponse(monitor.metrics)
}