import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { postAPI } from "../../services/api";

const PostItem = ({ post, onEdit, onDelete }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const isAuthor = user && user.id === post.userId;

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this post?")) {
      return;
    }

    setLoading(true);
    try {
      await postAPI.deletePost(post.id);
      onDelete?.(post.id);
    } catch {
      alert("Failed to delete post. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      draft: "bg-gray-100 text-gray-800",
      published: "bg-green-100 text-green-800",
      private: "bg-blue-100 text-blue-800",
    };

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          badges[status] || badges.draft
        }`}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <article className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {post.title}
          </h3>
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span>By {post.username || "Unknown"}</span>
            <span>•</span>
            <time>{formatDate(post.createdAt || post.created_at)}</time>
            <span>•</span>
            {getStatusBadge(post.status)}
          </div>
        </div>

        {isAuthor && (
          <div className="flex gap-2 ml-4">
            <button
              onClick={() => onEdit?.(post)}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              Edit
            </button>
            <button
              onClick={handleDelete}
              disabled={loading}
              className="text-red-600 hover:text-red-700 text-sm font-medium disabled:opacity-50"
            >
              {loading ? "..." : "Delete"}
            </button>
          </div>
        )}
      </div>

      <div className="prose prose-sm max-w-none">
        <p className="text-gray-700 leading-relaxed">
          {post.content.length > 300
            ? `${post.content.substring(0, 300)}...`
            : post.content}
        </p>
      </div>

      {post.updatedAt !== post.createdAt && (
        <p className="text-xs text-gray-500 mt-4">
          Last updated: {formatDate(post.updatedAt || post.updated_at)}
        </p>
      )}
    </article>
  );
};

export default PostItem;
