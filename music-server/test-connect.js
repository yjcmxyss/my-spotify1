// test-connect.js
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const uri = process.env.MONGO_URI;
console.log("正在尝试连接到:", uri ? "获取到 URI 了 (隐藏具体内容)" : "❌ 未获取到 URI，请检查 .env 文件");

mongoose.set('strictQuery', false);

// 监听连接事件，方便调试
mongoose.connection.on('connected', () => console.log('✅ 连接成功 (Connected)'));
mongoose.connection.on('error', (err) => console.log('❌ 连接错误:', err));
mongoose.connection.on('disconnected', () => console.log('⚠️ 连接断开'));

async function testConnection() {
  try {
    console.log("⏳ 开始连接...");
    // 这里的 5000 代表 5秒连不上就报错，不傻等
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log("🎉 测试通过！数据库连接完全正常。");
  } catch (error) {
    console.error("💥 连接失败！");
    console.error("错误原因:", error.message);
    console.log("\n------------------------------------------------");
    console.log("👉 排查建议：");
    console.log("1. 你的 IP 可能变了。请去 MongoDB Atlas 官网 -> Network Access -> 添加 0.0.0.0/0");
    console.log("2. 密码可能有特殊字符？尝试去数据库改为纯字母数字密码。");
    console.log("3. 检查 .env 里的 MONGO_URI 是否被引号包围了？(不要加引号)");
  } finally {
    // 强制关闭进程
    process.exit();
  }
}

testConnection();