export interface Post {
  id: string;
  title: string;
  content: string;
  image?: string | string[];
  author: string;
  authorName?: string;
  created: string;
  updated: string;
}

export interface User {
  id: string;
  email: string;
  username?: string;
}
