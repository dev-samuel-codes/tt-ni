#!/bin/bash
cd "$(dirname "$0")"

echo "========================================"
echo "  tt-ni 영양제 분석 서비스 시작"
echo "========================================"

# .env.local 없으면 생성
if [ ! -f .env.local ]; then
  if [ -f .env.example ]; then
    cp .env.example .env.local
    echo "→ .env.local 파일을 생성했습니다. Supabase 값을 입력해주세요."
  fi
fi

# npm install 확인
if [ ! -d node_modules ]; then
  echo "→ 의존성 패키지 설치 중..."
  npm install
fi

echo "→ 개발 서버 시작 (http://localhost:5173)"
npm run dev
