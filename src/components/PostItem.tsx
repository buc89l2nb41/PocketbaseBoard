import { useState } from 'react';
import pb from '../lib/pocketbase';
import { Post } from '../types';
import PostForm from './PostForm';

interface PostItemProps {
  post: Post;
  onDelete: () => void;
  onUpdate: () => void;
}

export default function PostItem({ post, onDelete, onUpdate }: PostItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const currentUserId = pb.authStore.model?.id;
  const isAuthor = post.author === currentUserId;

  const handleDelete = async () => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    try {
      await pb.collection('posts').delete(post.id);
      onDelete();
    } catch (error: any) {
      console.error('삭제 실패:', error);
      alert(error.message || '삭제에 실패했습니다.');
    }
  };

  // 이미지 URL 생성
  const getImageUrl = () => {
    if (!post.image) return null;
    try {
      return pb.files.getUrl(pb.collection('posts').getOne(post.id), post.image);
    } catch (error) {
      console.error('이미지 URL 생성 실패:', error);
      return null;
    }
  };

  const imageUrl = getImageUrl();

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
    <div className="post-item">
      <div className="post-header">
        <h3 className="post-title">{post.title}</h3>
        {isAuthor && (
          <div className="post-actions">
            <button onClick={() => setIsEditing(true)} className="edit-button">
              수정
            </button>
            <button onClick={handleDelete} className="delete-button">
              삭제
            </button>
          </div>
        )}
      </div>
      
      <div className="post-content">{post.content}</div>
      
      {imageUrl && (
        <div className="post-image">
          <img src={imageUrl} alt={post.title} />
        </div>
      )}
      
      <div className="post-footer">
        <span className="post-author">작성자: {post.authorName}</span>
        <span className="post-date">
          {new Date(post.created).toLocaleString('ko-KR')}
        </span>
      </div>
    </div>
  );
}
