import React, { useState, useRef, useEffect, createContext, useContext, useMemo } from 'react';
import axios from 'axios';
import { 
  Play, Pause, SkipBack, SkipForward, Volume2, Search, Home, Library, 
  ListMusic, Heart, Maximize2, ChevronDown, Repeat, Shuffle, X, Plus,
  ArrowLeft, Clock, BadgeCheck, Mic2, Users, ListPlus, Repeat1 
} from 'lucide-react';

// --- 全局样式 ---
const GlobalStyles = () => (
  <style>{`
    .no-scrollbar::-webkit-scrollbar { display: none; }
    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
      20%, 40%, 60%, 80% { transform: translateX(4px); }
    }
  `}</style>
);

// --- 工具函数：解析 LRC 歌词 ---
const parseLRC = (lrcText) => {
  if (!lrcText || typeof lrcText !== 'string') return [];
  const lines = lrcText.split(/\r?\n/);
  const lyrics = [];
  const timeReg = /\[(\d{2}):(\d{2})[.:](\d{2,3})\]/;
  lines.forEach(line => {
    const match = timeReg.exec(line);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const msStr = match[3];
      const msValue = msStr.length === 3 ? parseInt(msStr, 10) / 1000 : parseInt(msStr, 10) / 100;
      const time = minutes * 60 + seconds + msValue;
      const text = line.replace(timeReg, '').trim();
      if (text) lyrics.push({ time, text });
    }
  });
  return lyrics.sort((a, b) => a.time - b.time);
};

// --- 常量定义 ---
// 虽然现在主要用数据库，但 ARTIST_DATA 用于前端显示艺人封面映射，仍然需要保留
const ARTIST_DATA = {
  "Charli xcx": "/images/artist_charli.jpg", 
  "XG": "/images/artist_xg.jpg",
  "椎名林檎": "/images/artist_ringo.jpg",
  "Tyla": "/images/artist_tyla.jpg",
  "NewJeans": "/images/artist_newjeans.jpg",
  "ano": "/images/artist_ano.jpg",
  "米津玄師": "/images/artist_kenshi.jpg",
  "Lil Hero": "/images/artist_hero.jpg",
  "KATSEYE": "/images/artist_katseye.jpg",
  // 这里的键名要和数据库里的 artist 字段一致
};

const MOCK_SONGS = []; // 留空占位，防止旧组件引用报错

// ==========================================
// Context 定义
// ==========================================
export const PlayerContext = createContext();

// ==========================================
// Provider 组件 (核心逻辑)
// ==========================================
// ==========================================
// Provider 组件 (核心逻辑)
// ==========================================
export const PlayerProvider = ({ children }) => {
  // 后端 API 地址
  const API_URL = '/api';

  // ==============================
  // 1. 全局状态定义
  // ==============================

  const [themeColor, setThemeColor] = useState('#737373');
  
  // 数据源
  const [allSongs, setAllSongs] = useState([]);
  const [playlists, setPlaylists] = useState([]); 

  // 播放器状态
  const [currentSong, setCurrentSong] = useState(null); 
  const [currentLyrics, setCurrentLyrics] = useState([]); 
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [queue, setQueue] = useState([]);
  const [repeatMode, setRepeatMode] = useState('off'); 
  const audioRef = useRef(null);

  // 界面/弹窗状态
  const [showLyrics, setShowLyrics] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [addToPlaylistModal, setAddToPlaylistModal] = useState({ isOpen: false, song: null });
  
  // 导航状态
  const [currentPlaylist, setCurrentPlaylist] = useState(null);
  const [currentArtist, setCurrentArtist] = useState(null);
  
  // 用户数据
  const [user, setUser] = useState(null);
  const [likedSongs, setLikedSongs] = useState(new Set()); 
  const [followedArtists, setFollowedArtists] = useState(new Set());
  
  // 🔔 全局消息提示 (Toast)
  const [toast, setToast] = useState(null);

  // ==============================
  // 2. 核心辅助函数
  // ==============================

  const changeThemeColor = (color) => {
    setThemeColor(color);
    localStorage.setItem('music_hub_theme', color);
    document.documentElement.style.setProperty('--primary-color', color);
    document.documentElement.style.setProperty('--bg-gradient-color', `${color}CC`);
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const checkAuth = () => {
    if (!user) {
      setShowAuthModal(true);
      showToast('请先登录以使用此功能', 'error');
      return false;
    }
    return true;
  };

  // ==============================
  // 3. 数据初始化 (歌曲 & 主题)
  // ==============================

  useEffect(() => {
    // 1. 初始化主题色
    const savedColor = localStorage.getItem('music_hub_theme');
    if (savedColor) {
      setThemeColor(savedColor);
      document.documentElement.style.setProperty('--primary-color', savedColor);
    }

    // 2. 加载公共歌曲数据
    const fetchPublicData = async () => {
      try {
        const songsRes = await axios.get(`${API_URL}/songs`);
        
        // 处理歌曲 (映射 ID)
        const processedSongs = songsRes.data.map(song => ({
          ...song,
          id: song._id, 
          lyrics: [] // 初始不解析，按需加载
        }));
        
        setAllSongs(processedSongs);
        setQueue(processedSongs);
        
        // 默认选中第一首
        if (processedSongs.length > 0 && !currentSong) {
          setCurrentSong(processedSongs[0]); 
        }

      } catch (err) {
        console.error("初始化数据失败:", err);
        showToast("无法连接服务器，请检查后端", "error");
      }
    };

    fetchPublicData();
  }, []); 

  // ==============================
  // 4. 监听用户变化，加载专属歌单 (🌟 修复刷新延迟)
  // ==============================
  useEffect(() => {
    const fetchVisiblePlaylists = async () => {
      // 兼容两种 ID 写法
      const userId = user?.id || user?._id;

      try {
        const res = await axios.get(`${API_URL}/playlists`, {
          params: userId ? { userId: userId } : {}
        });
        
        const processedPlaylists = res.data.map(pl => ({
          ...pl,
          id: pl._id || pl.id, 
          songs: pl.songs ? pl.songs.map(s => ({...s, id: s._id || s.id})) : []
        }));

        // 🌟 修复：移除 if (prev.length > ...) 检查，始终信任后端数据
        setPlaylists(processedPlaylists);
        
      } catch (err) {
        console.error("加载歌单失败:", err);
      }
    };

    fetchVisiblePlaylists();
  }, [user?.id, user?._id]); 

  // ==============================
  // 5. 歌词按需加载系统
  // ==============================
  useEffect(() => {
    if (!currentSong) return;

    const loadLyrics = async () => {
      setCurrentLyrics([]); 
      
      if (currentSong.lrcUrl) {
        try {
          const res = await fetch(currentSong.lrcUrl);
          if (!res.ok) throw new Error("下载失败");
          const text = await res.text();
          setCurrentLyrics(parseLRC(text)); 
        } catch (err) {
          console.warn("歌词文件加载失败", err);
          setCurrentLyrics([{ time: 0, text: "暂无歌词" }]);
        }
      } 
      else if (currentSong.lyrics && typeof currentSong.lyrics === 'string') {
        setCurrentLyrics(parseLRC(currentSong.lyrics));
      } 
      else {
        setCurrentLyrics([{ time: 0, text: "纯音乐 / 暂无歌词" }]);
      }
    };

    loadLyrics();
  }, [currentSong?.id]);

  // ==============================
  // 6. 用户认证系统
  // ==============================
  
  useEffect(() => {
    const storedUser = localStorage.getItem('music_hub_user');
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        if (!parsedUser.id && parsedUser._id) parsedUser.id = parsedUser._id;
        setUser(parsedUser);
        if (parsedUser.likedSongs) setLikedSongs(new Set(parsedUser.likedSongs));
      } catch (e) {
        localStorage.removeItem('music_hub_user');
      }
    }
  }, []);

  const login = async (email, password) => {
    try {
      const res = await axios.post(`${API_URL}/login`, { email, password });
      if (res.data.success) {
        const userData = res.data.user;
        if (!userData.id && userData._id) userData.id = userData._id;
        
        setUser(userData);
        localStorage.setItem('music_hub_user', JSON.stringify(userData));
        setLikedSongs(new Set(userData.likedSongs || []));
        return { success: true, user: userData };
      }
      return { success: false, message: res.data.message };
    } catch (err) {
      return { success: false, message: '服务器连接失败' };
    }
  };

  const register = async (email, password, username) => {
    try {
      const res = await axios.post(`${API_URL}/register`, { email, password, username });
      if (res.data.success) {
        const userData = res.data.user;
        if (!userData.id && userData._id) userData.id = userData._id;

        setUser(userData);
        localStorage.setItem('music_hub_user', JSON.stringify(userData));
        setLikedSongs(new Set());
        return { success: true, user: userData };
      }
      return { success: false, message: '注册失败' };
    } catch (err) {
      return { success: false, message: err.response?.data?.message || '注册失败' };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('music_hub_user');
    setLikedSongs(new Set());
    setPlaylists([]); 
    setActiveTab('home');
    setCurrentPlaylist(null);
    showToast('已安全退出登录');
  };

  // ==============================
  // 7. 播放控制逻辑
  // ==============================
  
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  const safePlay = async () => {
    if (!audioRef.current) return;
    try {
      await audioRef.current.play();
      setIsPlaying(true);
    } catch (err) {
      console.error("播放失败:", err);
      setIsPlaying(false);
    }
  };

  const playSong = (song, newQueue = null) => {
    if (newQueue) setQueue(newQueue);
    
    if (currentSong && currentSong.id === song.id) {
      togglePlay();
    } else {
      setCurrentSong(song);
      setIsPlaying(false);
      
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.load();
          safePlay();
        }
      }, 0);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    isPlaying ? audioRef.current.pause() : safePlay();
    setIsPlaying(!isPlaying);
  };

  const toggleRepeat = () => {
    setRepeatMode(prev => prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off');
    showToast(`循环模式: ${repeatMode === 'off' ? '列表循环' : repeatMode === 'all' ? '单曲循环' : '关闭'}`);
  };

  const nextSong = (isAuto = false) => {
    if (!currentSong || queue.length === 0) return;

    if (isAuto && repeatMode === 'one') {
      audioRef.current.currentTime = 0;
      safePlay();
      return;
    }

    const currentIndex = queue.findIndex(s => s.id === currentSong.id);
    let nextIndex = currentIndex + 1;

    if (nextIndex >= queue.length) {
      if (repeatMode === 'off' && isAuto) {
        setIsPlaying(false);
        return;
      }
      nextIndex = 0;
    }

    playSong(queue[nextIndex]);
  };

  const prevSong = () => {
    if (!currentSong || queue.length === 0) return;
    const currentIndex = queue.findIndex(s => s.id === currentSong.id);
    const prevIndex = (currentIndex - 1 + queue.length) % queue.length;
    playSong(queue[prevIndex]);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) setProgress(audioRef.current.currentTime);
  };

  // ==============================
  // 8. 用户交互操作 (数据库同步)
  // ==============================

  const toggleLike = async (songId) => {
    if (!checkAuth()) return;

    const isLikedBefore = likedSongs.has(songId);
    setLikedSongs(prev => {
      const newLiked = new Set(prev);
      if (isLikedBefore) newLiked.delete(songId);
      else newLiked.add(songId);
      return newLiked;
    });

    if (isLikedBefore) showToast('已取消喜欢');
    else showToast('已添加到喜欢的歌曲');

    try {
      const userId = user.id || user._id;
      await axios.post(`${API_URL}/user/like`, {
        userId: userId,
        songId: songId
      });
    } catch (err) {
      console.error("点赞同步失败:", err);
      showToast("网络错误，操作未保存", "error");
      setLikedSongs(prev => {
        const newLiked = new Set(prev);
        if (isLikedBefore) newLiked.add(songId);
        else newLiked.delete(songId);
        return newLiked;
      });
    }
  };

  const toggleFollowArtist = (artistName) => {
    if (!checkAuth()) return;
    setFollowedArtists(prev => {
      const newFollowed = new Set(prev);
      if (newFollowed.has(artistName)) {
        newFollowed.delete(artistName);
        showToast(`已取消关注 ${artistName}`);
      } else {
        newFollowed.add(artistName);
        showToast(`已关注 ${artistName}`);
      }
      return newFollowed;
    });
  };

  const createPlaylist = async (name, coverUrl, isPublic = false) => {
    if (!checkAuth()) return;
    const userId = user?.id || user?._id;
    
    if (!userId) {
      showToast("创建失败：无法获取当前用户信息", "error");
      return;
    }

    try {
      const res = await axios.post(`${API_URL}/playlists`, {
        name: name,
        cover: coverUrl || "https://i.ibb.co/6cGhCCj6/Meteor-1-MIFEN.jpg",
        description: isPublic ? "公共歌单" : "新建歌单",
        userId: userId,
        isPublic: isPublic
      });

      const newPlaylist = { 
        ...res.data, 
        id: res.data._id || res.data.id 
      };
      
      setPlaylists(prev => {
        if (prev.find(p => (p._id || p.id) === newPlaylist.id)) return prev;
        return [...prev, newPlaylist];
      });
      showToast(`歌单 "${name}" 创建成功！`);
      setShowCreateModal(false); 
    } catch (err) {
      console.error("创建歌单详细错误:", err.response?.data || err.message);
      showToast(err.response?.data?.message || "创建失败，请检查网络", "error");
    }
  };

  const deletePlaylist = async (playlistId) => {
    if (!window.confirm("确定要永久删除这个歌单吗？")) return;
    const userId = user?.id || user?._id;
    
    try {
      await axios.delete(`${API_URL}/playlists/${playlistId}`, {
        params: { userId } 
      });

      setPlaylists(prev => prev.filter(p => (p._id || p.id) !== playlistId));
      
      // 如果当前正在查看该歌单，返回首页
      if (currentPlaylist && (currentPlaylist.id === playlistId || currentPlaylist._id === playlistId)) {
          setActiveTab('home'); 
          setCurrentPlaylist(null);
      }
      
      showToast("✨ 歌单已成功删除！");
    } catch (err) {
      console.error("删除失败:", err);
      showToast(err.response?.data?.message || "删除失败，请稍后再试", "error");
    }
  };

  // [修改] 更新歌单封面 (带权限检查)
  const updatePlaylistCover = async (playlistId, newCoverUrl) => {
    if (!checkAuth() || !newCoverUrl) return;
    const currentUserId = user?.id || user?._id;

    // 🌟 权限检查
    const targetPlaylist = playlists.find(pl => (pl.id || pl._id) === playlistId);
    if (targetPlaylist && targetPlaylist.userId !== currentUserId) {
      showToast("你没有权限修改此歌单封面", "error");
      return;
    }

    setPlaylists(prev => prev.map(pl => {
      if ((pl.id || pl._id) === playlistId) {
        return { ...pl, cover: newCoverUrl };
      }
      return pl;
    }));

    if (currentPlaylist && (currentPlaylist.id || currentPlaylist._id) === playlistId) {
      setCurrentPlaylist(prev => ({ ...prev, cover: newCoverUrl }));
    }

    showToast('正在更新封面...');

    try {
      await axios.put(`${API_URL}/playlists/${playlistId}`, {
        cover: newCoverUrl,
        userId: currentUserId // 🌟 传给后端鉴权
      });
      showToast('封面更新成功');
    } catch (err) {
      console.error("更新封面失败:", err);
      showToast("同步失败，请检查网络", "error");
    }
  };

  // [修改] 更新歌单名称 (带权限检查)
  const updatePlaylistName = async (playlistId, newName) => {
    if (!checkAuth() || !newName.trim()) return;
    const currentUserId = user?.id || user?._id;

    // 🌟 权限检查
    const targetPlaylist = playlists.find(pl => (pl.id || pl._id) === playlistId);
    if (targetPlaylist && targetPlaylist.userId !== currentUserId) {
      showToast("你没有权限修改此歌单名称", "error");
      return;
    }

    setPlaylists(prev => prev.map(pl => {
      if ((pl.id || pl._id) === playlistId) {
        return { ...pl, name: newName };
      }
      return pl;
    }));

    if (currentPlaylist && (currentPlaylist.id || currentPlaylist._id) === playlistId) {
      setCurrentPlaylist(prev => ({ ...prev, name: newName }));
    }

    showToast('正在更新名称...');

    try {
      await axios.put(`${API_URL}/playlists/${playlistId}`, {
        name: newName,
        userId: currentUserId // 🌟 传给后端鉴权
      });
      showToast('名称修改成功');
    } catch (err) {
      console.error("更新名称失败:", err);
      showToast("同步失败，请检查网络", "error");
    }
  };

  // [修改] 添加歌曲到歌单 (带权限检查)
  const addSongToPlaylist = async (playlistId, song) => {
    // 1. 登录检查
    if (!checkAuth()) return;
    const currentUserId = user?.id || user?._id;

    // 2. 找到歌单
    const targetPlaylist = playlists.find(pl => (pl.id || pl._id) === playlistId);
    if (!targetPlaylist) return;

    // 🌟 3. 权限检查：必须是自己的歌单
    if (targetPlaylist.userId !== currentUserId) {
      showToast('你只能修改自己的歌单', 'error');
      return;
    }

    // 4. 重复检查
    const songIdToCheck = song.id || song._id;
    const exists = targetPlaylist.songs.find(s => (s.id || s._id) === songIdToCheck);
    if (exists) {
      showToast('歌曲已存在于该歌单', 'error');
      return;
    } 
    
    const newSongs = [...targetPlaylist.songs, song];
    const newCover = newSongs.length === 1 ? song.cover : targetPlaylist.cover;

    // 5. 乐观更新
    setPlaylists(prev => prev.map(pl => {
      if ((pl.id || pl._id) === playlistId) {
        return { ...pl, songs: newSongs, cover: newCover };
      }
      return pl;
    }));

    closeAddToPlaylistModal();
    showToast('已添加到歌单');

    // 6. 发送请求 (带上 userId 供后端二次验证)
    try {
      await axios.put(`${API_URL}/playlists/${playlistId}`, {
        userId: currentUserId, 
        songs: newSongs,
        cover: newCover
      });
    } catch (err) {
      console.error("同步歌单失败:", err);
      showToast("同步失败", "error");
    }
  };

  // 导航与弹窗辅助
  const goToArtist = (artistName) => { setCurrentArtist(artistName); setCurrentPlaylist(null); setActiveTab('home'); };
  const openAddToPlaylistModal = (song) => { if (checkAuth()) setAddToPlaylistModal({ isOpen: true, song }); };
  const closeAddToPlaylistModal = () => { setAddToPlaylistModal({ isOpen: false, song: null }); };

  // 构造传递给组件的 currentSong 对象
  const contextCurrentSong = currentSong 
    ? { ...currentSong, lyrics: currentLyrics } 
    : null;

  return (
    <PlayerContext.Provider value={{
      // 数据
      allSongs, playlists,

      themeColor, changeThemeColor,
      
      // 播放状态
      currentSong: contextCurrentSong, 
      setCurrentSong, isPlaying, togglePlay, playSong, progress, setProgress, volume, setVolume, nextSong, prevSong, audioRef, queue, repeatMode, toggleRepeat,
      
      // 视图状态
      showLyrics, setShowLyrics, activeTab, setActiveTab, showCreateModal, setShowCreateModal,
      currentPlaylist, setCurrentPlaylist, currentArtist, setCurrentArtist, addToPlaylistModal, openAddToPlaylistModal, closeAddToPlaylistModal,
      
      // 用户操作
      likedSongs, toggleLike, followedArtists, toggleFollowArtist, 
      createPlaylist, deletePlaylist,updatePlaylistCover, updatePlaylistName,
      addSongToPlaylist,
      goToArtist, 
      
      // 认证
      user, login, register, logout, showAuthModal, setShowAuthModal,
      
      // 全局提示
      toast, showToast
    }}>
      {children}
      <audio 
        ref={audioRef} 
        src={currentSong?.url} 
        onTimeUpdate={handleTimeUpdate} 
        onEnded={() => nextSong(true)} 
      />
    </PlayerContext.Provider>
  );
};


