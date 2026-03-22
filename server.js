import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load env FIRST
dotenv.config();

// Fix for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Debug (you can remove later)
console.log("ENV CHECK:", process.env.MONGODB_URI);

// ------------------------------------

import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import morgan from "morgan";

// DB
import connectDB from "./config/db.js";

// Middleware
import { errorHandler, notFound } from "./middleware/errorMiddleware.js";

// Routes
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import requestRoutes from "./routes/requestRoutes.js";
import documentRoutes from "./routes/documentRoutes.js";

// ------------------------------------

// Connect DB
connectDB();

const app = express();

// Security Middleware
app.use(helmet());

// CORS config
app.use(
  cors({
    origin: [
      process.env.FRONTEND_URL,
      "http://localhost:5173",
      "http://127.0.0.1:5173"
    ].filter(Boolean),
    credentials: true,
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10000, // Increased for local development to prevent blocking
  message: {
    success: false,
    message: "Too many requests, try again later",
  },
});
// app.use("/api", limiter);

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/documents", documentRoutes);

// Root route
app.get("/", (req, res) => {
  res.send("DocVerify API is running 🚀");
});

// Error Handling
app.use(notFound);
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(
    `Server running in ${process.env.NODE_ENV || "development"} mode on port ${PORT} at ${new Date().toISOString()}`
  );
});