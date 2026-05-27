# AI 여행 예약 플랫폼 — Project TEAM AWS

야놀자 스타일의 여행 및 숙박 예약 플랫폼.  
모놀리식 백엔드를 **4개 마이크로서비스**로 분리한 구조입니다.

---

## 아키텍처

### EC2 배포 구조 (현재)

```
[Browser]
    │
    ▼
[Frontend EC2 — nginx :80]  ── 정적 파일 (frontend/public)
    │
    ├── /api/auth/*          → auth-service EC2    :3001  (auth_db)
    ├── /api/reviews/*       → review-service EC2  :3004  (review_db)
    ├── /api/hotels/*/reviews→ review-service EC2  :3004
    ├── /api/bookings/*      → booking-service EC2 :3003  (booking_db)
    └── /api/*               → hotel-service EC2   :3002  (hotel_db)

[ElasticMQ :9324]  ── SQS 로컬 대체 (hotel EC2에서 실행)
[MySQL EC2 :3306]  ── 4개 DB (auth_db / hotel_db / booking_db / review_db)
```

### AWS 최종 구조 (목표)

```
[Browser]
    │
    ├── Amplify ── 프론트엔드 정적 파일 (CDN)
    │
    └── WAF
          ↓
     API Gateway (HTTP API)
     ├── Cognito JWT Authorizer
     ├── /auth/*       → auth-service
     ├── /hotels/*     → hotel-service
     ├── /bookings/*   → booking-service
     └── /reviews/*    → review-service
          ↓ (VPC Link)
         ALB (internal)
          ↓
     ECS Fargate
     ├── auth-service    :3001  ── Cognito 토큰 검증
     ├── hotel-service   :3002  ── Bedrock / SQS Consumer ←─ SQS rating-queue
     ├── booking-service :3003  ── SQS Publisher ──────────→ SQS booking-queue
     └── review-service  :3004  ── SQS Publisher ──────────→ SQS rating-queue
          ↓
     RDS MySQL / DynamoDB / S3 / Bedrock

     SQS booking-queue → Lambda ──→ SES (예약 확정 이메일)
     S3 업로드 이벤트  → Lambda ──→ S3 (썸네일 리사이즈)
     Cognito 회원가입  → Lambda ──→ RDS auth_db (유저 프로필 초기화)
```

### 서비스 간 통신

| 호출 방향 | 방법 | 용도 |
|-----------|------|------|
| booking-service → hotel-service | HTTP `x-internal-secret` | 예약 시 객실 정보 조회 |
| review-service → booking-service | HTTP `x-internal-secret` | 리뷰 작성 시 예약 확인 |
| review-service → SQS rating-queue | SQS Publish | 리뷰 생성/삭제 시 평점 갱신 요청 |
| hotel-service ← SQS rating-queue | SQS Consume | 메시지 수신 후 평점 집계 후 DB 업데이트 |
| booking-service → SQS booking-queue | SQS Publish | 예약 확정 시 이메일 알림 요청 |
| Lambda ← SQS booking-queue | SQS Trigger | 메시지 수신 후 AWS SES로 예약 확정 이메일 발송 |

> 로컬/EC2 환경에서는 SQS 대신 **ElasticMQ** 컨테이너로 대체 (`SQS_ENDPOINT=http://elasticmq:9324`)

---

## EC2 각 서비스별 분리 테스트 (프론트엔드 1대, 백엔드 각 서비스별로 1대씩)

### 1-1. EC2 인스턴스 생성 (프론트엔드)

| 항목 | 권장 값 |
|------|--------|
| AMI | Amazon Linux 2023 |
| 인스턴스 타입 | `t3.micro` |
| 스토리지 | 기본 8GB |
| 보안 그룹 인바운드 | SSH 22 (내 IP), HTTP 80 (0.0.0.0/0) |
| 키 페어 | 기존 또는 새로 생성 |

### 1-2. EC2 접속 후 환경 세팅

```bash
# Amazon Linux 2023 — nginx, git 설치
sudo dnf install -y nginx git
sudo systemctl enable --now nginx
```

### 1-3. 프로젝트 클론

