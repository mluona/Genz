import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { doc, updateDoc, getDocs, collection, query, where, documentId } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { useNavigate, Link } from 'react-router-dom';
import { User, Settings, Heart, History, Bookmark, LogOut, Edit2, Camera, ChevronRight } from 'lucide-react';
import { Series } from '../types';

export const Profile: React.FC = () => {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    bio: '',
    profilePicture: '',
  });

  const [favoriteSeries, setFavoriteSeries] = useState<Series[]>([]);
  const [historySeries, setHistorySeries] = useState<(Series & { lastChapterId: string })[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  useEffect(() => {
    if (profile) {
      setFormData({
        username: profile.username || '',
        bio: profile.bio || '',
        profilePicture: profile.profilePicture || '',
      });
    }
  }, [profile]);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!profile) return;
      setIsLoadingData(true);
      
      try {
        const allSeriesIds = new Set<string>();
        profile.favorites?.forEach(id => allSeriesIds.add(id));
        profile.history?.forEach(h => allSeriesIds.add(h.seriesId));

        if (allSeriesIds.size === 0) {
          setIsLoadingData(false);
          return;
        }

        // Fetch series in chunks of 10 (Firestore 'in' query limit)
        const idsArray = Array.from(allSeriesIds);
        const seriesMap = new Map<string, Series>();
        
        for (let i = 0; i < idsArray.length; i += 10) {
          const chunk = idsArray.slice(i, i + 10);
          const q = query(collection(db, 'series'), where(documentId(), 'in', chunk));
          const snapshot = await getDocs(q);
          snapshot.docs.forEach(doc => {
            seriesMap.set(doc.id, { id: doc.id, ...doc.data() } as Series);
          });
        }

        const favs = (profile.favorites || []).map(id => seriesMap.get(id)).filter(Boolean) as Series[];
        setFavoriteSeries(favs);

        const hist = (profile.history || [])
          .sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis())
          .map(h => {
            const s = seriesMap.get(h.seriesId);
            return s ? { ...s, lastChapterId: h.lastChapterId } : null;
          })
          .filter(Boolean) as (Series & { lastChapterId: string })[];
        setHistorySeries(hist);

      } catch (error) {
        console.error("Error fetching user data:", error);
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchUserData();
  }, [profile]);

  if (loading) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center"><div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!user) return <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center gap-4"><h1 className="text-2xl font-black">Please login to view your profile</h1><Link to="/" className="px-8 py-3 bg-emerald-500 text-black font-bold rounded-full">Go Home</Link></div>;

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateDoc(doc(db, 'users', user.uid), formData);
      setIsEditing(false);
    } catch (error) {
      console.error("Update failed:", error);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-20">
      <div className="relative h-[30vh] bg-zinc-900 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 to-transparent" />
        <img src="https://picsum.photos/seed/profile-bg/1920/1080" className="w-full h-full object-cover opacity-20" alt="" referrerPolicy="no-referrer" />
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-24 relative z-10">
        <div className="flex flex-col md:flex-row gap-8 items-start">
          {/* Profile Sidebar */}
          <div className="w-full md:w-80 space-y-6">
            <div className="bg-zinc-900 border border-white/5 rounded-[2.5rem] p-8 text-center space-y-6">
              <div className="relative inline-block group">
                <img 
                  src={profile?.profilePicture || user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
                  className="w-32 h-32 rounded-full border-4 border-zinc-950 shadow-2xl mx-auto object-cover" 
                  alt="Profile" 
                  referrerPolicy="no-referrer"
                />
                <button className="absolute bottom-0 right-0 p-2 bg-emerald-500 text-black rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="w-4 h-4" />
                </button>
              </div>
              <div>
                <h2 className="text-2xl font-black tracking-tight">{profile?.username}</h2>
                <p className="text-zinc-500 text-sm font-medium">{user.email}</p>
              </div>
              <p className="text-zinc-400 text-sm leading-relaxed">{profile?.bio || "No bio yet."}</p>
              <div className="flex flex-wrap gap-2 justify-center">
                <span className="px-3 py-1 bg-white/5 text-[10px] font-black uppercase tracking-widest rounded-lg">{profile?.role}</span>
              </div>
              <div className="pt-4 border-t border-white/5 space-y-2">
                <button 
                  onClick={() => setIsEditing(!isEditing)}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-white text-black font-bold rounded-2xl hover:bg-zinc-200 transition-colors"
                >
                  <Edit2 className="w-4 h-4" /> Edit Profile
                </button>
                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-zinc-800 text-red-500 font-bold rounded-2xl hover:bg-red-500/10 transition-colors"
                >
                  <LogOut className="w-4 h-4" /> Logout
                </button>
              </div>
            </div>

            <div className="bg-zinc-900 border border-white/5 rounded-[2.5rem] p-8 space-y-6">
              <h3 className="font-black uppercase tracking-tight text-sm">Stats</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-zinc-950 rounded-2xl">
                  <p className="text-xl font-black">{profile?.favorites.length || 0}</p>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Favorites</p>
                </div>
                <div className="text-center p-4 bg-zinc-950 rounded-2xl">
                  <p className="text-xl font-black">{profile?.history.length || 0}</p>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">History</p>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 w-full space-y-8">
            {isEditing ? (
              <div className="bg-zinc-900 border border-white/5 rounded-[2.5rem] p-8">
                <h3 className="text-xl font-black uppercase tracking-tight mb-8">Edit Profile</h3>
                <form onSubmit={handleUpdate} className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Username</label>
                    <input 
                      type="text" 
                      value={formData.username}
                      onChange={e => setFormData({...formData, username: e.target.value})}
                      className="w-full bg-zinc-950 border border-white/10 rounded-2xl px-4 py-3 focus:border-emerald-500/50 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Bio</label>
                    <textarea 
                      rows={4}
                      value={formData.bio}
                      onChange={e => setFormData({...formData, bio: e.target.value})}
                      className="w-full bg-zinc-950 border border-white/10 rounded-2xl px-4 py-3 focus:border-emerald-500/50 outline-none resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Profile Picture URL</label>
                    <input 
                      type="text" 
                      value={formData.profilePicture}
                      onChange={e => setFormData({...formData, profilePicture: e.target.value})}
                      className="w-full bg-zinc-950 border border-white/10 rounded-2xl px-4 py-3 focus:border-emerald-500/50 outline-none"
                      placeholder="https://example.com/image.jpg"
                    />
                  </div>
                  <div className="flex gap-4">
                    <button type="submit" className="px-8 py-3 bg-emerald-500 text-black font-bold rounded-2xl">Save Changes</button>
                    <button type="button" onClick={() => setIsEditing(false)} className="px-8 py-3 bg-zinc-800 text-white font-bold rounded-2xl">Cancel</button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="space-y-12">
                {/* Favorites */}
                <section>
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <Heart className="w-6 h-6 text-red-500" />
                      <h3 className="text-xl font-black uppercase tracking-tight">Favorites</h3>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {isLoadingData ? (
                      <div className="col-span-full py-8 flex justify-center"><div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
                    ) : favoriteSeries.length === 0 ? (
                      <p className="col-span-full text-zinc-500 italic">No favorites yet.</p>
                    ) : (
                      favoriteSeries.map(series => (
                        <Link key={series.id} to={`/series/${series.slug}`} className="group relative aspect-[3/4] rounded-2xl overflow-hidden">
                          <img src={series.coverImage || undefined} alt={series.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
                          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent opacity-80 group-hover:opacity-100 transition-opacity" />
                          <div className="absolute bottom-0 left-0 right-0 p-4">
                            <h4 className="font-bold text-sm truncate" dir="auto">{series.title}</h4>
                            <p className="text-[10px] text-emerald-500 font-black uppercase tracking-widest mt-1">{series.type}</p>
                          </div>
                        </Link>
                      ))
                    )}
                  </div>
                </section>

                {/* History */}
                <section>
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <History className="w-6 h-6 text-blue-500" />
                      <h3 className="text-xl font-black uppercase tracking-tight">Reading History</h3>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {isLoadingData ? (
                      <div className="py-8 flex justify-center"><div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
                    ) : historySeries.length === 0 ? (
                      <p className="text-zinc-500 italic">No history yet.</p>
                    ) : (
                      historySeries.map(series => (
                        <Link key={series.id} to={`/series/${series.slug}`} className="flex items-center gap-4 bg-zinc-900/50 hover:bg-zinc-900 border border-white/5 rounded-2xl p-4 transition-colors group">
                          <img src={series.coverImage || undefined} alt={series.title} className="w-16 h-20 object-cover rounded-xl shrink-0" referrerPolicy="no-referrer" />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-sm truncate group-hover:text-emerald-500 transition-colors" dir="auto">{series.title}</h4>
                            <p className="text-xs text-zinc-500 mt-1">Last read chapter</p>
                          </div>
                          <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-emerald-500 transform group-hover:translate-x-1 transition-all" />
                        </Link>
                      ))
                    )}
                  </div>
                </section>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
