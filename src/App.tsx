import React, { useState, useRef, useEffect, createContext, useContext, useMemo } from 'react';
import axios from 'axios';
import { 
  Play, Pause, SkipBack, SkipForward, Volume2, Search, Home, Library, 
  ListMusic, Heart, Maximize2, ChevronDown, Repeat, Shuffle, X, Plus,
  ArrowLeft, ArrowRight, Clock, BadgeCheck, Mic2, Users, ListPlus, Repeat1 
} from 'lucide-react';

// --- 全局样式 & 字体 & 动画 ---
const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap');
    .no-scrollbar::-webkit-scrollbar { display: none; }
    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    .girlish-theme { font-family: 'Playfair Display', serif !important; }
    
    @keyframes floatUp {
      0% { transform: translateY(100vh) scale(0.5) rotate(0deg); opacity: 0; }
      20% { opacity: 0.8; }
      80% { opacity: 0.6; }
      100% { transform: translateY(-20vh) scale(1.2) rotate(360deg); opacity: 0; }
    }
    @keyframes breathe {
      0%, 100% { opacity: 0.3; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(1.1); }
    }
  `}</style>
);

// --- 少女风氛围背景组件 ---
const SparkleBackground = ({ isActive }) => {
  if (!isActive) return null;
  const particles = useMemo(() => {
    return Array.from({ length: 30 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100 + '%',
      duration: 10 + Math.random() * 15 + 's',
      delay: Math.random() * 5 + 's',
      icon: ['✨', '💖', '🌸', '☁️', '🎀'][Math.floor(Math.random() * 5)],
      size: Math.random() * 24 + 12 + 'px'
    }));
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      <div className="absolute top-[-10%] left-[-10%] w-[60vw] h-[60vw] bg-[#ff7eb3] rounded-full filter blur-[120px] opacity-20 animate-[breathe_8s_ease-in-out_infinite]"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] bg-[#8227ff] rounded-full filter blur-[120px] opacity-15 animate-[breathe_10s_ease-in-out_infinite_reverse]"></div>
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute bottom-[-50px] text-white/60 drop-shadow-md"
          style={{
            left: p.left,
            fontSize: p.size,
            animation: `floatUp ${p.duration} linear infinite`,
            animationDelay: p.delay
          }}
        >
          {p.icon}
        </div>
      ))}
    </div>
  );
};

// --- 常量定义 ---
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
};

const MOCK_SONGS = [];

// ==========================================
// Context 定义
// ==========================================
export const PlayerContext = createContext();

// ==========================================
// Provider 组件
// ==========================================
export const PlayerProvider = ({ children }) => {
  const API_URL = '/api';

  const [themeColor, setThemeColor] = useState('#737373');
  const [allSongs, setAllSongs] = useState([]);
  const [playlists, setPlaylists] = useState([]); 
  const [currentSong, setCurrentSong] = useState(null); 
  const [currentLyrics, setCurrentLyrics] = useState([]); 
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [queue, setQueue] = useState([]);
  const [repeatMode, setRepeatMode] = useState('off'); 
  const audioRef = useRef(null);
  const [showLyrics, setShowLyrics] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [addToPlaylistModal, setAddToPlaylistModal] = useState({ isOpen: false, song: null });
  const [currentPlaylist, setCurrentPlaylist] = useState(null);
  const [currentArtist, setCurrentArtist] = useState(null);
  const [user, setUser] = useState(null);
  const [likedSongs, setLikedSongs] = useState(new Set()); 
  const [followedArtists, setFollowedArtists] = useState(new Set());
  const [toast, setToast] = useState(null);

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

  useEffect(() => {
    const savedColor = localStorage.getItem('music_hub_theme');
    if (savedColor) {
      setThemeColor(savedColor);
      document.documentElement.style.setProperty('--primary-color', savedColor);
    }

    const fetchPublicData = async () => {
      try {
        const songsRes = await axios.get(`${API_URL}/songs`);
        const processedSongs = songsRes.data.map(song => ({
          ...song,
          id: song._id, 
          lyrics: [] 
        }));
        setAllSongs(processedSongs);
        setQueue(processedSongs);
        if (processedSongs.length > 0 && !currentSong) {
          setCurrentSong(processedSongs[0]); 
        }
      } catch (err) {
        console.error("初始化数据失败:", err);
      }
    };
    fetchPublicData();
  }, []); 

  useEffect(() => {
    const fetchVisiblePlaylists = async () => {
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
        setPlaylists(processedPlaylists);
      } catch (err) {
        console.error("加载歌单失败:", err);
      }
    };
    fetchVisiblePlaylists();
  }, [user?.id, user?._id]); 

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
      } else if (currentSong.lyrics && typeof currentSong.lyrics === 'string') {
        setCurrentLyrics(parseLRC(currentSong.lyrics));
      } else {
        setCurrentLyrics([{ time: 0, text: "纯音乐 / 暂无歌词" }]);
      }
    };
    loadLyrics();
  }, [currentSong?.id]);

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

  const toggleLike = async (songId) => {
    if (!checkAuth()) return;
    const isLikedBefore = likedSongs.has(songId);
    setLikedSongs(prev => {
      const newLiked = new Set(prev);
      if (isLikedBefore) newLiked.delete(songId);
      else newLiked.add(songId);
      return newLiked;
    });
    showToast(isLikedBefore ? '已取消喜欢' : '已添加到喜欢的歌曲');
    try {
      const userId = user.id || user._id;
      await axios.post(`${API_URL}/user/like`, { userId: userId, songId: songId });
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
    if (!userId) { showToast("创建失败：无法获取当前用户信息", "error"); return; }
    try {
      const res = await axios.post(`${API_URL}/playlists`, {
        name: name,
        cover: coverUrl || "https://i.ibb.co/6cGhCCj6/Meteor-1-MIFEN.jpg",
        description: isPublic ? "公共歌单" : "新建歌单",
        userId: userId,
        isPublic: isPublic
      });
      const newPlaylist = { ...res.data, id: res.data._id || res.data.id };
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
      await axios.delete(`${API_URL}/playlists/${playlistId}`, { params: { userId } });
      setPlaylists(prev => prev.filter(p => (p._id || p.id) !== playlistId));
      if (currentPlaylist && (currentPlaylist.id === playlistId || currentPlaylist._id === playlistId)) {
          setActiveTab('home'); setCurrentPlaylist(null);
      }
      showToast("✨ 歌单已成功删除！");
    } catch (err) {
      console.error("删除失败:", err);
      showToast(err.response?.data?.message || "删除失败，请稍后再试", "error");
    }
  };

  const updatePlaylistCover = async (playlistId, newCoverUrl) => {
    if (!checkAuth() || !newCoverUrl) return;
    const currentUserId = user?.id || user?._id;
    const targetPlaylist = playlists.find(pl => (pl.id || pl._id) === playlistId);
    if (targetPlaylist && targetPlaylist.userId !== currentUserId) {
      showToast("你没有权限修改此歌单封面", "error"); return;
    }
    setPlaylists(prev => prev.map(pl => {
      if ((pl.id || pl._id) === playlistId) return { ...pl, cover: newCoverUrl };
      return pl;
    }));
    if (currentPlaylist && (currentPlaylist.id || currentPlaylist._id) === playlistId) {
      setCurrentPlaylist(prev => ({ ...prev, cover: newCoverUrl }));
    }
    showToast('正在更新封面...');
    try {
      await axios.put(`${API_URL}/playlists/${playlistId}`, { cover: newCoverUrl, userId: currentUserId });
      showToast('封面更新成功');
    } catch (err) {
      console.error("更新封面失败:", err);
      showToast("同步失败，请检查网络", "error");
    }
  };

  const updatePlaylistName = async (playlistId, newName) => {
    if (!checkAuth() || !newName.trim()) return;
    const currentUserId = user?.id || user?._id;
    const targetPlaylist = playlists.find(pl => (pl.id || pl._id) === playlistId);
    if (targetPlaylist && targetPlaylist.userId !== currentUserId) {
      showToast("你没有权限修改此歌单名称", "error"); return;
    }
    setPlaylists(prev => prev.map(pl => {
      if ((pl.id || pl._id) === playlistId) return { ...pl, name: newName };
      return pl;
    }));
    if (currentPlaylist && (currentPlaylist.id || currentPlaylist._id) === playlistId) {
      setCurrentPlaylist(prev => ({ ...prev, name: newName }));
    }
    showToast('正在更新名称...');
    try {
      await axios.put(`${API_URL}/playlists/${playlistId}`, { name: newName, userId: currentUserId });
      showToast('名称修改成功');
    } catch (err) {
      console.error("更新名称失败:", err);
      showToast("同步失败，请检查网络", "error");
    }
  };

  const addSongToPlaylist = async (playlistId, song) => {
    if (!checkAuth()) return;
    const currentUserId = user?.id || user?._id;
    const targetPlaylist = playlists.find(pl => (pl.id || pl._id) === playlistId);
    if (!targetPlaylist) return;
    if (targetPlaylist.userId !== currentUserId) { showToast('你只能修改自己的歌单', 'error'); return; }
    const songIdToCheck = song.id || song._id;
    const exists = targetPlaylist.songs.find(s => (s.id || s._id) === songIdToCheck);
    if (exists) { showToast('歌曲已存在于该歌单', 'error'); return; } 
    const newSongs = [...targetPlaylist.songs, song];
    const newCover = newSongs.length === 1 ? song.cover : targetPlaylist.cover;
    setPlaylists(prev => prev.map(pl => {
      if ((pl.id || pl._id) === playlistId) return { ...pl, songs: newSongs, cover: newCover };
      return pl;
    }));
    closeAddToPlaylistModal();
    showToast('已添加到歌单');
    try {
      await axios.put(`${API_URL}/playlists/${playlistId}`, { userId: currentUserId, songs: newSongs, cover: newCover });
    } catch (err) {
      console.error("同步歌单失败:", err);
      showToast("同步失败", "error");
    }
  };

  const goToArtist = (artistName) => { setCurrentArtist(artistName); setCurrentPlaylist(null); setActiveTab('home'); };
  const openAddToPlaylistModal = (song) => { if (checkAuth()) setAddToPlaylistModal({ isOpen: true, song }); };
  const closeAddToPlaylistModal = () => { setAddToPlaylistModal({ isOpen: false, song: null }); };

  const contextCurrentSong = currentSong ? { ...currentSong, lyrics: currentLyrics } : null;

  return (
    <PlayerContext.Provider value={{
      allSongs, playlists, themeColor, changeThemeColor,
      currentSong: contextCurrentSong, setCurrentSong, isPlaying, togglePlay, playSong, progress, setProgress, volume, setVolume, nextSong, prevSong, audioRef, queue, repeatMode, toggleRepeat,
      showLyrics, setShowLyrics, activeTab, setActiveTab, showCreateModal, setShowCreateModal,
      currentPlaylist, setCurrentPlaylist, currentArtist, setCurrentArtist, addToPlaylistModal, openAddToPlaylistModal, closeAddToPlaylistModal,
      likedSongs, toggleLike, followedArtists, toggleFollowArtist, 
      createPlaylist, deletePlaylist,updatePlaylistCover, updatePlaylistName, addSongToPlaylist, goToArtist, 
      user, login, register, logout, showAuthModal, setShowAuthModal, toast, showToast
    }}>
      {children}
      <audio ref={audioRef} src={currentSong?.url} onTimeUpdate={handleTimeUpdate} onEnded={() => nextSong(true)} />
    </PlayerContext.Provider>
  );
};

const FollowedArtistsPage = () => {
  const { followedArtists, setCurrentArtist, setActiveTab } = useContext(PlayerContext);
  const artistsList = Array.from(followedArtists);
  const getArtistImage = (artistName) => {
    if (ARTIST_DATA[artistName]) return ARTIST_DATA[artistName];
    const song = MOCK_SONGS.find(s => s.artist === artistName);
    return song ? song.cover : '/images/default_artist.jpg';
  };
  const handleArtistClick = (artistName) => {
    setCurrentArtist(artistName);
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
              <div key={idx} onClick={() => handleArtistClick(artistName)} className="bg-neutral-800/20 hover:bg-neutral-800/60 p-4 rounded-xl transition duration-300 group cursor-pointer">
                <div className="relative mb-4 aspect-square overflow-hidden rounded-full shadow-lg border-2 border-transparent group-hover:border-white/10">
                  <img src={getArtistImage(artistName)} className="w-full h-full object-cover group-hover:scale-110 transition duration-500" alt={artistName} />
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
            <button onClick={() => setActiveTab('search')} className="mt-4 px-6 py-2 bg-white text-black font-bold rounded-full hover:scale-105 transition">去寻找艺人</button>
          </div>
        )}
      </div>
    </div>
  );
};

const Sidebar = () => {
  const { activeTab, setActiveTab, likedSongs, setShowCreateModal, setCurrentPlaylist, setCurrentArtist, playlists, user, deletePlaylist, themeColor, changeThemeColor } = useContext(PlayerContext);
  const handleTabClick = (tabId) => { setActiveTab(tabId); setCurrentPlaylist(null); setCurrentArtist(null); };
  const handlePlaylistClick = (playlist) => { setCurrentPlaylist(playlist); setActiveTab('home'); setCurrentArtist(null); };
  const menuItems = [ { id: 'home', icon: Home, label: '首页' }, { id: 'search', icon: Search, label: '搜索' }, { id: 'artists', icon: Mic2, label: '关注的艺人' } ];

  const ThemeSelector = () => {
    const colors = [
      { name: 'Spotify绿', value: '#737373' }, { name: '紫色', value: '#bd71ff' }, { name: '天空蓝', value: '#3496ff' },
      { name: '明亮黄', value: '#27ffe2' }, { name: '红色', value: '#ff2929' }, { name: '少女粉', value: '#FF9EAA' }, 
    ];
    return (
      <div className="mt-4 p-3 bg-white/5 backdrop-blur-md rounded-xl border border-white/10 shadow-lg">
        <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-3">界面配色</p>
        <div className="flex flex-wrap gap-2">
          {colors.map(c => (
            <button key={c.value} onClick={() =>{ changeThemeColor(c.value)}} className={`w-5 h-5 rounded-full border-2 transition-all hover:scale-125 ${ themeColor === c.value ? 'border-white scale-110' : 'border-transparent' }`} style={{ backgroundColor: c.value }} title={c.name} />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="w-64 h-screen p-6 pb-28 text-neutral-400 flex flex-col gap-6 hidden md:flex flex-shrink-0 border-r border-white/5 transition-all duration-1000 relative overflow-hidden" style={{ background: `linear-gradient(to bottom, ${themeColor}30 0%, 0)`, backdropFilter: 'blur(20px)' }}>
      <div className="absolute -top-20 -left-20 w-40 h-40 blur-[80px] opacity-20 pointer-events-none rounded-full" style={{ backgroundColor: themeColor }}></div>
      <div className="text-white font-bold text-2xl flex items-center gap-2 mb-4 cursor-pointer z-10" onClick={() => handleTabClick('home')}>
        <div className="w-9 h-9 rounded-full flex items-center justify-center shadow-lg transition-all duration-500" style={{ backgroundColor: themeColor }}>
          <Play size={18} fill="black" className="text-black ml-0.5" />
        </div>
        <span className="tracking-tighter">MusicHub</span>
      </div>
      <nav className="space-y-4 z-10">
        {menuItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <div key={item.id} onClick={() => handleTabClick(item.id)} className={`flex items-center gap-4 cursor-pointer transition-all duration-300 font-medium ${isActive ? 'text-white scale-105' : 'hover:text-white hover:translate-x-1'}`} style={{ color: isActive ? themeColor : '' }}>
              <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} /> 
              <span className={isActive ? "text-white" : ""}>{item.label}</span>
            </div>
          );
        })}
      </nav>
      <div className="mt-4 flex-1 overflow-y-auto no-scrollbar space-y-4 z-10">
        <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 sticky top-0 bg-transparent py-2 backdrop-blur-sm z-20">你的资料库</p>
        <div onClick={() => setShowCreateModal(true)} className="flex items-center gap-4 hover:text-white cursor-pointer transition group text-sm">
          <div className="p-1.5 bg-neutral-800 group-hover:bg-neutral-700 rounded-md text-white transition-all border border-white/5"><Plus size={16} strokeWidth={3} /></div>
          创建播放列表
        </div>
        <div onClick={() => setActiveTab('liked')} className={`flex items-center gap-4 cursor-pointer transition group text-sm ${activeTab === 'liked' ? 'text-white' : 'hover:text-white'}`}>
          <div className="p-1.5 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-md text-white shadow-md"><Heart size={16} fill="white" /></div>
          已点赞 ({likedSongs.size})
        </div>
        <div className="border-t border-white/10 pt-4 mt-2 space-y-2">
          {playlists.map(playlist => {
            const isMine = playlist.userId === (user?.id || user?._id);
            return (
              <div key={playlist.id || playlist._id} className="group flex items-center justify-between text-sm py-1 hover:text-white cursor-pointer transition-all rounded-md px-2 -mx-2 hover:bg-white/5">
                <span className="truncate flex-1" onClick={() => handlePlaylistClick(playlist)}>{playlist.name}</span>
                {isMine && (
                  <button onClick={(e) => { e.stopPropagation(); deletePlaylist(playlist.id || playlist._id); }} className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-all"><X size={14} /></button>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-auto border-t border-white/10 pt-4 z-10"><ThemeSelector /></div>
    </div>
  );
};

const LikedSongsPage = () => {
  const { allSongs, likedSongs, playSong, currentSong, isPlaying, toggleLike, goToArtist, openAddToPlaylistModal } = useContext(PlayerContext);
  const songs = (allSongs || []).filter(s => likedSongs.has(s.id));

  return (
    <div className="flex-1 bg-gradient-to-b from-neutral-800 to-black overflow-y-auto p-8 pb-32 no-scrollbar">
      <div className="flex flex-col md:flex-row items-end gap-6 mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
        <div className="w-52 h-52 bg-gradient-to-br from-indigo-500 to-purple-800 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center justify-center text-white rounded-md border border-white/5 shrink-0"><Heart size={80} fill="white" className="drop-shadow-lg" /></div>
        <div className="flex-1">
          <p className="text-xs font-bold uppercase text-white tracking-widest mb-2">播放列表</p>
          <h1 className="text-5xl md:text-8xl font-black text-white mb-6 tracking-tight drop-shadow-lg">已点赞的歌曲</h1>
          <div className="flex items-center gap-2 text-sm text-neutral-300 font-medium">
            <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-black font-bold text-[10px]">U</div>
            <span className="text-white hover:underline cursor-pointer">User</span><span>•</span><span>{songs.length} 首歌曲</span>
          </div>
        </div>
      </div>
      <div className="mt-8">
        <div className="flex items-center gap-6 mb-8">
           <button disabled={songs.length === 0} onClick={() => songs.length > 0 && playSong(songs[0], songs)} className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center text-black hover:scale-105 transition shadow-lg disabled:opacity-50 hover:bg-green-400">
            <Play fill="black" size={24} className="ml-1 text-black" />
          </button>
        </div>
        <div className="border-b border-white/5 mb-4 pb-2 grid grid-cols-[16px_1fr_auto] gap-4 px-4 text-[12px] text-neutral-400 font-medium uppercase tracking-widest sticky top-0 bg-neutral-900/90 backdrop-blur-sm z-10 py-2">
          <span className="text-center">#</span><span>标题</span><span className="flex justify-end"><Clock size={16} /></span>
        </div>
        <div className="space-y-1">
          {songs.map((song, idx) => {
             const isCurrent = currentSong && currentSong.id === song.id;
             return (
              <div key={song.id} onClick={() => playSong(song, songs)} className="grid grid-cols-[16px_1fr_auto] gap-4 items-center p-3 rounded-md hover:bg-white/10 transition-colors group cursor-pointer">
                <div className="flex justify-center items-center w-4">
                  {isCurrent && isPlaying ? <img src="https://open.spotifycdn.com/cdn/images/equaliser-animated-green.f93a2ef4.gif" className="h-4 w-4" alt="playing" /> : <>
                      <span className={`text-neutral-400 text-sm group-hover:hidden ${isCurrent ? 'text-green-500' : ''}`}>{idx + 1}</span>
                      <Play size={14} fill="white" className="text-white hidden group-hover:block" />
                    </>}
                </div>
                <div className="flex items-center gap-4 overflow-hidden">
                  <img src={song.cover} className="w-10 h-10 rounded shadow-sm object-cover" alt="" />
                  <div className="truncate flex flex-col justify-center">
                    <div className={`text-base font-medium truncate mb-0.5 ${isCurrent ? 'text-green-500' : 'text-white'}`}>{song.title}</div>
                    <div className="text-sm text-neutral-400 truncate hover:text-white hover:underline cursor-pointer w-fit" onClick={(e) => { e.stopPropagation(); goToArtist(song.artist); }}>{song.artist}</div>
                  </div>
                </div>
                <div className="flex items-center gap-6 md:gap-8">
                  <ListPlus size={18} className="text-neutral-500 hover:text-white cursor-pointer opacity-0 group-hover:opacity-100 transition-all" onClick={(e) => { e.stopPropagation(); openAddToPlaylistModal(song); }} title="添加到歌单" />
                  <Heart size={18} className="text-green-500 hover:scale-110 active:scale-90 transition-transform cursor-pointer" fill="currentColor" onClick={(e) => { e.stopPropagation(); toggleLike(song.id); }} />
                  <span className="text-sm text-neutral-400 w-10 text-right font-variant-numeric tabular-nums">{Math.floor(song.duration / 60)}:{(song.duration % 60).toString().padStart(2, '0')}</span>
                </div>
              </div>
            );
          })}
          {songs.length === 0 && <div className="py-20 text-center text-neutral-500 italic"><p>你还没有点赞任何歌曲。</p></div>}
        </div>
      </div>
    </div>
  );
};

const CreatePlaylistModal = () => {
  const { setShowCreateModal, createPlaylist } = useContext(PlayerContext);
  const [inputName, setInputName] = useState('');
  const [inputCover, setInputCover] = useState(''); 
  const handleCreate = () => {
    if (!inputName.trim()) return;
    createPlaylist(inputName, inputCover); 
    setShowCreateModal(false); setInputName(''); setInputCover('');
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-neutral-900 w-full max-w-md rounded-xl p-8 border border-white/5 shadow-2xl transform transition-all scale-100">
        <h2 className="text-2xl font-bold text-white mb-6 text-center">创建新的播放列表</h2>
        <div className="space-y-4">
          <div><label className="text-xs font-bold text-neutral-500 uppercase mb-2 block">列表名称</label><input type="text" placeholder="我的酷炫播放列表" value={inputName} onChange={(e) => setInputName(e.target.value)} autoFocus className="w-full bg-neutral-800 p-3 rounded-md text-white outline-none focus:ring-2 ring-green-500 transition-all" /></div>
          <div><label className="text-xs font-bold text-neutral-500 uppercase mb-2 block">封面图片链接 (URL)</label><input type="text" placeholder="https://example.com/image.jpg" value={inputCover} onChange={(e) => setInputCover(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreate()} className="w-full bg-neutral-800 p-3 rounded-md text-white outline-none focus:ring-2 ring-green-500 transition-all text-sm" />{inputCover && <div className="mt-2 w-full h-32 rounded-md overflow-hidden bg-neutral-800 border border-white/10"><img src={inputCover} alt="预览" className="w-full h-full object-cover" onError={(e) => e.target.style.display='none'} /></div>}</div>
          <div className="flex gap-4 pt-4"><button onClick={() => setShowCreateModal(false)} className="flex-1 py-3 text-white font-bold hover:text-neutral-300 transition">取消</button><button onClick={handleCreate} disabled={!inputName.trim()} className="flex-1 bg-green-500 py-3 rounded-full text-black font-bold hover:scale-105 transition disabled:opacity-50">创建</button></div>
        </div>
      </div>
    </div>
  );
};

const AuthModal = () => {
  const { showAuthModal, setShowAuthModal, login, register, showToast } = useContext(PlayerContext);
  const [isLoginView, setIsLoginView] = useState(true);
  const [formData, setFormData] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false); 

  if (!showAuthModal) return null;

  const handleSubmit = async () => {
    setError(''); 
    if (!formData.email || !formData.password) { setError('请填写完整信息'); return; }
    if (!isLoginView && !formData.username) { setError('请输入用户名'); return; }
    setIsLoading(true); 
    let result;
    try {
      if (isLoginView) { result = await login(formData.email, formData.password); } else { result = await register(formData.email, formData.password, formData.username); }
      if (result.success) { setShowAuthModal(false); setFormData({ username: '', email: '', password: '' }); showToast(isLoginView ? `欢迎回来，${result.user?.username || '朋友'}！` : '注册成功，已自动登录！'); } else { setError(result.message || '操作失败，请重试'); }
    } catch (err) { setError('网络请求发生错误'); } finally { setIsLoading(false); }
  };
  const toggleView = () => { setIsLoginView(!isLoginView); setError(''); };

  return (
    <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowAuthModal(false)}>
      <div className="bg-neutral-900 w-full max-w-md rounded-xl p-8 border border-white/5 shadow-2xl relative transform transition-all scale-100" onClick={(e) => e.stopPropagation()}>
        <button onClick={() => setShowAuthModal(false)} className="absolute top-4 right-4 text-neutral-500 hover:text-white transition-colors"><X size={24} /></button>
        <h2 className="text-3xl font-bold text-white mb-2 text-center">{isLoginView ? '欢迎回来' : '创建账号'}</h2>
        <p className="text-neutral-400 text-center mb-8 text-sm">{isLoginView ? '登录以访问你的歌单和收藏' : '加入 MusicHub 开启音乐之旅'}</p>
        <div className="space-y-4">
          {!isLoginView && <div className="animate-in slide-in-from-top-2 duration-300"><label className="text-xs font-bold text-neutral-500 uppercase mb-2 block">用户名</label><input type="text" className="w-full bg-neutral-800 p-3 rounded-md text-white outline-none focus:ring-1 focus:ring-green-500 transition-all border border-transparent focus:border-green-500/50" placeholder="给起个好听的名字" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} autoFocus={!isLoginView} /></div>}
          <div><label className="text-xs font-bold text-neutral-500 uppercase mb-2 block">电子邮箱</label><input type="email" className="w-full bg-neutral-800 p-3 rounded-md text-white outline-none focus:ring-1 focus:ring-green-500 transition-all border border-transparent focus:border-green-500/50" placeholder="name@example.com" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} autoFocus={isLoginView} /></div>
          <div><label className="text-xs font-bold text-neutral-500 uppercase mb-2 block">密码</label><input type="password" className="w-full bg-neutral-800 p-3 rounded-md text-white outline-none focus:ring-1 focus:ring-green-500 transition-all border border-transparent focus:border-green-500/50" placeholder="••••••••" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} onKeyDown={(e) => e.key === 'Enter' && handleSubmit()} /></div>
          {error && <div className="bg-red-500/10 border border-red-500/20 p-2 rounded text-center animate-in shake duration-300"><p className="text-red-500 text-xs font-bold">{error}</p></div>}
          <button onClick={handleSubmit} disabled={isLoading} className="w-full bg-green-500 py-3 rounded-full text-black font-bold hover:scale-105 active:scale-95 transition-all mt-4 disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed flex items-center justify-center gap-2">{isLoading ? <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin"></div> : isLoginView ? '登 录' : '注 册'}</button>
          <p className="text-center text-neutral-400 text-sm mt-4 select-none">{isLoginView ? '还没有账号？' : '已有账号？'}<span onClick={toggleView} className="text-white font-bold cursor-pointer hover:underline hover:text-green-400 ml-2 transition-colors">{isLoginView ? '免费注册' : '直接登录'}</span></p>
        </div>
      </div>
    </div>
  );
};

const SearchPage = () => {
  const [query, setQuery] = useState('');
  const { allSongs, playSong, currentSong, isPlaying, likedSongs, toggleLike, goToArtist, openAddToPlaylistModal } = useContext(PlayerContext);
  const filteredSongs = (allSongs || []).filter(song => song.title.toLowerCase().includes(query.toLowerCase()) || song.artist.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="flex-1 p-8 overflow-y-auto no-scrollbar bg-neutral-900 pb-32">
      <div className="max-w-xl relative mb-10 sticky top-0 z-20"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" size={20} /><input type="text" placeholder="你想听什么？" value={query} onChange={(e) => setQuery(e.target.value)} className="w-full bg-neutral-800 text-white pl-12 pr-10 py-3.5 rounded-full outline-none focus:bg-neutral-700 focus:ring-2 focus:ring-white/20 transition-all border border-transparent placeholder:text-neutral-500 font-medium shadow-lg" autoFocus />{query && <X className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 cursor-pointer hover:text-white transition-colors" size={20} onClick={() => setQuery('')} />}</div>
      <h2 className="text-2xl font-bold text-white mb-6 animate-in fade-in duration-500">{query ? `"${query}" 的搜索结果` : '浏览全部歌曲'}</h2>
      <div className="space-y-2">
        {filteredSongs.length > 0 ? (
          filteredSongs.map((song, idx) => {
            const isCurrent = currentSong && currentSong.id === song.id;
            return (
              <div key={song.id} onClick={() => playSong(song, filteredSongs)} className="flex items-center justify-between p-3 rounded-md hover:bg-white/10 transition-colors group cursor-pointer animate-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: `${idx * 50}ms`, animationFillMode: 'backwards' }}>
                <div className="flex items-center gap-4 overflow-hidden flex-1">
                  <div className="w-8 flex justify-center flex-shrink-0">{isCurrent && isPlaying ? <img src="https://open.spotifycdn.com/cdn/images/equaliser-animated-green.f93a2ef4.gif" className="h-4 w-4" alt="playing"/> : <span className="text-neutral-500 text-center w-full group-hover:hidden font-medium text-sm">{idx + 1}</span>}<Play size={16} fill="white" className="hidden group-hover:block text-white" /></div>
                  <img src={song.cover} className="w-10 h-10 rounded object-cover shadow-sm flex-shrink-0" alt="cover" />
                  <div className="truncate flex flex-col justify-center"><div className={`text-base font-medium truncate mb-0.5 ${isCurrent ? 'text-green-500' : 'text-white'}`}>{song.title}</div><div className="text-sm text-neutral-400 truncate hover:text-white hover:underline cursor-pointer w-fit transition-colors" onClick={(e) => { e.stopPropagation(); goToArtist(song.artist); }}>{song.artist}</div></div>
                </div>
                <div className="flex items-center gap-6 pl-4">
                  <ListPlus size={18} className="text-neutral-500 hover:text-white cursor-pointer opacity-0 group-hover:opacity-100 transition-all" onClick={(e) => { e.stopPropagation(); openAddToPlaylistModal(song); }} title="添加到歌单" />
                  <Heart size={18} className={`transition-all active:scale-90 cursor-pointer ${likedSongs.has(song.id) ? 'text-green-500 opacity-100' : 'text-neutral-500 opacity-0 group-hover:opacity-100 hover:text-white'}`} fill={likedSongs.has(song.id) ? "currentColor" : "none"} onClick={(e) => { e.stopPropagation(); toggleLike(song.id); }} />
                  <div className="text-xs text-neutral-400 w-10 text-right font-variant-numeric tabular-nums">{Math.floor(song.duration / 60)}:{(song.duration % 60).toString().padStart(2, '0')}</div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-neutral-500 animate-in fade-in zoom-in-95 duration-500"><Search size={48} className="mb-4 opacity-50" /><p className="text-lg font-medium">未能找到匹配 "{query}" 的歌曲</p><p className="text-sm mt-2">请尝试搜索其他关键词或艺人名称。</p></div>
        )}
      </div>
    </div>
  );
};

const LyricsPage = () => {
  const { currentSong, progress, setShowLyrics, isPlaying, likedSongs, toggleLike } = useContext(PlayerContext);
  const activeLyricRef = useRef(null);
  const [colors, setColors] = useState(['#444', '#333', '#222', '#111', '#000']);
  const [bgColor, setBgColor] = useState('#121212'); 

  const activeLyricIndex = currentSong.lyrics?.findIndex((l, i) => {
    const next = currentSong.lyrics[i + 1];
    return progress >= l.time && (!next || progress < next.time);
  }) ?? -1;

  useEffect(() => {
    if (activeLyricRef.current) {
      activeLyricRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeLyricIndex]);

  useEffect(() => {
    if (!currentSong?.cover) return;
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = currentSong.cover;
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 10; canvas.height = 10;
        ctx.drawImage(img, 0, 0, 10, 10);
        const data = ctx.getImageData(0, 0, 10, 10).data;
        const getRGB = (x, y) => { const i = (y * 10 + x) * 4; return `rgb(${data[i]}, ${data[i+1]}, ${data[i+2]})`; };
        setColors([getRGB(0, 0), getRGB(9, 0), getRGB(0, 9), getRGB(9, 9), getRGB(5, 5)]);
        setBgColor(getRGB(5, 5));
      } catch (e) { console.warn("颜色提取失败", e); }
    };
  }, [currentSong.cover]);

  return (
    <div className="fixed inset-0 z-[70] animate-in slide-in-from-bottom duration-500 flex flex-col items-center overflow-hidden" style={{ backgroundColor: bgColor, transition: 'background-color 1s ease' }}>
      <style>{`
        @keyframes float1 { 0%,100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(30%, 20%) scale(1.2); } }
        @keyframes float2 { 0%,100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(-20%, 30%) scale(1.1); } }
        @keyframes float3 { 0%,100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(20%, -20%) scale(0.9); } }
        @keyframes float4 { 0%,100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(-30%, -20%) scale(1.3); } }
        @keyframes float5 { 0%,100% { transform: translate(0, 0) scale(1.2); } 50% { transform: translate(10%, 10%) scale(0.8); } }
        .vibrant-blob { position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.8; mix-blend-mode: screen; animation-timing-function: ease-in-out; animation-iteration-count: infinite; will-change: transform; }
        .color-booster { filter: saturate(300%) brightness(120%) contrast(110%); }
        .mask-image-linear { mask-image: linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%); -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%); }
      `}</style>
      <div className="absolute inset-0 overflow-hidden pointer-events-none color-booster">
        <div className="vibrant-blob w-[70vw] h-[70vw] -top-[10%] -left-[10%]" style={{ backgroundColor: colors[0], animation: 'float1 15s infinite' }} />
        <div className="vibrant-blob w-[80vw] h-[80vw] -top-[20%] -right-[20%]" style={{ backgroundColor: colors[1], animation: 'float2 18s infinite reverse' }} />
        <div className="vibrant-blob w-[70vw] h-[70vw] -bottom-[10%] -left-[20%]" style={{ backgroundColor: colors[2], animation: 'float3 20s infinite' }} />
        <div className="vibrant-blob w-[90vw] h-[90vw] -bottom-[20%] -right-[10%]" style={{ backgroundColor: colors[3], animation: 'float4 22s infinite reverse' }} />
        <div className="vibrant-blob w-[50vw] h-[50vw] top-[25%] left-[25%]" style={{ backgroundColor: colors[4], animation: 'float5 25s infinite', opacity: 0.6 }} />
      </div>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[100px]" /> 
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60 pointer-events-none" />
      <button onClick={() => setShowLyrics(false)} className="absolute top-6 left-6 md:top-8 md:left-8 text-white/70 hover:text-white transition z-20 p-2 bg-black/10 hover:bg-black/20 rounded-full backdrop-blur-md border border-white/10"><ChevronDown size={32} /></button>
      <div className="flex flex-col md:flex-row w-full max-w-6xl h-full items-center gap-6 md:gap-12 pt-16 md:pt-20 relative px-6 md:px-0 z-10">
        <div className="w-full md:w-1/2 flex flex-col items-center gap-6 md:gap-8 shrink-0">
          <div className="relative group"><img src={currentSong.cover} className={`relative z-10 w-48 h-48 md:w-96 md:h-96 rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.4)] transition-transform duration-1000 border border-white/10 object-cover ${isPlaying ? 'scale-105' : 'scale-100'}`} alt="cover" /></div>
          <div className="flex items-center justify-between w-full max-w-xs md:max-w-sm relative z-10">
            <div className="flex-1 min-w-0 text-center md:text-left"><h2 className="text-2xl md:text-3xl font-bold text-white truncate px-2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">{currentSong.title}</h2><p className="text-lg md:text-xl text-white/90 truncate px-2 font-medium drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">{currentSong.artist}</p></div>
            <Heart size={28} className={`cursor-pointer transition-all active:scale-125 flex-shrink-0 drop-shadow-md ${likedSongs.has(currentSong.id) ? 'text-green-400' : 'text-white/70 hover:text-white'}`} fill={likedSongs.has(currentSong.id) ? "currentColor" : "none"} onClick={() => toggleLike(currentSong.id)} />
          </div>
        </div>
        <div className="w-full md:w-1/2 flex flex-col items-center md:items-start h-full overflow-y-auto no-scrollbar scroll-smooth relative mask-image-linear">
          <div className="space-y-6 md:space-y-10 pb-32 md:pb-40 pt-20 md:pt-40 text-center md:text-left w-full px-4">
            {currentSong.lyrics?.map((line, idx) => (
              <p key={idx} ref={idx === activeLyricIndex ? activeLyricRef : null} className={`transition-all duration-700 font-bold cursor-default origin-center md:origin-left drop-shadow-md ${idx === activeLyricIndex ? 'text-white scale-110 md:scale-105 text-xl md:text-4xl opacity-100' : 'text-white/50 hover:text-white/80 scale-100 text-lg md:text-3xl blur-[0.5px]'}`}>{line.text}</p>
            )) || <p className="text-white/50 mt-20 text-xl">纯音乐 / 暂无歌词</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

const AddToPlaylistModal = () => {
  const { playlists, addToPlaylistModal, closeAddToPlaylistModal, addSongToPlaylist, setShowCreateModal, user } = useContext(PlayerContext);
  if (!addToPlaylistModal.isOpen) return null;
  const myPlaylists = playlists.filter(pl => {
    const currentUserId = user?.id || user?._id;
    return pl.userId === currentUserId;
  });

  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200" onClick={closeAddToPlaylistModal}>
      <div className="bg-neutral-900 w-full max-w-sm rounded-xl border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-white/5 bg-neutral-800/50"><h2 className="text-lg font-bold text-white text-center">添加到歌单</h2><p className="text-xs text-neutral-400 text-center mt-1 line-clamp-1">将 "{addToPlaylistModal.song?.title}" 添加到...</p></div>
        <div className="overflow-y-auto p-2 no-scrollbar flex-1">
          <div onClick={() => { closeAddToPlaylistModal(); setShowCreateModal(true); }} className="flex items-center gap-4 p-3 hover:bg-white/10 rounded-md cursor-pointer text-green-500 group transition">
            <div className="w-12 h-12 bg-neutral-800 flex items-center justify-center rounded group-hover:bg-neutral-700"><Plus size={24} /></div><span className="font-bold">新建歌单</span>
          </div>
          <div className="h-px bg-white/5 my-2 mx-2"></div>
          {myPlaylists.length > 0 ? (
            myPlaylists.map(playlist => (
              <div key={playlist.id || playlist._id} onClick={() => addSongToPlaylist(playlist.id || playlist._id, addToPlaylistModal.song)} className="flex items-center gap-4 p-3 hover:bg-white/10 rounded-md cursor-pointer transition group">
                <img src={playlist.cover} className="w-12 h-12 object-cover rounded shadow-sm" alt="" /><div className="flex-1 min-w-0"><div className="text-white font-medium truncate">{playlist.name}</div><div className="text-xs text-neutral-500">{playlist.songs.length} 首歌曲</div></div>
              </div>
            ))
          ) : ( <div className="text-center py-6 text-neutral-500 text-sm flex flex-col items-center"><span>你还没有创建任何歌单</span><span className="text-xs opacity-50 mt-1">(或者未登录)</span></div> )}
        </div>
        <div className="p-4 border-t border-white/5 bg-neutral-800/50 text-center"><button onClick={closeAddToPlaylistModal} className="text-sm text-neutral-400 hover:text-white transition">取消</button></div>
      </div>
    </div>
  );
};

const HomePage = () => {
  const { allSongs, playlists, playSong, currentSong, isPlaying, setActiveTab, setCurrentPlaylist, currentPlaylist, setCurrentArtist, currentArtist, goToArtist, openAddToPlaylistModal, user, setShowAuthModal, logout, themeColor } = useContext(PlayerContext);
  const scrollContainerRef = useRef(null);
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
    return list.slice(0, 5);
  }, [allSongs]);

  const scrollPlaylists = (direction) => {
    if (scrollContainerRef.current) {
      const scrollAmount = scrollContainerRef.current.clientWidth * 0.8; 
      scrollContainerRef.current.scrollBy({ left: direction === 'next' ? scrollAmount : -scrollAmount, behavior: 'smooth' });
    }
  };

  const isGirlishMode = themeColor === '#FF9EAA';
  const fullScreenBrightStyle = isGirlishMode ? { background: 'transparent' } : {
    background: `radial-gradient(circle at 0% 0%, ${themeColor}AA 0%, transparent 70%), radial-gradient(circle at 100% 0%, ${themeColor}66 0%, transparent 50%), #0a0a0aff `,
    transition: 'background 1s ease-in-out',
  };

  if (currentArtist) return <ArtistPage />;
  if (currentPlaylist) {
    return (
      <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-32 no-scrollbar transition-all" style={fullScreenBrightStyle}>
        <PlaylistDetail playlist={currentPlaylist} />
      </div>
    );
  }

  return (
    <div className="flex-1 w-full overflow-y-auto p-4 md:p-8 pb-32 no-scrollbar relative transition-all" style={fullScreenBrightStyle}>
      {!isGirlishMode && (
        <div className="absolute top-0 left-0 w-[80%] h-[80%] -z-10 blur-[150px] opacity-50 pointer-events-none transition-colors duration-1000 rounded-full" style={{ backgroundColor: themeColor }}></div>
      )}
      <header className="flex justify-between items-center mb-6 md:mb-8 sticky top-0 z-10 py-4 -my-4 bg-neutral-900/0 backdrop-blur-sm transition-colors">
        <div className="hidden md:flex gap-2">
          <div className="w-8 h-8 bg-black/40 rounded-full flex items-center justify-center text-white cursor-pointer hover:bg-black/60 transition">{'<'}</div>
          <div className="w-8 h-8 bg-black/40 rounded-full flex items-center justify-center text-white cursor-pointer hover:bg-black/60 transition">{'>'}</div>
        </div>
        <div className="flex items-center gap-4 ml-auto md:ml-0">
          {user ? (
            <div className="flex items-center gap-3 bg-black/40 rounded-full p-1 pr-4 hover:bg-neutral-800 transition cursor-pointer group relative border border-white/5">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-black font-bold text-xs shadow-lg transition-colors duration-500" style={{ backgroundColor: themeColor }}>{user.username[0].toUpperCase()}</div>
              <span className="text-white font-bold text-sm max-w-[100px] truncate">{user.username}</span>
              <div className="absolute top-full right-0 w-32 pt-2 z-50 hidden group-hover:block">
                <div className="bg-neutral-800 rounded-md shadow-xl border border-white/10 overflow-hidden">
                  <button onClick={(e) => { e.stopPropagation(); logout(); }} className="w-full text-left px-4 py-3 md:py-2 text-sm text-red-400 hover:bg-white/10 hover:text-red-300 font-bold transition-colors">退出登录</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex gap-2 md:gap-4"><button onClick={() => setShowAuthModal(true)} className="text-neutral-400 font-bold hover:text-white transition px-2 py-1">注册</button><button onClick={() => setShowAuthModal(true)} className="bg-white text-black px-4 md:px-6 py-2 rounded-full font-bold hover:scale-105 transition text-sm md:text-base">登录</button></div>
          )}
        </div>
      </header>

      <section className="mb-8 md:mb-10 group/section min-w-0 w-full">
       <div className="flex justify-between items-center mb-4 md:mb-6">
         <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">今日推荐</h2>
         {playlists.length > 0 && (
           <div className="flex gap-2 opacity-100 md:opacity-0 group-hover/section:opacity-100 transition-opacity duration-300">
             <button onClick={() => scrollPlaylists('prev')} className="w-8 h-8 md:w-9 md:h-9 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition text-white hover:scale-105 active:scale-95 backdrop-blur-md"><ArrowLeft size={18} /></button>
             <button onClick={() => scrollPlaylists('next')} className="w-8 h-8 md:w-9 md:h-9 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition text-white hover:scale-105 active:scale-95 backdrop-blur-md"><ArrowRight size={18} /></button>
           </div>
         )}
       </div>
       <div ref={scrollContainerRef} className="flex gap-4 md:gap-6 overflow-x-auto no-scrollbar pb-4 scroll-smooth snap-x snap-mandatory w-full max-w-full">
          {playlists.length > 0 ? (
            playlists.map(playlist => (
              <div key={playlist.id} onClick={() => setCurrentPlaylist(playlist)} className="flex-shrink-0 w-40 md:w-56 snap-start bg-white/5 backdrop-blur-md hover:bg-white/10 border border-white/5 p-3 md:p-4 rounded-xl transition duration-300 group cursor-pointer overflow-hidden relative">
                <div className="relative mb-3 md:mb-4 aspect-square overflow-hidden rounded-lg shadow-lg">
                  <img src={playlist.cover} className="w-full h-full object-cover group-hover:scale-110 transition duration-500" alt="" />
                  <button className="absolute bottom-2 right-2 w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center shadow-xl opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300" style={{ backgroundColor: themeColor }}>
                    <Play fill="black" stroke="none" className="ml-1 text-black w-4 h-4 md:w-5 md:h-5" />
                  </button>
                </div>
                <h3 className="font-bold mb-1 truncate text-white text-sm md:text-base">{playlist.name}</h3>
                <p className="text-neutral-500 text-xs md:text-sm line-clamp-2">{playlist.description}</p>
              </div>
            ))
          ) : ( <div className="w-full py-10 text-center border border-white/5 rounded-xl bg-white/5 backdrop-blur-sm"><p className="text-neutral-400 text-sm">暂无歌单，点击左侧或底部 "+" 号创建</p></div> )}
        </div>
      </section>

      <section className="mb-8 md:mb-10 min-w-0 w-full">
        <h2 className="text-xl md:text-2xl font-bold text-white mb-4 md:mb-6 tracking-tight">推荐艺人</h2>
        <div className="flex gap-4 md:gap-6 overflow-x-auto pb-4 no-scrollbar w-full max-w-full">
          {recommendedArtists.map((artist, idx) => (
            <div key={idx} onClick={() => setCurrentArtist(artist.name)} className="flex flex-col items-center gap-3 md:gap-4 min-w-[100px] md:min-w-[140px] p-2 md:p-4 rounded-xl hover:bg-neutral-800/40 transition cursor-pointer group">
              <div className="w-24 h-24 md:w-32 md:h-32 rounded-full shadow-lg relative overflow-hidden bg-neutral-800 border-2 transition-all duration-500" style={{ borderColor: 'transparent' }} onMouseEnter={(e) => e.currentTarget.style.borderColor = themeColor} onMouseLeave={(e) => e.currentTarget.style.borderColor = 'transparent'}>
                <img src={artist.cover} alt={artist.name} className="w-full h-full object-cover group-hover:scale-110 transition duration-500" />
              </div>
              <div className="text-center w-full"><div className="font-bold text-white mb-1 text-sm md:text-base group-hover:underline truncate w-full">{artist.name}</div><div className="text-[10px] md:text-xs text-neutral-500 font-medium">艺人</div></div>
            </div>
          ))}
          {recommendedArtists.length === 0 && <div className="text-neutral-500 text-sm">暂无艺人数据</div>}
        </div>
      </section>

      <section className="min-w-0 w-full">
        <div className="flex justify-between items-end mb-4 md:mb-6">
           <h2 className="text-xl md:text-xl font-bold text-white hover:underline cursor-pointer tracking-tight">为您推荐</h2>
           <button onClick={() => setActiveTab('search')} className="text-xs font-bold text-neutral-500 hover:text-white hover:underline cursor-pointer uppercase tracking-widest transition-colors duration-200">全部显示</button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
          {(allSongs || []).map(song => {
            const isCurrent = currentSong && currentSong.id === song.id;
            return (
              <div key={song.id} onClick={() => playSong(song, allSongs)} className="bg-neutral-900/40 p-3 md:p-4 rounded-lg hover:bg-neutral-800/60 transition group cursor-pointer border border-transparent hover:border-white/5 relative">
                <div className="relative mb-3 md:mb-4">
                  <img src={song.cover} className="w-full aspect-square object-cover rounded shadow-2xl border border-white/5" alt="" />
                  <div className={`absolute bottom-2 right-2 shadow-xl w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all duration-300 ${ (isCurrent && isPlaying) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0'}`} style={{ backgroundColor: themeColor }}>
                    { (isCurrent && isPlaying) ? <Pause fill="black" size={16} className="text-black" /> : <Play fill="black" size={16} className="ml-0.5 text-black" /> }
                  </div>
                </div>
                <div className="absolute top-2 right-2 z-10 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">
                  <button onClick={(e) => { e.stopPropagation(); openAddToPlaylistModal(song); }} className="w-7 h-7 md:w-8 md:h-8 bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center text-white transition shadow-lg border border-white/10 active:scale-90" onMouseEnter={(e) => e.currentTarget.style.backgroundColor = themeColor} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.6)'}>
                      <ListPlus size={14} className="md:w-4 md:h-4" />
                    </button>
                 </div>
                <div className="text-white font-bold text-xs md:text-sm mb-1 truncate">{song.title}</div>
                <div className="text-neutral-500 text-[10px] md:text-xs truncate hover:text-white hover:underline cursor-pointer w-fit transition-colors" onClick={(e) => { e.stopPropagation(); goToArtist(song.artist); }}>{song.artist}</div>
              </div>
            );
          })}
        </div>
        {(!allSongs || allSongs.length === 0) && <div className="text-neutral-500 py-10 text-center">正在加载歌曲...</div>}
      </section>
    </div>
  );
};

