import { io, Socket } from 'socket.io-client'
import { env } from '@app/config'

class SocketClient {
  private static instance: SocketClient
  private socket: Socket | null = null

  private constructor() {}

  public static getInstance(): SocketClient {
    if (!SocketClient.instance) {
      SocketClient.instance = new SocketClient()
    }
    return SocketClient.instance
  }

  public connect() {
    if (!this.socket) {
      this.socket = io(env.SOCKET_URL, {
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      })

      this.socket.on('connect', () => {
        console.log('Connected to realtime server')
      })

      this.socket.on('disconnect', () => {
        console.log('Disconnected from realtime server')
      })
    }
    return this.socket
  }

  public getSocket(): Socket | null {
    return this.socket
  }

  public disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }
}

export const socketClient = SocketClient.getInstance()