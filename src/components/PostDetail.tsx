import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import pb from '../lib/pocketbase';
import { Post } from '../types';
import PostForm from './PostForm';

export default function PostDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const currentUserId = pb.authStore.model?.id;
  const isAuthor = post?.author === currentUserId;

  useEffect(() => {
    loadPost();
  }, [id]);

  const loadPost = async (retryCount = 0) => {
    if (!id) {
      setLoading(false);
      return;
    }

    try {
      const record = await pb.collection('posts').getOne(id, {
        expand: 'author',
      });

      // expand에서 먼저 시도 (name 필드만)
      let authorName = (record.expand as any)?.author?.name;
      
      // expand가 실패한 경우 직접 users 컬렉션에서 가져오기 (name 필드만)
      if (!authorName && record.author) {
        try {
          const author = await pb.collection('users').getOne(record.author);
          authorName = author.name;
        } catch (error) {
          console.error('작성자 정보 로드 실패:', error);
        }
      }
      
      // name이 없으면 알 수 없음
      authorName = authorName || '알 수 없음';

      setPost({
        id: record.id,
        title: record.title,
        content: record.content,
        image: record.image,
        author: record.author,
        authorName: authorName,
        created: record.created,
        updated: record.updated,
      });
    } catch (error: any) {
      console.error('게시글 로드 실패:', error);
      console.error('에러 상세:', {
        message: error.message,
        status: error.status,
        response: error.response,
        data: error.data
      });
      
      // 네트워크 에러나 일시적 에러인 경우 재시도
      if (retryCount < 2 && (error.status === 0 || error.status >= 500 || error.message?.includes('ERR_ABORTED'))) {
        console.log('재시도 중...');
        await new Promise(resolve => setTimeout(resolve, 500));
        return loadPost(retryCount + 1);
      }
      
      // 최종 실패 시에만 에러 처리
      if (error.status === 404) {
        alert('게시글을 찾을 수 없습니다.');
      } else {
        alert('게시글을 불러올 수 없습니다.');
      }
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    try {
      await pb.collection('posts').delete(post!.id);
      navigate('/');
    } catch (error: any) {
      console.error('삭제 실패:', error);
      alert('삭제에 실패했습니다.');
    }
  };

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      alert('링크가 클립보드에 복사되었습니다.');
    }).catch(() => {
      // 클립보드 API 실패 시 fallback
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('링크가 클립보드에 복사되었습니다.');
    });
  };

  // 이미지 URL 생성
  const getImageUrl = () => {
    if (!post?.image) return null;
    
    try {
      const imageFilename = Array.isArray(post.image) ? post.image[0] : post.image;
      if (!imageFilename) return null;
      return `${pb.baseUrl}/api/files/posts/${post.id}/${imageFilename}`;
    } catch (error) {
      console.error('이미지 URL 생성 실패:', error);
      return null;
    }
  };

  const imageUrl = getImageUrl();

  if (loading) {
    return <div className="loading">로딩 중...</div>;
  }

  if (!post) {
    return <div className="empty-board">게시글을 찾을 수 없습니다.</div>;
  }

  if (isEditing) {
    return (
      <div className="post-detail">
        <button onClick={() => navigate('/')} className="back-button">
          ← 목록으로
        </button>
        <div className="post-item editing">
          <PostForm
            postId={post.id}
            initialTitle={post.title}
            initialContent={post.content}
            onSuccess={() => {
              setIsEditing(false);
              loadPost();
            }}
          />
          <button onClick={() => setIsEditing(false)} className="cancel-button">
            취소
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="post-detail">
      <button onClick={() => navigate('/')} className="back-button">
        ← 목록으로
      </button>
      
      <div className="post-item">
        <div className="post-header">
          <h2 className="post-title">{post.title}</h2>
          <div className="post-header-actions">
            <button onClick={handleShare} className="share-button">
              공유
            </button>
            {isAuthor && (
              <div className="post-actions">
                <button 
                  onClick={() => setIsEditing(true)} 
                  className="edit-button"
                >
                  수정
                </button>
                <button 
                  onClick={handleDelete} 
                  className="delete-button"
                >
                  삭제
                </button>
              </div>
            )}
          </div>
        </div>
        
        <div className="post-content">{post.content}</div>
        
        {imageUrl && (
          <div className="post-image">
            <img src={imageUrl} alt={post.title} />
          </div>
        )}
        
        <div className="post-footer">
          <span className="post-author">{post.authorName}</span>
          <span className="post-date">
            {new Date(post.created).toLocaleString('ko-KR')}
          </span>
        </div>
      </div>
    </div>
  );
}