```bash
git clone --filter=blob:none --sparse https://github.com/yubin05/Project_TEAM_AWS.git
cd Project_TEAM_AWS
git sparse-checkout set frontend nginx

# 백엔드 서비스 EC2 Private IP로 교체
sudo vi nginx/nginx.frontend.conf
```

### 1-4. 서비스 가동

```bash
sudo cp nginx/nginx.frontend.conf /etc/nginx/nginx.conf

# 설정 문법 확인
sudo nginx -t

# frontend/public 하위 폴더만 복사하여 사용
sudo cp -r frontend/public/* /usr/share/nginx/html/
sudo systemctl restart nginx
```

---

## MySQL EC2 분리 배포

> 각 서비스 EC2에 MySQL 컨테이너를 올리는 대신, **MySQL 전용 EC2 1대**를 두고 모든 서비스가 연결하는 구조입니다.
> 서비스 EC2의 docker-compose에서 mysql 컨테이너를 제거하고 `DB_HOST`를 MySQL EC2 Private IP로 설정합니다.

### MySQL-1. EC2 인스턴스 생성

| 항목 | 권장 값 |
|------|--------|
| AMI | Amazon Linux 2023 |
| 인스턴스 타입 | `t3.small` (4개 DB 동시 운용) |
| 스토리지 | 20GB 이상 |
| 보안 그룹 인바운드 | SSH 22 (내 IP), TCP 3306 (auth/hotel/booking/review EC2 SG) |
| 키 페어 | 기존 또는 새로 생성 |

### MySQL-2. 레포지토리 클론 및 MySQL 8.0 설치

```bash
sudo dnf install -y git

git clone --filter=blob:none --sparse https://github.com/yubin05/Project_TEAM_AWS.git
cd Project_TEAM_AWS
git sparse-checkout set database

# MySQL 8.0 설치 및 설정 (GPG 키 등록 → 설치 → my.cnf 설정 → root 비밀번호 변경)
sudo bash database/scripts/mysql_install.sh
```

설치 후 적용 내용:
- MySQL 8.0 Community Server 설치 (공식 RPM 저장소)
- `/etc/my.cnf`: utf8mb4, `default_authentication_plugin=mysql_native_password`
- root 비밀번호: `P@ssw0rd`, 외부 접속 허용 (`root@'%'`)
- `user1@'%'` 계정 생성 (ALL PRIVILEGES)

### MySQL-3. DB 초기화 및 시드 데이터 삽입

```bash
# 4개 DB 및 테이블 생성 + 시드 데이터 삽입
bash database/scripts/run-seed.sh
```

> **보안 그룹 설정**: 각 서비스 EC2의 보안 그룹을 MySQL EC2 인바운드 규칙에 3306 포트로 추가해야 합니다.

---

### 2-1. EC2 인스턴스 생성 (auth-service)

| 항목 | 권장 값 |
|------|--------|
| AMI | Amazon Linux 2023 |
| 인스턴스 타입 | `t3.micro` |
| 스토리지 | 기본 8GB |
| 보안 그룹 인바운드 | SSH 22 (내 IP), TCP 3001 (Frontend EC2 SG) |
| 키 페어 | 기존 또는 새로 생성 |

### 2-2. EC2 접속 후 환경 세팅

```bash
# Amazon Linux 2023 — Docker 설치
sudo dnf install -y docker git
sudo systemctl enable --now docker

# Docker Compose 플러그인 설치
sudo mkdir -p /usr/local/lib/docker/cli-plugins
sudo curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# Docker BuildX 업데이트 (0.17.0 미만이면 compose build 오류 발생)
sudo curl -SL https://github.com/docker/buildx/releases/download/v0.19.3/buildx-v0.19.3.linux-amd64 \
  -o /usr/local/lib/docker/cli-plugins/docker-buildx
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-buildx
```

### 2-3. 프로젝트 클론 및 실행

```bash
git clone --filter=blob:none --sparse https://github.com/yubin05/Project_TEAM_AWS.git
cd Project_TEAM_AWS
git sparse-checkout set backend/auth-service
```

