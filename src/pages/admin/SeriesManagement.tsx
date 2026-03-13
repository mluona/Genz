import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, Timestamp, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Series, SeriesType, SeriesStatus } from '../../types';
import { Plus, Edit2, Trash2, Search, Filter, X, Upload } from 'lucide-react';

export const SeriesManagement: React.FC = () => {
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSeries, setEditingSeries] = useState<Series | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [seriesToDelete, setSeriesToDelete] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    coverImage: '',
    status: 'Ongoing' as SeriesStatus,
    type: 'Manga' as SeriesType,
    genres: [] as string[],
    tags: [] as string[],
    author: '',
    artist: '',
    releaseYear: new Date().getFullYear(),
    slug: '',
  });

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'series'), (snapshot) => {
      setSeriesList(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Series)));
    });
    return () => unsubscribe();
  }, []);

  const generateSlug = (title: string) => {
    return title.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const slug = formData.slug || generateSlug(formData.title);
    const data = {
      ...formData,
      slug,
      rating: editingSeries?.rating || 0,
      ratingCount: editingSeries?.ratingCount || 0,
      views: editingSeries?.views || 0,
      dailyViews: 0,
      weeklyViews: 0,
      monthlyViews: 0,
      lastUpdated: Timestamp.now(),
    };

    try {
      if (editingSeries) {
        await updateDoc(doc(db, 'series', editingSeries.id), data);
      } else {
        // Use slug as document ID for easier retrieval
        await setDoc(doc(db, 'series', slug), data);
      }
      setIsModalOpen(false);
      setEditingSeries(null);
      setFormData({
        title: '',
        description: '',
        coverImage: '',
        status: 'Ongoing',
        type: 'Manga',
        genres: [],
        tags: [],
        author: '',
        artist: '',
        releaseYear: new Date().getFullYear(),
        slug: '',
      });
    } catch (error) {
      console.error("Error saving series:", error);
    }
  };

  const handleDelete = async (id: string) => {
    setSeriesToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (seriesToDelete) {
      try {
        await deleteDoc(doc(db, 'series', seriesToDelete));
        setIsDeleteModalOpen(false);
        setSeriesToDelete(null);
      } catch (error) {
        console.error("Error deleting series:", error);
      }
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Series Management</h1>
          <p className="text-zinc-500 font-medium">Add, edit, and manage all reading works on GENZ.</p>
        </div>
        <button 
          onClick={() => { setEditingSeries(null); setIsModalOpen(true); }}
          className="flex items-center gap-2 px-6 py-3 bg-emerald-500 text-black font-bold rounded-2xl hover:bg-emerald-400 transition-colors"
        >
          <Plus className="w-5 h-5" /> Add New Series
        </button>
      </div>

      {/* Series Table */}
      <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-200">
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Series</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Type</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Status</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Views</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {seriesList.map((series) => (
              <tr key={series.id} className="hover:bg-zinc-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-4">
                    <img src={series.coverImage} className="w-10 h-14 object-cover rounded-lg" alt="" />
                    <div>
                      <p className="font-bold">{series.title}</p>
                      <p className="text-xs text-zinc-500">{series.author}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="px-3 py-1 bg-zinc-100 text-zinc-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                    {series.type}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${series.status === 'Ongoing' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                    {series.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm font-bold">{series.views.toLocaleString()}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => { setEditingSeries(series); setFormData(series); setIsModalOpen(true); }}
                      className="p-2 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(series.id)}
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

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-[2.5rem] shadow-2xl">
            <div className="p-8 border-b border-zinc-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-2xl font-black uppercase tracking-tight">{editingSeries ? 'Edit Series' : 'Add New Series'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-zinc-400 hover:bg-zinc-100 rounded-full">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-8">
              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Title</label>
                    <input 
                      type="text" 
                      required
                      value={formData.title}
                      onChange={e => setFormData({...formData, title: e.target.value})}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Slug</label>
                    <input 
                      type="text" 
                      required
                      value={formData.slug}
                      onChange={e => setFormData({...formData, slug: e.target.value})}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Type</label>
                      <select 
                        value={formData.type}
                        onChange={e => setFormData({...formData, type: e.target.value as SeriesType})}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 outline-none"
                      >
                        <option value="Manga">Manga</option>
                        <option value="Manhwa">Manhwa</option>
                        <option value="Novel">Novel</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Status</label>
                      <select 
                        value={formData.status}
                        onChange={e => setFormData({...formData, status: e.target.value as SeriesStatus})}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 outline-none"
                      >
                        <option value="Ongoing">Ongoing</option>
                        <option value="Completed">Completed</option>
                        <option value="Hiatus">Hiatus</option>
                        <option value="Dropped">Dropped</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Description</label>
                    <textarea 
                      rows={4}
                      value={formData.description}
                      onChange={e => setFormData({...formData, description: e.target.value})}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-emerald-500/20 outline-none resize-none"
                    />
                  </div>
                </div>
                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Cover Image</label>
                    <div className="flex flex-col gap-4">
                      <div className="flex gap-4">
                        <input 
                          type="text" 
                          placeholder="Image URL"
                          value={formData.coverImage}
                          onChange={e => setFormData({...formData, coverImage: e.target.value})}
                          className="flex-1 bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 outline-none"
                        />
                        <label className="p-3 bg-zinc-100 rounded-2xl text-zinc-500 hover:bg-zinc-200 cursor-pointer transition-colors">
                          <Upload className="w-5 h-5" />
                          <input 
                            type="file" 
                            className="hidden" 
                            accept="image/*"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  setFormData({...formData, coverImage: reader.result as string});
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                        </label>
                      </div>
                      <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Or upload a file from your device</p>
                    </div>
                    {formData.coverImage && (
                      <div className="relative mt-4 w-32 h-44 group">
                        <img src={formData.coverImage} className="w-full h-full object-cover rounded-2xl border border-zinc-200 shadow-lg" alt="Preview" />
                        <button 
                          type="button"
                          onClick={() => setFormData({...formData, coverImage: ''})}
                          className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Author</label>
                      <input 
                        type="text" 
                        value={formData.author}
                        onChange={e => setFormData({...formData, author: e.target.value})}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Artist</label>
                      <input 
                        type="text" 
                        value={formData.artist}
                        onChange={e => setFormData({...formData, artist: e.target.value})}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
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
                  {editingSeries ? 'Update Series' : 'Create Series'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl p-8 space-y-6">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight">Delete Series?</h3>
              <p className="text-zinc-500 font-medium">This action cannot be undone. All chapters and data associated with this series will be lost.</p>
            </div>
            <div className="flex gap-4">
              <button 
                onClick={() => setIsDeleteModalOpen(false)}
                className="flex-1 py-3 bg-zinc-100 text-zinc-500 font-bold rounded-xl hover:bg-zinc-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDelete}
                className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
