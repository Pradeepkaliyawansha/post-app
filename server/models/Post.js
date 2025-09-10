const { DataTypes } = require("sequelize");
const sequelize = require("../config");
const User = require("./User");

const Post = sequelize.define(
  "Post",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("draft", "published", "private"),
      defaultValue: "draft",
    },
  },
  {
    timestamps: true,
    tableName: "posts",
  }
);

//Relationship user and post
User.hasMany(Post, { foreignKey: "userId", onDelete: "CASCADE" });
Post.belongsTo(User, { foreignKey: "userId" });

module.exports = Post;