MySQL 설정 파일 수정
```bash
cat > backend/auth-service/.env.mysql-ec2 << 'EOF'
APP_MODE=local
PORT=3001
DB_HOST=<MySQL EC2 Private IP>
DB_PORT=3306
DB_USER=root
DB_PASSWORD=P@ssw0rd
DB_NAME=auth_db
JWT_SECRET=<랜덤 문자열, 모든 서비스 동일>
INTERNAL_SECRET=<랜덤 문자열, 모든 서비스 동일>
CORS_ORIGIN=http://<Frontend EC2 Public IP>
EOF
```

MySQL 컨테이너 없이 서비스만 실행
```bash
cat > docker-compose.auth.yml << 'EOF'
services:
  auth-service:
    build:
      context: ./backend/auth-service
      dockerfile: Dockerfile
    env_file: ./backend/auth-service/.env.mysql-ec2
    ports:
      - '3001:3001'
    restart: on-failure
EOF

sudo docker compose -f docker-compose.auth.yml up -d --build
```

### 헬스체크

```bash
curl http://localhost:3001/health
```

---

### 3-1. EC2 인스턴스 생성 (hotel-service)

| 항목 | 권장 값 |
|------|--------|
| AMI | Amazon Linux 2023 |
| 인스턴스 타입 | `t3.small` 이상 (Bedrock, SQS Consumer 상시 실행) |
| 스토리지 | 기본 8GB |
| 보안 그룹 인바운드 | SSH 22 (내 IP), TCP 3002 (Frontend EC2 SG + booking EC2 SG) |
| 키 페어 | 기존 또는 새로 생성 |

### 3-2. EC2 접속 후 환경 세팅

```bash
# Amazon Linux 2023 — Docker 설치
sudo dnf install -y docker git
sudo systemctl enable --now docker

# Docker Compose 플러그인 설치
sudo mkdir -p /usr/local/lib/docker/cli-plugins
sudo curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# Docker BuildX 업데이트 (0.17.0 미만이면 compose build 오류 발생)
sudo curl -SL https://github.com/docker/buildx/releases/download/v0.19.3/buildx-v0.19.3.linux-amd64 \
  -o /usr/local/lib/docker/cli-plugins/docker-buildx
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-buildx
```

### 3-3. 스왑 메모리 추가 (t3.medium 이하 권장)

```bash
sudo dd if=/dev/zero of=/swapfile bs=128M count=16
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile swap swap defaults 0 0' | sudo tee -a /etc/fstab
```

### 3-4. 프로젝트 클론 및 실행

```bash
git clone --filter=blob:none --sparse https://github.com/yubin05/Project_TEAM_AWS.git
cd Project_TEAM_AWS
git sparse-checkout set backend/hotel-service elasticmq
```

MySQL 설정 파일 수정
```bash
cat > backend/hotel-service/.env.mysql-ec2 << 'EOF'
APP_MODE=local
PORT=3002
DB_HOST=<MySQL EC2 Private IP>
DB_PORT=3306
DB_USER=root
DB_PASSWORD=P@ssw0rd
DB_NAME=hotel_db
JWT_SECRET=<auth-service와 동일한 값>
INTERNAL_SECRET=<모든 서비스 동일한 값>
CORS_ORIGIN=http://<Frontend EC2 Public IP>
AWS_REGION=ap-northeast-2
DYNAMODB_ENDPOINT=http://localhost:8000
SQS_ENDPOINT=http://elasticmq:9324
SQS_QUEUE_URL=http://elasticmq:9324/000000000000/rating-queue
EOF
```

MySQL 컨테이너 없이 서비스만 실행 (ElasticMQ 포함)
```bash
cat > docker-compose.hotel.yml << 'EOF'
services:
  elasticmq:
    image: softwaremill/elasticmq-native:latest
    volumes:
      - ./elasticmq/elasticmq.conf:/opt/elasticmq.conf:ro

  hotel-service:
    build:
      context: ./backend/hotel-service
      dockerfile: Dockerfile
    env_file: ./backend/hotel-service/.env.mysql-ec2
    ports:
      - '3002:3002'
    depends_on:
      - elasticmq
    restart: on-failure
EOF

sudo docker compose -f docker-compose.hotel.yml up -d --build
```

### 헬스체크

```bash
curl http://localhost:3002/health
```

---

### 4-1. EC2 인스턴스 생성 (booking-service)

