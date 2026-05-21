import { config } from 'dotenv'

/**
 * 환경변수 로드.
 * 1. .env.local을 먼저 로드 (로컬 개발용)
 * 2. 그 외 .env 파일을 로드
 * quiet: true → 파일이 없어도 에러 발생 안 함
 */
config({ path: '.env.local', quiet: true })
config({ quiet: true })
