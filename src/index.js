// src/index.js

import express from "express" // Trigger nodemon restart
import dotenv from "dotenv"
import cors from "cors"
import helmet from "helmet"
import morgan from "morgan"
import cookieParser from "cookie-parser"
import { rateLimit } from "express-rate-limit"

import prisma from "./config/db.js"

import { errorHandler, notFound } from "./middleware/errorHandler.js"

import authRoutes from "./modules/auth/auth.routes.js"
import companyRoutes from "./modules/company/company.routes.js"
import branchRoutes from "./modules/branch/branch.routes.js"
import leadSourceRoutes from "./modules/leadsources/leadsources.routes.js"
import leadStatusRoutes from "./modules/leadstatuses/leadstatuses.routes.js"
import pipelineRoutes from "./modules/pipeline/pipeline.routes.js"
import stageRoutes from "./modules/stage/stage.routes.js"
import leadRoutes from "./modules/lead/lead.routes.js"
import roleRoutes from "./modules/role/role.routes.js"
import userRoutes from "./modules/user/user.routes.js"
import { initializeSystem } from "./config/initSystem.js"
import dailyBranchReportRoutes from "./modules/daily_branch_reports/dailyBranchReport.routes.js"
import userProfileRoutes from "./modules/userprofile/userprofile.routes.js"

import courseRoutes from "./modules/course/course.routes.js"
import teamRoutes from "./modules/team/team.routes.js"
import followupRoutes from "./modules/followup/followup.routes.js"
import notificationRoutes from "./modules/notification/notification.routes.js"
import opportunityRoutes from "./modules/opportunity/opportunity.routes.js"
import qualificationRoutes from "./modules/qualification/qualification.routes.js"
import qualificationSettingsRoutes from "./modules/qualification/qualification-settings.routes.js"
import customerRoutes from "./modules/customer/customer.routes.js"
import dealRoutes from "./modules/deal/deal.routes.js"
import proposalRoutes from "./modules/proposal/proposal.routes.js"
import salesPerformanceRoutes from "./modules/salesPerformance/salesPerformance.routes.js"
import revenueReportRoutes from "./modules/revenueReport/revenueReport.routes.js"
import reportRoutes from "./modules/report/report.routes.js"
import kpiRoutes from "./modules/kpi/kpi.routes.js"
import { startReminderJob } from "./jobs/reminderJob.js"

// ── LOAD ENV ──────────────────────────────────────────────
dotenv.config({ quiet: true })

const app = express()
const PORT = process.env.PORT || 5000

// ══════════════════════════════════════════════════════════
// MIDDLEWARES
// ══════════════════════════════════════════════════════════
app.use(helmet())

// ── RATE LIMITING ─────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 1000, // Limit each IP to 100 requests per 15 minutes
  standardHeaders: "draft-7",
  legacyHeaders: false,
  statusCode: 429,
  message: {
    success: false,
    statusCode: 429,
    code: "TOO_MANY_REQUESTS",
    message: "Too many requests from this IP, please try again after 15 minutes."
  }
})
app.use(limiter)

app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173",
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}))

app.use(morgan("dev"))
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ limit: "10mb", extended: true }))
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
app.use("/api/branches", branchRoutes);
app.use("/api/lead-sources", leadSourceRoutes);
app.use("/api/lead-statuses", leadStatusRoutes);
app.use("/api/pipelines", pipelineRoutes);
app.use("/api/stages", stageRoutes);
app.use("/api/qualification-settings", qualificationSettingsRoutes);
app.use("/api/leads", qualificationRoutes);
app.use("/api/leads", leadRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/users", userRoutes);
app.use("/api/daily-branch-reports", dailyBranchReportRoutes);
app.use("/api/user-profile", userProfileRoutes);

app.use("/api/courses", courseRoutes);
app.use("/api/teams", teamRoutes);
app.use("/api/followups", followupRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/opportunities", opportunityRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/deals", dealRoutes);
app.use("/api/proposals", proposalRoutes);
app.use("/api/sales-performance", salesPerformanceRoutes);
app.use("/api/reports/revenue", revenueReportRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/kpi", kpiRoutes);
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

    // Server startup file.
    // Step 3 → Start listening
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`)
      console.log(`API URL: http://localhost:${PORT}`)
      console.log(`Client URL: ${process.env.CLIENT_URL}`)
      startReminderJob()
    })

  } catch (error) {
    console.error("Failed to start server:", error)
    process.exit(1)
  }
}

startServer()