| 항목 | 권장 값 |
|------|--------|
| AMI | Amazon Linux 2023 |
| 인스턴스 타입 | `t3.micro` |
| 스토리지 | 기본 8GB |
| 보안 그룹 인바운드 | SSH 22 (내 IP), TCP 3003 (Frontend EC2 SG + review EC2 SG) |
| 키 페어 | 기존 또는 새로 생성 |

### 4-2. EC2 접속 후 환경 세팅

```bash
# Amazon Linux 2023 — Docker 설치
sudo dnf install -y docker git
sudo systemctl enable --now docker

# Docker Compose 플러그인 설치
sudo mkdir -p /usr/local/lib/docker/cli-plugins
sudo curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# Docker BuildX 업데이트 (0.17.0 미만이면 compose build 오류 발생)
sudo curl -SL https://github.com/docker/buildx/releases/download/v0.19.3/buildx-v0.19.3.linux-amd64 \
  -o /usr/local/lib/docker/cli-plugins/docker-buildx
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-buildx
```

### 4-3. 프로젝트 클론 및 실행

```bash
git clone --filter=blob:none --sparse https://github.com/yubin05/Project_TEAM_AWS.git
cd Project_TEAM_AWS
git sparse-checkout set backend/booking-service
```

MySQL 설정 파일 수정
```bash
cat > backend/booking-service/.env.mysql-ec2 << 'EOF'
APP_MODE=local
PORT=3003
DB_HOST=<MySQL EC2 Private IP>
DB_PORT=3306
DB_USER=root
DB_PASSWORD=P@ssw0rd
DB_NAME=booking_db
JWT_SECRET=<auth-service와 동일한 값>
INTERNAL_SECRET=<모든 서비스 동일한 값>
HOTEL_SERVICE_URL=http://<hotel EC2 Private IP>:3002
CORS_ORIGIN=http://<Frontend EC2 Public IP>
AWS_REGION=ap-northeast-2
SQS_ENDPOINT=http://<hotel EC2 Private IP>:9324
SQS_QUEUE_URL=http://<hotel EC2 Private IP>:9324/000000000000/booking-queue
EOF
```

MySQL 컨테이너 없이 서비스만 실행
```bash
cat > docker-compose.booking.yml << 'EOF'
services:
  booking-service:
    build:
      context: ./backend/booking-service
      dockerfile: Dockerfile
    env_file: ./backend/booking-service/.env.mysql-ec2
    ports:
      - '3003:3003'
    restart: on-failure
EOF

sudo docker compose -f docker-compose.booking.yml up -d --build
```

### 헬스체크

```bash
curl http://localhost:3003/health
```

---

## 5. review-service EC2 분리 배포

> **역할**: 리뷰 작성/삭제 + booking-service에 예약 확인 → SQS로 평점 갱신 이벤트 발행
> **포트**: 3004 | **DB**: review_db (MySQL)
> **SQS**: 리뷰 생성/삭제 시 `rating-queue`에 메시지 발행 (hotel-service가 수신하여 평점 집계)

### 5-1. EC2 인스턴스 생성 (review-service)

| 항목 | 권장 값 |
|------|--------|
| AMI | Amazon Linux 2023 |
| 인스턴스 타입 | `t3.micro` |
| 스토리지 | 기본 8GB |
| 보안 그룹 인바운드 | SSH 22 (내 IP), TCP 3004 (Frontend EC2 SG + booking EC2 SG) |
| 키 페어 | 기존 또는 새로 생성 |

> booking-service가 review EC2 SG에 3003 포트를 열어뒀는지 확인 (booking → review 방향은 없음, review → booking 방향만 있음)

### 5-2. EC2 접속 후 환경 세팅

```bash
# Amazon Linux 2023 — Docker 설치
sudo dnf install -y docker git
sudo systemctl enable --now docker

# Docker Compose 플러그인 설치
sudo mkdir -p /usr/local/lib/docker/cli-plugins
sudo curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# Docker BuildX 업데이트 (0.17.0 미만이면 compose build 오류 발생)
sudo curl -SL https://github.com/docker/buildx/releases/download/v0.19.3/buildx-v0.19.3.linux-amd64 \
  -o /usr/local/lib/docker/cli-plugins/docker-buildx
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-buildx
```

### 5-3. 프로젝트 클론 및 실행