const FollowedArtistsPage = () => {
  const { 
    followedArtists, 
    setCurrentArtist, 
    setActiveTab // 需要用这个跳转回主页视图来显示艺人详情
  } = useContext(PlayerContext);

  // 将 Set 转换为数组
  const artistsList = Array.from(followedArtists);

  // 辅助函数：获取艺人图片
  const getArtistImage = (artistName) => {
    // 1. 查独立配置表
    if (ARTIST_DATA[artistName]) return ARTIST_DATA[artistName];
    // 2. 查歌曲库找一张封面
    const song = MOCK_SONGS.find(s => s.artist === artistName);
    return song ? song.cover : '/images/default_artist.jpg';
  };

  const handleArtistClick = (artistName) => {
    setCurrentArtist(artistName);
    // 因为 ArtistPage 的渲染逻辑目前写在 HomePage 里，
    // 所以我们需要切回 'home' tab，HomePage 会检测 currentArtist 并显示详情页
    setActiveTab('home'); 
  };

  return (
    <div className="flex-1 bg-neutral-900 overflow-y-auto p-8 pb-32 no-scrollbar">
      <div className="flex items-end gap-6 mb-8">
        <div className="w-48 h-48 bg-neutral-800 shadow-2xl flex items-center justify-center text-white rounded-full border border-white/5">
          <Mic2 size={80} fill="currentColor" className="opacity-20 text-white" />
        </div>
        <div>
          <p className="text-xs font-bold uppercase text-white tracking-widest">媒体库</p>
          <h1 className="text-7xl font-black text-white mt-2 mb-4">关注的艺人</h1>
          <p className="text-neutral-400 font-medium">{artistsList.length} 位艺人</p>
        </div>
      </div>

      <div className="mt-8">
        {artistsList.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {artistsList.map((artistName, idx) => (
              <div 
                key={idx} 
                onClick={() => handleArtistClick(artistName)}
                className="bg-neutral-800/20 hover:bg-neutral-800/60 p-4 rounded-xl transition duration-300 group cursor-pointer"
              >
                <div className="relative mb-4 aspect-square overflow-hidden rounded-full shadow-lg border-2 border-transparent group-hover:border-white/10">
                  <img 
                    src={getArtistImage(artistName)} 
                    className="w-full h-full object-cover group-hover:scale-110 transition duration-500" 
                    alt={artistName} 
                  />
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
                </div>
                <div className="text-center">
                  <h3 className="font-bold text-white mb-1 truncate">{artistName}</h3>
                  <p className="text-neutral-500 text-sm">艺人</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-20 text-center">
            <Users size={48} className="mx-auto text-neutral-600 mb-4" />
            <p className="text-neutral-400 text-lg">你还没有关注任何艺人</p>
            <button 
              onClick={() => setActiveTab('search')}
              className="mt-4 px-6 py-2 bg-white text-black font-bold rounded-full hover:scale-105 transition"
            >
              去寻找艺人
            </button>
          </div>
        )}
      </div>
    </div>
  );
};



const Sidebar = () => {
  // 1. 引入 context 状态
  const { 
    activeTab, setActiveTab, likedSongs, setShowCreateModal, 
    setCurrentPlaylist, setCurrentArtist, playlists,
    user, deletePlaylist,
    themeColor, changeThemeColor 
  } = useContext(PlayerContext);
  
  const handleTabClick = (tabId) => {
    setActiveTab(tabId);
    setCurrentPlaylist(null);
    setCurrentArtist(null);
  };

  const handlePlaylistClick = (playlist) => {
    setCurrentPlaylist(playlist);
    setActiveTab('home');
    setCurrentArtist(null);
  };

  const menuItems = [
    { id: 'home', icon: Home, label: '首页' },
    { id: 'search', icon: Search, label: '搜索' },
    { id: 'artists', icon: Mic2, label: '关注的艺人' }, 
  ];

  // 🎨 主题选择组件
  const ThemeSelector = () => {
    const colors = [
      { name: 'Spotify绿', value: '#737373' },
      { name: '紫色', value: '#bd71ff' }, 
      { name: '天空蓝', value: '#3496ff' },
      { name: '明亮黄', value: '#27ffe2' },
      { name: '红色', value: '#ff2929' },
      { name: '红色', value: '#ff87d3' },
    ];

    return (
      <div className="mt-4 p-3 bg-white/5 backdrop-blur-md rounded-xl border border-white/10 shadow-lg">
        <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-3">界面配色</p>
        <div className="flex flex-wrap gap-2">
          {colors.map(c => (
            <button
              key={c.value}
              
              onClick={() =>{
                console.log("切换颜色为:", c.value);
                changeThemeColor(c.value)}}
              className={`w-5 h-5 rounded-full border-2 transition-all hover:scale-125 ${
                themeColor === c.value ? 'border-white scale-110' : 'border-transparent'
              }`}
              style={{ backgroundColor: c.value }}
              title={c.name}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div 
      className="w-64 h-screen p-6 pb-28 text-neutral-400 flex flex-col gap-6 hidden md:flex flex-shrink-0 border-r border-white/5 transition-all duration-1000 relative overflow-hidden"
      style={{
        // 🌟 核心：使用半透明背景 + 顶部微弱的主题色晕染
        background: `linear-gradient(to bottom, ${themeColor}30 0%, 0)`,
        backdropFilter: 'blur(20px)'
      }}
    >
      {/* 🌟 侧边栏专属背景发光点 */}
      <div 
        className="absolute -top-20 -left-20 w-40 h-40 blur-[80px] opacity-20 pointer-events-none rounded-full"
        style={{ backgroundColor: themeColor }}
      ></div>

      {/* Logo 区域 */}
      <div className="text-white font-bold text-2xl flex items-center gap-2 mb-4 cursor-pointer z-10" onClick={() => handleTabClick('home')}>
        <div 
          className="w-9 h-9 rounded-full flex items-center justify-center shadow-lg transition-all duration-500"
          style={{ backgroundColor: themeColor }}
        >
          <Play size={18} fill="black" className="text-black ml-0.5" />
        </div>
        <span className="tracking-tighter">MusicHub</span>
      </div>

      {/* 导航栏 */}
      <nav className="space-y-4 z-10">
        {menuItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <div 
              key={item.id}
              onClick={() => handleTabClick(item.id)}
              className={`flex items-center gap-4 cursor-pointer transition-all duration-300 font-medium ${isActive ? 'text-white scale-105' : 'hover:text-white hover:translate-x-1'}`}
              style={{ color: isActive ? themeColor : '' }} // 激活项文字同步主题色（可选）
            >
              <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} /> 
              <span className={isActive ? "text-white" : ""}>{item.label}</span>
            </div>
          );
        })}
      </nav>
      
      {/* 滚动区域 */}
      <div className="mt-4 flex-1 overflow-y-auto no-scrollbar space-y-4 z-10">
        <div className="sticky top-0 z-20 -mx-6 px-6"></div>


        
        <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 sticky top-0 bg-transparent py-2 backdrop-blur-sm z-20">
    你的资料库
  </p>
        
        <div 
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-4 hover:text-white cursor-pointer transition group text-sm"
        >
          <div className="p-1.5 bg-neutral-800 group-hover:bg-neutral-700 rounded-md text-white transition-all border border-white/5">
            <Plus size={16} strokeWidth={3} />
          </div>
          创建播放列表
        </div>

        <div 
          onClick={() => setActiveTab('liked')}
          className={`flex items-center gap-4 cursor-pointer transition group text-sm ${activeTab === 'liked' ? 'text-white' : 'hover:text-white'}`}
        >
          <div className="p-1.5 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-md text-white shadow-md">
            <Heart size={16} fill="white" />
          </div>
          已点赞 ({likedSongs.size})
        </div>

        {/* 歌单列表 */}
        <div className="border-t border-white/10 pt-4 mt-2 space-y-2">
          {playlists.map(playlist => {
            const isMine = playlist.userId === (user?.id || user?._id);
            return (
              <div 
                key={playlist.id || playlist._id}
                className="group flex items-center justify-between text-sm py-1 hover:text-white cursor-pointer transition-all rounded-md px-2 -mx-2 hover:bg-white/5"
              >
                <span className="truncate flex-1" onClick={() => handlePlaylistClick(playlist)}>
                  {playlist.name}
                </span>
                {isMine && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation(); 
                      deletePlaylist(playlist.id || playlist._id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-all"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 底部固定区域：主题选择器 */}
      <div className="mt-auto border-t border-white/10 pt-4 z-10">
        <ThemeSelector />
      </div>
    </div>
  );
};


const LikedSongsPage = () => {
  const { 
    allSongs, // <--- 改用 allSongs
    likedSongs, 
    playSong, 
    currentSong, 
    isPlaying, 
    toggleLike, 
    goToArtist,
    openAddToPlaylistModal 
  } = useContext(PlayerContext);

  // 根据 likedSongs (Set) 筛选出具体的歌曲对象
  // 增加 ?. 防止 allSongs 为空时报错
  const songs = (allSongs || []).filter(s => likedSongs.has(s.id));

  return (
    <div className="flex-1 bg-gradient-to-b from-neutral-800 to-black overflow-y-auto p-8 pb-32 no-scrollbar">
      {/* --- 顶部头部区域 --- */}
      <div className="flex flex-col md:flex-row items-end gap-6 mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
        <div className="w-52 h-52 bg-gradient-to-br from-indigo-500 to-purple-800 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center justify-center text-white rounded-md border border-white/5 shrink-0">
          <Heart size={80} fill="white" className="drop-shadow-lg" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-bold uppercase text-white tracking-widest mb-2">播放列表</p>
          <h1 className="text-5xl md:text-8xl font-black text-white mb-6 tracking-tight drop-shadow-lg">已点赞的歌曲</h1>
          <div className="flex items-center gap-2 text-sm text-neutral-300 font-medium">
            <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-black font-bold text-[10px]">U</div>
            <span className="text-white hover:underline cursor-pointer">User</span>
            <span>•</span>
            <span>{songs.length} 首歌曲</span>
          </div>
        </div>
      </div>

      <div className="mt-8">
        {/* --- 大播放按钮 --- */}
        <div className="flex items-center gap-6 mb-8">
           <button 
            disabled={songs.length === 0}
            onClick={() => songs.length > 0 && playSong(songs[0], songs)} // 传入点赞列表作为队列
            className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center text-black hover:scale-105 transition shadow-lg disabled:opacity-50 hover:bg-green-400"
          >
            <Play fill="black" size={24} className="ml-1 text-black" />
          </button>
        </div>

        {/* --- 表头 --- */}
        <div className="border-b border-white/5 mb-4 pb-2 grid grid-cols-[16px_1fr_auto] gap-4 px-4 text-[12px] text-neutral-400 font-medium uppercase tracking-widest sticky top-0 bg-neutral-900/90 backdrop-blur-sm z-10 py-2">
          <span className="text-center">#</span>
          <span>标题</span>
          <span className="flex justify-end"><Clock size={16} /></span>
        </div>

        {/* --- 歌曲列表 --- */}
        <div className="space-y-1">
          {songs.map((song, idx) => {
             // 判断当前行是否是正在播放的歌曲
             const isCurrent = currentSong && currentSong.id === song.id;

             return (
              <div 
                key={song.id}
                onClick={() => playSong(song, songs)} // 传入点赞列表作为队列
                className="grid grid-cols-[16px_1fr_auto] gap-4 items-center p-3 rounded-md hover:bg-white/10 transition-colors group cursor-pointer"
              >
                {/* 序号 / 播放动画 / 播放图标 */}
                <div className="flex justify-center items-center w-4">
                  {isCurrent && isPlaying ? (
                     <img src="https://open.spotifycdn.com/cdn/images/equaliser-animated-green.f93a2ef4.gif" className="h-4 w-4" alt="playing" />
                  ) : (
                    <>
                      <span className={`text-neutral-400 text-sm group-hover:hidden ${isCurrent ? 'text-green-500' : ''}`}>{idx + 1}</span>
                      <Play size={14} fill="white" className="text-white hidden group-hover:block" />
                    </>
                  )}
                </div>

                {/* 歌曲信息 */}
                <div className="flex items-center gap-4 overflow-hidden">
                  <img src={song.cover} className="w-10 h-10 rounded shadow-sm object-cover" alt="" />
                  <div className="truncate flex flex-col justify-center">
                    <div className={`text-base font-medium truncate mb-0.5 ${isCurrent ? 'text-green-500' : 'text-white'}`}>
                      {song.title}
                    </div>
                    {/* --- 艺人跳转 --- */}
                    <div 
                      className="text-sm text-neutral-400 truncate hover:text-white hover:underline cursor-pointer w-fit"
                      onClick={(e) => {
                        e.stopPropagation(); // 阻止冒泡，避免触发播放
                        goToArtist(song.artist);
                      }}
                    >
                      {song.artist}
                    </div>
                  </div>
                </div>

                {/* 右侧操作区：添加到歌单 + 爱心 + 时长 */}
                <div className="flex items-center gap-6 md:gap-8">
                  {/* 添加到歌单按钮 */}
                  <ListPlus 
                    size={18} 
                    className="text-neutral-500 hover:text-white cursor-pointer opacity-0 group-hover:opacity-100 transition-all"
                    onClick={(e) => {
                      e.stopPropagation();
                      openAddToPlaylistModal(song);
                    }}
                    title="添加到歌单"
                  />

                  <Heart 
                    size={18} 
                    className="text-green-500 hover:scale-110 active:scale-90 transition-transform cursor-pointer" 
                    fill="currentColor"
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      toggleLike(song.id); 
                    }}
                  />
                  <span className="text-sm text-neutral-400 w-10 text-right font-variant-numeric tabular-nums">
                    {Math.floor(song.duration / 60)}:{(song.duration % 60).toString().padStart(2, '0')}
                  </span>
                </div>
              </div>
            );
          })}
          
          {/* 空状态 */}
          {songs.length === 0 && (
            <div className="py-20 text-center text-neutral-500 italic">
              <p>你还没有点赞任何歌曲。</p>
              <p className="text-sm mt-2">去发现页寻找你喜欢的音乐吧！</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const CreatePlaylistModal = () => {
  const { setShowCreateModal, createPlaylist } = useContext(PlayerContext);
  const [inputName, setInputName] = useState('');
  const [inputCover, setInputCover] = useState(''); // 新增：封面状态

  const handleCreate = () => {
    if (!inputName.trim()) return;
    createPlaylist(inputName, inputCover); // 传入封面
    setShowCreateModal(false);
    setInputName('');
    setInputCover('');
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-neutral-900 w-full max-w-md rounded-xl p-8 border border-white/5 shadow-2xl transform transition-all scale-100">
        <h2 className="text-2xl font-bold text-white mb-6 text-center">创建新的播放列表</h2>
        <div className="space-y-4">
          
          {/* 歌单名称输入 */}
          <div>
            <label className="text-xs font-bold text-neutral-500 uppercase mb-2 block">列表名称</label>
            <input 
              type="text" 
              placeholder="我的酷炫播放列表"
              value={inputName}
              onChange={(e) => setInputName(e.target.value)}
              autoFocus
              className="w-full bg-neutral-800 p-3 rounded-md text-white outline-none focus:ring-2 ring-green-500 transition-all"
            />
          </div>

          {/* 封面 URL 输入 */}
          <div>
            <label className="text-xs font-bold text-neutral-500 uppercase mb-2 block">封面图片链接 (URL)</label>
            <input 
              type="text" 
              placeholder="https://example.com/image.jpg"
              value={inputCover}
              onChange={(e) => setInputCover(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              className="w-full bg-neutral-800 p-3 rounded-md text-white outline-none focus:ring-2 ring-green-500 transition-all text-sm"
            />
            {/* 图片预览 */}
            {inputCover && (
              <div className="mt-2 w-full h-32 rounded-md overflow-hidden bg-neutral-800 border border-white/10">
                <img src={inputCover} alt="预览" className="w-full h-full object-cover" onError={(e) => e.target.style.display='none'} />
              </div>
            )}
          </div>

          <div className="flex gap-4 pt-4">
            <button 
              onClick={() => setShowCreateModal(false)}
              className="flex-1 py-3 text-white font-bold hover:text-neutral-300 transition"
            >
              取消
            </button>
            <button 
              onClick={handleCreate}
              disabled={!inputName.trim()}
              className="flex-1 bg-green-500 py-3 rounded-full text-black font-bold hover:scale-105 transition disabled:opacity-50"
            >
              创建
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const AuthModal = () => {
  // 1. 从 Context 获取必要的方法和状态
  const { 
    showAuthModal, 
    setShowAuthModal, 
    login, 
    register, 
    showToast // 引入全局提示
  } = useContext(PlayerContext);

  // 2. 本地状态管理
  const [isLoginView, setIsLoginView] = useState(true); // true: 登录模式, false: 注册模式
  const [formData, setFormData] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false); // 防止重复点击

  // 如果弹窗没开启，不渲染任何内容
  if (!showAuthModal) return null;

  // 3. 处理表单提交
  const handleSubmit = async () => {
    setError(''); // 清空旧错误

    // 基础校验
    if (!formData.email || !formData.password) {
      setError('请填写完整信息');
      return;
    }
    if (!isLoginView && !formData.username) {
      setError('请输入用户名');
      return;
    }

    setIsLoading(true); // 开始加载
    let result;

    try {
      if (isLoginView) {
        // --- 登录逻辑 ---
        result = await login(formData.email, formData.password);
      } else {
        // --- 注册逻辑 ---
        result = await register(formData.email, formData.password, formData.username);
      }

      if (result.success) {
        // 成功：关闭弹窗、清空表单、显示成功提示
        setShowAuthModal(false);
        setFormData({ username: '', email: '', password: '' });
        
        // 使用全局提示
        showToast(
          isLoginView 
            ? `欢迎回来，${result.user?.username || '朋友'}！` 
            : '注册成功，已自动登录！'
        );
      } else {
        // 失败：显示后端返回的错误信息
        setError(result.message || '操作失败，请重试');
      }
    } catch (err) {
      setError('网络请求发生错误');
    } finally {
      setIsLoading(false); // 结束加载
    }
  };

  // 4. 切换模式时重置错误信息
  const toggleView = () => {
    setIsLoginView(!isLoginView);
    setError('');
  };

  return (
    // 背景遮罩 (点击背景关闭)
    <div 
      className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={() => setShowAuthModal(false)}
    >
      {/* 弹窗主体 (阻止冒泡，防止点击主体关闭弹窗) */}
      <div 
        className="bg-neutral-900 w-full max-w-md rounded-xl p-8 border border-white/5 shadow-2xl relative transform transition-all scale-100"
        onClick={(e) => e.stopPropagation()} 
      >
        {/* 关闭按钮 */}
        <button 
          onClick={() => setShowAuthModal(false)}
          className="absolute top-4 right-4 text-neutral-500 hover:text-white transition-colors"
        >
          <X size={24} />
        </button>

        {/* 标题区 */}
        <h2 className="text-3xl font-bold text-white mb-2 text-center">
          {isLoginView ? '欢迎回来' : '创建账号'}
        </h2>
        <p className="text-neutral-400 text-center mb-8 text-sm">
          {isLoginView ? '登录以访问你的歌单和收藏' : '加入 MusicHub 开启音乐之旅'}
        </p>

        {/* 表单区 */}
        <div className="space-y-4">
          
          {/* 用户名输入框 (仅注册显示) */}
          {!isLoginView && (
            <div className="animate-in slide-in-from-top-2 duration-300">
              <label className="text-xs font-bold text-neutral-500 uppercase mb-2 block">用户名</label>
              <input 
                type="text" 
                className="w-full bg-neutral-800 p-3 rounded-md text-white outline-none focus:ring-1 focus:ring-green-500 transition-all border border-transparent focus:border-green-500/50"
                placeholder="给起个好听的名字"
                value={formData.username}
                onChange={e => setFormData({...formData, username: e.target.value})}
                autoFocus={!isLoginView} // 注册模式自动聚焦
              />
            </div>
          )}
          
          {/* 邮箱输入框 */}
          <div>
            <label className="text-xs font-bold text-neutral-500 uppercase mb-2 block">电子邮箱</label>
            <input 
              type="email" 
              className="w-full bg-neutral-800 p-3 rounded-md text-white outline-none focus:ring-1 focus:ring-green-500 transition-all border border-transparent focus:border-green-500/50"
              placeholder="name@example.com"
              value={formData.email}
              onChange={e => setFormData({...formData, email: e.target.value})}
              autoFocus={isLoginView} // 登录模式自动聚焦
            />
          </div>

          {/* 密码输入框 */}
          <div>
            <label className="text-xs font-bold text-neutral-500 uppercase mb-2 block">密码</label>
            <input 
              type="password" 
              className="w-full bg-neutral-800 p-3 rounded-md text-white outline-none focus:ring-1 focus:ring-green-500 transition-all border border-transparent focus:border-green-500/50"
              placeholder="••••••••"
              value={formData.password}
              onChange={e => setFormData({...formData, password: e.target.value})}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()} // 回车提交
            />
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 p-2 rounded text-center animate-in shake duration-300">
               <p className="text-red-500 text-xs font-bold">{error}</p>
            </div>
          )}

          {/* 提交按钮 */}
          <button 
            onClick={handleSubmit}
            disabled={isLoading}
            className="w-full bg-green-500 py-3 rounded-full text-black font-bold hover:scale-105 active:scale-95 transition-all mt-4 disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
               // 简单的加载动画圆圈
               <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
            ) : (
               isLoginView ? '登 录' : '注 册'
            )}
          </button>

          {/* 切换模式链接 */}
          <p className="text-center text-neutral-400 text-sm mt-4 select-none">
            {isLoginView ? '还没有账号？' : '已有账号？'}
            <span 
              onClick={toggleView}
              className="text-white font-bold cursor-pointer hover:underline hover:text-green-400 ml-2 transition-colors"
            >
              {isLoginView ? '免费注册' : '直接登录'}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};

const SearchPage = () => {
  const [query, setQuery] = useState('');
  const { 
    allSongs, // <--- 改用从后端获取的 allSongs
    playSong, 
    currentSong, 
    isPlaying, 
    likedSongs, 
    toggleLike, 
    goToArtist,
    openAddToPlaylistModal 
  } = useContext(PlayerContext);

  // 过滤逻辑：匹配标题或艺人名（不区分大小写）
  // 增加 ?. 防止数据未加载时报错
  const filteredSongs = (allSongs || []).filter(song => 
    song.title.toLowerCase().includes(query.toLowerCase()) || 
    song.artist.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="flex-1 p-8 overflow-y-auto no-scrollbar bg-neutral-900 pb-32">
      {/* --- 搜索输入框区域 --- */}
      <div className="max-w-xl relative mb-10 sticky top-0 z-20">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" size={20} />
        <input 
          type="text"
          placeholder="你想听什么？"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-neutral-800 text-white pl-12 pr-10 py-3.5 rounded-full outline-none focus:bg-neutral-700 focus:ring-2 focus:ring-white/20 transition-all border border-transparent placeholder:text-neutral-500 font-medium shadow-lg"
          autoFocus
        />
        {query && (
          <X 
            className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 cursor-pointer hover:text-white transition-colors" 
            size={20} 
            onClick={() => setQuery('')} 
          />
        )}
      </div>

      {/* --- 搜索结果 --- */}
      <h2 className="text-2xl font-bold text-white mb-6 animate-in fade-in duration-500">
        {query ? `"${query}" 的搜索结果` : '浏览全部歌曲'}
      </h2>

      <div className="space-y-2">
        {filteredSongs.length > 0 ? (
          filteredSongs.map((song, idx) => {
            const isCurrent = currentSong && currentSong.id === song.id;
            
            return (
              <div 
                key={song.id}
                onClick={() => playSong(song, filteredSongs)} // 传入搜索结果作为播放队列
                className="flex items-center justify-between p-3 rounded-md hover:bg-white/10 transition-colors group cursor-pointer animate-in slide-in-from-bottom-2 duration-300"
                style={{ animationDelay: `${idx * 50}ms`, animationFillMode: 'backwards' }}
              >
                {/* 左侧：序号/状态 + 封面 + 信息 */}
                <div className="flex items-center gap-4 overflow-hidden flex-1">
                  
                  {/* 序号或播放图标 */}
                  <div className="w-8 flex justify-center flex-shrink-0">
                    {isCurrent && isPlaying ? (
                       <img src="https://open.spotifycdn.com/cdn/images/equaliser-animated-green.f93a2ef4.gif" className="h-4 w-4" alt="playing"/>
                    ) : (
                      <span className="text-neutral-500 text-center w-full group-hover:hidden font-medium text-sm">{idx + 1}</span>
                    )}
                    <Play size={16} fill="white" className="hidden group-hover:block text-white" />
                  </div>

                  {/* 封面图 */}
                  <img src={song.cover} className="w-10 h-10 rounded object-cover shadow-sm flex-shrink-0" alt="cover" />
                  
                  {/* 文本信息 */}
                  <div className="truncate flex flex-col justify-center">
                    <div className={`text-base font-medium truncate mb-0.5 ${isCurrent ? 'text-green-500' : 'text-white'}`}>
                      {song.title}
                    </div>
                    
                    {/* --- 艺人名跳转 --- */}
                    <div 
                      className="text-sm text-neutral-400 truncate hover:text-white hover:underline cursor-pointer w-fit transition-colors"
                      onClick={(e) => {
                        e.stopPropagation(); // 阻止冒泡
                        goToArtist(song.artist);
                      }}
                    >
                      {song.artist}
                    </div>
                  </div>
                </div>

                {/* 右侧：添加到歌单 + 爱心 + 时长 */}
                <div className="flex items-center gap-6 pl-4">
                  {/* 添加到歌单按钮 */}
                  <ListPlus 
                    size={18} 
                    className="text-neutral-500 hover:text-white cursor-pointer opacity-0 group-hover:opacity-100 transition-all"
                    onClick={(e) => {
                      e.stopPropagation();
                      openAddToPlaylistModal(song);
                    }}
                    title="添加到歌单"
                  />

                  <Heart 
                    size={18} 
                    className={`transition-all active:scale-90 cursor-pointer ${likedSongs.has(song.id) ? 'text-green-500 opacity-100' : 'text-neutral-500 opacity-0 group-hover:opacity-100 hover:text-white'}`}
                    fill={likedSongs.has(song.id) ? "currentColor" : "none"}
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      toggleLike(song.id); 
                    }}
                  />
                  <div className="text-xs text-neutral-400 w-10 text-right font-variant-numeric tabular-nums">
                    {Math.floor(song.duration / 60)}:{(song.duration % 60).toString().padStart(2, '0')}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          /* 空状态提示 */
          <div className="flex flex-col items-center justify-center py-20 text-neutral-500 animate-in fade-in zoom-in-95 duration-500">
            <Search size={48} className="mb-4 opacity-50" />
            <p className="text-lg font-medium">未能找到匹配 "{query}" 的歌曲</p>
            <p className="text-sm mt-2">请尝试搜索其他关键词或艺人名称。</p>
          </div>
        )}
      </div>
    </div>
  );
};

const LyricsPage = () => {
  const { currentSong, progress, setShowLyrics, isPlaying, likedSongs, toggleLike } = useContext(PlayerContext);
  const activeLyricRef = useRef(null);

  const activeLyricIndex = currentSong.lyrics?.findIndex((l, i) => {
    const next = currentSong.lyrics[i + 1];
    return progress >= l.time && (!next || progress < next.time);
  }) ?? -1;

  useEffect(() => {
    if (activeLyricRef.current) {
      activeLyricRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeLyricIndex]);

  return (
    // 🌟 移除 bg-black，改为深灰背景兜底，避免加载瞬间太黑
    <div className="fixed inset-0 z-[70] animate-in slide-in-from-bottom duration-500 flex flex-col items-center overflow-hidden bg-[#121212]">
      
      <style>{`
        @keyframes blobBounce {
          0% { transform: scale(1.2) translate(0, 0); }
          50% { transform: scale(1.3) translate(5%, 5%); }
          100% { transform: scale(1.2) translate(0, 0); }
        }
        @keyframes slowSpin {
          0% { transform: rotate(0deg) scale(1.4); }
          100% { transform: rotate(360deg) scale(1.4); }
        }
        .mask-image-linear {
           mask-image: linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%);
           -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%);
        }
      `}</style>

      {/* 🌟 动态背景层 - 鲜艳版 */}
      
      {/* 1. 主色调层：高饱和度、高亮度、较低模糊度（保留更多色块细节） */}
      <div className="absolute inset-0 -z-20 overflow-hidden pointer-events-none">
        <img 
          src={currentSong.cover} 
          // saturate-200: 2倍饱和度 | brightness-125: 提升亮度 | opacity-80: 高不透明度
          className="w-full h-full object-cover blur-[50px] opacity-80 scale-150 saturate-200 brightness-125 animate-[slowSpin_60s_linear_infinite]"
          alt=""
        />
      </div>

      {/* 2. 氛围层：叠加模式，增加层次感 */}
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none mix-blend-screen"> 
        {/* mix-blend-screen 让亮色更亮，适合艳丽风格 */}
        <img 
          src={currentSong.cover} 
          className="w-full h-full object-cover blur-[80px] opacity-50 scale-150 saturate-150 animate-[blobBounce_20s_ease-in-out_infinite]"
          alt=""
        />
      </div>

      {/* 🌟 3. 遮罩层：大幅减弱黑色，只保留必要的文字衬托 */}
      {/* 全局仅加 10% 的黑，避免颜色脏掉 */}
      <div className="absolute inset-0 -z-5 bg-black/10 backdrop-blur-[1px]" />
      
      {/* 仅在底部和顶部加渐变，中间保持通透 */}
      <div className="absolute inset-0 -z-5 bg-gradient-to-b from-black/30 via-transparent to-black/60 pointer-events-none" />


      {/* --- UI 内容 --- */}

      {/* 关闭按钮 */}
      <button 
        onClick={() => setShowLyrics(false)} 
        // 按钮背景改淡，适应艳丽背景
        className="absolute top-6 left-6 md:top-8 md:left-8 text-white hover:text-white transition z-20 p-2 bg-black/10 hover:bg-black/30 rounded-full backdrop-blur-md border border-white/10"
      >
        <ChevronDown size={32} />
      </button>

      <div className="flex flex-col md:flex-row w-full max-w-6xl h-full items-center gap-6 md:gap-12 pt-16 md:pt-20 relative px-6 md:px-0">
        
        {/* 左侧 */}
        <div className="w-full md:w-1/2 flex flex-col items-center gap-6 md:gap-8 shrink-0">
          <div className="relative group">
            <img 
              src={currentSong.cover} 
              className={`relative z-10 w-48 h-48 md:w-96 md:h-96 rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.5)] transition-transform duration-1000 border border-white/10 object-cover ${isPlaying ? 'scale-105' : 'scale-100'}`} 
              alt="cover" 
            />
          </div>

          <div className="flex items-center justify-between w-full max-w-xs md:max-w-sm relative z-10">
            <div className="flex-1 min-w-0 text-center md:text-left">
              {/* 增加文字阴影，防止在亮背景下看不清 */}
              <h2 className="text-2xl md:text-3xl font-bold text-white truncate px-2 drop-shadow-md shadow-black/50">{currentSong.title}</h2>
              <p className="text-lg md:text-xl text-white/90 truncate px-2 font-medium drop-shadow-md shadow-black/50">{currentSong.artist}</p>
            </div>
            
            <Heart 
              size={28} 
              className={`cursor-pointer transition-all active:scale-125 flex-shrink-0 drop-shadow-md ${likedSongs.has(currentSong.id) ? 'text-green-400' : 'text-white/60 hover:text-white'}`}
              fill={likedSongs.has(currentSong.id) ? "currentColor" : "none"}
              onClick={() => toggleLike(currentSong.id)}
            />
          </div>
        </div>
        
        {/* 右侧 */}
        <div className="w-full md:w-1/2 flex flex-col items-center md:items-start h-full overflow-y-auto no-scrollbar scroll-smooth relative z-10 mask-image-linear">
          <div className="space-y-6 md:space-y-10 pb-32 md:pb-40 pt-20 md:pt-40 text-center md:text-left w-full px-4">
            {currentSong.lyrics?.map((line, idx) => (
              <p 
                key={idx} 
                ref={idx === activeLyricIndex ? activeLyricRef : null}
                // 增加 drop-shadow 确保白色文字在浅色背景上也清晰
                className={`transition-all duration-700 font-bold cursor-default origin-center md:origin-left drop-shadow-md ${
                  idx === activeLyricIndex 
                    ? 'text-white scale-110 md:scale-105 text-xl md:text-4xl opacity-100' 
                    : 'text-white/50 hover:text-white/80 scale-100 text-lg md:text-3xl blur-[0.5px]'
                }`}
              >
                {line.text}
              </p>
            )) || <p className="text-white/60 mt-20 text-xl drop-shadow-md">纯音乐 / 暂无歌词</p>}
          </div>
        </div>

      </div>
    </div>
  );
};
// [新增] 移动端底部导航栏
const MobileNav = () => {
  const { activeTab, setActiveTab, themeColor } = useContext(PlayerContext);

  const navItems = [
    { id: 'home', icon: Home, label: '首页' },
    { id: 'search', icon: Search, label: '搜索' },
    { id: 'artists', icon: Library, label: '媒体库' }, // 对应原来的“关注的艺人”或其他库
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-neutral-900/95 backdrop-blur-xl border-t border-white/5 pb-safe z-[60] flex justify-around items-center h-16">
      {navItems.map((item) => {
        const isActive = activeTab === item.id;
        return (
          <div 
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className="flex flex-col items-center justify-center w-full h-full gap-1 active:scale-90 transition-transform cursor-pointer"
            style={{ color: isActive ? themeColor : '#737373' }}
          >
            <item.icon size={24} strokeWidth={isActive ? 2.5 : 2} />
            <span className="text-[10px] font-medium">{item.label}</span>
          </div>
        );
      })}
    </div>
  );
};

const PlayerBar = () => {
  const { 
    currentSong, isPlaying, togglePlay, progress, setProgress, 
    volume, setVolume, nextSong, prevSong, audioRef, setShowLyrics,
    likedSongs, toggleLike, goToArtist, repeatMode, toggleRepeat,
    themeColor 
  } = useContext(PlayerContext);

  const formatTime = (time) => {
    if (!time || isNaN(time)) return "0:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleProgressChange = (e) => {
    const newTime = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
    setProgress(newTime);
  };

  if (!currentSong) return null;

  return (
    <div 
      className="fixed bottom-[64px] md:bottom-0 left-2 right-2 md:left-0 md:right-0 h-14 md:h-24 px-4 md:px-6 flex items-center justify-between z-50 transition-all duration-500 rounded-xl md:rounded-none overflow-hidden md:overflow-visible"
      style={{
        background: `linear-gradient(to right, ${themeColor}22 0%, #1a1a1ae6 100%)`,
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.05)',
        boxShadow: '0 4px 30px rgba(0, 0, 0, 0.3)'
      }}
      // 手机端点击整体打开歌词页
      onClick={(e) => {
        if (window.innerWidth < 768) setShowLyrics(true);
      }}
    >
      {/* 手机端顶部极细进度条 */}
      <div className="absolute top-0 left-0 h-[2px] bg-white/10 w-full md:hidden">
         <div 
           className="h-full transition-all duration-300" 
           style={{ width: `${(progress / currentSong.duration) * 100}%`, backgroundColor: themeColor }}
         />
      </div>

      {/* --- 左侧：歌曲信息 --- */}
      <div className="flex items-center gap-3 md:gap-4 flex-1 md:w-1/3 min-w-0">
        <div 
           className="relative flex-shrink-0 cursor-pointer transition hover:scale-110 active:scale-95" 
           onClick={(e) => { e.stopPropagation(); setShowLyrics(true); }}
        >
          <img 
            src={currentSong.cover} 
            className="w-10 h-10 md:w-14 md:h-14 rounded-md md:rounded-lg shadow-2xl object-cover border border-white/10 animate-[spin_10s_linear_infinite] md:animate-none" 
            style={{ animationPlayState: isPlaying ? 'running' : 'paused' }} 
            alt="thumb" 
          />
        </div>
        
        <div className="overflow-hidden flex-1">
          {/* 歌名：点击打开歌词 */}
          <div 
            className="text-white text-sm font-bold truncate cursor-pointer hover:underline"
            style={{ color: isPlaying ? 'white' : '#ffffffcc' }}
            onClick={(e) => { e.stopPropagation(); setShowLyrics(true); }}
          >
            {currentSong.title}
          </div>
          
          {/* 🌟 优化点 1：艺人名跳转 */}
          <div 
            className="text-white/60 text-xs truncate cursor-pointer hover:text-white hover:underline transition-colors w-fit"
            onClick={(e) => {
              e.stopPropagation(); // 阻止冒泡，防止触发手机端打开歌词页
              goToArtist(currentSong.artist);
            }}
          >
            {currentSong.artist}
          </div>
        </div>

        {/* 手机端爱心 */}
        <Heart 
          size={20} 
          className={`md:hidden flex-shrink-0 active:scale-125 transition-transform ${likedSongs.has(currentSong.id) ? '' : 'text-white/40'}`}
          fill={likedSongs.has(currentSong.id) ? themeColor : "none"}
          style={{ color: likedSongs.has(currentSong.id) ? themeColor : '' }}
          onClick={(e) => { e.stopPropagation(); toggleLike(currentSong.id); }}
        />
      </div>

      {/* --- 中间：播放控制 --- */}
      <div className="flex flex-col items-center md:w-1/3 gap-3 z-10 flex-shrink-0 ml-2 md:ml-0">
        <div className="flex items-center gap-4 md:gap-8 text-neutral-400">
          
          {/* 桌面端控件 */}
          <Shuffle size={18} className="hidden md:block cursor-pointer hover:text-white transition-colors" />
          <SkipBack size={24} className="hidden md:block cursor-pointer hover:text-white transition-colors active:scale-75" onClick={prevSong} />
          
          {/* 播放/暂停 */}
          <button 
            onClick={(e) => { e.stopPropagation(); togglePlay(); }}
            className="w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center bg-white text-black hover:scale-110 transition shadow-lg active:scale-90"
          >
            {isPlaying ? (
              <Pause size={18} className="md:w-[22px] md:h-[22px]" fill="black" />
            ) : (
              <Play size={18} className="ml-0.5 md:w-[22px] md:h-[22px]" fill="black" />
            )}
          </button>
          
          {/* 桌面端控件 */}
          <SkipForward size={24} className="hidden md:block cursor-pointer hover:text-white transition-colors active:scale-75" onClick={() => nextSong(false)} />
          
          {/* 🌟 优化点 2：循环按钮交互优化 */}
          <button 
            onClick={toggleRepeat} 
            className={`hidden md:flex relative items-center justify-center w-8 h-8 rounded-full transition-all active:scale-90 ${repeatMode !== 'off' ? '' : 'hover:bg-white/10 hover:text-white'}`}
            style={{ color: repeatMode !== 'off' ? themeColor : '' }}
            title={repeatMode === 'one' ? '单曲循环' : repeatMode === 'all' ? '列表循环' : '不循环'}
          >
             {/* 根据模式切换图标: 单曲显示 Repeat1，列表显示 Repeat */}
             {repeatMode === 'one' ? <Repeat1 size={20} /> : <Repeat size={20} />}
             
             {/* 激活状态下显示底部小圆点 */}
             {repeatMode !== 'off' && (
               <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-current shadow-[0_0_5px_currentColor]" />
             )}
          </button>

        </div>
        
        {/* 桌面端进度条 */}
        <div className="hidden md:flex w-full items-center gap-3 text-[11px] text-neutral-500 font-bold">
          <span className="w-10 text-right tabular-nums">{formatTime(progress)}</span>
          <div className="relative flex-1 flex items-center group">
            <input 
              type="range" min="0" max={currentSong.duration || 100} step="0.1" value={progress} onChange={handleProgressChange} 
              className="w-full h-1 rounded-lg cursor-pointer bg-white/10 appearance-none hover:bg-white/20 transition-all" 
              style={{ accentColor: themeColor }}
            />
          </div>
          <span className="w-10 text-left tabular-nums">{formatTime(currentSong.duration)}</span>
        </div>
      </div>

      {/* --- 右侧：音量与扩展 (仅桌面端) --- */}
      <div className="hidden md:flex items-center gap-5 w-1/3 justify-end text-neutral-400 z-10">
        <Heart 
          size={18} 
          fill={likedSongs.has(currentSong.id) ? themeColor : "none"}
          style={{ color: likedSongs.has(currentSong.id) ? themeColor : '' }}
          onClick={() => toggleLike(currentSong.id)}
          className="cursor-pointer active:scale-125 transition-transform hover:text-white"
        />
        <Maximize2 size={18} className="hover:text-white cursor-pointer hover:scale-110 transition" onClick={() => setShowLyrics(true)} />
        <div className="flex items-center gap-3 bg-white/5 px-3 py-2 rounded-full border border-white/5 hover:bg-white/10 transition">
          <Volume2 size={18} />
          <input 
            type="range" min="0" max="1" step="0.01" value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))} 
            className="w-24 h-1 rounded-lg cursor-pointer bg-white/10 appearance-none" 
            style={{ accentColor: themeColor }}
          />
        </div>
      </div>
    </div>
  );
};

const PlaylistDetail = ({ playlist }) => {
  const { 
    playSong, 
    currentSong, 
    isPlaying, 
    setCurrentPlaylist, 
    goToArtist, 
    updatePlaylistCover, 
    updatePlaylistName,
    user // 1. 获取当前用户
  } = useContext(PlayerContext);
  
  // 2. 判断是否是歌单的主人 (兼容 id 和 _id)
  const isOwner = user && (user.id === playlist.userId || user._id === playlist.userId);

  // 处理点击封面更换图片
  const handleCoverClick = () => {
    if (!isOwner) return; // 非主人禁止点击

    const newCover = prompt("请输入新的封面图片 URL:", playlist.cover);
    if (newCover && newCover !== playlist.cover) {
      updatePlaylistCover(playlist.id || playlist._id, newCover);
    }
  };

  // 处理点击标题修改名称
  const handleNameClick = () => {
    if (!isOwner) return; // 非主人禁止点击

    const newName = prompt("请输入新的歌单名称:", playlist.name);
    if (newName && newName.trim() !== "" && newName !== playlist.name) {
      updatePlaylistName(playlist.id || playlist._id, newName);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-top-4 duration-500 pb-20 md:pb-0">
      {/* --- 顶部导航 --- */}
      <button 
        onClick={() => setCurrentPlaylist(null)} 
        className="flex items-center gap-2 text-neutral-400 hover:text-white mb-6 transition group font-bold text-sm"
      >
        <div className="p-1 rounded-full bg-neutral-800 group-hover:bg-neutral-700 transition">
          <ArrowLeft size={20} />
        </div>
        返回
      </button>
      
      {/* --- 歌单头部信息区 (响应式布局) --- */}
      {/* 手机: 垂直排列居中; 桌面: 水平排列底部对齐 */}
      <div className="flex flex-col md:flex-row items-center md:items-end gap-6 md:gap-8 mb-8">
        
        {/* 封面图 (只有主人可以点击修改) */}
        <div 
          onClick={isOwner ? handleCoverClick : undefined}
          // 手机 w-48, 桌面 w-60
          className={`w-48 h-48 md:w-60 md:h-60 shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-lg overflow-hidden shrink-0 group relative ${isOwner ? 'cursor-pointer' : ''}`}
          title={isOwner ? "点击更换封面" : ""}
        >
          <img 
            src={playlist.cover} 
            className={`w-full h-full object-cover transition duration-500 ${isOwner ? 'group-hover:scale-105' : ''}`}
            alt={playlist.name} 
          />
          
          {/* 只有主人才显示“更换封面”遮罩 */}
          {isOwner && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <span className="text-white font-bold text-sm border border-white px-3 py-1 rounded-full hover:bg-white hover:text-black transition">
                更换封面
              </span>
            </div>
          )}
        </div>

        {/* 文字信息 */}
        <div className="flex-1 w-full text-center md:text-left">
          <p className="hidden md:block text-xs font-bold uppercase tracking-wider mb-2 text-white">歌单</p>
          
          {/* 标题区域：只有主人可以 hover 和点击修改 */}
          <div className="group w-full flex justify-center md:justify-start">
            <h1 
              onClick={isOwner ? handleNameClick : undefined}
              // 手机 text-3xl, 桌面 text-7xl
              className={`text-3xl md:text-7xl font-black mb-4 md:mb-6 tracking-tight text-white drop-shadow-md transition-all ${
                isOwner 
                  ? 'cursor-pointer hover:underline decoration-4 decoration-green-500 underline-offset-8' 
                  : 'cursor-default'
              }`}
              title={isOwner ? "点击修改名称" : ""}
            >
              {playlist.name}
              
              {/* 只有主人才显示编辑小图标 */}
              {isOwner && (
                <span className="inline-block ml-4 opacity-0 group-hover:opacity-100 transition-opacity align-middle">
                   <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400 w-5 h-5 md:w-6 md:h-6"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                </span>
              )}
            </h1>
          </div>

          <div className="flex flex-col gap-2 items-center md:items-start">
            <p className="text-neutral-300 text-sm font-medium opacity-80 line-clamp-2 max-w-lg">
              {playlist.description}
            </p>
            <p className="text-white text-sm font-bold mt-1">
              MusicHub • <span className="font-normal text-neutral-300">{playlist.songs.length} 首歌曲</span>
            </p>
          </div>
        </div>
      </div>

      {/* --- 歌曲列表区 --- */}
      <div className="bg-black/20 backdrop-blur-sm rounded-xl p-0 md:p-6 min-h-[400px]">
        {/* 表头: 手机隐藏专辑列 */}
        <div className="grid grid-cols-[30px_1fr_40px] md:grid-cols-[30px_1fr_1fr_40px] gap-4 px-4 py-3 border-b border-white/10 text-neutral-400 text-xs font-bold uppercase tracking-widest mb-2 sticky top-0 bg-neutral-900/50 backdrop-blur-md z-10">
          <span className="text-center">#</span>
          <span>标题</span>
          <span className="hidden md:block">专辑</span>
          <span className="flex justify-end"><Clock size={16} /></span>
        </div>

        <div className="space-y-1">
          {playlist.songs.map((song, index) => {
            const isCurrent = currentSong && currentSong.id === song.id;
            return (
              <div 
                key={song.id} 
                onClick={() => playSong(song, playlist.songs)} 
                className="grid grid-cols-[30px_1fr_40px] md:grid-cols-[30px_1fr_1fr_40px] gap-4 px-4 py-3 rounded-md hover:bg-white/10 transition group cursor-pointer items-center"
              >
                <span className={`text-sm flex justify-center items-center ${isCurrent ? 'text-green-500' : 'text-neutral-400'}`}>
                  {isCurrent && isPlaying ? (
                    <div className="flex gap-0.5 items-end h-3 w-3 mb-1">
                      <div className="w-1 bg-green-500 animate-[bounce_0.6s_infinite]"></div>
                      <div className="w-1 bg-green-500 animate-[bounce_0.8s_infinite] animation-delay-75"></div>
                      <div className="w-1 bg-green-500 animate-[bounce_1s_infinite] animation-delay-150"></div>
                    </div>
                  ) : (
                    <>
                      <span className="group-hover:hidden">{index + 1}</span>
                      <Play size={12} fill="white" className="hidden group-hover:block text-white" />
                    </>
                  )}
                </span>

                <div className="flex items-center gap-4 overflow-hidden">
                  <img src={song.cover} className="w-10 h-10 rounded shadow-sm object-cover" alt="" />
                  <div className="truncate flex flex-col justify-center">
                    <div className={`font-bold truncate text-base mb-0.5 ${isCurrent ? 'text-green-500' : 'text-white'}`}>
                      {song.title}
                    </div>
                    <div 
                      className="text-xs text-neutral-400 truncate hover:text-white hover:underline cursor-pointer w-fit transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        goToArtist(song.artist);
                      }}
                    >
                      {song.artist}
                    </div>
                  </div>
                </div>
                {/* 专辑信息在手机端隐藏 */}
                <span className="text-sm text-neutral-400 hidden md:block truncate hover:text-white transition-colors cursor-default">
                  {song.album}
                </span>
                <span className="text-sm text-neutral-400 font-variant-numeric tabular-nums text-right">
                  {Math.floor(song.duration / 60)}:{(song.duration % 60).toString().padStart(2, '0')}
                </span>
              </div>
            );
          })}
          
          {playlist.songs.length === 0 && (
            <div className="py-20 text-center text-neutral-500 italic">
              歌单为空，去添加歌曲吧！
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ArtistPage = () => {
  const { 
    allSongs, 
    currentArtist, 
    setCurrentArtist, 
    playSong, 
    currentSong, 
    isPlaying, 
    likedSongs, 
    toggleLike,
    followedArtists, 
    toggleFollowArtist,
    openAddToPlaylistModal
  } = useContext(PlayerContext);
  
  // 筛选出该艺人的所有歌曲
  const artistSongs = (allSongs || []).filter(s => s.artist === currentArtist);
  
  // 优先使用独立艺人图，如果没有则回退到第一首歌的封面
  const artistImage = ARTIST_DATA[currentArtist] || (artistSongs.length > 0 ? artistSongs[0].cover : '/images/default_artist.jpg');

  // 判断是否已关注
  const isFollowing = followedArtists.has(currentArtist);

  return (
    <div className="flex-1 bg-gradient-to-b from-neutral-800 to-black overflow-y-auto pb-32 no-scrollbar animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* 顶部背景区 (响应式高度) */}
      <div className="relative h-64 md:h-80 flex flex-col justify-end p-4 md:p-8 group">
        {/* 背景图 + 遮罩 */}
        <div 
           className="absolute inset-0 bg-cover bg-center opacity-40 mask-image-gradient transition-all duration-700 group-hover:scale-105"
           style={{ 
             backgroundImage: `url(${artistImage})`, 
             backgroundPosition: 'center 20%', 
             WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1), rgba(0,0,0,0))' 
           }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
        
        {/* 返回按钮 */}
        <button 
          onClick={() => setCurrentArtist(null)} 
          className="absolute top-6 left-4 md:top-8 md:left-8 w-10 h-10 bg-black/40 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition z-20 backdrop-blur-md group-hover:bg-white/30"
        >
          <ArrowLeft size={20} />
        </button>

        {/* 艺人信息 (响应式字体) */}
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-white mb-2">
            <BadgeCheck className="text-blue-400 w-5 h-5 md:w-6 md:h-6" fill="white" />
            <span className="text-xs md:text-sm font-medium">认证艺人</span>
          </div>
          
          {/* 手机 text-4xl, 桌面 text-8xl */}
          <h1 className="text-4xl md:text-8xl font-black text-white tracking-tight mb-2 md:mb-6 drop-shadow-lg line-clamp-1">
            {currentArtist}
          </h1>
          
          <p className="text-neutral-300 font-medium text-xs md:text-sm drop-shadow-md">
             每月 {Math.floor(Math.random() * 500) + 100}万 名听众
          </p>
        </div>
      </div>

      {/* 操作栏 (粘性定位) */}
      <div className="px-4 md:px-8 py-4 md:py-6 flex items-center gap-4 md:gap-6 sticky top-0 bg-black/95 z-30 border-b border-white/5 backdrop-blur-md">
         {/* 播放全部 */}
         <button 
            disabled={artistSongs.length === 0}
            onClick={() => artistSongs.length > 0 && playSong(artistSongs[0], artistSongs)}
            className="w-12 h-12 md:w-14 md:h-14 bg-green-500 rounded-full flex items-center justify-center text-black hover:scale-105 transition shadow-lg hover:bg-green-400 disabled:opacity-50"
          >
            <Play fill="black" size={20} className="ml-1 md:w-6 md:h-6" />
         </button>
         
         {/* 关注按钮 */}
         <button 
            onClick={() => toggleFollowArtist(currentArtist)}
            className={`px-6 py-2 rounded-full text-xs md:text-sm font-bold border transition duration-200 
              ${isFollowing 
                ? 'bg-transparent border-white text-white hover:bg-white/10' 
                : 'bg-transparent border-neutral-500 text-white hover:border-white hover:scale-105' 
              }`}
         >
            {isFollowing ? '已关注' : '关注'}
         </button>
      </div>

      {/* 歌曲列表 */}
      <div className="p-4 md:p-8">
        <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6 text-white">热门歌曲</h2>
        <div className="space-y-1">
          {artistSongs.map((song, idx) => {
            const isCurrent = currentSong && currentSong.id === song.id;
            return (
              <div 
                key={song.id}
                onClick={() => playSong(song, artistSongs)} 
                className="grid grid-cols-[16px_1fr_auto] gap-4 items-center p-2 md:p-3 rounded-md hover:bg-white/10 transition-colors group cursor-pointer"
              >
                {/* 序号 / 播放动画 */}
                <span className={`text-center text-sm w-4 flex justify-center ${isCurrent ? 'text-green-500' : 'text-neutral-500'}`}>
                   {isCurrent && isPlaying ? (
                      <img src="https://open.spotifycdn.com/cdn/images/equaliser-animated-green.f93a2ef4.gif" className="h-4 w-4" alt="playing"/>
                   ) : idx + 1}
                </span>
                
                {/* 歌曲信息 */}
                <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
                  <img src={song.cover} className="w-10 h-10 rounded object-cover shadow-sm flex-shrink-0" alt="" />
                  <div className="truncate min-w-0">
                    <div className={`font-medium truncate text-sm md:text-base ${isCurrent ? 'text-green-500' : 'text-white'}`}>
                      {song.title}
                    </div>
                    {/* 手机端隐藏播放次数，只显示 duration 或其他 */}
                    <div className="text-xs text-neutral-500 truncate">
                      {song.duration > 200 ? '1,234,567' : '987,654'} 次播放
                    </div>
                  </div>
                </div>

                {/* 操作区 */}
                <div className="flex items-center gap-4 md:gap-6 pl-2">
                  {/* 添加到歌单按钮 (手机端始终显示或保持 hover 逻辑，建议保持 hover 以保持界面整洁，或者调整为始终可见) */}
                  <ListPlus 
                    size={18} 
                    className="text-neutral-500 hover:text-white cursor-pointer opacity-0 group-hover:opacity-100 transition-all hidden md:block"
                    onClick={(e) => {
                      e.stopPropagation();
                      openAddToPlaylistModal(song);
                    }}
                    title="添加到歌单"
                  />

                  <Heart 
                    size={18} 
                    className={`transition-colors cursor-pointer active:scale-90 ${likedSongs.has(song.id) ? 'text-green-500' : 'text-neutral-500 opacity-0 group-hover:opacity-100 hover:text-white'}`}
                    fill={likedSongs.has(song.id) ? "currentColor" : "none"}
                    onClick={(e) => { e.stopPropagation(); toggleLike(song.id); }}
                  />
                  <span className="text-xs text-neutral-500 w-10 text-right tabular-nums">
                    {Math.floor(song.duration / 60)}:{(song.duration % 60).toString().padStart(2, '0')}
                  </span>
                </div>
              </div>
            );
          })}
          {artistSongs.length === 0 && <div className="text-neutral-500 text-sm italic">暂无该艺人的热门歌曲</div>}
        </div>
      </div>
    </div>
  );
};

const AddToPlaylistModal = () => {
  const { 
    playlists, 
    addToPlaylistModal, 
    closeAddToPlaylistModal, 
    addSongToPlaylist,
    setShowCreateModal // 允许用户在此时新建歌单
  } = useContext(PlayerContext);

  if (!addToPlaylistModal.isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={closeAddToPlaylistModal} // 点击背景关闭
    >
      <div 
        className="bg-neutral-900 w-full max-w-sm rounded-xl border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
        onClick={e => e.stopPropagation()} // 阻止冒泡
      >
        <div className="p-4 border-b border-white/5 bg-neutral-800/50">
          <h2 className="text-lg font-bold text-white text-center">添加到歌单</h2>
          <p className="text-xs text-neutral-400 text-center mt-1 line-clamp-1">
            将 "{addToPlaylistModal.song?.title}" 添加到...
          </p>
        </div>

        <div className="overflow-y-auto p-2 no-scrollbar flex-1">
          {/* 新建歌单选项 */}
          <div 
            onClick={() => {
              closeAddToPlaylistModal();
              setShowCreateModal(true);
            }}
            className="flex items-center gap-4 p-3 hover:bg-white/10 rounded-md cursor-pointer text-green-500 group transition"
          >
            <div className="w-12 h-12 bg-neutral-800 flex items-center justify-center rounded group-hover:bg-neutral-700">
              <Plus size={24} />
            </div>
            <span className="font-bold">新建歌单</span>
          </div>

          <div className="h-px bg-white/5 my-2 mx-2"></div>

          {/* 现有歌单列表 */}
          {playlists.length > 0 ? (
            playlists.map(playlist => (
              <div 
                key={playlist.id}
                onClick={() => addSongToPlaylist(playlist.id, addToPlaylistModal.song)}
                className="flex items-center gap-4 p-3 hover:bg-white/10 rounded-md cursor-pointer transition group"
              >
                <img src={playlist.cover} className="w-12 h-12 object-cover rounded shadow-sm" alt="" />
                <div className="flex-1 min-w-0">
                  <div className="text-white font-medium truncate">{playlist.name}</div>
                  <div className="text-xs text-neutral-500">{playlist.songs.length} 首歌曲</div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-6 text-neutral-500 text-sm">
              暂无歌单
            </div>
          )}
        </div>

        <div className="p-4 border-t border-white/5 bg-neutral-800/50 text-center">
          <button 
            onClick={closeAddToPlaylistModal}
            className="text-sm text-neutral-400 hover:text-white transition"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
};


const HomePage = () => {
  const { 
    // 数据源
    allSongs, 
    playlists, 
    
    // 播放控制
    playSong, 
    currentSong, 
    isPlaying, 
    
    // 导航
    setActiveTab, 
    setCurrentPlaylist, 
    currentPlaylist, 
    setCurrentArtist, 
    currentArtist,
    goToArtist, 
    
    // 功能弹窗
    openAddToPlaylistModal, 
    
    // 用户认证
    user, 
    setShowAuthModal, 
    logout,
    
    themeColor
  } = useContext(PlayerContext);

  // --- 逻辑：从数据库歌曲中提取推荐艺人 ---
  const recommendedArtists = useMemo(() => {
    if (!allSongs || allSongs.length === 0) return [];

    const unique = new Set();
    const list = [];
    
    allSongs.forEach(song => {
      if (!unique.has(song.artist)) {
        unique.add(song.artist);
        const artistCover = ARTIST_DATA[song.artist] || song.cover;
        list.push({ name: song.artist, cover: artistCover });
      }
    });
    
    // 只展示前 5 位
    return list.slice(0, 5);
  }, [allSongs]);

  // 公用的全屏亮色背景样式
  const fullScreenBrightStyle = {
    background: `
      radial-gradient(circle at 0% 0%, ${themeColor}AA 0%, transparent 70%),
      radial-gradient(circle at 100% 0%, ${themeColor}66 0%, transparent 50%),
      #0a0a0aff 
    `,
    transition: 'background 1s ease-in-out',
  };

  // --- 渲染优先级判断 ---

  if (currentArtist) return <ArtistPage />;

  if (currentPlaylist) {
    return (
      <div 
        className="flex-1 overflow-y-auto p-4 md:p-8 pb-32 no-scrollbar transition-all"
        style={fullScreenBrightStyle}
      >
        <PlaylistDetail playlist={currentPlaylist} />
      </div>
    );
  }

  // 3. 默认主页仪表盘
  return (
    <div 
      // 🌟 修改点：p-4 md:p-8 (手机端边距减小)
      className="flex-1 overflow-y-auto p-4 md:p-8 pb-32 no-scrollbar relative transition-all"
      style={fullScreenBrightStyle}
    >
      <div 
        className="absolute top-0 left-0 w-[80%] h-[80%] -z-10 blur-[150px] opacity-50 pointer-events-none transition-colors duration-1000 rounded-full"
        style={{ backgroundColor: themeColor }}
      ></div>

      {/* 顶部 Header */}
      <header className="flex justify-between items-center mb-6 md:mb-8 sticky top-0 z-10 py-4 -my-4 bg-neutral-900/0 backdrop-blur-sm transition-colors">
        {/* 🌟 修改点：hidden md:flex (手机端隐藏历史记录按钮) */}
        <div className="hidden md:flex gap-2">
          <div className="w-8 h-8 bg-black/40 rounded-full flex items-center justify-center text-white cursor-pointer hover:bg-black/60 transition">{'<'}</div>
          <div className="w-8 h-8 bg-black/40 rounded-full flex items-center justify-center text-white cursor-pointer hover:bg-black/60 transition">{'>'}</div>
        </div>
        
        {/* 用户区域 (手机端自动靠右) */}
        <div className="flex items-center gap-4 ml-auto md:ml-0">
          {user ? (
            <div className="flex items-center gap-3 bg-black/40 rounded-full p-1 pr-4 hover:bg-neutral-800 transition cursor-pointer group relative border border-white/5">
              {/* 用户头像 */}
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center text-black font-bold text-xs shadow-lg transition-colors duration-500"
                style={{ backgroundColor: themeColor }}
              >
                {user.username[0].toUpperCase()}
              </div>
              <span className="text-white font-bold text-sm max-w-[100px] truncate">{user.username}</span>
              
              {/* 下拉退出菜单 */}
              <div className="absolute top-full right-0 w-32 pt-2 z-50 hidden group-hover:block">
                <div className="bg-neutral-800 rounded-md shadow-xl border border-white/10 overflow-hidden">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation(); 
                      logout();
                    }}
                    className="w-full text-left px-4 py-3 md:py-2 text-sm text-red-400 hover:bg-white/10 hover:text-red-300 font-bold transition-colors"
                  >
                    退出登录
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex gap-2 md:gap-4">
              <button 
                onClick={() => setShowAuthModal(true)}
                className="text-neutral-400 font-bold hover:text-white transition px-2 py-1"
              >
                注册
              </button>
              <button 
                onClick={() => setShowAuthModal(true)}
                className="bg-white text-black px-4 md:px-6 py-2 rounded-full font-bold hover:scale-105 transition text-sm md:text-base"
              >
                登录
              </button>
            </div>
          )}
        </div>
      </header>

      {/* 歌单板块 */}
      <section className="mb-8 md:mb-10">
       <h2 className="text-2xl md:text-3xl font-bold mb-4 md:mb-6 text-white tracking-tight">今日推荐</h2>
       {/* 🌟 修改点：grid-cols-2 lg:grid-cols-4 gap-4 (手机双列，间距缩小) */}
       <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {playlists.map(playlist => (
            <div 
              key={playlist.id} 
              onClick={() => setCurrentPlaylist(playlist)} 
              className="bg-white/5 backdrop-blur-md hover:bg-white/10 border border-white/5 p-3 md:p-4 rounded-xl transition duration-300 group cursor-pointer overflow-hidden relative"
            >
              <div className="relative mb-3 md:mb-4 aspect-square overflow-hidden rounded-lg shadow-lg">
                <img src={playlist.cover} className="w-full h-full object-cover group-hover:scale-110 transition duration-500" alt="" />
                {/* 播放按钮 */}
                <button 
                  className="absolute bottom-2 right-2 w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center shadow-xl opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300"
                  style={{ backgroundColor: themeColor }}
                >
                  <Play fill="black" stroke="none" className="ml-1 text-black w-4 h-4 md:w-5 md:h-5" />
                </button>
              </div>
              <h3 className="font-bold mb-1 truncate text-white text-sm md:text-base">{playlist.name}</h3>
              <p className="text-neutral-500 text-xs md:text-sm line-clamp-2">{playlist.description}</p>
            </div>
          ))}
          
          {playlists.length === 0 && (
            <div className="col-span-2 lg:col-span-4 text-neutral-500 text-sm py-4 text-center border border-dashed border-white/10 rounded-xl">
              暂无歌单，点击底部的 "+" 创建一个吧。
            </div>
          )}
        </div>
      </section>

      {/* 推荐艺人板块 */}
      <section className="mb-8 md:mb-10">
        <h2 className="text-xl md:text-2xl font-bold text-white mb-4 md:mb-6 tracking-tight">推荐艺人</h2>
        {/* 🌟 修改点：min-w-[100px] (手机端卡片变小) */}
        <div className="flex gap-4 md:gap-6 overflow-x-auto pb-4 no-scrollbar">
          {recommendedArtists.map((artist, idx) => (
            <div 
              key={idx} 
              onClick={() => setCurrentArtist(artist.name)} 
              className="flex flex-col items-center gap-3 md:gap-4 min-w-[100px] md:min-w-[140px] p-2 md:p-4 rounded-xl hover:bg-neutral-800/40 transition cursor-pointer group"
            >
              <div 
                className="w-24 h-24 md:w-32 md:h-32 rounded-full shadow-lg relative overflow-hidden bg-neutral-800 border-2 transition-all duration-500"
                style={{ borderColor: 'transparent' }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = themeColor}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'transparent'}
              >
                <img 
                  src={artist.cover} 
                  alt={artist.name} 
                  className="w-full h-full object-cover group-hover:scale-110 transition duration-500" 
                />
              </div>
              <div className="text-center">
                <div className="font-bold text-white mb-1 text-sm md:text-base group-hover:underline truncate w-full">{artist.name}</div>
                <div className="text-[10px] md:text-xs text-neutral-500 font-medium">艺人</div>
              </div>
            </div>
          ))}
          {recommendedArtists.length === 0 && (
             <div className="text-neutral-500 text-sm">暂无艺人数据</div>
          )}
        </div>
      </section>

      {/* 歌曲推荐板块 */}
      <section>
        <div className="flex justify-between items-end mb-4 md:mb-6">
           <h2 className="text-xl md:text-xl font-bold text-white hover:underline cursor-pointer tracking-tight">为您推荐</h2>
           <button 
             onClick={() => setActiveTab('search')}
             className="text-xs font-bold text-neutral-500 hover:text-white hover:underline cursor-pointer uppercase tracking-widest transition-colors duration-200"
           >
             全部显示
           </button>
        </div>
        {/* 🌟 修改点：grid-cols-2 (手机双列) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
          {(allSongs || []).map(song => {
            const isCurrent = currentSong && currentSong.id === song.id;
            return (
              <div 
                key={song.id}
                onClick={() => playSong(song, allSongs)} 
                className="bg-neutral-900/40 p-3 md:p-4 rounded-lg hover:bg-neutral-800/60 transition group cursor-pointer border border-transparent hover:border-white/5 relative"
              >
                <div className="relative mb-3 md:mb-4">
                  <img src={song.cover} className="w-full aspect-square object-cover rounded shadow-2xl border border-white/5" alt="" />
                  
                  {/* 悬浮播放按钮 */}
                  <div 
                    className={`absolute bottom-2 right-2 shadow-xl w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all duration-300 ${ (isCurrent && isPlaying) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0'}`}
                    style={{ backgroundColor: themeColor }}
                  >
                    { (isCurrent && isPlaying) ? <Pause fill="black" size={16} className="text-black" /> : <Play fill="black" size={16} className="ml-0.5 text-black" /> }
                  </div>
                </div>

                {/* 添加到歌单按钮 */}
                {/* 🌟 修改点：opacity-100 md:opacity-0 (手机端始终显示，桌面端Hover显示) */}
                <div className="absolute top-2 right-2 z-10 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">
                  <button 
                    onClick={(e) => { e.stopPropagation(); openAddToPlaylistModal(song); }}
                    className="w-7 h-7 md:w-8 md:h-8 bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center text-white transition shadow-lg border border-white/10 active:scale-90"
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = themeColor}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.6)'}
                  >
                      <ListPlus size={14} className="md:w-4 md:h-4" />
                    </button>
                 </div>
                
                <div className="text-white font-bold text-xs md:text-sm mb-1 truncate">{song.title}</div>
                
                {/* 艺人名跳转 */}
                <div 
                  className="text-neutral-500 text-[10px] md:text-xs truncate hover:text-white hover:underline cursor-pointer w-fit transition-colors"
                  onClick={(e) => {
                    e.stopPropagation(); 
                    goToArtist(song.artist);
                  }}
                >
                  {song.artist}
                </div>
              </div>
            );
          })}
        </div>
        {(!allSongs || allSongs.length === 0) && (
             <div className="text-neutral-500 py-10 text-center">正在加载歌曲...</div>
        )}
      </section>
    </div>
  );
};

const LyricsOverlay = () => {
  const { currentSong, progress, setShowLyrics, lrcInputRef } = useContext(PlayerContext);
  const activeLyricRef = useRef(null);

  const [dominantColor, setDominantColor] = useState('#121212');
  

  const activeLyricIndex = currentSong.lyrics?.findIndex((l, i) => {
    const next = currentSong.lyrics[i + 1];
    return progress >= l.time && (!next || progress < next.time);
  }) ?? -1;

  useEffect(() => {
    if (currentSong?.cover) {
      const img = new Image();
      img.crossOrigin = "Anonymous"; // 避免跨域问题
      img.src = currentSong.cover;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 1;
        canvas.height = 1;
        ctx.drawImage(img, 0, 0, 1, 1);
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
        // 降低亮度 (乘以 0.3) 以确保歌词白字的阅读体验
        const darkenedColor = `rgb(${Math.floor(r * 0.8)}, ${Math.floor(g * 0.8)}, ${Math.floor(b * 0.8)})`;
        setDominantColor(darkenedColor);
      };
    }
  }, [currentSong]);


  useEffect(() => {
    if (activeLyricRef.current) {
      activeLyricRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeLyricIndex]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center p-8 overflow-hidden animate-in fade-in duration-1000">
        <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

      @keyframes liquidMove {
          0% { background-position: 0% 50%; transform: scale(1); }
          50% { background-position: 100% 50%; transform: scale(1.1); }
          100% { background-position: 0% 50%; transform: scale(1); }
        }

        .dynamic-bg {
          background: linear-gradient(-45deg, ${dominantColor}, #000000, ${dominantColor}, #0a0a0a);
          background-size: 400% 400%;
          animation: gradientMove 15s ease infinite;
          filter: blur(40px); 
        }

        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
          
      `}</style>

         <div className="absolute inset-0 dynamic-bg -z-20 transition-all duration-1000" />
         {/* <div className="absolute inset-0 bg-black/40 -z-10" /> */}

      <button onClick={() => setShowLyrics(false)} className="absolute top-8 right-8 text-neutral-500 hover:text-white transition-transform active:scale-90">
        <X size={32} />
      </button>
      
         <div className="flex flex-col md:flex-row w-full max-w-6xl h-full items-center gap-12 pt-12 relative">
        {/* 左侧：封面信息 */}
        <div className="w-full md:w-1/2 flex flex-col items-center gap-8">
          <div className="relative group">
            {/* 封面倒影效果 */}
            <div className="absolute -inset-4 bg-white/5 blur-2xl rounded-full group-hover:bg-white/10 transition-colors" />
            <img 
              src={currentSong.cover} 
              className="w-64 h-64 md:w-96 md:h-96 rounded-xl shadow-[0_30px_60px_rgba(0,0,0,0.8)] object-cover relative z-10" 
              alt="Album Cover" 
            />
          </div>
          <div className="text-center text-white z-10">
            <h2 className="text-4xl font-black mb-3 tracking-tight">{currentSong.title}</h2>
            <p className="text-2xl text-white/60 font-medium">{currentSong.artist}</p>
          </div>
        </div>
        
        {/* 这里使用了 no-scrollbar 类名 */}
        <div className="w-full md:w-1/2 flex flex-col items-start h-[70vh] overflow-y-auto no-scrollbar scroll-smooth space-y-8 text-2xl md:text-4xl font-bold pt-40 pb-40">
          {currentSong.lyrics?.map((line, idx) => (
            <p 
              key={idx} 
              ref={idx === activeLyricIndex ? activeLyricRef : null}
              className={`transition-all duration-700 cursor-default ${
                idx === activeLyricIndex ? 'text-white scale-105 origin-left' : 'text-white/20 hover:text-white/40 scale-100'
              }`}
            >
              {line.text}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
};





// --- 主应用组件 ---
// ==========================================
// 辅助组件定义 (必须放在 App 组件之前)
// ==========================================

// 1. 全局消息提示组件
const GlobalToast = () => {
  const { toast } = useContext(PlayerContext);
  if (!toast) return null;

  return (
    <div className={`fixed top-12 left-1/2 -translate-x-1/2 px-8 py-3 rounded-full shadow-2xl z-[200] font-bold text-sm flex items-center gap-2 animate-in slide-in-from-top-4 fade-in duration-300 ${
      toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-green-500 text-black'
    }`}>
      {toast.type === 'error' ? <span className="font-black">✕</span> : <span className="font-black">✓</span>}
      {toast.message}
    </div>
  );
};

// 2. 歌词背景包装器
const LyricsContextWrapper = () => {
  const { showLyrics } = useContext(PlayerContext);
  return showLyrics ? <LyricsOverlay /> : null;
};

// 3. 应用主界面包装器 (修正了 onst -> const)
const AppWrapper = () => {
  const { 
    activeTab, 
    showLyrics, 
    showCreateModal, 
    addToPlaylistModal, 
    showAuthModal 
  } = useContext(PlayerContext);

  return (
    <div className="flex bg-black h-screen font-sans selection:bg-green-500 selection:text-black text-white overflow-hidden">
      {/* 1. 左侧导航栏 */}
      <Sidebar />
      
      {/* 2. 主内容区域 */}
      <div className="flex-1 flex flex-col relative h-full">
        {/* 根据 activeTab 切换显示不同的页面 */}
        {activeTab === 'home' && <HomePage />}
        {activeTab === 'search' && <SearchPage />}
        {activeTab === 'liked' && <LikedSongsPage />}
        {activeTab === 'artists' && <FollowedArtistsPage />}
        
        {/* 底部播放条 */}
        <PlayerBar />

        <MobileNav />
      </div>

      {/* 3. 各类全屏/弹窗层 */}
      {showLyrics && <LyricsPage />}
      {showCreateModal && <CreatePlaylistModal />}
      {addToPlaylistModal.isOpen && <AddToPlaylistModal />}
      {showAuthModal && <AuthModal />}
      
      {/* 4. 全局提示组件 (Toast) */}
      <GlobalToast /> 

      {/* 5. 动态歌词背景层 */}
      <LyricsContextWrapper />
    </div>
  );
};

// ==========================================
// 主入口组件 (必须放在最后导出)
// ==========================================
export default function App() {
  return (
    <PlayerProvider>
      <AppWrapper />
    </PlayerProvider>
  );
}


