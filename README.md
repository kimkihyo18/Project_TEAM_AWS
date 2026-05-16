# AI 여행 예약 플랫폼 — Project TEAM AWS

야놀자 스타일의 여행 및 숙박 예약 플랫폼.  
모놀리식 백엔드를 **4개 마이크로서비스**로 분리한 구조입니다.

---

## 아키텍처

```
[Browser]
    │
    ▼
[nginx :80]  ── 정적 파일 (frontend/public)
    │
    ├── /api/auth/*          → auth-service    :3001  (auth_db)
    ├── /api/reviews/*       → review-service  :3004  (review_db)
    ├── /api/hotels/*/reviews→ review-service  :3004
    ├── /api/bookings/*      → booking-service :3003  (booking_db)
    └── /api/*               → hotel-service   :3002  (hotel_db)

[ElasticMQ :9324]  ── SQS 로컬 대체 (리뷰 → 평점 업데이트)
[MySQL :3306]      ── 4개 DB (auth_db / hotel_db / booking_db / review_db)
[DynamoDB Local :8000]
```

### 서비스 간 통신

| 호출 방향 | 방법 | 용도 |
|-----------|------|------|
| booking-service → hotel-service | HTTP `x-internal-secret` | 예약 시 객실 정보 조회 |
| review-service → booking-service | HTTP `x-internal-secret` | 리뷰 작성 시 예약 확인 |
| review-service → ElasticMQ | SQS Publish | 리뷰 생성/삭제 시 평점 갱신 요청 |
| hotel-service ← ElasticMQ | SQS Consume | 메시지 수신 후 review-service에서 평점 집계 후 DB 업데이트 |

---

## 로컬 테스트

### 사전 준비 — Docker Desktop 설치

#### 1. 다운로드