```bash
git clone --filter=blob:none --sparse https://github.com/yubin05/Project_TEAM_AWS.git
cd Project_TEAM_AWS
git sparse-checkout set backend/review-service
```

MySQL 설정 파일 수정
```bash
cat > backend/review-service/.env.mysql-ec2 << 'EOF'
APP_MODE=local
PORT=3004
DB_HOST=<MySQL EC2 Private IP>
DB_PORT=3306
DB_USER=root
DB_PASSWORD=P@ssw0rd
DB_NAME=review_db
JWT_SECRET=<auth-service와 동일한 값>
INTERNAL_SECRET=<모든 서비스 동일한 값>
BOOKING_SERVICE_URL=http://<booking EC2 Private IP>:3003
HOTEL_SERVICE_URL=http://<hotel EC2 Private IP>:3002
SQS_ENDPOINT=http://<hotel EC2 Private IP>:9324
SQS_QUEUE_URL=http://<hotel EC2 Private IP>:9324/000000000000/rating-queue
CORS_ORIGIN=http://<Frontend EC2 Public IP>
AWS_REGION=ap-northeast-2
EOF
```

MySQL 컨테이너 없이 서비스만 실행
```bash
cat > docker-compose.review.yml << 'EOF'
services:
  review-service:
    build:
      context: ./backend/review-service
      dockerfile: Dockerfile
    env_file: ./backend/review-service/.env.mysql-ec2
    ports:
      - '3004:3004'
    restart: on-failure
EOF

sudo docker compose -f docker-compose.review.yml up -d --build
```

### 헬스체크

```bash
curl http://localhost:3004/health
```

---

## 실행 모드

각 서비스의 `APP_MODE` 환경변수로 전환합니다.

| 항목 | `local` (기본값) | `aws` |
|------|-----------------|-------|
| 인증 | 자체 JWT (12h) | AWS Cognito |
| 데이터베이스 | MySQL 컨테이너 | RDS MySQL |
| NoSQL | DynamoDB Local | DynamoDB |
| 번역 | 미적용 (원본 반환) | Azure Translator |
| AI 추천 | 하드코딩 Fallback | AWS Bedrock (Claude 3 Haiku) |
| SQS | ElasticMQ 컨테이너 | AWS SQS |
| 자격증명 | 더미 키 | IAM Role 자동 처리 |

---

## 프로젝트 구조

```
Project_TEAM_AWS/
├── nginx/
│   └── nginx.conf                  API Gateway + 정적 파일 서빙
├── elasticmq/
│   └── elasticmq.conf              로컬 SQS (rating-queue)
├── scripts/
│   └── init-databases.sql          4개 DB 생성 초기화
├── cloudwatch/
│   └── amazon-cloudwatch-agent.json  서비스별 로그 그룹 설정
│
├── frontend/
│   └── public/
│       ├── index.html              Azure Maps SDK 로드
│       ├── css/style.css
│       └── js/
│           ├── config.js           API_BASE, AZURE_MAPS_KEY
│           └── app.js
│
└── backend/
    ├── auth-service/               포트 3001 | auth_db
    │   └── src/
    │       ├── config/             Secrets Manager 연동
    │       ├── middleware/auth.ts  JWT 생성(12h) / Cognito 검증
    │       ├── models/             users 테이블
    │       ├── controllers/authController.ts
    │       ├── routes/
    │       └── seed.ts             6명 사용자 (admin/host×2/user×3)
    │
    ├── hotel-service/              포트 3002 | hotel_db
    │   └── src/
    │       ├── config/             SQS, Azure Translator, Bedrock 설정
    │       ├── services/
    │       │   ├── translateService.ts   Azure Translator (인메모리 캐시)
    │       │   └── sqsConsumer.ts        평점 업데이트 SQS 소비
    │       ├── controllers/
    │       │   ├── hotelController.ts    getInternalRoom 포함
    │       │   ├── videoController.ts
    │       │   ├── wishlistController.ts
    │       │   └── recommendController.ts  Bedrock / fallback
    │       └── seed.ts             10개 호텔 + 30개 객실
    │
    ├── booking-service/            포트 3003 | booking_db
    │   └── src/
    │       ├── clients/hotelClient.ts    hotel-service internal HTTP
    │       ├── controllers/bookingController.ts
    │       │                             (비정규화: hotel_name, room_name, host_id)
    │       └── seed.ts             6개 예약
    │
    └── review-service/             포트 3004 | review_db
        └── src/
            ├── clients/bookingClient.ts  booking-service internal HTTP
            ├── services/sqsPublisher.ts  평점 갱신 SQS 발행
            ├── controllers/reviewController.ts
            │                             (비정규화: user_name)
            └── seed.ts             8개 리뷰
```

