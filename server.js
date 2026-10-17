// server.js
console.log('Starting ShopX server...')
const { createServer } = require('http')
const { Server } = require('socket.io')
const next = require('next')

const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const httpServer = createServer((req, res) => handle(req, res))

  const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
  })

  // Make io accessible to API routes
  global.io = io

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id)

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id)
    })
  })

  const port = process.env.PORT || 9002
  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`)
  })
}).catch((err) => {
  console.error('Error starting server:', err)
  process.exit(1)
})