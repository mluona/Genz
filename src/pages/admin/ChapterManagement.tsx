import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, Timestamp, query, orderBy, setDoc, getDocs, writeBatch, waitForPendingWrites } from 'firebase/firestore';
import { db } from '../../firebase';
import { Series, Chapter } from '../../types';
import { compressImage, splitAndCompressImage } from '../../utils/imageCompression';
import { 
  Plus, Edit2, Trash2, X, Upload, Image as ImageIcon, 
  Layers, Loader2, FileArchive, AlertCircle, ArrowUp, 
  ArrowDown, Search, Filter, ChevronRight, Check, 
  GripVertical, ExternalLink, RefreshCw, Type
} from 'lucide-react';
import JSZip from 'jszip';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const ChapterManagement: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [selectedSeries, setSelectedSeries] = useState<Series | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [formData, setFormData] = useState({
    chapterNumber: 1,
    title: '',
    content: [] as string[],
    publishDate: new Date().toISOString().split('T')[0],
  });

  // UI States
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [failedUploads, setFailedUploads] = useState<{name: string, error: string, index: number}[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [totalFilesToUpload, setTotalFilesToUpload] = useState(0);
  const [completedFilesCount, setCompletedFilesCount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [chapterToDelete, setChapterToDelete] = useState<string | null>(null);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  // Fetch Series
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'series'), (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Series));
      setSeriesList(list);
      
      // Auto-select from URL or first available
      const seriesId = searchParams.get('seriesId');
      if (seriesId) {
        const found = list.find(s => s.id === seriesId);
        if (found) setSelectedSeries(found);
      }
    });
    return () => unsubscribe();
  }, [searchParams]);

  // Fetch Chapters
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

  // Common Upload Logic
  const uploadFiles = async (files: File[]) => {
    if (!selectedSeries) return;
    setIsUploading(true);
    setError(null);
    setUploadProgress({});
    setFailedUploads([]);
    setTotalFilesToUpload(files.length);
    setCompletedFilesCount(0);

    // Pre-allocate slots with unique temporary IDs to track them
    const startIndex = formData.content.length;
    const placeholders = files.map(f => `uploading-${f.name}-${Date.now()}`);
    setFormData(prev => ({ ...prev, content: [...prev.content, ...placeholders] }));

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileId = placeholders[i];
      
      try {
        console.log(`Starting compression for: ${file.name}`, {
          size: (file.size / 1024).toFixed(2) + ' KB',
          type: file.type
        });
        
        // Compress and split image if it's a long strip
        const base64Images = await splitAndCompressImage(file, 0.9);
        
        console.log(`Successfully compressed and split into ${base64Images.length} parts: ${file.name}`);
        
        setFormData(prev => {
          const newContent = [...prev.content];
          const placeholderIndex = newContent.indexOf(fileId);
          if (placeholderIndex !== -1) {
            newContent.splice(placeholderIndex, 1, ...base64Images);
          }
          return { ...prev, content: newContent };
        });
        
        setCompletedFilesCount(prev => prev + 1);
        setUploadProgress(prev => ({ ...prev, [fileId]: 100 }));
        
      } catch (err: any) {
        console.error(`Compression error for ${file.name}:`, err);
        setFailedUploads(prev => [...prev, { 
          name: file.name, 
          error: err.message || 'Unknown error',
          index: startIndex + i
        }]);

        // Remove the placeholder for failed uploads
        setFormData(prev => ({
          ...prev,
          content: prev.content.filter(item => item !== fileId)
        }));
      }
    }
    setIsUploading(false);
    setTotalFilesToUpload(0);
    setCompletedFilesCount(0);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
    uploadFiles(files);
  };

  const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedSeries) return;

    setIsExtracting(true);
    setError(null);
    try {
      const zip = new JSZip();
      const contents = await zip.loadAsync(file);
      const imageFiles = Object.keys(contents.files)
        .filter(name => !contents.files[name].dir && /\.(jpe?g|png|gif|webp|avif|bmp|tiff?|jfif|svg)$/i.test(name))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

      if (imageFiles.length === 0) {
        setError("No images found in ZIP.");
        setIsExtracting(false);
        return;
      }

      const files: File[] = [];
      for (const name of imageFiles) {
        const blob = await contents.files[name].async('blob');
        files.push(new File([blob], name, { type: blob.type }));
      }
      
      setIsExtracting(false);
      await uploadFiles(files);
    } catch (err: any) {
      setError(`ZIP Error: ${err.message}`);
      setIsExtracting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent, shouldContinue = false) => {
    if (e) e.preventDefault();
    if (!selectedSeries) return;
    setIsSaving(true);
    setError(null);

    const publishDate = new Date(formData.publishDate);
    
    // Separate content from chapterData for non-novels
    const isNovel = selectedSeries.type === 'Novel';
    const chapterData = {
      chapterNumber: parseFloat(formData.chapterNumber.toString()),
      title: formData.title,
      seriesId: selectedSeries.id,
      publishDate: Timestamp.fromDate(publishDate),
      views: editingChapter?.views || 0,
      content: isNovel ? formData.content : [], // Store empty array for non-novels in the main doc
      pageCount: isNovel ? (formData.content[0]?.split(/\s+/).filter(Boolean).length || 0) : formData.content.length,
    };

    try {
      let chapterId = editingChapter?.id;
      
      if (editingChapter) {
        await updateDoc(doc(db, `series/${selectedSeries.id}/chapters`, editingChapter.id), chapterData);
      } else {
        const docRef = await addDoc(collection(db, `series/${selectedSeries.id}/chapters`), chapterData);
        chapterId = docRef.id;
        await updateDoc(doc(db, 'series', selectedSeries.id), { lastUpdated: Timestamp.now() });
      }
      
      // Save pages to subcollection for non-novels
      if (chapterId && !isNovel) {
        const pagesRef = collection(db, `series/${selectedSeries.id}/chapters/${chapterId}/pages`);
        
        // First, let's get existing pages to delete any extras
        const existingPagesSnapshot = await getDocs(pagesRef);
        const existingPageIds = existingPagesSnapshot.docs.map(d => d.id);
        
        // Save new pages and delete extra pages in batches (max 500 ops or 8MB per batch)
        const newPageIds = new Set<string>();
        let batch = writeBatch(db);
        let opCount = 0;
        let batchSizeBytes = 0;
        const MAX_BATCH_BYTES = 2 * 1024 * 1024; // 2MB to be safe and prevent stream exhaustion
        
        const commitBatchIfNeeded = async (addedBytes = 0) => {
          if (opCount >= 450 || (batchSizeBytes + addedBytes) >= MAX_BATCH_BYTES) {
            await batch.commit();
            try {
              await waitForPendingWrites(db);
              await new Promise(resolve => setTimeout(resolve, 500)); // Give client time to breathe
            } catch (e) {
              console.warn("waitForPendingWrites failed or timed out", e);
            }
            batch = writeBatch(db);
            opCount = 0;
            batchSizeBytes = 0;
          }
          batchSizeBytes += addedBytes;
        };

        for (let i = 0; i < formData.content.length; i++) {
          const pageId = `page_${i.toString().padStart(4, '0')}`;
          newPageIds.add(pageId);
          
          const content = formData.content[i];
          // Approximate size of the document (base64 string length + some overhead)
          const approxBytes = content ? content.length : 100;
          
          await commitBatchIfNeeded(approxBytes);
          
          batch.set(doc(pagesRef, pageId), {
            pageNumber: i,
            content: content
          });
          opCount++;
        }
        
        // Delete extra pages
        for (const oldId of existingPageIds) {
          if (!newPageIds.has(oldId)) {
            await commitBatchIfNeeded(100); // Small overhead for delete
            batch.delete(doc(pagesRef, oldId));
            opCount++;
          }
        }
        
        if (opCount > 0) {
          await batch.commit();
          try {
            await waitForPendingWrites(db);
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (e) {
            console.warn("waitForPendingWrites failed or timed out", e);
          }
        }
      }
      
      if (editingChapter) {
        setSuccess("Chapter updated successfully!");
      } else {
        setSuccess("Chapter created successfully!");
      }
      
      if (shouldContinue) {
        const nextNum = chapterData.chapterNumber + 1;
        setFormData({
          chapterNumber: nextNum,
          title: '',
          content: [],
          publishDate: new Date().toISOString().split('T')[0],
        });
        setEditingChapter(null);
      } else {
        setIsEditorOpen(false);
        setEditingChapter(null);
        resetForm();
      }
    } catch (err: any) {
      setError(`Save failed: ${err.message}`);
    } finally {
      setIsSaving(false);
      setTimeout(() => setSuccess(null), 3000);
    }
  };

  const resetForm = () => {
    setFormData({
      chapterNumber: chapters.length > 0 ? chapters[0].chapterNumber + 1 : 1,
      title: '',
      content: [],
      publishDate: new Date().toISOString().split('T')[0],
    });
    setUploadProgress({});
    setFailedUploads([]);
  };

  const handleDelete = (id: string) => {
    if (!selectedSeries) return;
    setChapterToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedSeries || !chapterToDelete) return;
    try {
      // If it's not a novel, delete the pages subcollection first
      if (selectedSeries.type !== 'Novel') {
        const pagesRef = collection(db, `series/${selectedSeries.id}/chapters/${chapterToDelete}/pages`);
        const pagesSnapshot = await getDocs(pagesRef);
        
        if (!pagesSnapshot.empty) {
          let batch = writeBatch(db);
          let opCount = 0;
          
          for (const doc of pagesSnapshot.docs) {
            batch.delete(doc.ref);
            opCount++;
            if (opCount >= 450) {
              await batch.commit();
              try {
                await waitForPendingWrites(db);
                await new Promise(resolve => setTimeout(resolve, 500));
              } catch (e) {
                console.warn("waitForPendingWrites failed or timed out", e);
              }
              batch = writeBatch(db);
              opCount = 0;
            }
          }
          
          if (opCount > 0) {
            await batch.commit();
            try {
              await waitForPendingWrites(db);
              await new Promise(resolve => setTimeout(resolve, 500));
            } catch (e) {
              console.warn("waitForPendingWrites failed or timed out", e);
            }
          }
        }
      }
      
      // Delete the main chapter document
      await deleteDoc(doc(db, `series/${selectedSeries.id}/chapters`, chapterToDelete));
      setSuccess("Chapter deleted.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsDeleteModalOpen(false);
      setChapterToDelete(null);
      setTimeout(() => setSuccess(null), 3000);
    }
  };

  const openEditor = async (chapter?: Chapter) => {
    if (chapter) {
      let content = chapter.content || [];
      if (selectedSeries?.type !== 'Novel') {
        const pagesRef = collection(db, `series/${selectedSeries.id}/chapters/${chapter.id}/pages`);
        const pagesQuery = query(pagesRef, orderBy('pageNumber', 'asc'));
        const pagesSnapshot = await getDocs(pagesQuery);
        if (!pagesSnapshot.empty) {
          content = pagesSnapshot.docs.map(d => d.data().content);
        }
      }
      
      setEditingChapter(chapter);
      setFormData({
        chapterNumber: chapter.chapterNumber,
        title: chapter.title || '',
        content: content,
        publishDate: chapter.publishDate.toDate().toISOString().split('T')[0]
      });
    } else {
      setEditingChapter(null);
      resetForm();
    }
    setIsEditorOpen(true);
  };

  const filteredChapters = chapters.filter(c => 
    c.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.chapterNumber.toString().includes(searchTerm)
  );

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-zinc-200 px-4 sm:px-8 py-4">
        <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2">
                <Layers className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-500" />
                Chapter Management
              </h1>
              <p className="text-[10px] sm:text-xs font-medium text-zinc-500 uppercase tracking-widest">Admin Control Panel</p>
            </div>
            
            <div className="hidden sm:block h-8 w-px bg-zinc-200 mx-2" />

            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
              <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest hidden sm:inline">Active Series</span>
              <select 
                className="bg-zinc-100 border-none rounded-xl px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-emerald-500/20 outline-none w-full sm:min-w-[240px]"
                value={selectedSeries?.id || ''}
                onChange={(e) => setSelectedSeries(seriesList.find(s => s.id === e.target.value) || null)}
              >
                <option value="">Select a series...</option>
                {seriesList.map(s => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-4 w-full sm:w-auto">
            {selectedSeries && !isEditorOpen && (
              <motion.button 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => openEditor()}
                className="w-full sm:w-auto justify-center bg-emerald-500 text-black px-6 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
              >
                <Plus className="w-4 h-4" /> New Chapter
              </motion.button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-4 sm:p-8">
        <AnimatePresence mode="wait">
          {!selectedSeries ? (
            <motion.div 
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-16 sm:py-32 text-center px-4"
            >
              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-zinc-100 rounded-full flex items-center justify-center mb-6">
                <Layers className="w-8 h-8 sm:w-10 sm:h-10 text-zinc-300" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-zinc-400">No Series Selected</h2>
              <p className="text-zinc-500 mt-2 max-w-md">Please select a series from the dropdown above to start managing its chapters.</p>
            </motion.div>
          ) : isEditorOpen ? (
            <motion.div 
              key="editor"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8"
            >
              {/* Editor Sidebar */}
              <div className="lg:col-span-4 space-y-6">
                <div className="bg-white p-4 sm:p-8 rounded-[2rem] border border-zinc-200 shadow-sm space-y-6 sm:space-y-8">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg sm:text-xl font-black uppercase tracking-tight">Chapter Details</h3>
                    <button 
                      onClick={() => setIsEditorOpen(false)}
                      className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Chapter Number</label>
                      <input 
                        type="number" 
                        step="0.1"
                        value={formData.chapterNumber}
                        onChange={e => setFormData(prev => ({ ...prev, chapterNumber: Number(e.target.value) }))}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Title (Optional)</label>
                      <input 
                        type="text" 
                        value={formData.title}
                        onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="e.g. The Beginning of the End"
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Publish Date</label>
                      <input 
                        type="date" 
                        value={formData.publishDate}
                        onChange={e => setFormData(prev => ({ ...prev, publishDate: e.target.value }))}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>
                  </div>

                  <div className="pt-6 border-t border-zinc-100 flex flex-col gap-3">
                    <button 
                      onClick={(e) => handleSubmit(e, false)}
                      disabled={isSaving || isUploading}
                      className="w-full bg-black text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-zinc-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      {editingChapter ? 'Update Chapter' : 'Save & Close'}
                    </button>
                    {!editingChapter && (
                      <button 
                        onClick={(e) => handleSubmit(e, true)}
                        disabled={isSaving || isUploading}
                        className="w-full bg-emerald-500 text-black py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-emerald-400 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        Save & Continue
                      </button>
                    )}
                    <button 
                      onClick={() => setIsEditorOpen(false)}
                      className="w-full bg-zinc-100 text-zinc-500 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-zinc-200 transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>

                {/* Status Card */}
                {(isUploading || isExtracting || error || success || failedUploads.length > 0) && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={cn(
                      "p-6 rounded-[2rem] border shadow-sm",
                      error || failedUploads.length > 0 ? "bg-red-50 border-red-100 text-red-600" : 
                      success ? "bg-emerald-50 border-emerald-100 text-emerald-600" :
                      "bg-blue-50 border-blue-100 text-blue-600"
                    )}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        {error || failedUploads.length > 0 ? <AlertCircle className="w-5 h-5" /> : 
                         success ? <Check className="w-5 h-5" /> :
                         <Loader2 className="w-5 h-5 animate-spin" />}
                        <span className="text-sm font-black uppercase tracking-tight">
                          {error || failedUploads.length > 0 ? 'Upload Issues' : success ? 'Success' : 'Processing...'}
                        </span>
                      </div>
                      {failedUploads.length > 0 && (
                        <button 
                          onClick={() => setFailedUploads([])}
                          className="text-[10px] font-black uppercase tracking-widest hover:underline"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    
                    {error && <p className="text-xs font-medium leading-relaxed mb-2">{error}</p>}
                    {success && <p className="text-xs font-medium leading-relaxed">{success}</p>}
                    
                    {failedUploads.length > 0 && (
                      <div className="space-y-2 mt-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                        {failedUploads.map((fail, i) => (
                          <div key={i} className="p-3 bg-white/50 rounded-xl border border-red-100">
                            <p className="text-[10px] font-black uppercase tracking-tight truncate">{fail.name}</p>
                            <p className="text-[9px] font-medium opacity-80 mt-1">{fail.error}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {isUploading && (
                      <div className="space-y-3 mt-4">
                        <div className="flex justify-between items-end">
                          <p className="text-[10px] font-black uppercase tracking-widest opacity-70">
                            Overall Progress
                          </p>
                          <p className="text-[10px] font-black">
                            {completedFilesCount} / {totalFilesToUpload}
                          </p>
                        </div>
                        <div className="h-2 bg-blue-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-600 transition-all duration-500" 
                            style={{ width: `${(completedFilesCount / totalFilesToUpload) * 100}%` }} 
                          />
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </div>

              {/* Main Editor Area */}
              <div 
                className="lg:col-span-8 space-y-6 relative"
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const files = Array.from(e.dataTransfer.files);
                  const zipFile = files.find(f => f.name.endsWith('.zip'));
                  if (zipFile) {
                    const mockEvent = { target: { files: [zipFile] } } as any;
                    handleZipUpload(mockEvent);
                  } else {
                    const imageFiles = files.filter(f => f.type.startsWith('image/'));
                    if (imageFiles.length > 0) uploadFiles(imageFiles);
                  }
                }}
              >
                <AnimatePresence>
                  {isDragging && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 z-50 bg-emerald-500/10 backdrop-blur-sm border-4 border-dashed border-emerald-500 rounded-[2rem] flex items-center justify-center"
                    >
                      <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4">
                        <Upload className="w-12 h-12 text-emerald-500 animate-bounce" />
                        <p className="text-xl font-black uppercase tracking-tight">Drop to Upload</p>
                        <p className="text-sm font-medium text-zinc-500">Images or ZIP files supported</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="bg-white p-4 sm:p-8 rounded-[2rem] border border-zinc-200 shadow-sm min-h-[400px] sm:min-h-[600px]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
                    <div>
                      <h3 className="text-lg sm:text-xl font-black uppercase tracking-tight">
                        {selectedSeries.type === 'Novel' ? 'Chapter Content' : 'Chapter Pages'}
                      </h3>
                      <p className="text-xs font-medium text-zinc-500 mt-1">
                        {selectedSeries.type === 'Novel' ? 'Write or paste your chapter text below.' : 'Upload images or ZIP files to add pages.'}
                      </p>
                    </div>

                    {selectedSeries.type !== 'Novel' && (
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => {
                            const newContent = [...formData.content].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
                            setFormData(prev => ({ ...prev, content: newContent }));
                          }}
                          className="p-2 hover:bg-zinc-100 rounded-xl transition-colors text-zinc-500"
                          title="Sort Pages"
                        >
                          <RefreshCw className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => setIsClearModalOpen(true)}
                          className="p-2 hover:bg-red-50 rounded-xl transition-colors text-red-400"
                          title="Clear All"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {selectedSeries.type === 'Novel' ? (
                    <div className="space-y-4">
                      <textarea 
                        value={formData.content[0] || ''}
                        onChange={e => setFormData(prev => ({ ...prev, content: [e.target.value] }))}
                        placeholder="Once upon a time..."
                        className="w-full min-h-[500px] bg-zinc-50 border border-zinc-200 rounded-3xl p-8 text-lg font-serif leading-relaxed outline-none focus:ring-4 focus:ring-emerald-500/5 resize-none"
                      />
                      <div className="flex justify-between items-center px-4">
                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                          Word Count: {formData.content[0]?.split(/\s+/).filter(Boolean).length || 0}
                        </span>
                        <div className="flex items-center gap-2 text-zinc-400">
                          <Type className="w-4 h-4" />
                          <span className="text-[10px] font-black uppercase tracking-widest">Rich Text Supported</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-8">
                      {/* Upload Zones */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div 
                          onClick={() => fileInputRef.current?.click()}
                          className="group relative border-2 border-dashed border-zinc-200 rounded-[2rem] p-8 flex flex-col items-center justify-center gap-4 hover:border-blue-500 hover:bg-blue-50/50 transition-all cursor-pointer"
                        >
                          <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Upload className="w-6 h-6" />
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-black uppercase tracking-tight">Upload Images</p>
                            <p className="text-[10px] font-medium text-zinc-400 mt-1 uppercase tracking-widest">JPG, PNG, WEBP, etc.</p>
                          </div>
                          <input type="file" multiple accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
                        </div>

                        <div 
                          onClick={() => zipInputRef.current?.click()}
                          className="group relative border-2 border-dashed border-zinc-200 rounded-[2rem] p-8 flex flex-col items-center justify-center gap-4 hover:border-emerald-500 hover:bg-emerald-50/50 transition-all cursor-pointer"
                        >
                          <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                            <FileArchive className="w-6 h-6" />
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-black uppercase tracking-tight">Upload ZIP</p>
                            <p className="text-[10px] font-medium text-zinc-400 mt-1 uppercase tracking-widest">Auto-extract images</p>
                          </div>
                          <input type="file" accept=".zip" className="hidden" ref={zipInputRef} onChange={handleZipUpload} />
                        </div>
                      </div>

                      {/* Page Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
                        {formData.content.map((url, index) => (
                          <motion.div 
                            layout
                            key={`${url}-${index}`}
                            className="group relative aspect-[3/4] bg-zinc-100 rounded-2xl border border-zinc-200 overflow-hidden shadow-sm hover:shadow-md transition-all"
                          >
                            {url && !url.startsWith('uploading-') ? (
                              <img src={url} className="w-full h-full object-cover" alt={`Page ${index + 1}`} referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-zinc-50">
                                <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
                                <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">
                                  Uploading...
                                </span>
                              </div>
                            )}

                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3">
                              <div className="flex items-center gap-2">
                                <button 
                                  onClick={() => {
                                    const newContent = [...formData.content];
                                    const target = index - 1;
                                    if (target >= 0) {
                                      [newContent[index], newContent[target]] = [newContent[target], newContent[index]];
                                      setFormData(prev => ({ ...prev, content: newContent }));
                                    }
                                  }}
                                  className="p-2 bg-white/20 hover:bg-white/40 rounded-lg text-white transition-colors"
                                >
                                  <ArrowUp className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => {
                                    const newContent = [...formData.content];
                                    const target = index + 1;
                                    if (target < newContent.length) {
                                      [newContent[index], newContent[target]] = [newContent[target], newContent[index]];
                                      setFormData(prev => ({ ...prev, content: newContent }));
                                    }
                                  }}
                                  className="p-2 bg-white/20 hover:bg-white/40 rounded-lg text-white transition-colors"
                                >
                                  <ArrowDown className="w-4 h-4" />
                                </button>
                              </div>
                              <button 
                                onClick={() => {
                                  setFormData(prev => ({ ...prev, content: prev.content.filter((_, i) => i !== index) }));
                                }}
                                className="px-4 py-2 bg-red-500 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-red-600 transition-colors"
                              >
                                Remove
                              </button>
                            </div>

                            <div className="absolute top-3 left-3 px-2 py-1 bg-black/50 backdrop-blur-md rounded-lg text-[8px] font-black text-white uppercase tracking-widest">
                              Page {index + 1}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="list"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {/* List Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <h2 className="text-3xl font-black tracking-tight">{selectedSeries.title}</h2>
                  <p className="text-zinc-500 font-medium mt-1">Manage {chapters.length} chapters for this series.</p>
                </div>

                <div className="flex items-center gap-4 w-full md:w-auto">
                  <div className="relative w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input 
                      type="text" 
                      placeholder="Search chapters..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="bg-white border border-zinc-200 rounded-2xl pl-12 pr-6 py-3 text-sm font-medium outline-none focus:ring-4 focus:ring-emerald-500/5 w-full md:w-80"
                    />
                  </div>
                </div>
              </div>

              {/* Chapter Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredChapters.map((chapter) => (
                  <motion.div 
                    layout
                    key={chapter.id}
                    className="group bg-white p-4 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] border border-zinc-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all"
                  >
                    <div className="flex items-start justify-between mb-4 sm:mb-6">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 bg-zinc-100 rounded-2xl flex items-center justify-center text-lg sm:text-xl font-black text-zinc-400 group-hover:bg-emerald-50 group-hover:text-emerald-500 transition-colors">
                        #{chapter.chapterNumber}
                      </div>
                      <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            openEditor(chapter);
                          }}
                          className="p-2 hover:bg-blue-50 text-zinc-400 hover:text-blue-500 rounded-xl transition-all relative z-10"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDelete(chapter.id);
                          }}
                          className="p-2 hover:bg-red-50 text-zinc-400 hover:text-red-500 rounded-xl transition-all relative z-10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <h4 className="font-black text-lg truncate">{chapter.title || `Chapter ${chapter.chapterNumber}`}</h4>
                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1">
                          Published {chapter.publishDate.toDate().toLocaleDateString()}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t border-zinc-100">
                        <div className="flex items-center gap-2">
                          <ImageIcon className="w-3 h-3 text-zinc-400" />
                          <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                            {chapter.pageCount ?? chapter.content?.length ?? 0} {selectedSeries.type === 'Novel' ? 'Words' : 'Pages'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <ExternalLink className="w-3 h-3 text-zinc-400" />
                          <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                            {chapter.views.toLocaleString()} Views
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}

                <button 
                  onClick={() => openEditor()}
                  className="group aspect-square border-4 border-dashed border-zinc-200 rounded-[2.5rem] flex flex-col items-center justify-center gap-4 hover:border-emerald-500 hover:bg-emerald-50/50 transition-all text-zinc-300 hover:text-emerald-500"
                >
                  <div className="w-16 h-16 bg-zinc-100 rounded-3xl flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
                    <Plus className="w-8 h-8" />
                  </div>
                  <span className="text-sm font-black uppercase tracking-widest">Add Chapter</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl p-8 space-y-6">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight">Delete Chapter?</h3>
              <p className="text-zinc-500 font-medium">This action cannot be undone. The chapter and all its pages will be permanently deleted.</p>
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

      {/* Clear Pages Confirmation Modal */}
      {isClearModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl p-8 space-y-6">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight">Clear All Pages?</h3>
              <p className="text-zinc-500 font-medium">Are you sure you want to remove all pages from this chapter? You will need to re-upload them.</p>
            </div>
            <div className="flex gap-4">
              <button 
                onClick={() => setIsClearModalOpen(false)}
                className="flex-1 py-3 bg-zinc-100 text-zinc-500 font-bold rounded-xl hover:bg-zinc-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  setFormData(prev => ({ ...prev, content: [] }));
                  setIsClearModalOpen(false);
                }}
                className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