---

## API 엔드포인트

### auth-service (`/api/auth/*`, `/api/internal/users/*`)

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | /api/auth/register | 회원가입 |
| POST | /api/auth/login | 로그인 |
| GET | /api/auth/profile | 프로필 조회 |
| PUT | /api/auth/profile | 프로필 수정 |
| PUT | /api/auth/password | 비밀번호 변경 |
| GET | /api/internal/users/:id | 사용자 조회 (내부 전용) |

### hotel-service (`/api/hotels/*`, `/api/wishlist/*`, `/api/recommend`)

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | /api/hotels/featured | 인기 숙소 |
| GET | /api/hotels/regions | 지역 목록 |
| GET | /api/hotels/search | 숙소 검색 (`?lang=en` 번역) |
| GET | /api/hotels/mine | 내 숙소 (호스트) |
| GET | /api/hotels/:id | 숙소 상세 |
| POST | /api/hotels | 숙소 등록 |
| PUT | /api/hotels/:id | 숙소 수정 |
| GET | /api/hotels/:hotelId/rooms/:roomId | 객실 상세 |
| POST | /api/hotels/:hotelId/rooms | 객실 등록 |
| POST | /api/wishlist/:hotelId | 위시리스트 토글 |
| GET | /api/wishlist | 위시리스트 조회 |
| POST | /api/recommend | AI 추천 |

### booking-service (`/api/bookings/*`)

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | /api/bookings | 예약 생성 |
| GET | /api/bookings | 내 예약 목록 |
| GET | /api/bookings/host | 호스트 예약 목록 |
| GET | /api/bookings/:id | 예약 상세 |
| DELETE | /api/bookings/:id | 예약 취소 |

### review-service (`/api/reviews/*`, `/api/hotels/*/reviews`)

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | /api/reviews | 리뷰 작성 |
| GET | /api/hotels/:hotelId/reviews | 리뷰 목록 |
| DELETE | /api/reviews/:id | 리뷰 삭제 |

---

## 기술 스택

### 백엔드 (공통)
- Node.js 20 + TypeScript
- Express.js
- MySQL2 (로컬 MySQL / AWS RDS)
- jsonwebtoken / aws-jwt-verify
- winston (로깅)
- AWS SDK v3 (Secrets Manager, SQS, Bedrock)

### 추가 서비스별
- **hotel-service**: Azure Translator (REST), AWS Bedrock (Claude 3 Haiku)
- **hotel-service**: @aws-sdk/client-sqs (SQS Consumer — rating-queue)
- **review-service**: @aws-sdk/client-sqs (SQS Publisher — rating-queue)
- **booking-service**: @aws-sdk/client-sqs (SQS Publisher — booking-queue)
- **Lambda** (booking-notification): @aws-sdk/client-ses (예약 확정 이메일 발송)

### 프론트엔드
- Vanilla HTML5 / CSS3 / JavaScript (ES6+)
- Azure Maps SDK v3 (숙소 위치 지도)
- HLS.js (영상 스트리밍)

### 인프라 (EC2 배포)
- nginx (API Gateway + 정적 파일, Frontend EC2)
- Docker + Docker Compose (서비스별 개별 컨테이너)
- MySQL 8.0 (서비스별 독립 DB, 전용 EC2 분리)
- ElasticMQ (SQS 로컬 대체, hotel EC2)

### 인프라 (AWS 배포)
- Amplify (프론트엔드 CDN)
- WAF + API Gateway (진입점, Cognito JWT 인증)
- ECS Fargate + ECR (컨테이너 실행)
- ALB (internal, ECS 라우팅)
- RDS MySQL / DynamoDB / SQS / S3
- Lambda (이메일 발송 / 이미지 리사이즈 / Cognito 후처리)
- CodePipeline v2 + CodeBuild + CodeDeploy (CI/CD)

