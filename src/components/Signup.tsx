import { useState } from 'react';
import pb from '../lib/pocketbase';

interface SignupProps {
  onSuccess: () => void;
  onSwitchToLogin: () => void;
}

export default function Signup({ onSuccess, onSwitchToLogin }: SignupProps) {
  const [loading, setLoading] = useState(false);

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
      console.error('회원가입 실패:', error);
      alert(`회원가입에 실패했습니다. ${error.message || ''}`);
    } finally {
      setLoading(false);
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
      <div className="auth-switch">
        <p>이미 계정이 있으신가요? <button type="button" onClick={onSwitchToLogin}>로그인</button></p>
      </div>
    </div>
  );
}
