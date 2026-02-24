import cors from 'cors'
import express from 'express'
import { createServer } from 'http'
import swaggerUi from 'swagger-ui-express'

import { authRouter } from './auth/auth.route'
import { cardsRouter } from './cards/cards.route'
import { decksRouter } from './decks/decks.route'
import { swaggerDocument } from './docs'
import { env } from './env'
import { createSocketServer } from './socket/socket.server'

// Create Express app
export const app = express()

// Middlewares
app.use(
  cors({
    origin: true, // Autorise toutes les origines
    credentials: true,
  }),
)

app.use(express.json())

// Serve static files (Socket.io test client)
app.use(express.static('public'))

// Documentation Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: "API Documentation TCG",
    swaggerOptions: {
        tryItOutEnabled: true,
        persistAuthorization: true,
    }
}))

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'TCG Backend Server is running' })
})

app.use("/api/auth",authRouter);

app.use("/api/cards", cardsRouter);

app.use("/api/decks", decksRouter);

// Start server only if this file is run directly (not imported for tests)
if (require.main === module) {
  // Create HTTP server
  const httpServer = createServer(app)

  // Attach Socket.IO (authenticated via JWT)
  createSocketServer(httpServer)

  // Start server
  try {
    httpServer.listen(env.PORT, () => {
      console.log(`\n🚀 Server is running on http://localhost:${env.PORT}`)
      console.log(
        `🧪 Socket.io Test Client available at http://localhost:${env.PORT}`,
      )
    })
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}
