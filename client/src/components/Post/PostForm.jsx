import React, { useState } from "react";
import { postAPI } from "../../services/api";

const PostForm = ({ onPostCreated, editPost = null, onCancel }) => {
  const [formData, setFormData] = useState({
    title: editPost?.title || "",
    content: editPost?.content || "",
    status: editPost?.status || "draft",
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = "Title is required";
    } else if (formData.title.length > 200) {
      newErrors.title = "Title must be 200 characters or less";
    }

    if (!formData.content.trim()) {
      newErrors.content = "Content is required";
    }

    if (!["draft", "published", "private"].includes(formData.status)) {
      newErrors.status = "Invalid status";
    }

    return newErrors;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const formErrors = validateForm();
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      return;
    }

    setLoading(true);
    try {
      let response;
      if (editPost) {
        response = await postAPI.updatePost(editPost.id, formData);
      } else {
        response = await postAPI.createPost(formData);
      }

      if (response.data.success) {
        onPostCreated?.(response.data.post);
        // Reset form if creating new post
        if (!editPost) {
          setFormData({ title: "", content: "", status: "draft" });
        }
      }
    } catch (error) {
      setErrors({
        submit: error.response?.data?.message || "Failed to save post",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">
        {editPost ? "Edit Post" : "Create New Post"}
      </h3>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label
            htmlFor="title"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Title
          </label>
          <input
            id="title"
            name="title"
            type="text"
            value={formData.title}
            onChange={handleChange}
            className={`input-field ${errors.title ? "border-red-500" : ""}`}
            placeholder="Enter post title..."
            maxLength={200}
          />
          <div className="flex justify-between mt-1">
            {errors.title && (
              <p className="text-sm text-red-600">{errors.title}</p>
            )}
            <p className="text-xs text-gray-500 ml-auto">
              {formData.title.length}/200
            </p>
          </div>
        </div>

        <div>
          <label
            htmlFor="content"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Content
          </label>
          <textarea
            id="content"
            name="content"
            rows={8}
            value={formData.content}
            onChange={handleChange}
            className={`input-field resize-none ${
              errors.content ? "border-red-500" : ""
            }`}
            placeholder="Write your post content..."
          />
          {errors.content && (
            <p className="mt-1 text-sm text-red-600">{errors.content}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="status"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Status
          </label>
          <select
            id="status"
            name="status"
            value={formData.status}
            onChange={handleChange}
            className={`input-field ${errors.status ? "border-red-500" : ""}`}
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="private">Private</option>
          </select>
          {errors.status && (
            <p className="mt-1 text-sm text-red-600">{errors.status}</p>
          )}
        </div>

        {errors.submit && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <p className="text-sm text-red-600">{errors.submit}</p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className={`btn-primary flex-1 ${
              loading ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            {loading
              ? editPost
                ? "Updating..."
                : "Creating..."
              : editPost
              ? "Update Post"
              : "Create Post"}
          </button>

          {editPost && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="btn-secondary px-6"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default PostForm;
