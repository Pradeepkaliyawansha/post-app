const express = require("express");
const { body, validationResult } = require("express-validator");
const db = require("../config/database");
const { authenticateToken, optionalAuth } = require("../middleware/auth");

const router = express.Router();

// Create post
router.post(
  "/",
  authenticateToken,
  [
    body("title").isLength({ min: 1, max: 200 }).trim(),
    body("content").isLength({ min: 1 }).trim(),
    body("status").optional().isIn(["draft", "published", "private"]),
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

    const { title, content, status = "draft" } = req.body;
    const user_id = req.user.userId;

    const query = `
      INSERT INTO posts (user_id, title, content, status) 
      VALUES (?, ?, ?, ?)
    `;

    db.query(query, [user_id, title, content, status], (err, result) => {
      if (err) {
        console.error("Database error creating post:", err);
        return res.status(500).json({
          success: false,
          message: "Failed to create post",
        });
      }

      // Get the created post with user info
      const getPostQuery = `
        SELECT 
          p.id, p.title, p.content, p.status, p.created_at, p.updated_at,
          u.username
        FROM posts p
        JOIN users u ON p.user_id = u.id
        WHERE p.id = ?
      `;

      db.query(getPostQuery, [result.insertId], (err, postResults) => {
        if (err) {
          console.error("Error fetching created post:", err);
          return res.status(500).json({
            success: false,
            message: "Post created but failed to retrieve",
          });
        }

        res.status(201).json({
          success: true,
          message: "Post created successfully",
          post: postResults[0],
        });
      });
    });
  }
);

// Get posts
router.get("/", optionalAuth, (req, res) => {
  let whereClause = "WHERE (p.status = 'published'";
  let params = [];

  // If user is authenticated, also show their private/draft posts
  if (req.user) {
    whereClause += " OR p.user_id = ?";
    params.push(req.user.userId);
  }
  whereClause += ")";

  const query = `
    SELECT 
      p.id, p.title, p.content, p.status, p.created_at, p.updated_at,
      p.user_id as userId,
      u.username
    FROM posts p
    JOIN users u ON p.user_id = u.id
    ${whereClause}
    ORDER BY p.created_at DESC
    LIMIT 50
  `;

  db.query(query, params, (err, results) => {
    if (err) {
      console.error("Database error fetching posts:", err);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch posts",
      });
    }

    res.json({
      success: true,
      posts: results,
    });
  });
});

// Update post
router.put(
  "/:id",
  authenticateToken,
  [
    body("title").optional().isLength({ min: 1, max: 200 }).trim(),
    body("content").optional().isLength({ min: 1 }).trim(),
    body("status").optional().isIn(["draft", "published", "private"]),
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

    const postId = req.params.id;
    const userId = req.user.userId;
    const updates = req.body;

    // Check if post belongs to user
    const checkQuery = "SELECT id FROM posts WHERE id = ? AND user_id = ?";
    db.query(checkQuery, [postId, userId], (err, results) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: "Database error",
        });
      }

      if (results.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Post not found or access denied",
        });
      }

      // Build update query
      const updateFields = [];
      const params = [];

      if (updates.title) {
        updateFields.push("title = ?");
        params.push(updates.title);
      }
      if (updates.content) {
        updateFields.push("content = ?");
        params.push(updates.content);
      }
      if (updates.status) {
        updateFields.push("status = ?");
        params.push(updates.status);
      }

      if (updateFields.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No valid fields to update",
        });
      }

      params.push(postId);

      const updateQuery = `
        UPDATE posts 
        SET ${updateFields.join(", ")}, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `;

      db.query(updateQuery, params, (err, result) => {
        if (err) {
          console.error("Database error updating post:", err);
          return res.status(500).json({
            success: false,
            message: "Failed to update post",
          });
        }

        // Get the updated post
        const getPostQuery = `
          SELECT 
            p.id, p.title, p.content, p.status, p.created_at, p.updated_at,
            p.user_id as userId,
            u.username
          FROM posts p
          JOIN users u ON p.user_id = u.id
          WHERE p.id = ?
        `;

        db.query(getPostQuery, [postId], (err, postResults) => {
          if (err) {
            return res.status(500).json({
              success: false,
              message: "Post updated but failed to retrieve",
            });
          }

          res.json({
            success: true,
            message: "Post updated successfully",
            post: postResults[0],
          });
        });
      });
    });
  }
);

// Delete post
router.delete("/:id", authenticateToken, (req, res) => {
  const postId = req.params.id;
  const userId = req.user.userId;

  const query = "DELETE FROM posts WHERE id = ? AND user_id = ?";
  db.query(query, [postId, userId], (err, result) => {
    if (err) {
      console.error("Database error deleting post:", err);
      return res.status(500).json({
        success: false,
        message: "Database error",
      });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Post not found or access denied",
      });
    }

    res.json({
      success: true,
      message: "Post deleted successfully",
    });
  });
});

module.exports = router;
