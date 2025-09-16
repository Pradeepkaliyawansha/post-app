// Load environment variables FIRST
require("dotenv").config();

// Debug: Check if JWT_SECRET is loaded
console.log("JWT_SECRET loaded:", !!process.env.JWT_SECRET);
if (!process.env.JWT_SECRET) {
  console.error("ERROR: JWT_SECRET not found in environment variables!");
  console.error(
    "Make sure you have a .env file in the server directory with JWT_SECRET defined."
  );
  process.exit(1);
}

const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/auth");
const postRoutes = require("./routes/posts");
const userRoutes = require("./routes/users");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/users", userRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "Post App Backend is running",
    env_loaded: !!process.env.JWT_SECRET,
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: "Something went wrong!",
    error: process.env.NODE_ENV === "development" ? err.message : {},
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});
