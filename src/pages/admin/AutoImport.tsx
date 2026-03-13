import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Globe, Zap, Search, Plus, Trash2, Play, CheckCircle, AlertCircle } from 'lucide-react';
import axios from 'axios';

export const AutoImport: React.FC = () => {
  const [sources, setSources] = useState([
    { id: '1', name: 'MangaSource RSS', url: 'https://rss.app/feeds/v1/manga', type: 'RSS', status: 'Active', lastSync: '2 hours ago' },
  ]);
  const [isImporting, setIsImporting] = useState(false);
  const [importLog, setImportLog] = useState<string[]>([]);
  const [rssItems, setRssItems] = useState<any[]>([]);

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
        <button className="flex items-center gap-2 px-6 py-3 bg-black text-white font-bold rounded-2xl hover:bg-zinc-800 transition-colors">
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
                      <button className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
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
    </div>
  );
};
