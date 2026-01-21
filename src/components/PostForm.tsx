import { useState } from 'react';
import pb from '../lib/pocketbase';

interface PostFormProps {
  onSuccess: () => void;
  postId?: string;
  initialTitle?: string;
  initialContent?: string;
}

export default function PostForm({ onSuccess, postId, initialTitle = '', initialContent = '' }: PostFormProps) {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!pb.authStore.isValid) {
      alert('로그인이 필요합니다.');
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('content', content);
      formData.append('author', pb.authStore.model?.id || '');
      
      if (image) {
        formData.append('image', image);
      }

      if (postId) {
        // 수정
        await pb.collection('posts').update(postId, formData);
      } else {
        // 작성
        await pb.collection('posts').create(formData);
      }
      
      // 폼 초기화
      setTitle('');
      setContent('');
      setImage(null);
      setImagePreview(null);
      onSuccess();
    } catch (error: any) {
      console.error('게시글 작성 실패:', error);
      alert('게시글 작성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="post-form">
      <div className="form-group">
        <label htmlFor="title">제목</label>
        <input
          type="text"
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          placeholder="제목을 입력하세요"
        />
      </div>
      
      <div className="form-group">
        <label htmlFor="content">내용</label>
        <textarea
          id="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
          rows={5}
          placeholder="내용을 입력하세요"
        />
      </div>

      <div className="form-group">
        <label htmlFor="image">이미지</label>
        <input
          type="file"
          id="image"
          accept="image/*"
          onChange={handleImageChange}
        />
        {imagePreview && (
          <div className="image-preview">
            <img src={imagePreview} alt="미리보기" />
          </div>
        )}
      </div>

      <div className="form-actions">
        <button type="submit" disabled={loading} className="submit-button">
          {loading ? '처리 중...' : postId ? '수정하기' : '작성하기'}
        </button>
      </div>
    </form>
  );
}
