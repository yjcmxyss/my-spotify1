// server.js - 完整后端入口文件

// ==========================================
// 1. 引入依赖
// ==========================================
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs'); // 用于密码加密
require('dotenv').config(); // 读取 .env 配置

// ==========================================
// 2. 初始化应用 & 中间件
// ==========================================
const app = express();
const PORT = process.env.PORT || 5000;

// 允许跨域
app.use(cors());
// 解析 JSON 请求体
app.use(express.json());

// ==========================================
// 3. 连接 MongoDB 数据库
// ==========================================
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB 数据库连接成功！"))
  .catch(err => console.error("❌ 数据库连接失败:", err));

// ==========================================
// 4. 定义数据模型 (Schemas)
// ==========================================

// --- A. 用户模型 (User) ---
const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  likedSongs: [String], // 🌟 存储用户喜欢的歌曲 ID
  playlists: Array      // 用户创建的歌单
});
const User = mongoose.model('User', userSchema);

// --- B. 歌曲模型 (Song) ---
const songSchema = new mongoose.Schema({
  title: { type: String, required: true },
  artist: { type: String, required: true },
  album: String,
  cover: String,
  url: { type: String, required: true },
  duration: Number,
  lrcUrl: String // 歌词文件路径
});
const Song = mongoose.model('Song', songSchema);


// --- B. 歌单模型 (Playlist) ---
// server.js 里的 Playlist 模型
const playlistSchema = new mongoose.Schema({
  name: { type: String, required: true },
  cover: String,
  description: String,
  userId: { type: String, index: true }, 
  isPublic: { type: Boolean, default: false }, // 确保有这个字段
  songs: Array
});

// 🌟 核心：确保这一行在 app.get('/api/playlists') 之前执行
const Playlist = mongoose.model('Playlist', playlistSchema);
// 5. API 路由接口
// ==========================================

// ---------------------------
// 1. 用户认证接口 (Auth)
// ---------------------------

// [POST] 注册
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // 检查邮箱
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.json({ success: false, message: '该邮箱已被注册' });
    }

    // 密码加密
    const hashedPassword = await bcrypt.hash(password, 10);

    // 创建用户
    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      likedSongs: [],
      playlists: []
    });

    await newUser.save();

    res.json({
      success: true,
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        likedSongs: newUser.likedSongs,
        playlists: newUser.playlists
      }
    });

  } catch (err) {
    res.status(500).json({ success: false, message: '服务器错误: ' + err.message });
  }
});

// [POST] 登录
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // 查找用户
    const user = await User.findOne({ email });
    if (!user) {
      return res.json({ success: false, message: '用户不存在' });
    }

    // 验证密码
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.json({ success: false, message: '密码错误' });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        likedSongs: user.likedSongs,
        playlists: user.playlists
      }
    });

  } catch (err) {
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// ---------------------------
// 2. 用户交互接口 (User Actions) - 🌟 新增部分
// ---------------------------

// [POST] 切换点赞状态 (点赞/取消点赞)
app.post('/api/user/like', async (req, res) => {
  try {
    const { userId, songId } = req.body;

    // 查找用户
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: '用户不存在' });

    // 检查是否已点赞
    const index = user.likedSongs.indexOf(songId);
    let isLiked = false;

    if (index === -1) {
      // 没点赞 -> 添加
      user.likedSongs.push(songId);
      isLiked = true;
    } else {
      // 已点赞 -> 移除
      user.likedSongs.splice(index, 1);
      isLiked = false;
    }

    // 保存更新后的用户数据
    await user.save();

    res.json({ 
      success: true, 
      isLiked, 
      likedSongs: user.likedSongs 
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---------------------------
// 3. 歌曲接口 (Songs)
// ---------------------------

// [GET] 获取所有歌曲 (不含歌词文本，提高速度)
app.get('/api/songs', async (req, res) => {
  try {
    const songs = await Song.find().select('-lyrics'); 
    res.json(songs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// [GET] 获取单首歌曲详情 (包含 lrcUrl)
app.get('/api/songs/:id', async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);
    if (!song) return res.status(404).json({ message: '歌曲未找到' });
    res.json(song);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// [POST] 添加新歌 (用于 seed.js 或后台)
app.post('/api/songs', async (req, res) => {
  const song = new Song({
    title: req.body.title,
    artist: req.body.artist,
    album: req.body.album,
    cover: req.body.cover,
    url: req.body.url,
    duration: req.body.duration,
    lrcUrl: req.body.lrcUrl
  });

  try {
    const newSong = await song.save();
    res.status(201).json(newSong);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ---------------------------
// 4. 歌单接口 (Playlists)
// ---------------------------

// [GET] 获取歌单列表 (修改版)
// [GET] 获取歌单列表
app.get('/api/playlists', async (req, res) => {
  try {
    const { userId } = req.query;
    let filter = {};

    if (userId) {
      filter = {
        $or: [{ isPublic: true }, { userId: userId }]
      };
    } else {
      filter = { isPublic: true };
    }

    console.log("执行查询，条件为:", JSON.stringify(filter));

    // 🌟 此时这里就能找到 Playlist 变量了
    const playlists = await Playlist.find(filter);
    res.json(playlists);
  } catch (err) {
    console.error("后端查询报错:", err.message);
    res.status(500).json({ message: err.message });
  }
});


// [POST] 创建新歌单
app.post('/api/playlists', async (req, res) => {
  // 必须确保前端传来了 userId
 if (!req.body.userId) {
  return res.status(400).json({ message: "缺少用户ID" });
}

  const playlist = new Playlist({
    name: req.body.name,
    cover: req.body.cover || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=500&auto=format&fit=crop&q=60",
    description: req.body.description || "新建歌单",
    userId: req.body.userId, // 🌟 记录：保存前端传来的 userId
    isPublic: req.body.isPublic || false, // 🌟 这一行必须有！
    songs: []
  });
 
  try {
    const newPlaylist = await playlist.save();
    res.status(201).json(newPlaylist);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// [PUT] 更新歌单 (添加歌曲 / 更新封面)
app.put('/api/playlists/:id', async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id);
    if (!playlist) return res.status(404).json({ message: '歌单不存在' });

    // 更新逻辑
    if (req.body.songs) playlist.songs = req.body.songs;
    if (req.body.cover) playlist.cover = req.body.cover;

    const updatedPlaylist = await playlist.save();
    res.json(updatedPlaylist);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// [DELETE] 删除歌单
app.delete('/api/playlists/:id', async (req, res) => {
  try {
    const { userId } = req.query; // 从请求参数获取当前登录用户ID
    const playlistId = req.params.id;

    const playlist = await Playlist.findById(playlistId);

    if (!playlist) {
      return res.status(404).json({ message: "歌单不存在" });
    }

    // 🌟 安全检查：只有创建者可以删除
    if (playlist.userId !== userId) {
      return res.status(403).json({ message: "你没有权限删除此歌单" });
    }

    await Playlist.findByIdAndDelete(playlistId);
    res.json({ message: "歌单已成功删除" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ==========================================
// 6. 启动服务器
// ==========================================
// app.listen(PORT, () => {
//   console.log(`🚀 后端服务器已启动，运行在 http://localhost:${PORT}`);
// });

module.exports = app;