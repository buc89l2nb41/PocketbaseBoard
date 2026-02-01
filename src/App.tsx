import { useState, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import pb from './lib/pocketbase'
import './App.css'
import Board from './components/Board'
import PostDetail from './components/PostDetail'
import Login from './components/Login'
import Signup from './components/Signup'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [showAuth, setShowAuth] = useState(false)
  const [showSignup, setShowSignup] = useState(false)

  useEffect(() => {
    // PocketBase 인증 상태 확인
    setIsAuthenticated(pb.authStore.isValid)
    setUser(pb.authStore.model)

    // OAuth 콜백 처리
    const handleOAuthCallback = async () => {
      // OAuth2 리다이렉트 실패 확인
      const isFailurePage = window.location.hash.includes('oauth2-redirect-failure') || 
                           window.location.pathname.includes('oauth2-redirect-failure') ||
                           window.location.href.includes('oauth2-redirect-failure') ||
                           document.body.textContent?.includes('Auth failed') ||
                           document.title.includes('Auth failed');
      
      if (isFailurePage) {
        const pbUrl = pb.baseUrl;
        const redirectUri = `${pbUrl}/api/oauth2-redirect`;
        
        const errorMessage = `구글 로그인에 실패했습니다.\n\n` +
          `가능한 원인:\n` +
          `1. PKCE 세션 쿠키 문제 (가장 흔한 원인)\n` +
          `   - PocketBase 서버에서 쿠키를 SameSite=None, Secure로 설정해야 합니다\n` +
          `   - 로컬 개발 환경에서는 Secure 플래그 없이 SameSite=None만 사용 가능\n\n` +
          `2. Google OAuth 설정 확인\n` +
          `   - PocketBase 관리자 페이지(${pbUrl}/_/)에서 Google OAuth 활성화 확인\n` +
          `   - Client ID와 Secret이 정확한지 확인\n` +
          `   - Google Cloud Console의 리디렉션 URI:\n` +
          `     ${redirectUri}\n\n` +
          `3. PocketBase 서버 로그 확인\n` +
          `   - 서버 콘솔에서 정확한 에러 메시지 확인\n\n`;
        
        alert(errorMessage);
        
        // URL 정리 및 인증 오버레이 닫기
        window.history.replaceState({}, document.title, window.location.pathname);
        setShowAuth(false);
        return;
      }

      // OAuth 콜백 파라미터 확인
      const urlParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const code = urlParams.get('code') || hashParams.get('code');
      const state = urlParams.get('state') || hashParams.get('state');
      const error = urlParams.get('error') || hashParams.get('error_description');
      
      if (code && state) {
        try {
          // PocketBase SDK가 자동으로 콜백을 처리하므로 잠시 대기
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // 인증이 성공했는지 확인
          if (pb.authStore.isValid) {
            setIsAuthenticated(true);
            setUser(pb.authStore.model);
            setShowAuth(false);
            // URL 정리
            window.history.replaceState({}, document.title, window.location.pathname);
          } else {
            // PocketBase가 자동으로 처리할 때까지 조금 더 대기
            let attempts = 0;
            const maxAttempts = 5;
            const checkAuth = setInterval(() => {
              attempts++;
              
              if (pb.authStore.isValid) {
                setIsAuthenticated(true);
                setUser(pb.authStore.model);
                setShowAuth(false);
                window.history.replaceState({}, document.title, window.location.pathname);
                clearInterval(checkAuth);
              } else if (attempts >= maxAttempts) {
                alert('OAuth 인증이 완료되지 않았습니다.\n\nPocketBase 서버 로그를 확인하세요.');
                clearInterval(checkAuth);
              }
            }, 1000);
          }
        } catch (error) {
          alert('OAuth 콜백 처리 중 오류가 발생했습니다.');
        }
      } else if (error) {
        let errorMsg = `구글 로그인 중 오류가 발생했습니다.\n\n` +
          `에러: ${error}\n\n` +
          `가능한 해결 방법:\n` +
          `1. PocketBase 관리자 페이지에서 Google OAuth 설정 확인\n` +
          `2. Google Cloud Console의 리디렉션 URI 확인\n` +
          `3. 브라우저 쿠키 설정 확인 (SameSite=None 필요)\n`;
        
        alert(errorMsg);
        setShowAuth(false);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }

    handleOAuthCallback()

    // 인증 상태 변경 리스너
    pb.authStore.onChange((token, model) => {
      setIsAuthenticated(!!token)
      setUser(model)
      if (token) {
        setShowAuth(false)
        // 인증 성공 시 URL 정리
        if (window.location.search.includes('code=') || window.location.hash.includes('oauth2')) {
          window.history.replaceState({}, document.title, window.location.pathname)
        }
      }
    })
  }, [])

  const handleLogout = () => {
    pb.authStore.clear()
  }

  const handleDeleteAccount = async () => {
    if (!user || !isAuthenticated) {
      return
    }

    // 확인 다이얼로그
    const confirmed = window.confirm(
      '정말로 회원 탈퇴를 하시겠습니까?\n\n' +
      '탈퇴 시 모든 데이터가 삭제되며 복구할 수 없습니다.\n' +
      '이 작업은 되돌릴 수 없습니다.'
    )

    if (!confirmed) {
      return
    }

    try {
      // 사용자 삭제
      await pb.collection('users').delete(user.id)
      
      // 로그아웃 처리
      pb.authStore.clear()
      
      alert('회원 탈퇴가 완료되었습니다.')
    } catch (error: any) {
      alert(`회원 탈퇴에 실패했습니다. ${error.message || ''}`)
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>PocketBase Board</h1>
        {isAuthenticated && user ? (
          <div className="user-info">
            <span>안녕하세요, {user.email}님</span>
            <button onClick={handleLogout}>로그아웃</button>
            <button className="delete-account-btn" onClick={handleDeleteAccount}>회원 탈퇴</button>
          </div>
        ) : (
          <div className="user-info">
            <button onClick={() => { setShowAuth(true); setShowSignup(false); }}>
              로그인
            </button>
            <button onClick={() => { setShowAuth(true); setShowSignup(true); }}>
              회원가입
            </button>
          </div>
        )}
      </header>

      <main className="app-main">
        {showAuth && !isAuthenticated && (
          <div className="auth-overlay">
            {showSignup ? (
              <Signup 
                onSuccess={() => {
                  setIsAuthenticated(true);
                  setShowAuth(false);
                }} 
                onSwitchToLogin={() => setShowSignup(false)}
              />
            ) : (
              <Login 
                onSuccess={() => {
                  setIsAuthenticated(true);
                  setShowAuth(false);
                }} 
                onSwitchToSignup={() => setShowSignup(true)}
              />
            )}
            <button 
              className="close-auth" 
              onClick={() => setShowAuth(false)}
            >
              닫기
            </button>
          </div>
        )}
        <Routes>
          <Route path="/" element={<Board />} />
          <Route path="/post/:id" element={<PostDetail />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
