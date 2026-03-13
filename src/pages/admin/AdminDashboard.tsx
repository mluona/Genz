import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { Users, BookOpen, Layers, MessageSquare, TrendingUp, Eye, UserPlus, Star } from 'lucide-react';
import { Series, UserProfile, Comment } from '../../types';

export const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalSeries: 0,
    totalChapters: 0,
    totalComments: 0,
    dailyVisitors: 1240, // Mocked for now
  });
  const [recentSeries, setRecentSeries] = useState<Series[]>([]);
  const [recentUsers, setRecentUsers] = useState<UserProfile[]>([]);

  useEffect(() => {
    const fetchStats = async () => {
      const usersSnap = await getDocs(collection(db, 'users'));
      const seriesSnap = await getDocs(collection(db, 'series'));
      const commentsSnap = await getDocs(collection(db, 'comments'));
      
      setStats(prev => ({
        ...prev,
        totalUsers: usersSnap.size,
        totalSeries: seriesSnap.size,
        totalComments: commentsSnap.size,
      }));

      const recentSeriesQuery = query(collection(db, 'series'), orderBy('lastUpdated', 'desc'), limit(5));
      const recentSeriesSnap = await getDocs(recentSeriesQuery);
      setRecentSeries(recentSeriesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Series)));

      const recentUsersQuery = query(collection(db, 'users'), limit(5));
      const recentUsersSnap = await getDocs(recentUsersQuery);
      setRecentUsers(recentUsersSnap.docs.map(d => ({ ...d.data() } as unknown as UserProfile)));
    };

    fetchStats();
  }, []);

  const statCards = [
    { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'bg-blue-500' },
    { label: 'Total Series', value: stats.totalSeries, icon: BookOpen, color: 'bg-emerald-500' },
    { label: 'Total Comments', value: stats.totalComments, icon: MessageSquare, color: 'bg-purple-500' },
    { label: 'Daily Visitors', value: stats.dailyVisitors, icon: Eye, color: 'bg-orange-500' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Dashboard Overview</h1>
        <p className="text-zinc-500 font-medium">Welcome back! Here's what's happening with GENZ today.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => (
          <div key={stat.label} className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm flex items-center gap-6">
            <div className={`p-4 ${stat.color} text-white rounded-2xl`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">{stat.label}</p>
              <p className="text-2xl font-black">{stat.value.toLocaleString()}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Recent Series */}
        <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
            <h3 className="font-black uppercase tracking-tight">Recently Updated Series</h3>
            <button className="text-xs font-bold text-emerald-600 hover:underline">View All</button>
          </div>
          <div className="divide-y divide-zinc-100">
            {recentSeries.map((series) => (
              <div key={series.id} className="p-4 flex items-center gap-4 hover:bg-zinc-50 transition-colors">
                <img src={series.coverImage} className="w-12 h-16 object-cover rounded-lg" alt="" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate">{series.title}</p>
                  <p className="text-xs text-zinc-500 font-medium uppercase tracking-widest">{series.type} • {series.status}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold">{series.views.toLocaleString()} views</p>
                  <div className="flex items-center gap-1 text-yellow-500 justify-end">
                    <Star className="w-3 h-3 fill-current" />
                    <span className="text-xs font-bold">{series.rating.toFixed(1)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Users */}
        <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
            <h3 className="font-black uppercase tracking-tight">New Users</h3>
            <button className="text-xs font-bold text-emerald-600 hover:underline">View All</button>
          </div>
          <div className="divide-y divide-zinc-100">
            {recentUsers.map((user) => (
              <div key={user.uid} className="p-4 flex items-center gap-4 hover:bg-zinc-50 transition-colors">
                <img src={user.profilePicture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} className="w-10 h-10 rounded-full" alt="" />
                <div className="flex-1">
                  <p className="font-bold">{user.username}</p>
                  <p className="text-xs text-zinc-500 font-medium">{user.email}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${user.role === 'admin' ? 'bg-purple-100 text-purple-600' : 'bg-zinc-100 text-zinc-600'}`}>
                  {user.role}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
