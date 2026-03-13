import { Timestamp } from 'firebase/firestore';

export type SeriesType = 'Manga' | 'Manhwa' | 'Novel';
export type SeriesStatus = 'Ongoing' | 'Completed' | 'Hiatus' | 'Dropped';
export type UserRole = 'user' | 'admin' | 'translator' | 'proofreader' | 'typesetter' | 'editor';

export interface Series {
  id: string;
  title: string;
  description: string;
  coverImage: string;
  status: SeriesStatus;
  type: SeriesType;
  genres: string[];
  tags: string[];
  author: string;
  artist: string;
  releaseYear: number;
  rating: number;
  ratingCount: number;
  views: number;
  dailyViews: number;
  weeklyViews: number;
  monthlyViews: number;
  lastUpdated: Timestamp;
  slug: string;
}

export interface Chapter {
  id: string;
  seriesId: string;
  chapterNumber: number;
  title: string;
  content: string[]; // URLs for images, text for novels
  publishDate: Timestamp;
  views: number;
  teamId?: string;
}

export interface UserProfile {
  uid: string;
  username: string;
  email: string;
  bio: string;
  profilePicture: string;
  role: UserRole;
  favorites: string[]; // Series IDs
  history: { seriesId: string; lastChapterId: string; timestamp: Timestamp }[];
  bookmarks: string[]; // Chapter IDs
  banned: boolean;
}

export interface Comment {
  id: string;
  seriesId: string;
  chapterId?: string;
  userId: string;
  username: string;
  userAvatar: string;
  text: string;
  likes: number;
  parentId?: string;
  timestamp: Timestamp;
}

export interface Team {
  id: string;
  name: string;
  members: { userId: string; role: string }[];
}

export interface Notification {
  id: string;
  userId: string;
  message: string;
  type: 'chapter' | 'reply' | 'announcement';
  read: boolean;
  timestamp: Timestamp;
  link?: string;
}