// 1. 全局消息提示组件
const GlobalToast = () => {
  const { toast } = useContext(PlayerContext);
  if (!toast) return null;
  return (
    <div className={`fixed top-12 left-1/2 -translate-x-1/2 px-8 py-3 rounded-full shadow-2xl z-[200] font-bold text-sm flex items-center gap-2 animate-in slide-in-from-top-4 fade-in duration-300 ${toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-green-500 text-black'}`}>
      {toast.type === 'error' ? <span className="font-black">✕</span> : <span className="font-black">✓</span>}{toast.message}
    </div>
  );
};

// 3. 应用主界面包装器
const AppWrapper = () => {
  const { activeTab, showLyrics, showCreateModal, addToPlaylistModal, showAuthModal, themeColor } = useContext(PlayerContext);
  const isGirlishMode = themeColor === '#FF9EAA';

  return (
    <div className={`flex h-screen overflow-hidden transition-all duration-1000 relative text-white ${isGirlishMode ? 'girlish-theme selection:bg-[#FF9EAA] selection:text-white' : 'font-sans selection:bg-green-500 selection:text-black'}`} style={{ backgroundColor: isGirlishMode ? '#231518' : 'black' }}>
      <GlobalStyles />
      <SparkleBackground isActive={isGirlishMode} />
      <div className="relative z-10 hidden md:block"><Sidebar /></div>
      <div className="flex-1 flex flex-col relative h-full z-10">
        {activeTab === 'home' && <HomePage />}
        {activeTab === 'search' && <SearchPage />}
        {activeTab === 'liked' && <LikedSongsPage />}
        {activeTab === 'artists' && <FollowedArtistsPage />}
        <PlayerBar />
        <MobileNav />
      </div>
      {showLyrics && <LyricsPage />}
      {showCreateModal && <CreatePlaylistModal />}
      {addToPlaylistModal.isOpen && <AddToPlaylistModal />}
      {showAuthModal && <AuthModal />}
      <GlobalToast /> 
    </div>
  );
};

export default function App() {
  return (
    <PlayerProvider>
      <AppWrapper />
    </PlayerProvider>
  );
}