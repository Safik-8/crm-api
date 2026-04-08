// src/utils/tokenUtils.js

import jwt from "jsonwebtoken"
import dotenv from "dotenv"
dotenv.config()
// ── ACCESS TOKEN ──────────────────────────────────────────
export const generateAccessToken = (payload) => {
  if (!process.env.JWT_ACCESS_SECRET) {
    throw new Error("JWT_ACCESS_SECRET missing")
  }
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m"
  })
}

// ── REFRESH TOKEN ─────────────────────────────────────────
export const generateRefreshToken = (payload) => {
  return jwt.sign(
    payload,
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d" }
  )
}

// ── VERIFY ────────────────────────────────────────────────
export const verifyAccessToken = (token) => {
  if (!token) throw new Error("Token missing")
console.log("VERIFY ACCESS SECRET:", process.env.JWT_ACCESS_SECRET)
  try {
    return jwt.verify(token, process.env.JWT_ACCESS_SECRET)
  } catch {
    throw new Error("Invalid or expired access token")
  }
}

export const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET)
}