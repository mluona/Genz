import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Comment } from '../../types';
import { Trash2, MessageSquare, ShieldAlert, CheckCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export const CommentModeration: React.FC = () => {
  const [comments, setComments] = useState<Comment[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'comments'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setComments(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Comment)));
    });
    return () => unsubscribe();
  }, []);

  const handleDelete = async (id: string) => {
    if (window.confirm("Delete this comment?")) {
      await deleteDoc(doc(db, 'comments', id));
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Comment Moderation</h1>
        <p className="text-zinc-500 font-medium">Monitor and moderate user discussions across the site.</p>
      </div>

      <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
          <h3 className="font-black uppercase tracking-tight">Recent Comments</h3>
          <div className="flex gap-2">
            <button className="px-4 py-2 bg-zinc-100 text-zinc-600 text-xs font-bold rounded-xl hover:bg-zinc-200">All</button>
            <button className="px-4 py-2 bg-red-50 text-red-600 text-xs font-bold rounded-xl hover:bg-red-100">Flagged</button>
          </div>
        </div>
        <div className="divide-y divide-zinc-100">
          {comments.map((comment) => (
            <div key={comment.id} className="p-6 flex gap-4 hover:bg-zinc-50 transition-colors">
              <img src={comment.userAvatar} className="w-10 h-10 rounded-full flex-shrink-0" alt="" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{comment.username}</span>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                      {formatDistanceToNow(comment.timestamp.toDate(), { addSuffix: true })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="p-2 text-zinc-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg">
                      <CheckCircle className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(comment.id)}
                      className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-sm text-zinc-600 leading-relaxed">{comment.text}</p>
                <div className="flex items-center gap-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                  <span>Series ID: {comment.seriesId}</span>
                  {comment.chapterId && <span>Chapter ID: {comment.chapterId}</span>}
                </div>
              </div>
            </div>
          ))}
          {comments.length === 0 && (
            <div className="p-20 text-center text-zinc-400 font-bold">
              No comments found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