---

## AWS 배포 (예정)

> 상세 인프라 구성은 [docs/aws-infrastructure.md](docs/aws-infrastructure.md) 참고

### 필요한 AWS 리소스

| 서비스 | 역할 |
|---|---|
| **Amplify** | 프론트엔드 정적 파일 호스팅 + GitHub 자동 배포 (`appRoot: frontend`) |
| **WAF** | SQL Injection, XSS 차단 / Rate Limiting (API Gateway에 연결) |
| **API Gateway** | HTTP API 엔드포인트 + Cognito JWT Authorizer + VPC Link |
| **ALB** | VPC 내부 트래픽 로드밸런싱 (internal, ECS Target Group 라우팅) |
| **ECS Fargate** | 4개 마이크로서비스 컨테이너 실행 |
| **ECR** | 서비스별 Docker 이미지 저장소 |
| **Cognito** | User Pool + `custom:role` 속성 + Post Confirmation Lambda 트리거 |
| **RDS MySQL** | MySQL 8.0, 4개 DB (auth_db / hotel_db / booking_db / review_db) |
| **DynamoDB** | 호텔 검색 캐시 (`TravelBookingCache`) |
| **SQS** | `rating-queue` (평점 갱신), `booking-queue` (예약 이메일) |
| **SES** | 예약 확정 이메일 발송 (Sandbox → Production 신청 필요) |
| **S3** | 호텔 이미지 원본 / 썸네일 / 영상 / 로그 보관 |
| **Bedrock** | Claude 3 Haiku 모델 액세스 활성화 |
| **Secrets Manager** | 서비스별 시크릿 (`travel-app/auth-service` 등) |
| **CloudWatch** | 서비스별 로그 그룹 (`/travel-app/auth-service` 등) |

### Lambda 구성

| 함수 | 트리거 | 역할 | IAM 권한 |
|---|---|---|---|
| `booking-notification` | SQS `booking-queue` | 예약 확정 이메일 발송 | `ses:SendEmail`, `sqs:ReceiveMessage` |
| `image-resize` | S3 업로드 이벤트 | 호텔 이미지 썸네일 생성 | `s3:GetObject`, `s3:PutObject` |
| `cognito-post-confirm` | Cognito Post Confirmation | auth_db 유저 프로필 초기화 | `rds-data:ExecuteStatement` |

### 이메일 알림 흐름

```
예약 생성 (POST /bookings)
    → booking-service INSERT 성공
        → SQS booking-queue 메시지 발행
            → Lambda (booking-notification) SQS 트리거
                → AWS SES 이메일 발송 → 사용자 이메일
```

> **SES Sandbox 제한**: 인증된 이메일 주소로만 수신 가능. 실서비스 전 Production 액세스 신청 필요.

### CI/CD 경로 필터 (모노레포)

| push 경로 | Amplify | CodePipeline |
|---|---|---|
| `frontend/**` | ✅ 빌드 | ❌ 스킵 |
| `backend/**` | ❌ 스킵 | ✅ 빌드 |
| `docs/**`, `*.md` | ❌ 스킵 | ❌ 스킵 |

- **Amplify**: `amplify.yml`의 `appRoot: frontend`로 경로 필터
- **CodePipeline v2**: `filePaths.Includes: backend/**` 트리거 필터

### 보안 구성

```
인터넷
  └── WAF (악성 요청 차단)
        └── API Gateway (HTTPS, Cognito JWT 검증)
              └── VPC Link
                    └── ALB internal (VPC Link에서만 인바운드)
                          └── ECS (ALB에서만 인바운드)
                                └── RDS (ECS에서만 3306 허용)
```

### 포트 요약

| 서비스 | EC2 배포 | AWS 배포 |
|--------|----------|----------|
| 진입점 | nginx :80 (Frontend EC2) | API Gateway (HTTPS) |
| auth-service | :3001 | ECS :3001 |
| hotel-service | :3002 | ECS :3002 |
| booking-service | :3003 | ECS :3003 |
| review-service | :3004 | ECS :3004 |
| DB | MySQL EC2 :3306 | RDS :3306 (private) |
