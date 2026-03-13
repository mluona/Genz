import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, onSnapshot, collection, query, orderBy, getDocs, where } from 'firebase/firestore';
import { auth, googleProvider, db } from '../firebase';
import { signInWithPopup } from 'firebase/auth';
import { Series, Chapter, Comment } from '../types';
import { Star, Eye, Clock, List, MessageSquare, Heart, Share2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '../context/AuthContext';

export const SeriesDetail: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { user, profile } = useAuth();
  const [series, setSeries] = useState<Series | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'chapters' | 'comments'>('chapters');

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Login failed:", error);
      alert("Login failed: " + error.message);
    }
  };

  useEffect(() => {
    if (!slug) return;

    // Find series by slug
    const seriesQuery = query(collection(db, 'series'), where('slug', '==', slug));
    const unsubscribeSeries = onSnapshot(seriesQuery, (snapshot) => {
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        setSeries({ id: doc.id, ...doc.data() } as Series);
      }
      setLoading(false);
    });

    return () => unsubscribeSeries();
  }, [slug]);

  useEffect(() => {
    if (!series) return;

    const chaptersQuery = query(collection(db, `series/${series.id}/chapters`), orderBy('chapterNumber', 'desc'));
    const unsubscribeChapters = onSnapshot(chaptersQuery, (snapshot) => {
      setChapters(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Chapter)));
    });

    const commentsQuery = query(collection(db, 'comments'), orderBy('timestamp', 'desc'));
    // Filter comments by seriesId in a real app
    const unsubscribeComments = onSnapshot(commentsQuery, (snapshot) => {
      setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment)).filter(c => c.seriesId === series.id));
    });

    return () => {
      unsubscribeChapters();
      unsubscribeComments();
    };
  }, [series]);

  if (loading) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center"><div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!series) return <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">Series not found</div>;

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-20">
      {/* Header / Banner */}
      <div className="relative h-[40vh] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent z-10" />
        <img
          src={series.coverImage}
          alt={series.title}
          className="w-full h-full object-cover blur-xl opacity-30 scale-110"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 z-20 flex items-end max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          <div className="flex flex-col sm:flex-row gap-8 items-center sm:items-end">
            <div className="w-48 sm:w-64 aspect-[3/4] rounded-2xl overflow-hidden shadow-2xl border border-white/10 flex-shrink-0">
              <img src={series.coverImage} alt={series.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
            <div className="flex flex-col gap-4 text-center sm:text-left">
              <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                <span className="px-3 py-1 bg-emerald-500 text-black text-[10px] font-black rounded-md uppercase tracking-widest">{series.type}</span>
                <span className="px-3 py-1 bg-white/10 text-white text-[10px] font-black rounded-md uppercase tracking-widest">{series.status}</span>
              </div>
              <h1 className="text-4xl sm:text-6xl font-black tracking-tighter leading-[1.2] sm:leading-[1.1]">{series.title}</h1>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-6 text-sm font-bold text-zinc-400">
                <div className="flex items-center gap-2"><Star className="w-4 h-4 text-yellow-500 fill-current" /> {series.rating.toFixed(1)} ({series.ratingCount})</div>
                <div className="flex items-center gap-2"><Eye className="w-4 h-4" /> {series.views.toLocaleString()}</div>
                <div className="flex items-center gap-2"><Clock className="w-4 h-4" /> Updated {formatDistanceToNow(series.lastUpdated.toDate(), { addSuffix: true })}</div>
              </div>
              <div className="flex gap-4 mt-2">
                <button className="flex-1 sm:flex-none px-8 py-3 bg-emerald-500 text-black font-bold rounded-full hover:bg-emerald-400 transition-colors flex items-center justify-center gap-2">
                  Read First Chapter
                </button>
                <button className="p-3 bg-white/10 rounded-full hover:bg-white/20 transition-colors">
                  <Heart className="w-5 h-5" />
                </button>
                <button className="p-3 bg-white/10 rounded-full hover:bg-white/20 transition-colors">
                  <Share2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 grid lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-12">
          {/* Synopsis */}
          <section>
            <h2 className="text-xl font-black uppercase tracking-tight mb-4">Synopsis</h2>
            <p className="text-zinc-400 leading-relaxed text-lg">{series.description}</p>
          </section>

          {/* Genres */}
          <section>
            <h2 className="text-xl font-black uppercase tracking-tight mb-4">Genres</h2>
            <div className="flex flex-wrap gap-2">
              {series.genres.map(genre => (
                <Link key={genre} to={`/search?genre=${genre}`} className="px-4 py-2 bg-zinc-900 border border-white/5 rounded-xl text-sm font-bold hover:bg-zinc-800 transition-colors">
                  {genre}
                </Link>
              ))}
            </div>
          </section>

          {/* Tabs */}
          <section>
            <div className="flex border-b border-white/5 mb-8">
              <button
                onClick={() => setActiveTab('chapters')}
                className={`px-8 py-4 text-sm font-black uppercase tracking-widest transition-colors relative ${activeTab === 'chapters' ? 'text-white' : 'text-zinc-500 hover:text-white'}`}
              >
                Chapters ({chapters.length})
                {activeTab === 'chapters' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500" />}
              </button>
              <button
                onClick={() => setActiveTab('comments')}
                className={`px-8 py-4 text-sm font-black uppercase tracking-widest transition-colors relative ${activeTab === 'comments' ? 'text-white' : 'text-zinc-500 hover:text-white'}`}
              >
                Comments ({comments.length})
                {activeTab === 'comments' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500" />}
              </button>
            </div>

            {activeTab === 'chapters' ? (
              <div className="grid gap-2">
                {chapters.map(chapter => (
                  <Link
                    key={chapter.id}
                    to={`/series/${series.slug}/${chapter.chapterNumber}`}
                    className="flex items-center justify-between p-4 bg-zinc-900/50 border border-white/5 rounded-2xl hover:bg-zinc-900 transition-colors group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center font-black text-zinc-500 group-hover:text-emerald-500 transition-colors">
                        {chapter.chapterNumber}
                      </div>
                      <div>
                        <h4 className="font-bold text-white">Chapter {chapter.chapterNumber}{chapter.title ? `: ${chapter.title}` : ''}</h4>
                        <p className="text-xs font-medium text-zinc-500 uppercase tracking-widest">{formatDistanceToNow(chapter.publishDate.toDate(), { addSuffix: true })}</p>
                      </div>
                    </div>
                    <Eye className="w-4 h-4 text-zinc-600" />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="space-y-8">
                {/* Comment Form */}
                {user ? (
                  <div className="flex gap-4">
                    <img src={profile?.profilePicture || user.photoURL || ''} className="w-10 h-10 rounded-full" alt="Me" />
                    <div className="flex-1 space-y-4">
                      <textarea
                        placeholder="Write a comment..."
                        className="w-full bg-zinc-900 border border-white/10 rounded-2xl p-4 text-sm focus:outline-none focus:border-emerald-500/50 min-h-[100px]"
                      />
                      <button className="px-6 py-2 bg-white text-black font-bold rounded-full text-sm">Post Comment</button>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 bg-zinc-900/50 border border-dashed border-white/10 rounded-2xl text-center space-y-4">
                    <p className="text-zinc-500 font-bold">Please login to join the discussion</p>
                    <button 
                      onClick={handleLogin}
                      className="px-8 py-2 bg-white text-black font-bold rounded-full text-sm hover:bg-zinc-200 transition-colors"
                    >
                      Login with Google
                    </button>
                  </div>
                )}

                {/* Comment List */}
                <div className="space-y-6">
                  {comments.map(comment => (
                    <div key={comment.id} className="flex gap-4">
                      <img src={comment.userAvatar} className="w-10 h-10 rounded-full" alt={comment.username} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-white">{comment.username}</span>
                          <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest">{formatDistanceToNow(comment.timestamp.toDate(), { addSuffix: true })}</span>
                        </div>
                        <p className="text-zinc-400 text-sm leading-relaxed">{comment.text}</p>
                        <div className="flex items-center gap-4 mt-2">
                          <button className="text-xs font-bold text-zinc-500 hover:text-white flex items-center gap-1">
                            <Heart className="w-3 h-3" /> {comment.likes}
                          </button>
                          <button className="text-xs font-bold text-zinc-500 hover:text-white">Reply</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Sidebar */}
        <aside className="space-y-8">
          <section className="bg-zinc-900/50 border border-white/5 rounded-3xl p-6 space-y-6">
            <h3 className="text-lg font-black uppercase tracking-tight">Information</h3>
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500 font-bold uppercase tracking-widest text-[10px]">Author</span>
                <span className="font-bold">{series.author}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500 font-bold uppercase tracking-widest text-[10px]">Artist</span>
                <span className="font-bold">{series.artist}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500 font-bold uppercase tracking-widest text-[10px]">Released</span>
                <span className="font-bold">{series.releaseYear}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500 font-bold uppercase tracking-widest text-[10px]">Serialization</span>
                <span className="font-bold">GENZ Original</span>
              </div>
            </div>
          </section>

          <section className="bg-zinc-900/50 border border-white/5 rounded-3xl p-6 space-y-6">
            <h3 className="text-lg font-black uppercase tracking-tight">Tags</h3>
            <div className="flex flex-wrap gap-2">
              {series.tags.map(tag => (
                <span key={tag} className="px-3 py-1 bg-zinc-800 text-zinc-400 text-[10px] font-bold rounded-lg uppercase tracking-widest">
                  #{tag}
                </span>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
};
