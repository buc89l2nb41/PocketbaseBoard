import { useState } from 'react';
import pb from '../lib/pocketbase';

interface SignupProps {
  onSuccess: () => void;
  onSwitchToLogin: () => void;
}

export default function Signup({ onSuccess, onSwitchToLogin }: SignupProps) {
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [nicknameInput, setNicknameInput] = useState('');
  const [nicknameLoading, setNicknameLoading] = useState(false);
  const [googleNickname, setGoogleNickname] = useState('');

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const passwordConfirmValue = formData.get('passwordConfirm') as string;
    const nickname = formData.get('nickname') as string;

    if (!nickname || nickname.trim().length === 0) {
      alert('닉네임을 입력해주세요.');
      return;
    }

    if (nickname.length < 2 || nickname.length > 20) {
      alert('닉네임은 2자 이상 20자 이하여야 합니다.');
      return;
    }

    if (password !== passwordConfirmValue) {
      alert('비밀번호가 일치하지 않습니다.');
      return;
    }

    if (password.length < 8) {
      alert('비밀번호는 8자 이상이어야 합니다.');
      return;
    }

    setLoading(true);

    try {
      // 회원가입
      await pb.collection('users').create({
        email,
        password,
        passwordConfirm: passwordConfirmValue,
        name: nickname.trim(), // PocketBase의 name 필드에 닉네임 저장
      });

      // 자동 로그인
      await pb.collection('users').authWithPassword(email, password);
      
      onSuccess();
    } catch (error: any) {
      alert(`회원가입에 실패했습니다. ${error.message || ''}`);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    // 닉네임 검증
    const nickname = googleNickname.trim();
    
    if (!nickname || nickname.length === 0) {
      alert('닉네임을 입력해주세요.');
      return;
    }
    
    if (nickname.length < 2 || nickname.length > 20) {
      alert('닉네임은 2자 이상 20자 이하여야 합니다.');
      return;
    }
    
    setGoogleLoading(true);
    
    try {
      const frontendUrl = `${window.location.origin}${window.location.pathname}`;
      const pbBaseUrlForOAuth = pb.baseUrl.replace('127.0.0.1', 'localhost');
      const redirectURL = `${pbBaseUrlForOAuth}/api/oauth2-redirect?redirect=${encodeURIComponent(frontendUrl)}`;
      
      let popup: Window | null = null;
      
      await pb.collection('users').authWithOAuth2({
        provider: 'google',
        redirectURL: redirectURL,
        urlCallback: (url) => {
          const width = 500;
          const height = 600;
          const left = (window.screen.width - width) / 2;
          const top = (window.screen.height - height) / 2;
          
          popup = window.open(
            url,
            'google-oauth',
            `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
          );
          
          if (!popup) {
            alert('팝업이 차단되었습니다. 팝업 차단을 해제해주세요.');
            setGoogleLoading(false);
            return;
          }
          
          const checkPopup = setInterval(() => {
            if (popup?.closed) {
              clearInterval(checkPopup);
              
              setTimeout(async () => {
                if (pb.authStore.isValid) {
                  const user = pb.authStore.model;
                  
                  if (user && nickname) {
                    try {
                      await pb.collection('users').update(user.id, {
                        name: nickname,
                      });
                      await pb.collection('users').authRefresh();
                      onSuccess();
                    } catch (error: any) {
                      alert(`닉네임 설정에 실패했습니다. ${error.message || ''}`);
                    }
                  } else {
                    onSuccess();
                  }
                } else {
                  alert('구글 회원가입이 완료되지 않았습니다. 다시 시도해주세요.');
                }
                setGoogleLoading(false);
              }, 500);
            }
          }, 500);
          
          const handleMessage = async (event: MessageEvent) => {
            if (event.origin !== window.location.origin) return;
            
            if (event.data?.type === 'oauth-success') {
              clearInterval(checkPopup);
              window.removeEventListener('message', handleMessage);
              
              if (popup) {
                popup.close();
              }
              
              const user = pb.authStore.model;
              
              if (user && nickname) {
                try {
                  await pb.collection('users').update(user.id, {
                    name: nickname,
                  });
                  await pb.collection('users').authRefresh();
                  onSuccess();
                } catch (error: any) {
                  alert(`닉네임 설정에 실패했습니다. ${error.message || ''}`);
                }
              } else {
                onSuccess();
              }
              setGoogleLoading(false);
            } else if (event.data?.type === 'oauth-error') {
              clearInterval(checkPopup);
              window.removeEventListener('message', handleMessage);
              
              if (popup) {
                popup.close();
              }
              
              alert(`구글 회원가입에 실패했습니다: ${event.data.error || '알 수 없는 오류'}`);
              setGoogleLoading(false);
            }
          };
          
          window.addEventListener('message', handleMessage);
        },
      });
      
    } catch (error: any) {
      let errorMessage = '구글 회원가입에 실패했습니다.\n\n';
      
      if (error.status === 400 || error.status === 404) {
        errorMessage += '가능한 원인:\n';
        errorMessage += '1. PocketBase 관리자 페이지에서 Google OAuth가 활성화되어 있는지 확인\n';
        errorMessage += '2. Client ID와 Client Secret이 올바르게 설정되었는지 확인\n';
        errorMessage += '3. PocketBase 서버가 정상적으로 실행 중인지 확인\n';
      } else if (error.status === 500) {
        errorMessage += 'PocketBase 서버 오류가 발생했습니다.\n';
        errorMessage += '서버 로그를 확인하세요.\n';
      } else {
        errorMessage += `에러 코드: ${error.status || '알 수 없음'}\n`;
        errorMessage += `에러 메시지: ${error.message || '알 수 없음'}\n`;
      }
      
      alert(errorMessage);
      setGoogleLoading(false);
    }
  };

  const handleNicknameSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    const nickname = nicknameInput.trim();
    
    if (!nickname || nickname.length === 0) {
      alert('닉네임을 입력해주세요.');
      return;
    }
    
    if (nickname.length < 2 || nickname.length > 20) {
      alert('닉네임은 2자 이상 20자 이하여야 합니다.');
      return;
    }
    
    setNicknameLoading(true);
    
    try {
      const currentUser = pb.authStore.model;
      if (!currentUser) {
        throw new Error('사용자 정보를 찾을 수 없습니다.');
      }
      
      // 사용자 정보 업데이트
      await pb.collection('users').update(currentUser.id, {
        name: nickname,
      });
      
      // authStore 갱신
      await pb.collection('users').authRefresh();
      
      setShowNicknameModal(false);
      setNicknameInput('');
      onSuccess();
    } catch (error: any) {
      alert(`닉네임 설정에 실패했습니다. ${error.message || ''}`);
    } finally {
      setNicknameLoading(false);
    }
  };

  return (
    <div className="login-container">
      <h2>회원가입</h2>
      <form onSubmit={handleSignup}>
        <div className="form-group">
          <label htmlFor="email">이메일</label>
          <input
            type="email"
            id="email"
            name="email"
            required
            placeholder="이메일을 입력하세요"
          />
        </div>
        <div className="form-group">
          <label htmlFor="nickname">닉네임</label>
          <input
            type="text"
            id="nickname"
            name="nickname"
            required
            minLength={2}
            maxLength={20}
            placeholder="닉네임을 입력하세요 (2-20자)"
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">비밀번호</label>
          <input
            type="password"
            id="password"
            name="password"
            required
            minLength={8}
            placeholder="비밀번호를 입력하세요 (8자 이상)"
          />
        </div>
        <div className="form-group">
          <label htmlFor="passwordConfirm">비밀번호 확인</label>
          <input
            type="password"
            id="passwordConfirm"
            name="passwordConfirm"
            required
            minLength={8}
            placeholder="비밀번호를 다시 입력하세요"
          />
        </div>
        <button type="submit" disabled={loading}>
          {loading ? '가입 중...' : '회원가입'}
        </button>
      </form>
      
      <div className="oauth-divider">
        <span>또는</span>
      </div>
      
      <div className="form-group" style={{ marginBottom: '1rem' }}>
        <label htmlFor="google-nickname">닉네임 (구글 회원가입용)</label>
        <input
          type="text"
          id="google-nickname"
          value={googleNickname}
          onChange={(e) => setGoogleNickname(e.target.value)}
          minLength={2}
          maxLength={20}
          placeholder="닉네임을 입력하세요 (2-20자)"
        />
      </div>
      
      <button 
        type="button" 
        className="google-login-btn" 
        onClick={handleGoogleSignup}
        disabled={googleLoading || !googleNickname.trim()}
      >
        {googleLoading ? (
          '구글 회원가입 중...'
        ) : (
          <>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.965-2.184l-2.908-2.258c-.806.54-1.837.86-3.057.86-2.35 0-4.34-1.587-5.052-3.72H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
              <path d="M3.948 10.698c-.18-.54-.282-1.117-.282-1.698s.102-1.158.282-1.698V4.97H.957C.348 6.175 0 7.55 0 9s.348 2.825.957 4.03l2.991-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.97L3.948 7.302C4.66 5.167 6.65 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            구글로 회원가입
          </>
        )}
      </button>
      
      <div className="auth-switch">
        <p>이미 계정이 있으신가요? <button type="button" onClick={onSwitchToLogin}>로그인</button></p>
      </div>
      
      {/* 닉네임 입력 모달 */}
      {showNicknameModal && (
        <div className="auth-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="login-container" style={{ maxWidth: '400px', width: '90%' }}>
            <h2>닉네임 설정</h2>
            <p style={{ marginBottom: '20px', color: '#666' }}>
              구글 계정으로 회원가입이 완료되었습니다.<br />
              사용할 닉네임을 입력해주세요.
            </p>
            <form onSubmit={handleNicknameSubmit}>
              <div className="form-group">
                <label htmlFor="oauth-nickname">닉네임</label>
                <input
                  type="text"
                  id="oauth-nickname"
                  value={nicknameInput}
                  onChange={(e) => setNicknameInput(e.target.value)}
                  required
                  minLength={2}
                  maxLength={20}
                  placeholder="닉네임을 입력하세요 (2-20자)"
                  autoFocus
                />
              </div>
              <button type="submit" disabled={nicknameLoading}>
                {nicknameLoading ? '설정 중...' : '닉네임 설정'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
