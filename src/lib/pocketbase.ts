import PocketBase from 'pocketbase';

// 환경 변수로 로컬/프로덕션 전환 가능
// 기본값: 외부 PocketBase 서버
// 로컬 서버 사용 시: VITE_POCKETBASE_URL=http://localhost:8091
// 외부 서버 사용 시: VITE_POCKETBASE_URL=https://roaring-snake.lv255.com:19415
const pbUrl = import.meta.env.VITE_POCKETBASE_URL || 'https://roaring-snake.lv255.com:19415';

const pb = new PocketBase(pbUrl);

export default pb;
