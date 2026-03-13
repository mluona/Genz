import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, LogIn, User, LayoutDashboard, Menu, X, Bell, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { auth, googleProvider } from '../firebase';
import { signInWithPopup, signOut } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';

export const Navbar: React.FC = () => {
  const { user, profile, isAdmin } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const [loginError, setLoginError] = useState<string | null>(null);

  const handleLogin = async () => {
    setLoginError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Login failed:", error);
      if (error.code === 'auth/popup-blocked') {
        setLoginError("Please allow popups for this site to login with Google.");
      } else if (error.code === 'auth/cancelled-popup-request') {
        // Ignore
      } else {
        setLoginError("Login failed: " + error.message);
      }
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
      setIsMenuOpen(false);
    }
  };

  return (
    <nav className="sticky top-0 z-50 bg-zinc-950/80 backdrop-blur-md border-b border-white/5">
      {loginError && (
        <div className="bg-red-500 text-white text-xs font-bold py-2 px-4 text-center">
          {loginError}
          <button onClick={() => setLoginError(null)} className="ml-4 underline">Dismiss</button>
        </div>
      )}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <span className="text-2xl font-black tracking-tighter text-white">GENZ</span>
            <span className="hidden sm:block text-xs font-medium text-zinc-500 uppercase tracking-widest">World of Reading</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            <Link to="/manga" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">Manga</Link>
            <Link to="/manhwa" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">Manhwa</Link>
            <Link to="/novels" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">Novels</Link>
          </div>

          {/* Search & User */}
          <div className="hidden md:flex items-center gap-4">
            <form onSubmit={handleSearch} className="relative group">
              <input
                type="text"
                placeholder="Search series..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64 bg-zinc-900/50 border border-white/5 rounded-full py-2 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-zinc-900 transition-all"
              />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-emerald-500 transition-colors" />
            </form>

            {user ? (
              <div className="flex items-center gap-2">
                <Link to="/notifications" className="p-2.5 text-zinc-400 hover:text-white hover:bg-white/5 rounded-full transition-all">
                  <Bell className="w-5 h-5" />
                </Link>
                {isAdmin && (
                  <Link to="/admin" className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 rounded-full transition-all" title="Admin Dashboard">
                    <LayoutDashboard className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Admin</span>
                  </Link>
                )}
                <Link to="/profile" className="ml-2">
                  <img
                    src={profile?.profilePicture || user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`}
                    alt="Profile"
                    className="w-9 h-9 rounded-full border-2 border-white/5 hover:border-emerald-500/50 transition-all"
                  />
                </Link>
              </div>
            ) : (
              <button
                onClick={handleLogin}
                className="m3-button-primary"
              >
                Login
              </button>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <div className="md:hidden flex items-center gap-4">
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 text-zinc-400">
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-zinc-950 border-b border-white/5 overflow-hidden"
          >
            <div className="px-4 py-6 space-y-6">
              <form onSubmit={handleSearch} className="relative">
                <input
                  type="text"
                  placeholder="Search series..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-emerald-500/50"
                />
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
              </form>

              <div className="grid grid-cols-2 gap-3">
                <Link to="/manga" onClick={() => setIsMenuOpen(false)} className="flex items-center justify-center py-3 bg-zinc-900 rounded-xl text-sm font-bold">Manga</Link>
                <Link to="/manhwa" onClick={() => setIsMenuOpen(false)} className="flex items-center justify-center py-3 bg-zinc-900 rounded-xl text-sm font-bold">Manhwa</Link>
                <Link to="/novels" onClick={() => setIsMenuOpen(false)} className="flex items-center justify-center py-3 bg-zinc-900 rounded-xl text-sm font-bold">Novels</Link>
                <Link to="/latest" onClick={() => setIsMenuOpen(false)} className="flex items-center justify-center py-3 bg-zinc-900 rounded-xl text-sm font-bold">Latest</Link>
              </div>

              {isAdmin && (
                <Link 
                  to="/admin" 
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center justify-center gap-2 w-full py-4 bg-emerald-500 text-black font-black rounded-xl uppercase tracking-widest text-xs"
                >
                  <LayoutDashboard className="w-5 h-5" />
                  Admin Dashboard
                </Link>
              )}

              {user ? (
                <div className="flex items-center justify-between p-4 bg-zinc-900 rounded-2xl">
                  <Link to="/profile" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3">
                    <img
                      src={profile?.profilePicture || user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`}
                      alt="Profile"
                      className="w-10 h-10 rounded-full border border-white/10"
                    />
                    <div>
                      <p className="text-sm font-bold">{profile?.username || user.displayName}</p>
                      <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">View Profile</p>
                    </div>
                  </Link>
                  <button onClick={() => signOut(auth)} className="p-2 text-zinc-500 hover:text-red-500">
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleLogin}
                  className="flex items-center justify-center gap-2 w-full py-4 bg-white text-black font-black rounded-xl uppercase tracking-widest text-xs"
                >
                  <LogIn className="w-5 h-5" />
                  Login with Google
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};
