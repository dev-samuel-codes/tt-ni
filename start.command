#!/bin/bash
cd "$(dirname "$0")"

echo "========================================"
echo "  tt-ni 영양제 분석 서비스 시작"
echo "========================================"

# .env.local 없으면 생성
if [ ! -f .env.local ]; then
  if [ -f .env.example ]; then
    cp .env.example .env.local
    echo "[+] .env.local 파일을 생성했습니다. Firebase/TiDB 값을 입력해주세요."
  fi
fi

# Node.js 확인
if ! command -v node &> /dev/null; then
  echo "[!] Node.js가 설치되어 있지 않습니다. https://nodejs.org 에서 설치해주세요."
  exit 1
fi

echo "[+] Node.js: $(node --version)"

# npm install 확인
if [ ! -d node_modules ]; then
  echo "[+] 의존성 패키지 설치 중..."
  npm install
  if [ $? -ne 0 ]; then
    echo "[!] 패키지 설치에 실패했습니다."
    exit 1
  fi
else
  # node_modules는 있지만 package.json보다 오래됐으면 업데이트
  if [ package.json -nt node_modules ]; then
    echo "[+] package.json 변경 감지, 패키지 업데이트 중..."
    npm install
  fi
fi

echo "[+] 개발 서버와 API 서버 시작 (http://localhost:5173)"
echo ""

# 백그라운드에서 Vite/API 서버 실행 후 브라우저 열기
npm run dev &
DEV_PID=$!

# Vite가 준비될 때까지 대기
sleep 3

# 브라우저 열기
if command -v open &> /dev/null; then
  open "http://localhost:5173"
elif command -v xdg-open &> /dev/null; then
  xdg-open "http://localhost:5173"
fi

# 개발 서버 종료 시 정리
wait $DEV_PID
