import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import dotenv from 'dotenv'
import mongoose from 'mongoose'

import { errorHandler } from './middleware/errorHandler'
import { notFound } from './middleware/notFound'
import { authRoutes } from './routes/auth'
import { productRoutes } from './routes/products'
import { reportRoutes } from './routes/reports'
import { aiRoutes } from './routes/ai'


import axios from 'axios';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL;

export async function generateQuestions(inputData: any) {
  try {
    const response = await axios.post(`${AI_SERVICE_URL}/api/ai/generate-questions`, { productData: inputData });
    return response.data;
  } catch (error: any) {
    console.error('Error generating questions:', error.message);
    return { success: false, error: 'AI service error' };
  }
}

export async function calculateTransparencyScore(inputData: any, answers: any) {
  try {
    const response = await axios.post(`${AI_SERVICE_URL}/api/ai/transparency-score`, {
      productData: inputData,
      answers
    });
    return response.data;
  } catch (error: any) {
    console.error('Error calculating transparency score:', error.message);
    return { success: false, error: 'AI service error' };
  }
}

export async function analyzeProduct(inputData: any, answers: any) {
  try {
    const response = await axios.post(`${AI_SERVICE_URL}/api/ai/analyze-product`, {
      product: inputData,
      answers
    });
    return response.data;
  } catch (error: any) {
    console.error('Error analyzing product:', error.message);
    return { success: false, error: 'AI service error' };
  }
}


// Load environment variables (support backend/env.local if present)
import fs from 'fs'
import path from 'path'

const envLocalPath = path.resolve(__dirname, '../env.local')
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath })
  console.log(`Loaded env from ${envLocalPath}`)
} else {
  dotenv.config()
  console.log('Loaded env from default .env (if present)')
}

const app = express()
// Ensure PORT is a number (process.env values are strings)
const PORT = Number(process.env.PORT) || 8080

// Security middleware
app.use(helmet())

// CORS configuration
// CORS configuration - support comma-separated origins in env
const corsEnv = process.env.CORS_ORIGIN || 'http://localhost:3000'
const corsOrigins = corsEnv.split(',').map(s => s.trim())
app.use(cors({
  origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins,
  credentials: true
}))

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
})
app.use(limiter)

// Body parsing middleware
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Compression middleware
app.use(compression())

// Logging middleware
app.use(morgan('combined'))

// Debugging middleware: log incoming requests (router probes often hit here)
app.use((req: any, res: any, next: any) => {
  try {
    const ip = req.headers['x-forwarded-for'] || req.ip || req.connection?.remoteAddress
    console.log('INCOMING PROBE', { method: req.method, url: req.originalUrl || req.url, ip, ua: req.headers['user-agent'] })
  } catch (e) {
    console.log('INCOMING PROBE: failed to read request metadata')
  }
  next()
})

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  })
})

// Root endpoint (some hosting platforms probe `/` for readiness)
app.get('/', (req, res) => {
  res.status(200).json({ message: 'Product Transparency API is running' })
})

// API routes
app.use('/api/auth', authRoutes)
app.use('/api/products', productRoutes)
app.use('/api/reports', reportRoutes)
app.use('/api/ai', aiRoutes)

// Error handling middleware
app.use(notFound)
app.use(errorHandler)

// Database connection
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb+srv://sreejasudhakaran06:Pakindimple@cluster0.kdfx8.mongodb.net/?appName=Cluster0'
    await mongoose.connect(mongoURI)
    console.log('✅ MongoDB connected successfully')
  } catch (error) {
    console.error('❌ MongoDB connection error:', error)
    process.exit(1)
  }
}

// Start server immediately so hosting platforms can probe the HTTP port quickly.
// Connect to MongoDB asynchronously so a slow DB connect doesn't block the process from becoming reachable.
const startServer = () => {
  try {
    // Bind to 0.0.0.0 explicitly so some container hosts can reach the server
    const server = app.listen(PORT, '0.0.0.0', async () => {
      console.log(`🚀 Server running on port ${PORT}`)
      console.log(`📊 Environment: ${process.env.NODE_ENV}`)
      console.log(`🔗 Health check: http://localhost:${PORT}/health`)
      try {
        const addr = server.address()
        console.log('🚪 Server.address():', addr)
        console.log('🔎 Raw PORT env:', process.env.PORT)
      } catch (e) {
        console.log('Could not read server.address()')
      }

      // Self-check: attempt to call the local /health endpoint to verify the server is reachable
      try {
        const localResp = await axios.get(`http://127.0.0.1:${PORT}/health`, { timeout: 2000 })
        console.log('✅ Self-check /health response:', localResp.data)
      } catch (err: any) {
        console.error('❌ Self-check failed (cannot reach local /health):', err.message)
      }
    })

    // Connect to DB without blocking the HTTP server startup
    connectDB().catch(err => {
      console.error('❌ MongoDB connection failed (async):', err)
      // Do not exit the process here; allow platform to probe the HTTP endpoints.
    })
  } catch (error) {
    console.error('❌ Failed to start server:', error)
    process.exit(1)
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: Error) => {
  console.error('❌ Unhandled Promise Rejection:', err.message)
  process.exit(1)
})

// Handle uncaught exceptions
process.on('uncaughtException', (err: Error) => {
  console.error('❌ Uncaught Exception:', err.message)
  process.exit(1)
})

// Graceful shutdown
 process.on('SIGTERM', async () => {
   console.log('🛑 SIGTERM received, shutting down gracefully')
   try {
     await mongoose.connection.close()
     console.log('📦 MongoDB connection closed')
     process.exit(0)
   } catch (err) {
     console.error('Error while closing MongoDB connection during shutdown:', err)
     process.exit(1)
   }
 })

startServer()

export default app
