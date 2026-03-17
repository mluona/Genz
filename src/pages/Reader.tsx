import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, onSnapshot, collection, query, where, getDocs, updateDoc, arrayUnion, arrayRemove, Timestamp, orderBy, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Series, Chapter, Comment } from '../types';
import { ChevronLeft, ChevronRight, Settings, Maximize2, List, Moon, Sun, Layout, ArrowUp, Bookmark, BookmarkCheck, Menu, X, Share2, MessageSquare, Heart } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { motion, AnimatePresence } from 'motion/react';

export const Reader: React.FC = () => {
  const { slug, chapterNum } = useParams<{ slug: string; chapterNum: string }>();
  const { user, profile } = useAuth();
  const { theme: appTheme, toggleTheme: toggleAppTheme } = useTheme();
  const navigate = useNavigate();
  const [series, setSeries] = useState<Series | null>(null);
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Settings
  const [viewMode, setViewMode] = useState<'vertical' | 'horizontal'>('vertical');
  const [fontSize, setFontSize] = useState(18);
  const [lineHeight, setLineHeight] = useState(1.8);
  const [currentPage, setCurrentPage] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [readingProgress, setReadingProgress] = useState(0);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [showComments, setShowComments] = useState(false);

  useEffect(() => {
    if (!series || !chapter) return;
    const commentsQuery = query(collection(db, 'comments'), orderBy('timestamp', 'desc'));
    const unsubscribeComments = onSnapshot(commentsQuery, (snapshot) => {
      setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment)).filter(c => c.seriesId === series.id && c.chapterId === chapter.id));
    });
    return () => unsubscribeComments();
  }, [series, chapter]);

  const handlePostComment = async () => {
    if (!user || !series || !chapter || !newComment.trim()) return;
    try {
      await addDoc(collection(db, 'comments'), {
        seriesId: series.id,
        chapterId: chapter.id,
        userId: user.uid,
        username: profile?.username || user.displayName || 'Anonymous',
        userAvatar: profile?.profilePicture || user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
        text: newComment.trim(),
        timestamp: Timestamp.now(),
        likes: 0
      });
      setNewComment('');
    } catch (error) {
      console.error("Error posting comment:", error);
      alert("Failed to post comment");
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${series?.title} - Chapter ${chapter?.chapterNumber}`,
          text: `Read Chapter ${chapter?.chapterNumber} of ${series?.title} on GENZ!`,
          url: window.location.href,
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRefs = useRef<(HTMLImageElement | null)[]>([]);

  // Track current page in vertical mode and reading progress
  useEffect(() => {
    const handleScroll = () => {
      // Reading progress
      const totalHeight = document.body.scrollHeight - window.innerHeight;
      const progress = totalHeight > 0 ? (window.scrollY / totalHeight) * 100 : 0;
      setReadingProgress(progress);

      if (viewMode !== 'vertical') return;

      const scrollPosition = window.scrollY + window.innerHeight / 2;
      let current = 0;
      for (let i = 0; i < imageRefs.current.length; i++) {
        const img = imageRefs.current[i];
        if (img && img.offsetTop <= scrollPosition) {
          current = i;
        } else {
          break;
        }
      }
      setCurrentPage(current);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [viewMode, chapter]);

  useEffect(() => {
    if (!slug || !chapterNum) return;

    // Fetch series and chapters
    const fetchSeries = async () => {
      // Assuming slug is ID for now
      const seriesDoc = await getDocs(query(collection(db, 'series'), where('slug', '==', slug)));
      if (!seriesDoc.empty) {
        const s = { id: seriesDoc.docs[0].id, ...seriesDoc.docs[0].data() } as Series;
        setSeries(s);

        const chaptersQuery = query(collection(db, `series/${s.id}/chapters`), where('chapterNumber', '==', Number(chapterNum)));
        const chapterSnapshot = await getDocs(chaptersQuery);
        if (!chapterSnapshot.empty) {
          const chapterData = { id: chapterSnapshot.docs[0].id, ...chapterSnapshot.docs[0].data() } as Chapter;
          
          if (s.type !== 'Novel') {
            const pagesQuery = query(collection(db, `series/${s.id}/chapters/${chapterData.id}/pages`), orderBy('pageNumber', 'asc'));
            const pagesSnapshot = await getDocs(pagesQuery);
            if (!pagesSnapshot.empty) {
              chapterData.content = pagesSnapshot.docs.map(d => d.data().content);
            }
          }
          
          setChapter(chapterData);
          
          // Save to history
          if (user) {
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, {
              history: arrayUnion({
                seriesId: s.id,
                lastChapterId: chapterSnapshot.docs[0].id,
                timestamp: Timestamp.now()
              })
            });
          }
        }

        const allChaptersQuery = query(collection(db, `series/${s.id}/chapters`), orderBy('chapterNumber', 'asc'));
        const allChaptersSnapshot = await getDocs(allChaptersQuery);
        setChapters(allChaptersSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Chapter)));
      }
      setLoading(false);
    };

    fetchSeries();
  }, [slug, chapterNum, user]);

  useEffect(() => {
    if (profile && chapter) {
      setIsBookmarked(profile.bookmarks?.includes(chapter.id) || false);
    }
  }, [profile, chapter]);

  const toggleBookmark = async () => {
    if (!user || !chapter) return;
    const userRef = doc(db, 'users', user.uid);
    if (isBookmarked) {
      await updateDoc(userRef, { bookmarks: arrayRemove(chapter.id) });
      setIsBookmarked(false);
    } else {
      await updateDoc(userRef, { bookmarks: arrayUnion(chapter.id) });
      setIsBookmarked(true);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const nextChapter = chapters.find(c => c.chapterNumber === Number(chapterNum) + 1);
  const prevChapter = chapters.find(c => c.chapterNumber === Number(chapterNum) - 1);

  if (loading) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center"><div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!series || !chapter) return <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">Chapter not found</div>;

  return (
    <div 
      ref={containerRef}
      className="min-h-screen transition-colors duration-500 bg-zinc-950 text-white"
    >
      {/* Top Navigation Bar */}
      <motion.div 
        initial={{ y: -100 }}
        animate={{ y: showControls ? 0 : -100 }}
        className="fixed top-0 left-0 right-0 z-50 bg-zinc-950/80 backdrop-blur-xl border-b border-white/5"
      >
        <div className="absolute bottom-0 left-0 h-0.5 bg-emerald-500 transition-all duration-150" style={{ width: `${readingProgress}%` }} />
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-6">
            <button 
              onClick={() => setShowSidebar(true)}
              className="p-3 bg-zinc-900 hover:bg-zinc-800 rounded-2xl transition-all text-zinc-400 hover:text-white"
            >
              <Menu className="w-5 h-5" />
            </button>
            <button 
              onClick={() => navigate(`/series/${series.slug}`)}
              className="p-3 bg-zinc-900 hover:bg-zinc-800 rounded-2xl transition-all group"
              title="Back to Series"
            >
              <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            </button>
            <div className="hidden sm:block">
              <h1 className="text-sm font-black tracking-tight truncate max-w-xs" dir="auto">{series.title}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Chapter {chapter.chapterNumber}</span>
                <div className="w-1 h-1 bg-zinc-700 rounded-full" />
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest" dir="auto">{chapter.title || 'Untitled'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {series.type === 'Novel' ? (
              <div className="flex items-center gap-2 bg-zinc-900 p-1 rounded-2xl border border-white/5 mr-2">
                <button 
                  onClick={(e) => { e.stopPropagation(); setFontSize(Math.max(12, fontSize - 2)) }}
                  className="p-2 text-zinc-500 hover:text-white text-xs font-black"
                >
                  A-
                </button>
                <div className="w-px h-4 bg-white/5" />
                <button 
                  onClick={(e) => { e.stopPropagation(); setFontSize(Math.min(32, fontSize + 2)) }}
                  className="p-2 text-zinc-500 hover:text-white text-xs font-black"
                >
                  A+
                </button>
              </div>
            ) : (
              <div className="flex bg-zinc-900 p-1 rounded-2xl border border-white/5">
                <button 
                  onClick={() => setViewMode('vertical')}
                  className={`p-2 rounded-xl transition-all ${viewMode === 'vertical' ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20' : 'text-zinc-500 hover:text-white'}`}
                  title="Vertical Scroll"
                >
                  <Layout className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setViewMode('horizontal')}
                  className={`p-2 rounded-xl transition-all ${viewMode === 'horizontal' ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20' : 'text-zinc-500 hover:text-white'}`}
                  title="Horizontal Paging"
                >
                  <Layout className="w-4 h-4 rotate-90" />
                </button>
              </div>
            )}

            <div className="h-6 w-px bg-white/5 mx-2" />

            {user && (
              <button 
                onClick={toggleBookmark}
                className={`p-3 rounded-2xl transition-all ${isBookmarked ? 'bg-emerald-500/20 text-emerald-500' : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white'}`}
                title={isBookmarked ? "Remove Bookmark" : "Bookmark Chapter"}
              >
                {isBookmarked ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
              </button>
            )}

            <button 
              onClick={() => setShowComments(true)}
              className="p-3 bg-zinc-900 hover:bg-zinc-800 rounded-2xl transition-all text-zinc-400 hover:text-white relative"
              title="Comments"
            >
              <MessageSquare className="w-4 h-4" />
              {comments.length > 0 && (
                <div className="absolute -top-1 -right-1 bg-emerald-500 text-black text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                  {comments.length > 99 ? '99+' : comments.length}
                </div>
              )}
            </button>

            <button 
              onClick={handleShare}
              className="p-3 bg-zinc-900 hover:bg-zinc-800 rounded-2xl transition-all text-zinc-400 hover:text-white"
              title="Share Chapter"
            >
              <Share2 className="w-4 h-4" />
            </button>

            <button 
              onClick={toggleAppTheme}
              className="p-3 bg-zinc-900 hover:bg-zinc-800 rounded-2xl transition-all text-zinc-400 hover:text-white"
            >
              {appTheme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            
            <button 
              onClick={toggleFullscreen}
              className="p-3 bg-zinc-900 hover:bg-zinc-800 rounded-2xl transition-all text-zinc-400 hover:text-white"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Reader Content Area */}
      <div 
        className={`relative flex flex-col items-center ${viewMode === 'vertical' ? 'pt-24 pb-40' : 'h-screen pt-20 pb-0 overflow-hidden'}`}
        onClick={() => setShowControls(!showControls)}
      >
        {series.type === 'Novel' ? (
          <div className="max-w-3xl w-full px-6 py-12 space-y-8">
            <div 
              className="font-serif leading-relaxed whitespace-pre-wrap"
              style={{ fontSize: `${fontSize}px`, lineHeight: lineHeight }}
              dir="auto"
            >
              {chapter.content[0]}
            </div>
            
            {/* End of Chapter Actions */}
            <div className="m3-section-gap text-center space-y-8">
              <div className="h-px w-full bg-gradient-to-r from-transparent via-zinc-800 to-transparent" />
              <h2 className="text-3xl font-black tracking-tighter uppercase italic text-zinc-500">End of Chapter</h2>
              <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
                {prevChapter && (
                  <button 
                    onClick={() => navigate(`/series/${slug}/${prevChapter.chapterNumber}`)}
                    className="flex items-center gap-3 px-8 py-4 bg-zinc-900 text-white font-black rounded-2xl hover:bg-zinc-800 transition-all border border-white/5 w-full sm:w-auto justify-center"
                  >
                    <ChevronLeft className="w-5 h-5" /> Previous Chapter
                  </button>
                )}
                {nextChapter && (
                  <button 
                    onClick={() => navigate(`/series/${slug}/${nextChapter.chapterNumber}`)}
                    className="flex items-center gap-3 px-12 py-5 bg-emerald-500 text-black font-black rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-xl shadow-emerald-500/20 w-full sm:w-auto justify-center"
                  >
                    Next Chapter <ChevronRight className="w-5 h-5" />
                  </button>
                )}
                {!nextChapter && (
                  <button 
                    onClick={() => navigate(`/series/${series.slug}`)}
                    className="flex items-center gap-3 px-8 py-4 bg-zinc-900 text-white font-black rounded-2xl hover:bg-zinc-800 transition-all border border-white/5 w-full sm:w-auto justify-center"
                  >
                    Back to Series
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : viewMode === 'vertical' ? (
          <div className="max-w-3xl w-full shadow-2xl relative">
            {/* Floating Page Indicator for Vertical Mode */}
            <div className="fixed bottom-12 right-6 sm:right-12 z-40 px-4 py-2 bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-full text-[10px] font-black tracking-widest text-white shadow-2xl">
              {currentPage + 1} <span className="text-zinc-500 mx-1">/</span> {chapter.content.length}
            </div>

            {chapter.content.map((url, i) => (
              <motion.img 
                key={i} 
                ref={el => { imageRefs.current[i] = el; }}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                src={url || undefined} 
                alt={`Page ${i + 1}`} 
                className="w-full h-auto block" 
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            ))}
            
            {/* End of Chapter Actions */}
            <div className="m3-section-gap px-4 text-center space-y-8">
              <div className="h-px w-full bg-gradient-to-r from-transparent via-zinc-800 to-transparent" />
              <h2 className="text-3xl font-black tracking-tighter uppercase italic text-zinc-500">End of Chapter</h2>
              <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
                {prevChapter && (
                  <button 
                    onClick={() => navigate(`/series/${slug}/${prevChapter.chapterNumber}`)}
                    className="flex items-center gap-3 px-8 py-4 bg-zinc-900 text-white font-black rounded-2xl hover:bg-zinc-800 transition-all border border-white/5 w-full sm:w-auto justify-center"
                  >
                    <ChevronLeft className="w-5 h-5" /> Previous Chapter
                  </button>
                )}
                {nextChapter && (
                  <button 
                    onClick={() => navigate(`/series/${slug}/${nextChapter.chapterNumber}`)}
                    className="flex items-center gap-3 px-12 py-5 bg-emerald-500 text-black font-black rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-xl shadow-emerald-500/20 w-full sm:w-auto justify-center"
                  >
                    Next Chapter <ChevronRight className="w-5 h-5" />
                  </button>
                )}
                {!nextChapter && (
                  <button 
                    onClick={() => navigate(`/series/${series.slug}`)}
                    className="flex items-center gap-3 px-8 py-4 bg-zinc-900 text-white font-black rounded-2xl hover:bg-zinc-800 transition-all border border-white/5 w-full sm:w-auto justify-center"
                  >
                    Back to Series
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="relative w-full h-full flex items-center justify-center bg-black">
            <motion.img 
              key={currentPage}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              src={chapter.content[currentPage] || undefined} 
              alt={`Page ${currentPage + 1}`} 
              className="max-h-full max-w-full object-contain shadow-2xl"
              referrerPolicy="no-referrer"
            />
            
            {/* Navigation Overlays */}
            <div 
              className="absolute left-0 top-0 w-1/3 h-full cursor-pointer z-10 group"
              onClick={(e) => { e.stopPropagation(); setCurrentPage(Math.max(0, currentPage - 1)) }}
            >
              <div className="absolute left-8 top-1/2 -translate-y-1/2 p-4 bg-black/20 backdrop-blur-md rounded-full opacity-0 group-hover:opacity-100 transition-all">
                <ChevronLeft className="w-8 h-8 text-white" />
              </div>
            </div>
            <div 
              className="absolute right-0 top-0 w-1/3 h-full cursor-pointer z-10 group"
              onClick={(e) => { e.stopPropagation(); setCurrentPage(Math.min(chapter.content.length - 1, currentPage + 1)) }}
            >
              <div className="absolute right-8 top-1/2 -translate-y-1/2 p-4 bg-black/20 backdrop-blur-md rounded-full opacity-0 group-hover:opacity-100 transition-all">
                <ChevronRight className="w-8 h-8 text-white" />
              </div>
            </div>

            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 px-6 py-3 bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-full text-xs font-black tracking-widest text-white z-20 shadow-2xl">
              {currentPage + 1} <span className="text-zinc-500 mx-2">/</span> {chapter.content.length}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Navigation Controls */}
      <motion.div 
        initial={{ y: 100 }}
        animate={{ y: showControls ? 0 : 100 }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-950/80 backdrop-blur-xl border-t border-white/5 px-4 py-6"
      >
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-6">
          <button 
            disabled={!prevChapter}
            onClick={() => navigate(`/series/${slug}/${Number(chapterNum) - 1}`)}
            className="flex-1 flex items-center justify-center gap-3 py-4 bg-zinc-900 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest disabled:opacity-20 hover:bg-zinc-800 transition-all border border-white/5"
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>
          
          <div className="flex-1">
            <div className="relative">
              <select 
                value={chapterNum}
                onChange={(e) => navigate(`/series/${slug}/${e.target.value}`)}
                className="w-full bg-zinc-900 border border-white/5 rounded-[1.5rem] px-6 py-4 text-[10px] font-black uppercase tracking-widest focus:outline-none appearance-none cursor-pointer text-center hover:bg-zinc-800 transition-all"
                dir="auto"
              >
                {chapters.map(c => (
                  <option key={c.id} value={c.chapterNumber}>Chapter {c.chapterNumber} {c.title ? `- ${c.title}` : ''}</option>
                ))}
              </select>
              <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none">
                <List className="w-3 h-3 text-zinc-500" />
              </div>
            </div>
          </div>

          <button 
            disabled={!nextChapter}
            onClick={() => navigate(`/series/${slug}/${Number(chapterNum) + 1}`)}
            className="flex-1 flex items-center justify-center gap-3 py-4 bg-emerald-500 text-black rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest disabled:opacity-20 hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </motion.div>

      {/* Scroll to Top Button */}
      {viewMode === 'vertical' && (
        <motion.button 
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: showControls ? 1 : 0, scale: showControls ? 1 : 0.5 }}
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-32 right-8 p-5 bg-emerald-500 text-black rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all z-40"
        >
          <ArrowUp className="w-6 h-6" />
        </motion.button>
      )}

      {/* Chapter List Sidebar */}
      <AnimatePresence>
        {showSidebar && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSidebar(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 bottom-0 w-80 bg-zinc-950 border-r border-white/5 z-[70] flex flex-col shadow-2xl"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <h3 className="font-black uppercase tracking-widest text-lg">Chapters</h3>
                <button 
                  onClick={() => setShowSidebar(false)}
                  className="p-2 hover:bg-white/5 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                {chapters.map(c => (
                  <button
                    key={c.id}
                    onClick={() => {
                      navigate(`/series/${slug}/${c.chapterNumber}`);
                      setShowSidebar(false);
                    }}
                    className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center justify-between ${
                      c.chapterNumber === Number(chapterNum)
                        ? 'bg-emerald-500/10 text-emerald-500 font-bold border border-emerald-500/20'
                        : 'hover:bg-white/5 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <span dir="auto">Chapter {c.chapterNumber} {c.title ? `- ${c.title}` : ''}</span>
                    {c.chapterNumber === Number(chapterNum) && <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 ml-2" />}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      {/* Comments Sidebar */}
      <AnimatePresence>
        {showComments && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowComments(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 w-full sm:w-96 bg-zinc-950 border-l border-white/5 z-[70] flex flex-col shadow-2xl"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <h3 className="font-black uppercase tracking-widest text-lg">Comments ({comments.length})</h3>
                <button 
                  onClick={() => setShowComments(false)}
                  className="p-2 hover:bg-white/5 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                {comments.map(comment => (
                  <div key={comment.id} className="flex gap-3">
                    <img src={comment.userAvatar || undefined} className="w-8 h-8 rounded-full shrink-0" alt={comment.username} referrerPolicy="no-referrer" />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-bold text-white text-sm">{comment.username}</span>
                      </div>
                      <p className="text-zinc-400 text-xs leading-relaxed break-words" dir="auto">{comment.text}</p>
                      <div className="flex items-center gap-4 mt-2">
                        <button className="text-[10px] font-bold text-zinc-500 hover:text-white flex items-center gap-1">
                          <Heart className="w-3 h-3" /> {comment.likes}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {comments.length === 0 && (
                  <div className="text-center text-zinc-500 text-sm py-8">No comments yet. Be the first!</div>
                )}
              </div>

              {/* Comment Input */}
              <div className="p-4 border-t border-white/5 bg-zinc-950">
                {user ? (
                  <div className="space-y-3">
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      dir="auto"
                      placeholder="Write a comment..."
                      className="w-full bg-zinc-900 border border-white/10 rounded-2xl p-3 text-sm focus:outline-none focus:border-emerald-500/50 min-h-[80px] resize-none"
                    />
                    <button 
                      onClick={handlePostComment}
                      disabled={!newComment.trim()}
                      className="w-full py-2 bg-emerald-500 text-black font-bold rounded-full text-sm disabled:opacity-50 hover:bg-emerald-400 transition-colors"
                    >
                      Post Comment
                    </button>
                  </div>
                ) : (
                  <div className="text-center space-y-3">
                    <p className="text-zinc-500 text-sm">Please login to comment</p>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
