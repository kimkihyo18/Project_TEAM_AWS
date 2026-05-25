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
| booking-service → ElasticMQ | SQS Publish | 예약 확정 시 이메일 알림 요청 |
| Lambda ← SQS booking-queue | SQS Trigger | 메시지 수신 후 AWS SES로 예약 확정 이메일 발송 |

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

### MySQL-2. MySQL 8.0 설치 및 설정

```bash
# MySQL 8.0 설치
sudo dnf install -y mysql-server
sudo systemctl enable --now mysqld

# root 비밀번호 설정 및 원격 접속 허용
sudo mysql -u root << 'SQL'
ALTER USER 'root'@'localhost' IDENTIFIED BY 'P@ssw0rd';
CREATE USER 'root'@'%' IDENTIFIED BY 'P@ssw0rd';
GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' WITH GRANT OPTION;
FLUSH PRIVILEGES;
SQL

# 원격 접속을 위해 bind-address 변경
sudo sed -i '/\[mysqld\]/a bind-address = 0.0.0.0' /etc/my.cnf
sudo systemctl restart mysqld
```

### MySQL-3. DB 초기화 및 시드 데이터 삽입

```bash
git clone --filter=blob:none --sparse https://github.com/yubin05/Project_TEAM_AWS.git
cd Project_TEAM_AWS
git sparse-checkout set database

# 4개 DB 생성
mysql -u root -pP@ssw0rd < database/scripts/init-databases.sql

# node.js 설치 (bcrypt 해시 생성용)
sudo dnf install -y nodejs

# auth-service 의존성 설치 (bcryptjs 사용)
npm install --prefix backend/auth-service

# 시드 데이터 삽입 (서비스 기동 후 테이블 생성 완료된 뒤 실행)
# - 서비스 EC2들을 먼저 기동하여 테이블 생성 후 실행 권장
bash database/scripts/run-seed.sh P@ssw0rd
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

MySQL 컨테이너 없이 서비스만 실행, MySQL EC2 Private IP 연결:

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
- **SQS**: `rating-queue`, `booking-queue`
- **SES**: 발신 이메일 인증 (Sandbox → Production 신청 필요)
- **Lambda**: `booking-notification` 함수 (`lambda/booking-notification/index.mjs`)
  - 트리거: SQS `booking-queue`
  - IAM Role: `ses:SendEmail` + `sqs:ReceiveMessage` / `sqs:DeleteMessage` / `sqs:GetQueueAttributes`
  - 환경변수: `FROM_EMAIL`, `AWS_REGION`
- **Secrets Manager**: 서비스별 시크릿 (`travel-app/auth-service` 등)
- **Bedrock**: Claude 3 Haiku 모델 액세스 활성화
- **CloudWatch**: 서비스별 로그 그룹 (`/travel-app/auth-service` 등)

### 이메일 알림 흐름

```
예약 생성 (POST /api/bookings)
    → booking-service INSERT 성공
        → SQS booking-queue 메시지 발행
            → Lambda (booking-notification) SQS 트리거
                → AWS SES 이메일 발송 → 사용자 이메일
```

> 로컬 테스트 시 ElasticMQ의 `booking-queue`까지만 확인 가능하며, 실제 이메일 발송은 AWS 배포 후 SES에서 동작합니다.

**SES Sandbox 제한**: 인증된 이메일 주소로만 수신 가능. 실서비스 전 Production 액세스 신청 필요.

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
