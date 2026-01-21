import { useState, useEffect } from 'react';
import pb from '../lib/pocketbase';
import { Post } from '../types';
import PostForm from './PostForm';
import PostItem from './PostItem';

export default function Board() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const isAuthenticated = pb.authStore.isValid;
  const perPage = 10;

  useEffect(() => {
    loadPosts();
  }, [currentPage]);

  const loadPosts = async () => {
    try {
      // 인증 없이도 조회 가능 (공개)
      const records = await pb.collection('posts').getList(currentPage, perPage, {
        sort: '-created',
        expand: 'author',
      });
      
      // 총 페이지 수 계산
      setTotalPages(Math.ceil(records.totalItems / perPage));
      
      // 작성자 정보를 한 번에 가져오기
      const authorIds = [...new Set(records.items.map((item: any) => item.author).filter(Boolean))];
      const authorsMap = new Map();
      
      // 각 작성자 정보를 가져오기
      for (const authorId of authorIds) {
        try {
          const author = await pb.collection('users').getOne(authorId);
          authorsMap.set(authorId, author);
        } catch (error) {
          console.error(`작성자 정보 로드 실패 (${authorId}):`, error);
        }
      }
      
      const postsWithAuthor = records.items.map((item: any) => {
        // expand에서 먼저 시도 (name 필드만)
        let authorName = item.expand?.author?.name;
        
        // expand가 실패한 경우 직접 가져온 정보 사용 (name 필드만)
        if (!authorName && item.author) {
          const author = authorsMap.get(item.author);
          if (author) {
            authorName = author.name;
          }
        }
        
        // name이 없으면 알 수 없음
        authorName = authorName || '알 수 없음';
        
        return {
          id: item.id,
          title: item.title,
          content: item.content,
          image: item.image,
          author: item.author,
          authorName: authorName,
          created: item.created,
          updated: item.updated,
        };
      });
      
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
            setCurrentPage(1); // 새 게시글 작성 후 첫 페이지로 이동
            loadPosts(); // 게시글 목록 새로고침
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
        <>
          <div className="posts-list">
            {posts.map((post) => (
              <PostItem 
                key={post.id} 
                post={post} 
                onUpdate={loadPosts}
              />
            ))}
          </div>
          
          {totalPages > 1 && (
            <div className="pagination">
              <button
                className="pagination-button"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                이전
              </button>
              <span className="pagination-info">
                {currentPage} / {totalPages}
              </span>
              <button
                className="pagination-button"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                다음
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
