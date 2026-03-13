import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, onSnapshot, collection, query, where, getDocs, updateDoc, arrayUnion, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Series, Chapter } from '../types';
import { ChevronLeft, ChevronRight, Settings, Maximize2, List, Moon, Sun, Layout, ArrowUp } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Reader: React.FC = () => {
  const { slug, chapterNum } = useParams<{ slug: string; chapterNum: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [series, setSeries] = useState<Series | null>(null);
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Settings
  const [viewMode, setViewMode] = useState<'vertical' | 'horizontal'>('vertical');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [currentPage, setCurrentPage] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

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
          setChapter({ id: chapterSnapshot.docs[0].id, ...chapterSnapshot.docs[0].data() } as Chapter);
          
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
      className={`min-h-screen transition-colors duration-300 ${theme === 'dark' ? 'bg-zinc-950 text-white' : 'bg-zinc-50 text-zinc-900'}`}
    >
      {/* Top Controls */}
      <div className={`fixed top-0 left-0 right-0 z-50 transition-transform duration-300 ${showControls ? 'translate-y-0' : '-translate-y-full'} bg-black/80 backdrop-blur-md border-b border-white/5 px-4 py-3 flex items-center justify-between`}>
        <div className="flex items-center gap-4">
          <Link to={`/series/${series.slug}`} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <div>
            <h1 className="text-sm font-black truncate max-w-[150px] sm:max-w-xs">{series.title}</h1>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Chapter {chapter.chapterNumber}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <button onClick={() => setViewMode(viewMode === 'vertical' ? 'horizontal' : 'vertical')} className="p-2 hover:bg-white/10 rounded-full transition-colors" title="Toggle View Mode">
            <Layout className={`w-5 h-5 ${viewMode === 'horizontal' ? 'rotate-90' : ''}`} />
          </button>
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="p-2 hover:bg-white/10 rounded-full transition-colors" title="Toggle Theme">
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <button onClick={toggleFullscreen} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <Maximize2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Reader Content */}
      <div 
        className={`pt-16 pb-32 flex flex-col items-center ${viewMode === 'vertical' ? 'space-y-0' : 'h-[calc(100vh-64px)] justify-center'}`}
        onClick={() => setShowControls(!showControls)}
      >
        {viewMode === 'vertical' ? (
          <div className="max-w-3xl w-full">
            {chapter.content.map((url, i) => (
              <img 
                key={i} 
                src={url} 
                alt={`Page ${i + 1}`} 
                className="w-full h-auto block" 
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            ))}
          </div>
        ) : (
          <div className="relative w-full h-full flex items-center justify-center group">
            <img 
              src={chapter.content[currentPage]} 
              alt={`Page ${currentPage + 1}`} 
              className="max-h-full max-w-full object-contain"
              referrerPolicy="no-referrer"
            />
            
            {/* Navigation Overlays */}
            <div 
              className="absolute left-0 top-0 w-1/3 h-full cursor-pointer z-10"
              onClick={(e) => { e.stopPropagation(); setCurrentPage(Math.max(0, currentPage - 1)) }}
            />
            <div 
              className="absolute right-0 top-0 w-1/3 h-full cursor-pointer z-10"
              onClick={(e) => { e.stopPropagation(); setCurrentPage(Math.min(chapter.content.length - 1, currentPage + 1)) }}
            />

            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/50 backdrop-blur rounded-full text-xs font-bold text-white z-20">
              {currentPage + 1} / {chapter.content.length}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Controls */}
      <div className={`fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300 ${showControls ? 'translate-y-0' : 'translate-y-full'} bg-black/80 backdrop-blur-md border-t border-white/5 px-4 py-4`}>
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <button 
            disabled={!prevChapter}
            onClick={() => navigate(`/series/${slug}/${Number(chapterNum) - 1}`)}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-zinc-900 rounded-2xl font-bold text-sm disabled:opacity-30 hover:bg-zinc-800 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Prev
          </button>
          
          <div className="flex-1 flex items-center justify-center">
            <select 
              value={chapterNum}
              onChange={(e) => navigate(`/series/${slug}/${e.target.value}`)}
              className="bg-zinc-900 border border-white/10 rounded-xl px-4 py-2 text-sm font-bold focus:outline-none"
            >
              {chapters.map(c => (
                <option key={c.id} value={c.chapterNumber}>Chapter {c.chapterNumber}</option>
              ))}
            </select>
          </div>

          <button 
            disabled={!nextChapter}
            onClick={() => navigate(`/series/${slug}/${Number(chapterNum) + 1}`)}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-500 text-black rounded-2xl font-bold text-sm disabled:opacity-30 hover:bg-emerald-400 transition-colors"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scroll to Top */}
      {viewMode === 'vertical' && (
        <button 
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-24 right-8 p-4 bg-emerald-500 text-black rounded-full shadow-xl hover:scale-110 transition-transform z-40"
        >
          <ArrowUp className="w-6 h-6" />
        </button>
      )}
    </div>
  );
};
