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
      .withMessage("Username must be between 3 and 50 characters")
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage(
        "Username can only contain letters, numbers, and underscores"
      ),
    body("email")
      .isEmail()
      .withMessage("Please provide a valid email")
      .normalizeEmail(),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters long"),
  ],
  async (req, res) => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const { username, email, password } = req.body;

      // Log the received data for debugging
      console.log("Registration attempt:", {
        username,
        email,
        passwordLength: password.length,
      });

      // Check if user exists
      const checkQuery = "SELECT id FROM users WHERE username = ? OR email = ?";

      db.query(checkQuery, [username, email], async (err, results) => {
        if (err) {
          console.error("Database error during user check:", err);
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

        try {
          // Hash password
          const hashedPassword = await bcrypt.hash(password, 10);

          // Insert user
          const insertQuery =
            "INSERT INTO users (username, email, password) VALUES (?, ?, ?)";

          db.query(
            insertQuery,
            [username, email, hashedPassword],
            (err, result) => {
              if (err) {
                console.error("Database error during user creation:", err);
                return res.status(500).json({
                  success: false,
                  message: "Failed to create user",
                  error:
                    process.env.NODE_ENV === "development"
                      ? err.message
                      : undefined,
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
        } catch (hashError) {
          console.error("Password hashing error:", hashError);
          return res.status(500).json({
            success: false,
            message: "Server error during registration",
          });
        }
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({
        success: false,
        message: "Server error",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

// Login
router.post(
  "/login",
  [
    body("login").notEmpty().withMessage("Email or username is required"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { login, password } = req.body;

    // Log the login attempt for debugging
    console.log("Login attempt for:", login);

    // Find user by username or email
    const query = "SELECT * FROM users WHERE username = ? OR email = ?";

    db.query(query, [login, login], async (err, results) => {
      if (err) {
        console.error("Database error during login:", err);
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

      try {
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
      } catch (passwordError) {
        console.error("Password comparison error:", passwordError);
        return res.status(500).json({
          success: false,
          message: "Server error during login",
        });
      }
    });
  }
);

// Get current user
router.get("/me", authenticateToken, (req, res) => {
  const query =
    "SELECT id, username, email, full_name, bio, profile_image, created_at FROM users WHERE id = ?";

  db.query(query, [req.user.userId], (err, results) => {
    if (err) {
      console.error("Database error during user fetch:", err);
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
