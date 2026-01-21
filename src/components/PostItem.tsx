import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Post } from '../types';
import PostForm from './PostForm';

interface PostItemProps {
  post: Post;
  onUpdate: () => void;
}

export default function PostItem({ post, onUpdate }: PostItemProps) {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);

  // 날짜를 간략하게 표시하는 함수
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    
    const year = date.getFullYear().toString().slice(-2); // YY 형식
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    return `${year}.${month}.${day} ${hours}:${minutes}`;
  };

  if (isEditing) {
    return (
      <div className="post-item editing">
        <PostForm
          postId={post.id}
          initialTitle={post.title}
          initialContent={post.content}
          onSuccess={() => {
            setIsEditing(false);
            onUpdate();
          }}
        />
        <button onClick={() => setIsEditing(false)} className="cancel-button">
          취소
        </button>
      </div>
    );
  }

  return (
    <div 
      className="post-item clickable"
      onClick={() => {
        navigate(`/post/${post.id}`);
      }}
    >
      <h3 className="post-title">
        {post.title}
      </h3>
      <div className="post-item-meta">
        <span className="post-author">{post.authorName}</span>
        <span className="post-date">
          {formatDate(post.created)}
        </span>
      </div>
    </div>
  );
}
