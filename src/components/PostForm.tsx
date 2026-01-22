import { useState, useEffect, useRef } from 'react';
import pb from '../lib/pocketbase';

interface PostFormProps {
  onSuccess: () => void;
  postId?: string;
  initialTitle?: string;
  initialContent?: string;
  initialImages?: string[]; // 기존 이미지 URL 배열
}

interface ImagePreview {
  file?: File; // 새로 추가한 이미지만 File 객체
  preview: string;
  id: string;
  isExisting?: boolean; // 기존 이미지인지 여부
  url?: string; // 기존 이미지의 URL
  imageNumber?: number; // 이미지 번호 (1, 2, 3...)
}

export default function PostForm({ onSuccess, postId, initialTitle = '', initialContent = '', initialImages = [] }: PostFormProps) {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [images, setImages] = useState<ImagePreview[]>([]);
  const [loading, setLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const MAX_IMAGES = 5;
  const imageNumberRef = useRef(0); // 이미지 번호 추적

  // 기존 이미지들을 초기 이미지 목록에 추가
  useEffect(() => {
    if (initialImages && initialImages.length > 0) {
      const existingImages: ImagePreview[] = initialImages.map((url, index) => {
        const imageNumber = index + 1;
        imageNumberRef.current = Math.max(imageNumberRef.current, imageNumber);
        return {
          id: `existing_${index}_${Date.now()}`,
          preview: url,
          url: url,
          isExisting: true,
          imageNumber: imageNumber, // 기존 이미지 번호
        };
      });
      // 기존 이미지 설정 (새로 추가한 이미지는 유지)
      setImages(prev => {
        const newImages = prev.filter(img => !img.isExisting);
        return [...existingImages, ...newImages];
      });
    } else if (postId) {
      // 수정 모드인데 initialImages가 없으면 기존 이미지만 제거
      setImages(prev => prev.filter(img => !img.isExisting));
    }
  }, [initialImages, postId]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newFiles = Array.from(files);
    const remainingSlots = MAX_IMAGES - images.length;

    if (newFiles.length > remainingSlots) {
      alert(`이미지는 최대 ${MAX_IMAGES}개까지 업로드할 수 있습니다. (현재 ${images.length}개 업로드됨)`);
      newFiles.splice(remainingSlots);
    }

    newFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const preview = reader.result as string;
        const imageId = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        imageNumberRef.current += 1;
        const imageNumber = imageNumberRef.current;
        
        setImages(prev => {
          const updated = [...prev, { file, preview, id: imageId, isExisting: false, imageNumber }];
          return updated;
        });

        // 자동 삽입 제거 - 드래그 앤 드롭으로 추가하도록 안내
      };
      reader.readAsDataURL(file);
    });
    
    // 파일 입력 초기화
    e.target.value = '';
  };

  const removeImage = (imageId: string) => {
    setImages(prev => prev.filter(img => img.id !== imageId));
  };

  // 드래그 시작
  const handleDragStart = (e: React.DragEvent, image: ImagePreview) => {
    if (image.isExisting && image.imageNumber) {
      // 이미지 번호를 전달
      e.dataTransfer.setData('text/plain', image.imageNumber.toString());
      e.dataTransfer.effectAllowed = 'copy';
    }
  };

  // 드롭 처리
  const handleDrop = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    const imageNumber = e.dataTransfer.getData('text/plain');
    
    if (imageNumber) {
      // content 끝에 이미지 추가 (번호 사용)
      const imageMarkdown = `\n![이미지](${imageNumber})\n`;
      setContent(prev => {
        const trimmed = prev.trimEnd();
        const separator = trimmed.length > 0 && !trimmed.endsWith('\n') ? '\n' : '';
        return trimmed + separator + imageMarkdown;
      });
    }
  };

  // 드래그 오버 처리 (드롭 가능 표시)
  const handleDragOver = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!pb.authStore.isValid) {
      alert('로그인이 필요합니다.');
      return;
    }

    if (images.length > MAX_IMAGES) {
      alert(`이미지는 최대 ${MAX_IMAGES}개까지 업로드할 수 있습니다.`);
      return;
    }

    setLoading(true);

    try {
      let finalContent = content;
      const formData = new FormData();
      formData.append('title', title);
      formData.append('content', finalContent);
      formData.append('author', pb.authStore.model?.id || '');
      
      if (postId) {
        // 수정 시: 기존 이미지도 함께 전송해야 유지됨
        const existingImages = images.filter(img => img.isExisting && img.url);
        const newImages = images.filter(img => img.file && !img.isExisting);
        
        // 기존 이미지 파일들을 가져와서 함께 전송
        for (const existingImg of existingImages) {
          try {
            const response = await fetch(existingImg.url!);
            const blob = await response.blob();
            const filename = existingImg.url!.split('/').pop() || 'image.png';
            const file = new File([blob], filename, { type: blob.type });
            formData.append('image', file);
          } catch (error) {
            console.error('기존 이미지 로드 실패:', error);
          }
        }
        
        // 새로 추가한 이미지도 전송
        newImages.forEach((imagePreview) => {
          formData.append('image', imagePreview.file!);
        });
        
        await pb.collection('posts').update(postId, formData);
      } else {
        // 작성 시: 새로 추가한 이미지만 업로드
        const newImages = images.filter(img => img.file && !img.isExisting);
        newImages.forEach((imagePreview) => {
          formData.append('image', imagePreview.file!);
        });
        
        await pb.collection('posts').create(formData);
      }

      // 번호는 그대로 유지 (URL로 교체하지 않음)
      // content는 이미 번호 형식으로 저장되어 있으므로 그대로 사용
      
      // 폼 초기화
      setTitle('');
      setContent('');
      setImages([]);
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
        <div style={{ position: 'relative' }}>
          <textarea
            ref={textareaRef}
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            required
            rows={10}
            placeholder="내용을 입력하세요. 이미지를 추가하려면 아래 이미지 미리보기를 드래그하여 여기에 드롭하세요."
            style={{ width: '100%', paddingRight: '10px' }}
          />
        </div>
        <p style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.5rem' }}>
          💡 이미지를 게시글에 추가하려면 아래 이미지 미리보기를 드래그하여 텍스트 영역에 드롭하세요.
        </p>
      </div>

      <div className="form-group">
        <label htmlFor="image">
          이미지 ({images.length}/{MAX_IMAGES})
        </label>
        <input
          type="file"
          id="image"
          accept="image/*"
          multiple
          onChange={handleImageChange}
          disabled={images.length >= MAX_IMAGES}
        />
        {images.length >= MAX_IMAGES && (
          <p style={{ color: '#ff6b6b', fontSize: '0.875rem', marginTop: '0.5rem' }}>
            최대 {MAX_IMAGES}개까지 업로드할 수 있습니다.
          </p>
        )}
        {images.length > 0 && (
          <div style={{ marginTop: '1rem' }}>
            <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>
              이미지 미리보기 - 드래그하여 텍스트 영역에 드롭하세요
            </p>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
              gap: '1rem'
            }}>
              {images.map((img) => (
                <div key={img.id} style={{ position: 'relative' }}>
                  <img
                    src={img.preview}
                    alt={img.isExisting ? "기존 이미지" : "미리보기"}
                    draggable={true}
                    onDragStart={(e) => {
                      if (img.isExisting && img.imageNumber) {
                        handleDragStart(e, img);
                      } else if (img.imageNumber) {
                        // 새 이미지도 드래그 가능하도록
                        e.dataTransfer.setData('text/plain', img.imageNumber.toString());
                        e.dataTransfer.effectAllowed = 'copy';
                      }
                    }}
                    style={{
                      width: '100%',
                      height: '120px',
                      objectFit: 'cover',
                      borderRadius: '8px',
                      border: img.isExisting ? '2px solid #4CAF50' : '1px solid #ddd',
                      cursor: 'grab'
                    }}
                    title="드래그하여 텍스트 영역에 추가"
                  />
                  {img.isExisting && (
                    <div style={{
                      position: 'absolute',
                      top: '4px',
                      left: '4px',
                      backgroundColor: '#4CAF50',
                      color: 'white',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontWeight: 'bold'
                    }}>
                      기존
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeImage(img.id);
                    }}
                    style={{
                      position: 'absolute',
                      top: '4px',
                      right: '4px',
                      backgroundColor: 'rgba(0, 0, 0, 0.7)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '50%',
                      width: '24px',
                      height: '24px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '16px',
                      lineHeight: '1'
                    }}
                    title="이미지 제거"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
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
