import { useState, useEffect } from 'react';
import pb from '../lib/pocketbase';
import { Post } from '../types';
import PostForm from './PostForm';
import PostItem from './PostItem';

export default function Board() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const isAuthenticated = pb.authStore.isValid;

  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
    try {
      // 인증 없이도 조회 가능 (공개)
      const records = await pb.collection('posts').getList(1, 50, {
        sort: '-created',
        expand: 'author',
      });
      
      const postsWithAuthor = records.items.map((item: any) => ({
        id: item.id,
        title: item.title,
        content: item.content,
        image: item.image,
        author: item.author,
        authorName: item.expand?.author?.email || '알 수 없음',
        created: item.created,
        updated: item.updated,
      }));
      
      setPosts(postsWithAuthor);
    } catch (error) {
      console.error('게시글 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">로딩 중...</div>;
  }

  return (
    <div className="board-container">
      <div className="board-header">
        <h2>게시판</h2>
        {isAuthenticated && (
          <button 
            className="write-button" 
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? '취소' : '글쓰기'}
          </button>
        )}
      </div>

      {showForm && isAuthenticated && (
        <PostForm 
          onSuccess={() => { 
            setShowForm(false); 
            loadPosts(); 
          }} 
        />
      )}

      {!isAuthenticated && (
        <div className="login-prompt">
          <p>글을 작성하려면 로그인이 필요합니다.</p>
        </div>
      )}

      {posts.length === 0 ? (
        <div className="empty-board">
          <p>아직 작성된 글이 없습니다.</p>
        </div>
      ) : (
        <div className="posts-list">
          {posts.map((post) => (
            <PostItem 
              key={post.id} 
              post={post} 
              onDelete={loadPosts}
              onUpdate={loadPosts}
            />
          ))}
        </div>
      )}
    </div>
  );
}
