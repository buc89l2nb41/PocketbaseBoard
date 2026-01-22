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

  // 업로드된 모든 이미지 URL 가져오기 (post.image 필드에서)
  const getAllImageUrls = () => {
    if (!post?.image) return [];
    
    try {
      const imageFilenames = Array.isArray(post.image) ? post.image : [post.image];
      return imageFilenames
        .filter(filename => filename)
        .map(filename => `${pb.baseUrl}/api/files/posts/${post.id}/${filename}`);
    } catch (error) {
      console.error('이미지 URL 생성 실패:', error);
      return [];
    }
  };

  const allImageUrls = getAllImageUrls();

  // 마크다운 이미지 파싱 및 렌더링 (숫자 형식만 표시)
  const renderContentWithImages = (text: string) => {
    // 마크다운 이미지 패턴: ![alt](url)
    const imagePattern = /!\[([^\]]*)\]\(([^)]+)\)/g;
    const parts: Array<{ type: 'text' | 'image'; content?: string; url?: string; alt?: string; imageNumber?: number }> = [];
    let lastIndex = 0;
    let match;

    while ((match = imagePattern.exec(text)) !== null) {
      // 이미지 앞의 텍스트
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: text.substring(lastIndex, match.index)
        });
      }
      
      const urlOrNumber = match[2];
      // 숫자 형식인지 확인 (순수 숫자만)
      const isNumber = /^\d+$/.test(urlOrNumber);
      
      if (isNumber) {
        // 숫자 형식인 경우만 이미지로 처리
        parts.push({
          type: 'image',
          alt: match[1],
          url: urlOrNumber,
          imageNumber: parseInt(urlOrNumber, 10)
        });
      } else {
        // 숫자가 아닌 경우 텍스트로 처리 (표시하지 않음)
        parts.push({
          type: 'text',
          content: match[0] // 원본 마크다운 텍스트 그대로 표시
        });
      }
      
      lastIndex = match.index + match[0].length;
    }
    
    // 남은 텍스트
    if (lastIndex < text.length) {
      parts.push({
        type: 'text',
        content: text.substring(lastIndex)
      });
    }
    
    // 파싱 결과가 없으면 원본 텍스트 반환
    if (parts.length === 0) {
      return <span style={{ whiteSpace: 'pre-wrap' }}>{text}</span>;
    }

    // 이미지 번호를 실제 URL로 매핑
    const imageUrlMap = new Map<number, string>();
    if (post?.image) {
      try {
        const imageFilenames = Array.isArray(post.image) ? post.image : [post.image];
        imageFilenames
          .filter(filename => filename)
          .forEach((filename, index) => {
            const imageUrl = `${pb.baseUrl}/api/files/posts/${post.id}/${filename}`;
            imageUrlMap.set(index + 1, imageUrl);
          });
      } catch (error) {
        console.error('이미지 URL 매핑 실패:', error);
      }
    }

    return (
      <>
        {parts.map((part, index) => {
          if (part.type === 'image' && part.imageNumber) {
            const imageUrl = imageUrlMap.get(part.imageNumber);
            if (imageUrl) {
              return (
                <div key={index} style={{ margin: '1.5rem 0' }}>
                  <img 
                    src={imageUrl} 
                    alt={part.alt || post.title}
                    style={{
                      maxWidth: '100%',
                      height: 'auto',
                      display: 'block',
                      borderRadius: '8px',
                      boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
                    }}
                  />
                </div>
              );
            }
            // URL을 찾을 수 없으면 표시하지 않음
            return null;
          }
          return (
            <span key={index} style={{ whiteSpace: 'pre-wrap' }}>
              {part.content}
            </span>
          );
        })}
      </>
    );
  };

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
            initialImages={allImageUrls}
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
        
        <div className="post-content">
          {renderContentWithImages(post.content)}
        </div>
        
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
