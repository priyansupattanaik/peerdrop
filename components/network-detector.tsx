"use client"

import { useState, useEffect } from "react"
import { Wifi, WifiOff, Activity } from "lucide-react"
import { Progress } from "@/components/ui/progress"

export default function NetworkDetector() {
  const [isOnline, setIsOnline] = useState(true)
  const [latency, setLatency] = useState<number | null>(null)
  const [networkInfo, setNetworkInfo] = useState<{
    type: string | null
    downlink: number | null
    rtt: number | null
  }>({
    type: null,
    downlink: null,
    rtt: null,
  })

  useEffect(() => {
    // Check online status
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    // Measure network latency
    const checkLatency = () => {
      const start = Date.now()

      fetch("/favicon.ico", {
        method: "HEAD",
        cache: "no-store",
      })
        .then(() => {
          const latencyValue = Date.now() - start
          setLatency(latencyValue)
        })
        .catch(() => {
          setLatency(null)
        })
    }

    // Get connection info if available
    const updateConnectionInfo = () => {
      if ("connection" in navigator) {
        const connection = (navigator as any).connection

        setNetworkInfo({
          type: connection.type || connection.effectiveType || null,
          downlink: connection.downlink || null,
          rtt: connection.rtt || null,
        })
      }
    }

    // Initial checks
    checkLatency()
    updateConnectionInfo()

    // Set up intervals for periodic checks
    const latencyInterval = setInterval(checkLatency, 10000)
    const connectionInterval = setInterval(updateConnectionInfo, 5000)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
      clearInterval(latencyInterval)
      clearInterval(connectionInterval)
    }
  }, [])

  const getLatencyColor = () => {
    if (!latency) return "bg-gray-600"
    if (latency < 100) return "bg-green-500"
    if (latency < 300) return "bg-yellow-500"
    return "bg-red-500"
  }

  const getLatencyText = () => {
    if (!latency) return "Unknown"
    if (latency < 100) return "Excellent"
    if (latency < 300) return "Good"
    if (latency < 600) return "Fair"
    return "Poor"
  }

  return (
    <div className="p-3 bg-gray-800/50 rounded-lg">
      <h3 className="text-sm font-medium mb-3">Network Status</h3>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            {isOnline ? (
              <Wifi className="h-4 w-4 text-green-500 mr-2" />
            ) : (
              <WifiOff className="h-4 w-4 text-red-500 mr-2" />
            )}
            <span className="text-sm">{isOnline ? "Online" : "Offline"}</span>
          </div>
          <span className="text-xs text-gray-400">{networkInfo.type ? networkInfo.type.toUpperCase() : "Unknown"}</span>
        </div>

        {isOnline && (
          <>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center">
                  <Activity className="h-3 w-3 mr-1" />
                  Latency
                </span>
                <span>{latency ? `${latency}ms (${getLatencyText()})` : "Measuring..."}</span>
              </div>
              <Progress value={latency ? Math.min(100, latency / 10) : 0} className={`h-1 ${getLatencyColor()}`} />
            </div>

            {networkInfo.downlink && (
              <div className="flex justify-between text-xs">
                <span>Connection Speed</span>
                <span>{networkInfo.downlink} Mbps</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

