import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, onSnapshot, getDocs, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Series, Chapter } from '../types';
import { SeriesCard } from '../components/SeriesCard';
import { TrendingUp, Clock, Zap, Star, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';

export const Home: React.FC = () => {
  const [latestChapters, setLatestChapters] = useState<(Chapter & { series?: Series })[]>([]);
  const [dailyTop, setDailyTop] = useState<Series[]>([]);
  const [weeklyTop, setWeeklyTop] = useState<Series[]>([]);
  const [monthlyTop, setMonthlyTop] = useState<Series[]>([]);
  const [recentlyUpdated, setRecentlyUpdated] = useState<Series[]>([]);
  const [popularWorks, setPopularWorks] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch Popular Works
    const popularQuery = query(collection(db, 'series'), orderBy('rating', 'desc'), limit(6));
    const unsubscribePopular = onSnapshot(popularQuery, (snapshot) => {
      setPopularWorks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Series)));
    });

    // Fetch Recently Updated
    const updatedQuery = query(collection(db, 'series'), orderBy('lastUpdated', 'desc'), limit(12));
    const unsubscribeUpdated = onSnapshot(updatedQuery, (snapshot) => {
      setRecentlyUpdated(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Series)));
    });

    // Fetch Top Viewed (Daily/Weekly/Monthly)
    const dailyQuery = query(collection(db, 'series'), orderBy('dailyViews', 'desc'), limit(6));
    const weeklyQuery = query(collection(db, 'series'), orderBy('weeklyViews', 'desc'), limit(6));
    const monthlyQuery = query(collection(db, 'series'), orderBy('monthlyViews', 'desc'), limit(6));

    const unsubscribeDaily = onSnapshot(dailyQuery, (snapshot) => setDailyTop(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Series))));
    const unsubscribeWeekly = onSnapshot(weeklyQuery, (snapshot) => setWeeklyTop(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Series))));
    const unsubscribeMonthly = onSnapshot(monthlyQuery, (snapshot) => setMonthlyTop(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Series))));

    setLoading(false);

    return () => {
      unsubscribePopular();
      unsubscribeUpdated();
      unsubscribeDaily();
      unsubscribeWeekly();
      unsubscribeMonthly();
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-20">
      {/* Hero / Featured Section */}
      <section className="relative h-[60vh] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-zinc-950/50 to-zinc-950 z-10" />
        <img
          src="https://picsum.photos/seed/manga-hero/1920/1080"
          alt="Featured"
          className="w-full h-full object-cover opacity-40"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 z-20 flex flex-col justify-end p-8 sm:p-16 max-w-7xl mx-auto w-full">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="px-3 py-1 bg-emerald-500 text-black text-xs font-black rounded-md uppercase tracking-widest mb-4 inline-block">
              Featured Today
            </span>
            <h1 className="text-5xl sm:text-7xl font-black tracking-tighter mb-4 max-w-2xl leading-[0.9]">
              EXPLORE THE WORLD OF GENZ
            </h1>
            <p className="text-zinc-400 text-lg max-w-xl mb-8 font-medium">
              Dive into thousands of manga, manhwa, and novels. Updated daily with the latest chapters from your favorite creators.
            </p>
            <div className="flex gap-4">
              <button className="px-8 py-3 bg-white text-black font-bold rounded-full hover:bg-zinc-200 transition-colors">
                Start Reading
              </button>
              <button className="px-8 py-3 bg-zinc-900 text-white font-bold rounded-full border border-white/10 hover:bg-zinc-800 transition-colors">
                Browse All
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 relative z-30 space-y-20">
        
        {/* Latest Chapters */}
        <section>
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <Zap className="w-6 h-6 text-emerald-500" />
              </div>
              <h2 className="text-2xl font-black tracking-tight uppercase">Latest Releases</h2>
            </div>
            <Link to="/latest" className="text-sm font-bold text-zinc-500 hover:text-white flex items-center gap-1 transition-colors">
              View All <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {recentlyUpdated.slice(0, 6).map((series) => (
              <SeriesCard key={series.id} series={series} />
            ))}
          </div>
        </section>

        {/* Top Viewed Grid */}
        <section className="grid lg:grid-cols-3 gap-12">
          {/* Daily Top */}
          <div>
            <div className="flex items-center gap-3 mb-8">
              <TrendingUp className="w-6 h-6 text-emerald-500" />
              <h2 className="text-xl font-black tracking-tight uppercase">Daily Top</h2>
            </div>
            <div className="space-y-4">
              {dailyTop.map((series, i) => (
                <div key={series.id} className="flex items-center gap-4">
                  <span className="text-3xl font-black text-zinc-800 w-8">{i + 1}</span>
                  <SeriesCard series={series} compact />
                </div>
              ))}
            </div>
          </div>

          {/* Weekly Top */}
          <div>
            <div className="flex items-center gap-3 mb-8">
              <TrendingUp className="w-6 h-6 text-blue-500" />
              <h2 className="text-xl font-black tracking-tight uppercase">Weekly Top</h2>
            </div>
            <div className="space-y-4">
              {weeklyTop.map((series, i) => (
                <div key={series.id} className="flex items-center gap-4">
                  <span className="text-3xl font-black text-zinc-800 w-8">{i + 1}</span>
                  <SeriesCard series={series} compact />
                </div>
              ))}
            </div>
          </div>

          {/* Monthly Top */}
          <div>
            <div className="flex items-center gap-3 mb-8">
              <TrendingUp className="w-6 h-6 text-purple-500" />
              <h2 className="text-xl font-black tracking-tight uppercase">Monthly Top</h2>
            </div>
            <div className="space-y-4">
              {monthlyTop.map((series, i) => (
                <div key={series.id} className="flex items-center gap-4">
                  <span className="text-3xl font-black text-zinc-800 w-8">{i + 1}</span>
                  <SeriesCard series={series} compact />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Recently Updated Series */}
        <section>
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Clock className="w-6 h-6 text-blue-500" />
              </div>
              <h2 className="text-2xl font-black tracking-tight uppercase">Recently Updated</h2>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {recentlyUpdated.map((series) => (
              <SeriesCard key={series.id} series={series} />
            ))}
          </div>
        </section>

        {/* Popular Works */}
        <section className="bg-zinc-900/50 border border-white/5 rounded-[2rem] p-8 sm:p-12">
          <div className="flex items-center justify-between mb-12">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/10 rounded-lg">
                <Star className="w-6 h-6 text-yellow-500" />
              </div>
              <h2 className="text-3xl font-black tracking-tight uppercase">Popular Works</h2>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-8">
            {popularWorks.map((series) => (
              <SeriesCard key={series.id} series={series} />
            ))}
          </div>
        </section>

      </div>
    </div>
  );
};
