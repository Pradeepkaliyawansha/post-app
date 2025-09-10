const express = require("express");
const { body, validationResult } = require("express-validator");
const db = require("../config/database");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

// Get user profile
router.get("/:username", (req, res) => {
  const username = req.params.username;

  const query = `
    SELECT 
      u.id, u.username, u.full_name, u.bio, u.profile_image, u.created_at,
      COUNT(DISTINCT p.id) as posts_count,
      COUNT(DISTINCT f1.id) as followers_count,
      COUNT(DISTINCT f2.id) as following_count
    FROM users u
    LEFT JOIN posts p ON u.id = p.user_id AND p.is_private = FALSE
    LEFT JOIN follows f1 ON u.id = f1.following_id
    LEFT JOIN follows f2 ON u.id = f2.follower_id
    WHERE u.username = ?
    GROUP BY u.id
  `;

  db.query(query, [username], (err, results) => {
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

// Update user profile
router.put(
  "/profile",
  authenticateToken,
  [
    body("full_name").optional().isLength({ max: 100 }).trim(),
    body("bio").optional().isLength({ max: 500 }).trim(),
    body("profile_image").optional().isURL(),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const userId = req.user.userId;
    const { full_name, bio, profile_image } = req.body;

    const updateFields = [];
    const params = [];

    if (full_name !== undefined) {
      updateFields.push("full_name = ?");
      params.push(full_name);
    }
    if (bio !== undefined) {
      updateFields.push("bio = ?");
      params.push(bio);
    }
    if (profile_image !== undefined) {
      updateFields.push("profile_image = ?");
      params.push(profile_image);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No fields to update",
      });
    }

    params.push(userId);

    const query = `UPDATE users SET ${updateFields.join(
      ", "
    )}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;

    db.query(query, params, (err, result) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: "Failed to update profile",
        });
      }

      res.json({
        success: true,
        message: "Profile updated successfully",
      });
    });
  }
);

module.exports = router;
