import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Globe, Zap, Search, Plus, Trash2, Play, CheckCircle, AlertCircle, X } from 'lucide-react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, Timestamp, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import axios from 'axios';

export const AutoImport: React.FC = () => {
  const [sources, setSources] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importLog, setImportLog] = useState<string[]>([]);
  const [rssItems, setRssItems] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newSource, setNewSource] = useState({
    name: '',
    url: '',
    type: 'RSS' as 'RSS' | 'API',
  });

  useEffect(() => {
    const q = query(collection(db, 'import_sources'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSources(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe();
  }, []);

  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'import_sources'), {
        ...newSource,
        status: 'Active',
        lastSync: 'Never',
        createdAt: Timestamp.now(),
      });
      setIsModalOpen(false);
      setNewSource({ name: '', url: '', type: 'RSS' });
    } catch (error) {
      console.error("Error adding source:", error);
    }
  };

  const handleDeleteSource = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'import_sources', id));
    } catch (error) {
      console.error("Error deleting source:", error);
    }
  };

  const handleRunImport = async (sourceId: string) => {
    const source = sources.find(s => s.id === sourceId);
    if (!source) return;

    setIsImporting(true);
    setImportLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] Starting import from ${source.name}...`]);
    
    try {
      const response = await fetch(`/api/import/rss?url=${encodeURIComponent(source.url)}`);
      const xmlText = await response.text();
      
      // Simple XML parsing for RSS
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, "text/xml");
      const items = Array.from(xmlDoc.querySelectorAll("item")).map(item => ({
        title: item.querySelector("title")?.textContent,
        link: item.querySelector("link")?.textContent,
        pubDate: item.querySelector("pubDate")?.textContent,
      }));

      setRssItems(items);
      setImportLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] Found ${items.length} items in feed.`]);
    } catch (error) {
      setImportLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] Error: Failed to fetch RSS feed.`]);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Auto Import System</h1>
          <p className="text-zinc-500 font-medium">Connect external sources to automatically import new chapters.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-6 py-3 bg-black text-white font-bold rounded-2xl hover:bg-zinc-800 transition-colors"
        >
          <Plus className="w-5 h-5" /> Add New Source
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Sources List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-zinc-100">
              <h3 className="font-black uppercase tracking-tight">Configured Sources</h3>
            </div>
            <div className="divide-y divide-zinc-100">
              {sources.map((source) => (
                <div key={source.id} className="p-6 flex items-center justify-between hover:bg-zinc-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-zinc-100 rounded-2xl text-zinc-500">
                      <Globe className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-bold">{source.name}</p>
                      <p className="text-xs text-zinc-500 font-medium">{source.url}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-8">
                    <div className="text-right">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${source.status === 'Active' ? 'bg-emerald-100 text-emerald-600' : 'bg-zinc-100 text-zinc-600'}`}>
                        {source.status}
                      </span>
                      <p className="text-[10px] font-bold text-zinc-400 mt-1 uppercase tracking-widest">Last sync: {source.lastSync}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleRunImport(source.id)}
                        disabled={isImporting}
                        className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-30"
                      >
                        <Play className="w-5 h-5 fill-current" />
                      </button>
                      <button 
                        onClick={() => handleDeleteSource(source.id)}
                        className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Import Log */}
          <div className="bg-zinc-900 rounded-3xl p-6 shadow-xl border border-white/5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-black uppercase tracking-tight text-sm">Import Console</h3>
              {isImporting && <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />}
            </div>
            <div className="space-y-2 font-mono text-xs h-48 overflow-y-auto custom-scrollbar mb-6">
              {importLog.map((log, i) => (
                <div key={i} className="flex gap-3">
                  <span className="text-zinc-600">[{new Date().toLocaleTimeString()}]</span>
                  <span className={log.includes('Successfully') || log.includes('Found') ? 'text-emerald-400' : log.includes('Error') ? 'text-red-400' : 'text-zinc-300'}>{log}</span>
                </div>
              ))}
              {importLog.length === 0 && <p className="text-zinc-600 italic">Waiting for import task...</p>}
            </div>

            {rssItems.length > 0 && (
              <div className="space-y-4 border-t border-white/10 pt-6">
                <h4 className="text-white text-[10px] font-black uppercase tracking-widest">Latest Feed Items</h4>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                  {rssItems.map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors group">
                      <div className="flex-1 min-w-0 mr-4">
                        <p className="text-white text-xs font-bold truncate">{item.title}</p>
                        <p className="text-zinc-500 text-[10px] truncate">{item.link}</p>
                      </div>
                      <Link 
                        to={`/admin/chapters?scrapeUrl=${encodeURIComponent(item.link || '')}`}
                        className="px-3 py-1.5 bg-emerald-500 text-black text-[10px] font-black uppercase tracking-widest rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        Import
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Settings / Info */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm space-y-6">
            <h3 className="font-black uppercase tracking-tight">Import Settings</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold">Auto-Publish</span>
                <div className="w-10 h-5 bg-emerald-500 rounded-full relative">
                  <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold">Notify Users</span>
                <div className="w-10 h-5 bg-emerald-500 rounded-full relative">
                  <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold">Auto-Translate</span>
                <div className="w-10 h-5 bg-zinc-200 rounded-full relative">
                  <div className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full" />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100 space-y-4">
            <div className="flex items-center gap-3 text-emerald-600">
              <Zap className="w-5 h-5" />
              <h3 className="font-black uppercase tracking-tight">Pro Tip</h3>
            </div>
            <p className="text-sm text-emerald-700 font-medium leading-relaxed">
              Use RSS feeds for the fastest updates. Most major manga sites provide RSS feeds for their latest releases.
            </p>
          </div>
        </div>
      </div>

      {/* Add Source Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black uppercase tracking-tight">Add Source</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-zinc-400 hover:bg-zinc-100 rounded-full">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleAddSource} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Source Name</label>
                <input 
                  type="text" 
                  required
                  value={newSource.name}
                  onChange={e => setNewSource({...newSource, name: e.target.value})}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500/20"
                  placeholder="e.g. MangaSource RSS"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Source URL</label>
                <input 
                  type="url" 
                  required
                  value={newSource.url}
                  onChange={e => setNewSource({...newSource, url: e.target.value})}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500/20"
                  placeholder="https://example.com/rss"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Type</label>
                <select 
                  value={newSource.type}
                  onChange={e => setNewSource({...newSource, type: e.target.value as 'RSS' | 'API'})}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 outline-none"
                >
                  <option value="RSS">RSS Feed</option>
                  <option value="API">API Endpoint</option>
                </select>
              </div>
              <div className="flex gap-4 pt-4">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 text-zinc-500 font-bold hover:bg-zinc-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3 bg-black text-white font-bold rounded-xl hover:bg-zinc-800 transition-colors"
                >
                  Add Source
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
