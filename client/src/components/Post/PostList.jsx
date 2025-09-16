import React, { useState, useEffect } from "react";
import { postAPI } from "../../services/api";
import PostForm from "./PostForm";
import PostItem from "./PostItem";

const PostList = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingPost, setEditingPost] = useState(null);

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const response = await postAPI.getPosts();

      if (response.data.success) {
        setPosts(response.data.posts || []);
      } else {
        setError("Failed to fetch posts");
      }
    } catch (err) {
      console.error("Error fetching posts:", err);
      setError(err.response?.data?.message || "Failed to fetch posts");
    } finally {
      setLoading(false);
    }
  };

  const handlePostCreated = (newPost) => {
    if (editingPost) {
      // Update existing post
      setPosts(
        posts.map((post) => (post.id === editingPost.id ? newPost : post))
      );
      setEditingPost(null);
    } else {
      // Add new post to the beginning
      setPosts([newPost, ...posts]);
    }
    setShowForm(false);
  };

  const handleEdit = (post) => {
    setEditingPost(post);
    setShowForm(true);
  };

  const handleDelete = (postId) => {
    setPosts(posts.filter((post) => post.id !== postId));
  };

  const handleCancelEdit = () => {
    setEditingPost(null);
    setShowForm(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Posts</h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          {showForm ? "Cancel" : "Create New Post"}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <p className="text-red-600">{error}</p>
          <button
            onClick={fetchPosts}
            className="mt-2 text-sm text-red-700 hover:text-red-800 font-medium"
          >
            Try Again
          </button>
        </div>
      )}

      {(showForm || editingPost) && (
        <div className="mb-8">
          <PostForm
            onPostCreated={handlePostCreated}
            editPost={editingPost}
            onCancel={handleCancelEdit}
          />
        </div>
      )}

      <div className="space-y-6">
        {posts.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">📝</div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              No posts yet
            </h3>
            <p className="text-gray-500 mb-4">
              Be the first to create a post and share your thoughts!
            </p>
            <button onClick={() => setShowForm(true)} className="btn-primary">
              Create First Post
            </button>
          </div>
        ) : (
          posts.map((post) => (
            <PostItem
              key={post.id}
              post={post}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default PostList;
