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

    // 인증 상태 변경 리스너
    pb.authStore.onChange((token, model) => {
      setIsAuthenticated(!!token)
      setUser(model)
      if (token) {
        setShowAuth(false)
      }
    })
  }, [])

  const handleLogout = () => {
    pb.authStore.clear()
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>PocketBase Board</h1>
        {isAuthenticated && user ? (
          <div className="user-info">
            <span>안녕하세요, {user.email}님</span>
            <button onClick={handleLogout}>로그아웃</button>
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
