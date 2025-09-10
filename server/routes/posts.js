const express = require("express");
const { body, validationResult, query } = require("express-validator");
const db = require("../config/database");
const { authenticateToken, optionalAuth } = require("../middleware/auth");

const router = express.Router();

// Create post
router.post(
  "/",
  authenticateToken,
  [
    body("title").isLength({ min: 1, max: 255 }).trim(),
    body("content").isLength({ min: 1 }).trim(),
    body("is_private").optional().isBoolean(),
    body("tags").optional().isArray(),
    body("image_url").optional().isURL(),
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

    const { title, content, is_private = false, tags, image_url } = req.body;
    const user_id = req.user.userId;

    const query = `
    INSERT INTO posts (user_id, title, content, is_private, tags, image_url) 
    VALUES (?, ?, ?, ?, ?, ?)
  `;

    db.query(
      query,
      [
        user_id,
        title,
        content,
        is_private,
        tags ? JSON.stringify(tags) : null,
        image_url || null,
      ],
      (err, result) => {
        if (err) {
          return res.status(500).json({
            success: false,
            message: "Failed to create post",
          });
        }

        res.status(201).json({
          success: true,
          message: "Post created successfully",
          post: {
            id: result.insertId,
            title,
            content,
            is_private,
            tags,
            image_url,
          },
        });
      }
    );
  }
);

// Get posts (public posts + user's private posts if authenticated)
router.get(
  "/",
  optionalAuth,
  [
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("user_id").optional().isInt({ min: 1 }),
  ],
  (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const filterUserId = req.query.user_id;

    let whereClause = "WHERE (p.is_private = FALSE";
    let params = [];

    // If user is authenticated, also show their private posts
    if (req.user) {
      whereClause += " OR p.user_id = ?";
      params.push(req.user.userId);
    }
    whereClause += ")";

    // Filter by specific user if requested
    if (filterUserId) {
      whereClause += " AND p.user_id = ?";
      params.push(filterUserId);
    }

    const query = `
    SELECT 
      p.id, p.title, p.content, p.is_private, p.tags, p.image_url,
      p.views, p.likes_count, p.comments_count, p.created_at, p.updated_at,
      u.username, u.full_name, u.profile_image
    FROM posts p
    JOIN users u ON p.user_id = u.id
    ${whereClause}
    ORDER BY p.created_at DESC
    LIMIT ? OFFSET ?
  `;

    params.push(limit, offset);

    db.query(query, params, (err, results) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: "Failed to fetch posts",
        });
      }

      // Parse tags JSON
      const posts = results.map((post) => ({
        ...post,
        tags: post.tags ? JSON.parse(post.tags) : null,
        is_private: Boolean(post.is_private),
      }));

      res.json({
        success: true,
        posts,
        pagination: {
          page,
          limit,
          total: posts.length,
        },
      });
    });
  }
);

// Get single post
router.get("/:id", optionalAuth, (req, res) => {
  const postId = req.params.id;

  let whereClause = "WHERE p.id = ? AND (p.is_private = FALSE";
  let params = [postId];

  if (req.user) {
    whereClause += " OR p.user_id = ?";
    params.push(req.user.userId);
  }
  whereClause += ")";

  const query = `
    SELECT 
      p.id, p.title, p.content, p.is_private, p.tags, p.image_url,
      p.views, p.likes_count, p.comments_count, p.created_at, p.updated_at,
      u.id as user_id, u.username, u.full_name, u.profile_image
    FROM posts p
    JOIN users u ON p.user_id = u.id
    ${whereClause}
  `;

  db.query(query, params, (err, results) => {
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

    const post = results[0];

    // Increment view count
    db.query("UPDATE posts SET views = views + 1 WHERE id = ?", [postId]);

    res.json({
      success: true,
      post: {
        ...post,
        tags: post.tags ? JSON.parse(post.tags) : null,
        is_private: Boolean(post.is_private),
      },
    });
  });
});

// Update post
router.put(
  "/:id",
  authenticateToken,
  [
    body("title").optional().isLength({ min: 1, max: 255 }).trim(),
    body("content").optional().isLength({ min: 1 }).trim(),
    body("is_private").optional().isBoolean(),
    body("tags").optional().isArray(),
    body("image_url").optional().isURL(),
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

      Object.keys(updates).forEach((key) => {
        if (["title", "content", "is_private", "image_url"].includes(key)) {
          updateFields.push(`${key} = ?`);
          params.push(updates[key]);
        } else if (key === "tags") {
          updateFields.push("tags = ?");
          params.push(JSON.stringify(updates[key]));
        }
      });

      if (updateFields.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No valid fields to update",
        });
      }

      params.push(postId);

      const updateQuery = `UPDATE posts SET ${updateFields.join(
        ", "
      )}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;

      db.query(updateQuery, params, (err, result) => {
        if (err) {
          return res.status(500).json({
            success: false,
            message: "Failed to update post",
          });
        }

        res.json({
          success: true,
          message: "Post updated successfully",
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

//add comment
router.post(
  "/:id/comments",
  authenticateToken,
  [body("comment").isLength({ min: 1 }).trim()],
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
    const { comment } = req.body;

    const insertQuery = `INSERT INTO post_comments (post_id, user_id, comment) VALUES (?, ?, ?)`;

    db.query(insertQuery, [postId, userId, comment], (err, result) => {
      if (err)
        return res
          .status(500)
          .json({ success: false, message: "Failed to add comment" });

      // update comments_count
      db.query(
        "UPDATE posts SET comments_count = comments_count + 1 WHERE id = ?",
        [postId]
      );

      res.status(201).json({
        success: true,
        message: "Comment added successfully",
        comment: {
          id: result.insertId,
          post_id: postId,
          user_id: userId,
          comment,
        },
      });
    });
  }
);

//delete comment
router.delete("/:postId/comments/:commentId", authenticateToken, (req, res) => {
  const { postId, commentId } = req.params;
  const userId = req.user.userId;

  const checkQuery =
    "SELECT id FROM post_comments WHERE id = ? AND user_id = ?";
  db.query(checkQuery, [commentId, userId], (err, results) => {
    if (err)
      return res
        .status(500)
        .json({ success: false, message: "Database error" });

    if (results.length === 0) {
      return res
        .status(404)
        .json({
          success: false,
          message: "Comment not found or access denied",
        });
    }

    const deleteQuery = "DELETE FROM post_comments WHERE id = ?";
    db.query(deleteQuery, [commentId], (err) => {
      if (err)
        return res
          .status(500)
          .json({ success: false, message: "Failed to delete comment" });

      // decrement comments_count
      db.query(
        "UPDATE posts SET comments_count = comments_count - 1 WHERE id = ?",
        [postId]
      );

      res.json({ success: true, message: "Comment deleted successfully" });
    });
  });
});

module.exports = router;
