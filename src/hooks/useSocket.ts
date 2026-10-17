// hooks/useSocket.ts
import { useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export function useSocket(
  eventName: string | ((data: any) => void),
  onEvent?: (data: any) => void
) {
  const actualEventName = typeof eventName === 'string' ? eventName : 'inventory_update'
  const callback = typeof eventName === 'function' ? eventName : onEvent

  const handlerRef = useRef(callback)
  handlerRef.current = callback

  useEffect(() => {
    if (!socket) {
      socket = io() // connects to same host automatically
    }

    const handler = (data: any) => handlerRef.current?.(data)
    socket.on(actualEventName, handler)

    return () => {
      socket?.off(actualEventName, handler)
    }
  }, [actualEventName])
}