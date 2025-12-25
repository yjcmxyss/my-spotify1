// index.js - 完整后端入口文件

// ==========================================
// 1. 引入依赖
// ==========================================
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

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
// 添加连接选项以保持稳定
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB 数据库连接成功！"))
  .catch(err => console.error("❌ 数据库连接失败:", err));

// ==========================================
// 4. 定义数据模型 (Schemas) - 🌟 核心修复：防止重复编译
// ==========================================

// --- A. 用户模型 (User) ---
const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  likedSongs: [String], // 存储用户喜欢的歌曲 ID
  playlists: Array      // 这里的 playlists 字段主要作冗余备份，实际逻辑主要依赖 Playlist 模型
});
// 🌟 使用 || 运算符检查模型是否已存在
const User = mongoose.models.User || mongoose.model('User', userSchema);

// --- B. 歌曲模型 (Song) ---
const songSchema = new mongoose.Schema({
  title: { type: String, required: true },
  artist: { type: String, required: true },
  album: String,
  cover: String,
  url: { type: String, required: true },
  duration: Number,
  lrcUrl: String 
});
const Song = mongoose.models.Song || mongoose.model('Song', songSchema);

// --- C. 歌单模型 (Playlist) ---
const playlistSchema = new mongoose.Schema({
  name: { type: String, required: true },
  cover: String,
  description: String,
  userId: { type: String, index: true }, // 🌟 建立索引加快查询速度
  isPublic: { type: Boolean, default: false }, 
  songs: Array
});
const Playlist = mongoose.models.Playlist || mongoose.model('Playlist', playlistSchema);

// ==========================================
// 5. API 路由接口
// ==========================================

// ---------------------------
// 1. 用户认证接口 (Auth)
// ---------------------------

// [POST] 注册
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.json({ success: false, message: '该邮箱已被注册' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

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

    const user = await User.findOne({ email });
    if (!user) {
      return res.json({ success: false, message: '用户不存在' });
    }

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
// 2. 用户交互接口
// ---------------------------

// [POST] 切换点赞状态
app.post('/api/user/like', async (req, res) => {
  try {
    const { userId, songId } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: '用户不存在' });

    const index = user.likedSongs.indexOf(songId);
    let isLiked = false;

    if (index === -1) {
      user.likedSongs.push(songId);
      isLiked = true;
    } else {
      user.likedSongs.splice(index, 1);
      isLiked = false;
    }

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

// [GET] 获取所有歌曲
app.get('/api/songs', async (req, res) => {
  try {
    // 排除 lyrics 字段以减少数据传输量
    const songs = await Song.find().select('-lyrics'); 
    res.json(songs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// [GET] 获取单首歌曲详情 (含 lrcUrl)
app.get('/api/songs/:id', async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);
    if (!song) return res.status(404).json({ message: '歌曲未找到' });
    res.json(song);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// [POST] 添加新歌 (后台用)
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

// [GET] 获取歌单列表
app.get('/api/playlists', async (req, res) => {
  try {
    const { userId } = req.query;
    let filter = {};

    // 逻辑：如果提供了 userId，则返回 (公开的歌单 OR 该用户的私有歌单)
    // 如果没有 userId，则只返回 (公开的歌单)
    if (userId) {
      filter = {
        $or: [{ isPublic: true }, { userId: userId }]
      };
    } else {
      filter = { isPublic: true };
    }

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
    userId: req.body.userId, 
    isPublic: req.body.isPublic || false,
    songs: []
  });
 
  try {
    const newPlaylist = await playlist.save();
    res.status(201).json(newPlaylist);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// [PUT] 更新歌单 (添加歌曲 / 更新封面 / 更新名称)
app.put('/api/playlists/:id', async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id);
    if (!playlist) return res.status(404).json({ message: '歌单不存在' });

    // 更新逻辑
    if (req.body.songs) playlist.songs = req.body.songs;
    if (req.body.cover) playlist.cover = req.body.cover;
    if (req.body.name) playlist.name = req.body.name; // 支持更新名称

    const updatedPlaylist = await playlist.save();
    res.json(updatedPlaylist);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// [DELETE] 删除歌单
app.delete('/api/playlists/:id', async (req, res) => {
  try {
    const { userId } = req.query; 
    const playlistId = req.params.id;

    const playlist = await Playlist.findById(playlistId);

    if (!playlist) {
      return res.status(404).json({ message: "歌单不存在" });
    }

    // 权限检查
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

// 如果你在本地运行（非 Vercel 等 Serverless 环境），请取消下面的注释
// app.listen(PORT, () => {
//   console.log(`🚀 后端服务器已启动，运行在 http://localhost:${PORT}`);
// });

export default app;