[https://www.docker.com/products/docker-desktop/](https://www.docker.com/products/docker-desktop/) 접속 → **Download for Windows** 클릭

#### 2. 설치

1. 다운로드된 `Docker Desktop Installer.exe` 실행
2. "Use WSL 2 instead of Hyper-V" 체크 (권장)
3. **Ok** → 설치 완료 후 PC 재시작

#### 3. WSL 2 설정 (설치 후 오류 나는 경우)

PowerShell을 **관리자 권한**으로 열고:

```powershell
wsl --install
wsl --set-default-version 2
```

재시작 후 Docker Desktop 다시 실행

#### 4. 실행 확인

Docker Desktop 앱 실행 후 트레이 아이콘이 초록색이면 정상.

```bash
docker --version
docker compose version
```

> **Windows 요구사양**: Windows 10 21H2 이상 또는 Windows 11, WSL 2 지원 CPU

---

### 1. 컨테이너 빌드 및 실행

```bash
docker compose -f docker-compose.local.yml up --build -d
```

### 2. 시드 데이터 입력 (최초 1회)

```bash
docker compose -f docker-compose.local.yml exec auth-service    npm run seed
docker compose -f docker-compose.local.yml exec hotel-service   npm run seed
docker compose -f docker-compose.local.yml exec booking-service npm run seed
docker compose -f docker-compose.local.yml exec review-service  npm run seed
```

### 3. 접속

```
http://localhost
```

### 테스트 계정

| 역할 | 이메일 | 비밀번호 |
|------|--------|---------|
| 관리자 | admin@travel.com | password123 |
| 호스트 1 | host@travel.com | password123 |
| 호스트 2 | host2@travel.com | password123 |
| 일반 사용자 | user@travel.com | password123 |

### 서비스별 헬스체크

```bash
curl http://localhost/health                   # nginx
curl http://localhost:3001/health              # auth-service
curl http://localhost:3002/health              # hotel-service
curl http://localhost:3003/health              # booking-service
curl http://localhost:3004/health              # review-service
```

### 로그 확인

```bash
docker compose -f docker-compose.local.yml logs -f auth-service
docker compose -f docker-compose.local.yml logs -f hotel-service
docker compose -f docker-compose.local.yml logs -f booking-service
docker compose -f docker-compose.local.yml logs -f review-service
```

### 전체 초기화

```bash
docker compose -f docker-compose.local.yml down -v
docker compose -f docker-compose.local.yml up --build -d
```

---

## EC2 단일 서버 테스트

로컬 PC에 Docker를 설치하기 어려운 경우, EC2 1대에서 동일하게 테스트할 수 있습니다.

### 1. EC2 인스턴스 생성

| 항목 | 권장 값 |
|------|--------|
| AMI | Amazon Linux 2023 |
| 인스턴스 타입 | `t3.medium` 이상 (4개 서비스 + DB 동시 실행) |
| 스토리지 | 20GB 이상 |
| 보안 그룹 인바운드 | SSH 22 (내 IP), HTTP 80 (0.0.0.0/0) |
| 키 페어 | 기존 또는 새로 생성 |

### 2. EC2 접속 후 환경 세팅

```bash
# Amazon Linux 2023 — Docker 설치
sudo dnf install -y docker git
sudo systemctl start docker
sudo systemctl enable docker

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

### 3. 스왑 메모리 추가 (t3.medium 이하 권장)

```bash
sudo dd if=/dev/zero of=/swapfile bs=128M count=16
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile swap swap defaults 0 0' | sudo tee -a /etc/fstab
```

### 4. 프로젝트 클론 및 실행

```bash
git clone https://github.com/yubin05/Project_TEAM_AWS.git
cd Project_TEAM_AWS

# 한 번에 하나씩 빌드
sudo docker compose -f docker-compose.local.yml build --no-cache auth-service && \
sudo docker compose -f docker-compose.local.yml build --no-cache booking-service && \
sudo docker compose -f docker-compose.local.yml build --no-cache review-service && \
sudo docker compose -f docker-compose.local.yml build --no-cache hotel-service && \
sudo docker compose -f docker-compose.local.yml up -d

# 빌드 진행 상황 확인
sudo docker compose -f docker-compose.local.yml logs -f
```

### 5. 시드 데이터 입력 (최초 1회)

```bash
sudo docker compose -f docker-compose.local.yml exec auth-service npm run seed
sudo docker compose -f docker-compose.local.yml exec hotel-service npm run seed
sudo docker compose -f docker-compose.local.yml exec booking-service npm run seed
sudo docker compose -f docker-compose.local.yml exec review-service npm run seed
```

### 6. 접속

```
http://<EC2 퍼블릭 IP>
```

> EC2 콘솔 → 인스턴스 → **퍼블릭 IPv4 주소** 확인

### 트러블슈팅

```bash
# 컨테이너 상태 확인
sudo docker compose -f docker-compose.local.yml ps

# 특정 서비스 로그
sudo docker compose -f docker-compose.local.yml logs -f hotel-service

# 헬스체크
curl http://localhost/health
curl http://localhost:3001/health
curl http://localhost:3002/health
curl http://localhost:3003/health
curl http://localhost:3004/health

# 전체 초기화 (볼륨 포함)
sudo docker compose -f docker-compose.local.yml down -v
sudo docker compose -f docker-compose.local.yml up --build -d
```

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

### 1-3. 프로젝트 클론 및 실행

```bash
# 현재는 전체 프로젝트 클론 (frontend/public 하위 폴더만 복사하여 사용 예정)
git clone https://github.com/yubin05/Project_TEAM_AWS.git
cd Project_TEAM_AWS

# 백엔드 서비스 EC2 Private IP로 교체
sudo vi nginx/nginx.frontend.conf

sudo cp nginx/nginx.frontend.conf /etc/nginx/nginx.conf

# 설정 문법 확인
sudo nginx -t

# frontend/public 하위 폴더만 복사하여 사용
sudo cp -r frontend/public/* /usr/share/nginx/html/
sudo systemctl restart nginx
```

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
```

### 2-3. 프로젝트 클론 및 실행

```bash
git clone https://github.com/yubin05/Project_TEAM_AWS.git
cd Project_TEAM_AWS
```

**A. RDS 없이 로컬 MySQL로 테스트 (간단)**

`.env.local` 그대로 사용, MySQL 컨테이너 함께 실행:

```bash
cat > docker-compose.auth.yml << 'EOF'
services:
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: localpassword
      MYSQL_CHARACTER_SET_SERVER: utf8mb4
      MYSQL_COLLATION_SERVER: utf8mb4_unicode_ci
    volumes:
      - ./scripts/init-databases.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: ['CMD', 'mysqladmin', 'ping', '-h', 'localhost', '-uroot', '-plocalpassword']
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 30s

  auth-service:
    build:
      context: ./services/auth-service
      dockerfile: Dockerfile
    env_file: ./services/auth-service/.env.local
    ports:
      - '3001:3001'
    depends_on:
      mysql:
        condition: service_healthy
    restart: on-failure
EOF
```

**B. RDS 연동 (EC2 배포)**

`.env.aws` 작성:

```bash
cat > services/auth-service/.env.aws << 'EOF'
APP_MODE=local
PORT=3001
DB_HOST=<RDS endpoint>
DB_PORT=3306
DB_USER=admin
DB_PASSWORD=<비밀번호>
DB_NAME=auth_db
JWT_SECRET=<랜덤 문자열>
INTERNAL_SECRET=<다른 서비스들과 동일한 값>
CORS_ORIGIN=http://<Frontend EC2 Public IP>
AWS_REGION=ap-northeast-2
EOF
```

compose 파일:

```bash
cat > docker-compose.auth.yml << 'EOF'
services:
  auth-service:
    build:
      context: ./services/auth-service
      dockerfile: Dockerfile
    env_file: ./services/auth-service/.env.aws
    ports:
      - '3001:3001'
    restart: on-failure
EOF
```

실행:

```bash
# Docker BuildX 업데이트 (0.17.0 미만이면 compose build 오류 발생)
sudo curl -SL https://github.com/docker/buildx/releases/download/v0.19.3/buildx-v0.19.3.linux-amd64 \
  -o /usr/local/lib/docker/cli-plugins/docker-buildx
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-buildx

sudo docker compose -f docker-compose.auth.yml up -d --build

# 시드 데이터 입력 (최초 1회) - DB 연동하지 않았을 경우, 테스트를 위한 데이터
sudo docker compose -f docker-compose.auth.yml exec auth-service npm run seed
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
git clone https://github.com/yubin05/Project_TEAM_AWS.git
cd Project_TEAM_AWS
```

**A. RDS 없이 로컬 MySQL로 테스트 (간단)**

`.env.local` 그대로 사용, 인프라 컨테이너 함께 실행:

```bash
cat > docker-compose.hotel.yml << 'EOF'
services:
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: localpassword
      MYSQL_CHARACTER_SET_SERVER: utf8mb4
      MYSQL_COLLATION_SERVER: utf8mb4_unicode_ci
    volumes:
      - ./scripts/init-databases.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: ['CMD', 'mysqladmin', 'ping', '-h', 'localhost', '-uroot', '-plocalpassword']
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 30s

  dynamodb-local:
    image: amazon/dynamodb-local:latest
    command: '-Xmx128m -jar DynamoDBLocal.jar -sharedDb -inMemory'

  elasticmq:
    image: softwaremill/elasticmq-native:latest
    volumes:
      - ./elasticmq/elasticmq.conf:/opt/elasticmq.conf:ro

  hotel-service:
    build:
      context: ./services/hotel-service
      dockerfile: Dockerfile
    env_file: ./services/hotel-service/.env.local
    ports:
      - '3002:3002'
    depends_on:
      mysql:
        condition: service_healthy
      dynamodb-local:
        condition: service_started
      elasticmq:
        condition: service_started
    restart: on-failure
EOF
```

**B. RDS + AWS DynamoDB + AWS SQS 연동 (EC2 배포)**

`.env.aws` 작성:

```bash
cat > services/hotel-service/.env.aws << 'EOF'
APP_MODE=local
PORT=3002
DB_HOST=<RDS endpoint>
DB_PORT=3306
DB_USER=admin
DB_PASSWORD=<비밀번호>
DB_NAME=hotel_db
JWT_SECRET=<auth-service와 동일한 값>
INTERNAL_SECRET=<다른 서비스들과 동일한 값>
CORS_ORIGIN=http://<Frontend EC2 Public IP>
DYNAMO_TABLE=TravelBookingCache
SQS_QUEUE_URL=https://sqs.ap-northeast-2.amazonaws.com/<ACCOUNT_ID>/rating-queue
AWS_REGION=ap-northeast-2
EOF
```

compose 파일:

```bash
cat > docker-compose.hotel.yml << 'EOF'
services:
  hotel-service:
    build:
      context: ./services/hotel-service
      dockerfile: Dockerfile
    env_file: ./services/hotel-service/.env.aws
    ports:
      - '3002:3002'
    restart: on-failure
EOF
```

실행:

```bash
# Docker BuildX 업데이트 (0.17.0 미만이면 compose build 오류 발생)
sudo curl -SL https://github.com/docker/buildx/releases/download/v0.19.3/buildx-v0.19.3.linux-amd64 \
  -o /usr/local/lib/docker/cli-plugins/docker-buildx
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-buildx

sudo docker compose -f docker-compose.hotel.yml up -d --build

# 시드 데이터 입력 (최초 1회) - DB 연동하지 않았을 경우, 테스트를 위한 데이터
sudo docker compose -f docker-compose.hotel.yml exec hotel-service npm run seed
```

### 헬스체크

```bash
curl http://localhost:3002/health
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
├── docker-compose.local.yml        로컬 전체 스택 실행
├── docker-compose.aws.yml          AWS 연동 버전
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
└── services/
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
- **hotel-service**: @aws-sdk/client-sqs (SQS Consumer)
- **review-service**: @aws-sdk/client-sqs (SQS Publisher)

### 프론트엔드
- Vanilla HTML5 / CSS3 / JavaScript (ES6+)
- Azure Maps SDK v3 (숙소 위치 지도)
- HLS.js (영상 스트리밍)

### 인프라
- nginx (API Gateway + 정적 파일)
- Docker + Docker Compose
- ElasticMQ (로컬 SQS 대체)
- MySQL 8.0 (서비스별 독립 DB)

---

## AWS 배포 (예정)

### 필요한 AWS 리소스

- **Cognito**: User Pool + `custom:role` 속성
- **RDS**: MySQL 8.0, 4개 DB (auth_db / hotel_db / booking_db / review_db)
- **SQS**: `rating-queue`
- **Secrets Manager**: 서비스별 시크릿 (`travel-app/auth-service` 등)
- **Bedrock**: Claude 3 Haiku 모델 액세스 활성화
- **CloudWatch**: 서비스별 로그 그룹 (`/travel-app/auth-service` 등)

### EC2 배포

```bash
git clone https://github.com/yubin05/Project_TEAM_AWS.git
cd Project_TEAM_AWS

# 각 서비스 .env.aws 작성 후
docker compose -f docker-compose.aws.yml up --build -d
```

### 포트 요약

| 서비스 | 포트 |
|--------|------|
| nginx (진입점) | 80 |
| auth-service | 3001 |
| hotel-service | 3002 |
| booking-service | 3003 |
| review-service | 3004 |
| MySQL | 3306 |
| DynamoDB Local | 8000 |
| ElasticMQ | 9324 |
