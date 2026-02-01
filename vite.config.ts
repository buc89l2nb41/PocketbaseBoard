import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // 모든 네트워크 인터페이스에서 접근 가능하도록 설정
    open: true
  }
})
