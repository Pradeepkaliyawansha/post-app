const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const db = require("../config/database");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

// Register
router.post(
  "/register",
  [
    body("username")
      .isLength({ min: 3, max: 50 })
      .matches(/^[a-zA-Z0-9_]+$/),
    body("email").isEmail().normalizeEmail(),
    body("password").isLength({ min: 6 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const { username, email, password } = req.body;

      // Check if user exists
      const checkQuery = "SELECT id FROM users WHERE username = ? OR email = ?";
      db.query(checkQuery, [username, email], async (err, results) => {
        if (err) {
          return res.status(500).json({
            success: false,
            message: "Database error",
          });
        }

        if (results.length > 0) {
          return res.status(400).json({
            success: false,
            message: "Username or email already exists",
          });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert user - FIXED QUERY
        const insertQuery =
          "INSERT INTO users (username, email, password) VALUES (?, ?, ?)";
        db.query(
          insertQuery,
          [username, email, hashedPassword],
          (err, result) => {
            if (err) {
              return res.status(500).json({
                success: false,
                message: "Failed to create user",
              });
            }

            // Generate token
            const token = jwt.sign(
              { userId: result.insertId, username },
              process.env.JWT_SECRET,
              { expiresIn: "7d" }
            );

            res.status(201).json({
              success: true,
              message: "User created successfully",
              token,
              user: {
                id: result.insertId,
                username,
                email,
              },
            });
          }
        );
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  }
);

// Login
router.post(
  "/login",
  [
    body("login").notEmpty(), // Can be username or email
    body("password").notEmpty(),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Please provide login credentials",
      });
    }

    const { login, password } = req.body;

    // Find user by username or email
    const query = "SELECT * FROM users WHERE username = ? OR email = ?";
    db.query(query, [login, login], async (err, results) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: "Database error",
        });
      }

      if (results.length === 0) {
        return res.status(401).json({
          success: false,
          message: "Invalid credentials",
        });
      }

      const user = results[0];

      // Check password
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({
          success: false,
          message: "Invalid credentials",
        });
      }

      // Generate token
      const token = jwt.sign(
        { userId: user.id, username: user.username },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      res.json({
        success: true,
        message: "Login successful",
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
        },
      });
    });
  }
);

// Get current user
router.get("/me", authenticateToken, (req, res) => {
  const query =
    "SELECT id, username, email,  created_at FROM users WHERE id = ?";
  db.query(query, [req.user.userId], (err, results) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: "Database error",
      });
    }

    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      user: results[0],
    });
  });
});

module.exports = router;
