// src/index.js

import express from "express"
import dotenv from "dotenv"
import cors from "cors"
import helmet from "helmet"
import morgan from "morgan"
import cookieParser from "cookie-parser"

import prisma from "./config/db.js"

import { errorHandler, notFound } from "./middleware/errorHandler.js"

import authRoutes from "./modules/auth/auth.routes.js"
import companyRoutes from "./modules/company/comany.routes.js"
import branchRoutes  from "./modules/branch/branch.routes.js"
import { initializeSystem } from "./config/initSystem.js"

// ── LOAD ENV ──────────────────────────────────────────────
dotenv.config({ quiet: true })

const app = express()
const PORT = process.env.PORT || 5000

// ══════════════════════════════════════════════════════════
// MIDDLEWARES
// ══════════════════════════════════════════════════════════
app.use(helmet())

app.use(cors({
  origin: "*" || process.env.CLIENT_URL || "http://localhost:5173",
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}))

app.use(morgan("dev"))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())

// ══════════════════════════════════════════════════════════
// HEALTH CHECK
// ══════════════════════════════════════════════════════════
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "StackDot CRM API is running",
    version: "1.0.0",
    timestamp: new Date().toISOString()
  })
})

// ══════════════════════════════════════════════════════════
// ROUTES
// ══════════════════════════════════════════════════════════

app.use("/api", authRoutes);
app.use("/api/companies", companyRoutes);
app.use("/api/branches",  branchRoutes);

// ══════════════════════════════════════════════════════════
// 404 + GLOBAL ERROR HANDLER
// ══════════════════════════════════════════════════════════
app.use(notFound)
app.use(errorHandler)

// ══════════════════════════════════════════════════════════
// START SERVER
// ══════════════════════════════════════════════════════════
const startServer = async () => {
  try {

    // Step 1 → Connect database
    await prisma.$connect()
    console.log("Database connected")

    // Step 2 → Initialize roles and permissions
    await initializeSystem()

    // Step 3 → Start listening
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`)
      console.log(`API URL: http://localhost:${PORT}`)
      console.log(`Client URL: ${process.env.CLIENT_URL}`)
    })

  } catch (error) {
    console.error("Failed to start server:", error)
    process.exit(1)
  }
}

startServer()