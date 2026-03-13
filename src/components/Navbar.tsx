import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, LogIn, User, LayoutDashboard, Menu, X, Bell } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { auth, googleProvider } from '../firebase';
import { signInWithPopup, signOut } from 'firebase/auth';

export const Navbar: React.FC = () => {
  const { user, profile, isAdmin } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed:", error);
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
            <form onSubmit={handleSearch} className="relative">
              <input
                type="text"
                placeholder="Search series..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64 bg-zinc-900 border border-white/10 rounded-full py-1.5 pl-10 pr-4 text-sm focus:outline-none focus:border-emerald-500/50 transition-colors"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            </form>

            {user ? (
              <div className="flex items-center gap-4">
                <Link to="/notifications" className="p-2 text-zinc-400 hover:text-white transition-colors">
                  <Bell className="w-5 h-5" />
                </Link>
                {isAdmin && (
                  <Link to="/admin" className="p-2 text-zinc-400 hover:text-white transition-colors" title="Admin Dashboard">
                    <LayoutDashboard className="w-5 h-5" />
                  </Link>
                )}
                <Link to="/profile" className="flex items-center gap-2">
                  <img
                    src={profile?.profilePicture || user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`}
                    alt="Profile"
                    className="w-8 h-8 rounded-full border border-white/10"
                  />
                </Link>
              </div>
            ) : (
              <button
                onClick={handleLogin}
                className="flex items-center gap-2 px-4 py-1.5 bg-white text-black text-sm font-bold rounded-full hover:bg-zinc-200 transition-colors"
              >
                <LogIn className="w-4 h-4" />
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
      {isMenuOpen && (
        <div className="md:hidden bg-zinc-900 border-b border-white/5 p-4 space-y-4">
          <form onSubmit={handleSearch} className="relative">
            <input
              type="text"
              placeholder="Search series..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-800 border border-white/10 rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          </form>
          <div className="grid grid-cols-3 gap-2">
            <Link to="/manga" onClick={() => setIsMenuOpen(false)} className="text-center py-2 bg-zinc-800 rounded-lg text-sm font-medium">Manga</Link>
            <Link to="/manhwa" onClick={() => setIsMenuOpen(false)} className="text-center py-2 bg-zinc-800 rounded-lg text-sm font-medium">Manhwa</Link>
            <Link to="/novels" onClick={() => setIsMenuOpen(false)} className="text-center py-2 bg-zinc-800 rounded-lg text-sm font-medium">Novels</Link>
          </div>
          {!user && (
            <button
              onClick={handleLogin}
              className="w-full py-2 bg-white text-black font-bold rounded-lg"
            >
              Login with Google
            </button>
          )}
        </div>
      )}
    </nav>
  );
};
