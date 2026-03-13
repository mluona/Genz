import React, { useState } from 'react';
import { Globe, Zap, Search, Plus, Trash2, Play, CheckCircle, AlertCircle } from 'lucide-react';
import axios from 'axios';

export const AutoImport: React.FC = () => {
  const [sources, setSources] = useState([
    { id: '1', name: 'MangaSource RSS', url: 'https://example.com/rss', type: 'RSS', status: 'Active', lastSync: '2 hours ago' },
    { id: '2', name: 'ManhwaAPI', url: 'https://api.example.com/v1', type: 'API', status: 'Idle', lastSync: '1 day ago' },
  ]);
  const [isImporting, setIsImporting] = useState(false);
  const [importLog, setImportLog] = useState<string[]>([]);

  const handleRunImport = async (sourceId: string) => {
    setIsImporting(true);
    setImportLog(['Starting import process...', `Connecting to source ${sourceId}...`]);
    
    // Simulate import steps
    setTimeout(() => setImportLog(prev => [...prev, 'Fetching latest updates...']), 1000);
    setTimeout(() => setImportLog(prev => [...prev, 'Found 3 new chapters for "Solo Leveling"']), 2000);
    setTimeout(() => setImportLog(prev => [...prev, 'Downloading chapter 179 pages...']), 3000);
    setTimeout(() => {
      setImportLog(prev => [...prev, 'Successfully imported 3 chapters!']);
      setIsImporting(false);
    }, 5000);
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
            <div className="space-y-2 font-mono text-xs h-48 overflow-y-auto custom-scrollbar">
              {importLog.map((log, i) => (
                <div key={i} className="flex gap-3">
                  <span className="text-zinc-600">[{new Date().toLocaleTimeString()}]</span>
                  <span className={log.includes('Successfully') ? 'text-emerald-400' : 'text-zinc-300'}>{log}</span>
                </div>
              ))}
              {importLog.length === 0 && <p className="text-zinc-600 italic">Waiting for import task...</p>}
            </div>
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
