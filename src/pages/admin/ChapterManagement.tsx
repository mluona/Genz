import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, Timestamp, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { Series, Chapter } from '../../types';
import { Plus, Edit2, Trash2, X, Upload, Image as ImageIcon, ArrowRight, Layers } from 'lucide-react';

export const ChapterManagement: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [selectedSeries, setSelectedSeries] = useState<Series | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
  const [formData, setFormData] = useState({
    chapterNumber: 1,
    title: '',
    content: [] as string[],
    publishDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'series'), (snapshot) => {
      setSeriesList(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Series)));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!selectedSeries) {
      setChapters([]);
      return;
    }

    const q = query(collection(db, `series/${selectedSeries.id}/chapters`), orderBy('chapterNumber', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setChapters(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Chapter)));
    });
    return () => unsubscribe();
  }, [selectedSeries]);

  const [bulkText, setBulkText] = useState('');
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [scrapeUrl, setScrapeUrl] = useState(searchParams.get('scrapeUrl') || '');
  const [isScraping, setIsScraping] = useState(false);

  useEffect(() => {
    if (searchParams.get('scrapeUrl')) {
      setIsModalOpen(true);
    }
  }, [searchParams]);

  const handleScrape = async () => {
    if (!scrapeUrl) return;
    setIsScraping(true);
    try {
      const response = await fetch(`/api/scrape/images?url=${encodeURIComponent(scrapeUrl)}`);
      const data = await response.json();
      if (data.images) {
        setFormData({ ...formData, content: [...formData.content, ...data.images] });
        setScrapeUrl('');
      }
    } catch (error) {
      console.error("Scraping failed:", error);
    } finally {
      setIsScraping(false);
    }
  };

  const handleBulkAdd = () => {
    const urls = bulkText.split('\n').map(url => url.trim()).filter(url => url !== '');
    setFormData({ ...formData, content: [...formData.content, ...urls] });
    setBulkText('');
    setIsBulkModalOpen(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newPages: string[] = [];

    for (const file of files) {
      const reader = new FileReader();
      const promise = new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
      });
      reader.readAsDataURL(file);
      const base64 = await promise;
      newPages.push(base64);
    }

    setFormData({ ...formData, content: [...formData.content, ...newPages] });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSeries) return;

    const data = {
      ...formData,
      seriesId: selectedSeries.id,
      publishDate: Timestamp.fromDate(new Date(formData.publishDate)),
      views: editingChapter?.views || 0,
    };

    try {
      if (editingChapter) {
        await updateDoc(doc(db, `series/${selectedSeries.id}/chapters`, editingChapter.id), data);
      } else {
        await addDoc(collection(db, `series/${selectedSeries.id}/chapters`), data);
        // Update series lastUpdated
        await updateDoc(doc(db, 'series', selectedSeries.id), {
          lastUpdated: Timestamp.now()
        });
      }
      setIsModalOpen(false);
      setEditingChapter(null);
      setFormData({
        chapterNumber: chapters.length > 0 ? chapters[0].chapterNumber + 1 : 1,
        title: '',
        content: [],
        publishDate: new Date().toISOString().split('T')[0],
      });
    } catch (error) {
      console.error("Error saving chapter:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!selectedSeries) return;
    if (confirm("Are you sure you want to delete this chapter?")) {
      await deleteDoc(doc(db, `series/${selectedSeries.id}/chapters`, id));
    }
  };

  const handleAddImage = () => {
    setFormData({ ...formData, content: [...formData.content, ''] });
  };

  const handleImageChange = (index: number, value: string) => {
    const newContent = [...formData.content];
    newContent[index] = value;
    setFormData({ ...formData, content: newContent });
  };

  const handleRemoveImage = (index: number) => {
    setFormData({ ...formData, content: formData.content.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Chapter Management</h1>
          <p className="text-zinc-500 font-medium">Upload and manage chapters for your series.</p>
        </div>
        {selectedSeries && (
          <button 
            onClick={() => { setEditingChapter(null); setIsModalOpen(true); }}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-500 text-black font-bold rounded-2xl hover:bg-emerald-400 transition-colors"
          >
            <Plus className="w-5 h-5" /> Add New Chapter
          </button>
        )}
      </div>

      {/* Series Selector */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm space-y-4">
          <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500">Select Series</label>
          <select 
            className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 outline-none"
            value={selectedSeries?.id || ''}
            onChange={(e) => setSelectedSeries(seriesList.find(s => s.id === e.target.value) || null)}
          >
            <option value="">Choose a series...</option>
            {seriesList.map(s => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>
        </div>
      </div>

      {selectedSeries ? (
        <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
            <h3 className="font-black uppercase tracking-tight">Chapters for {selectedSeries.title}</h3>
            <span className="text-xs font-bold text-zinc-500">{chapters.length} Chapters total</span>
          </div>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200">
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Number</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Title</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Pages</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Published</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {chapters.map((chapter) => (
                <tr key={chapter.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-6 py-4 font-black text-zinc-400">#{chapter.chapterNumber}</td>
                  <td className="px-6 py-4 font-bold">{chapter.title || 'Untitled'}</td>
                  <td className="px-6 py-4 text-sm">{chapter.content.length} pages</td>
                  <td className="px-6 py-4 text-sm">{chapter.publishDate.toDate().toLocaleDateString()}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => { 
                          setEditingChapter(chapter); 
                          setFormData({
                            chapterNumber: chapter.chapterNumber,
                            title: chapter.title || '',
                            content: chapter.content,
                            publishDate: chapter.publishDate.toDate().toISOString().split('T')[0]
                          }); 
                          setIsModalOpen(true); 
                        }}
                        className="p-2 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(chapter.id)}
                        className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-20 bg-zinc-100 rounded-[3rem] border-4 border-dashed border-zinc-200 flex flex-col items-center justify-center text-center">
          <Layers className="w-16 h-16 text-zinc-300 mb-4" />
          <h3 className="text-xl font-black text-zinc-400">Select a series to manage chapters</h3>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-[2.5rem] shadow-2xl">
            <div className="p-8 border-b border-zinc-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-2xl font-black uppercase tracking-tight">{editingChapter ? 'Edit Chapter' : 'Add New Chapter'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-zinc-400 hover:bg-zinc-100 rounded-full">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-8">
              <div className="grid md:grid-cols-3 gap-8">
                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Chapter Number</label>
                    <input 
                      type="number" 
                      required
                      step="0.1"
                      value={formData.chapterNumber}
                      onChange={e => setFormData({...formData, chapterNumber: Number(e.target.value)})}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Title (Optional)</label>
                    <input 
                      type="text" 
                      value={formData.title}
                      onChange={e => setFormData({...formData, title: e.target.value})}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Publish Date</label>
                    <input 
                      type="date" 
                      required
                      value={formData.publishDate}
                      onChange={e => setFormData({...formData, publishDate: e.target.value})}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 outline-none"
                    />
                  </div>
                </div>
                <div className="md:col-span-2 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500">Chapter Content (Pages)</label>
                    <div className="flex flex-wrap gap-4">
                      <label className="text-xs font-bold text-blue-600 flex items-center gap-1 hover:underline cursor-pointer">
                        <Upload className="w-3 h-3" /> Upload Files
                        <input 
                          type="file" 
                          multiple 
                          accept="image/*" 
                          className="hidden" 
                          onChange={handleFileUpload}
                        />
                      </label>
                      <button 
                        type="button"
                        onClick={() => setIsBulkModalOpen(true)}
                        className="text-xs font-bold text-purple-600 flex items-center gap-1 hover:underline"
                      >
                        <Layers className="w-3 h-3" /> Bulk Add URLs
                      </button>
                      <button 
                        type="button"
                        onClick={handleAddImage}
                        className="text-xs font-bold text-emerald-600 flex items-center gap-1 hover:underline"
                      >
                        <Plus className="w-3 h-3" /> Add Page
                      </button>
                    </div>
                  </div>

                  {/* Scrape Input */}
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      placeholder="Paste chapter URL to scrape images..."
                      value={scrapeUrl}
                      onChange={e => setScrapeUrl(e.target.value)}
                      className="flex-1 bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-emerald-500/50"
                    />
                    <button 
                      type="button"
                      onClick={handleScrape}
                      disabled={isScraping || !scrapeUrl}
                      className="px-4 py-2 bg-zinc-900 text-white text-xs font-bold rounded-xl hover:bg-zinc-800 disabled:opacity-50 transition-colors"
                    >
                      {isScraping ? 'Scraping...' : 'Scrape'}
                    </button>
                  </div>

                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                    {formData.content.map((url, index) => (
                      <div key={index} className="flex gap-2 group">
                        <div className="w-8 h-10 bg-zinc-100 rounded flex items-center justify-center text-[10px] font-bold text-zinc-400 flex-shrink-0">
                          {index + 1}
                        </div>
                        <div className="flex-1 relative">
                          <input 
                            type="text" 
                            placeholder="Image URL or Base64"
                            value={url}
                            onChange={e => handleImageChange(index, e.target.value)}
                            className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2 text-sm outline-none"
                          />
                          {url.startsWith('data:image') && (
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-0.5 bg-blue-100 text-blue-600 text-[8px] font-black uppercase rounded">File</span>
                          )}
                        </div>
                        <button 
                          type="button"
                          onClick={() => handleRemoveImage(index)}
                          className="p-2 text-zinc-400 hover:text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {formData.content.length === 0 && (
                      <div className="p-12 border-2 border-dashed border-zinc-100 rounded-2xl text-center">
                        <ImageIcon className="w-8 h-8 text-zinc-200 mx-auto mb-2" />
                        <p className="text-xs font-bold text-zinc-400">No pages added yet</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Bulk Add Modal */}
              {isBulkModalOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                  <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl p-8 space-y-6">
                    <div>
                      <h3 className="text-xl font-black uppercase tracking-tight">Bulk Add URLs</h3>
                      <p className="text-xs text-zinc-500 font-medium">Paste image URLs separated by new lines.</p>
                    </div>
                    <textarea 
                      rows={10}
                      value={bulkText}
                      onChange={e => setBulkText(e.target.value)}
                      placeholder="https://example.com/image1.jpg&#10;https://example.com/image2.jpg"
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 text-sm outline-none resize-none font-mono"
                    />
                    <div className="flex gap-4">
                      <button 
                        type="button"
                        onClick={() => setIsBulkModalOpen(false)}
                        className="flex-1 py-3 bg-zinc-100 text-zinc-500 font-bold rounded-xl hover:bg-zinc-200 transition-colors"
                      >
                        Cancel
                      </button>
                      <button 
                        type="button"
                        onClick={handleBulkAdd}
                        className="flex-1 py-3 bg-black text-white font-bold rounded-xl hover:bg-zinc-800 transition-colors"
                      >
                        Add Pages
                      </button>
                    </div>
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-4 pt-8 border-t border-zinc-100">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-8 py-3 text-zinc-500 font-bold hover:bg-zinc-100 rounded-2xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-12 py-3 bg-black text-white font-bold rounded-2xl hover:bg-zinc-800 transition-colors"
                >
                  {editingChapter ? 'Update Chapter' : 'Upload Chapter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
