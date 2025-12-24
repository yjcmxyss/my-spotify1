// server/seed.js
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// 加载环境变量
dotenv.config();

// 连接数据库
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("数据库连接成功，准备写入数据..."))
  .catch(err => console.log(err));

// 定义模型 (和 server.js 保持一致)
const SongSchema = new mongoose.Schema({
  title: String,
  artist: String,
  album: String,
  cover: String,
  url: String,
  duration: Number,
 lrcUrl: String // 数据库存原始 LRC 字符串，前端负责解析
});
const Song = mongoose.model('Song', SongSchema);

const PlaylistSchema = new mongoose.Schema({
  name: String,
  cover: String,
  description: String,
  songs: Array,
  isPublic: { type: Boolean, default: true } // 🌟 默认设为公开
});

// 2. 这里的变量名一定要叫 Playlist，且要在 seedDB 函数外面定义
const Playlist = mongoose.model('Playlist', PlaylistSchema);


// --- 歌曲列表 (只有一首) ---
const songs = [
  {
    title: "12",
    artist: "PinkPantheress",
    album: "Sound Effects 6",
    cover: "/images/Mosquito.webp",
    duration: 238,
    url: "https://audio.jukehost.co.uk/vLHWQMoFqWPyo8NUbaYLC1vtx8tiINU7",
    lrcUrl: "/lyrics/Mosquito - PinkPantheress.lrc" 
  }
];

// --- 歌单数据 (已修复引用错误) ---
const playlistsData = [
  {
    name: "橘子汽水味的风",
    cover: "/images/6.webp",
    description: "夏日限定的心动时刻",
    songs: [songs[0]],
    isPublic: true // 🌟 所有人可见
  },
  {
    name: "宇宙级浪漫",
    cover: "/images/5.jpg",
    description: "你的夏日降温必备",
    songs: [songs[0]],
    isPublic: true // 🌟 所有人可见
  },
  {
    name: "官方推荐列表",
    cover: "/images/fm.jpg",
    description: "编辑精选",
    songs: [],
    isPublic: true // 🌟 所有人可见
  }
];

// --- 执行导入 (包含连接逻辑修复) ---
const seedDB = async () => {
  try {
    console.log("⏳ 正在连接数据库...");
    
    // 1. 建立连接 (设置超时)
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000 
    });
    console.log("✅ 数据库连接成功！");

    // 2. 插入新数据
    // 注意：这里没有 deleteMany，所以每次运行都会新增数据（可能会重复）
    // 如果你想清空，请取消下面两行的注释：
    // await Song.deleteMany({});
    // await Playlist.deleteMany({});

    console.log("📝 正在写入歌曲...");
    // 必须先插入歌曲，拿到带 _id 的对象 (可选，但推荐)
    const insertedSongs = await Song.insertMany(songs);
    console.log(`- 已写入 ${insertedSongs.length} 首歌曲`);

    console.log("📝 正在写入歌单...");
    await Playlist.insertMany(playlistsData);
    console.log(`- 已写入 ${playlistsData.length} 个歌单`);

    console.log("🎉 所有操作成功！");

  } catch (err) {
    console.error("❌ 发生错误:", err.message);
  } finally {
    // 3. 关闭连接
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      console.log("👋 连接已关闭");
    }
  }
};

seedDB();