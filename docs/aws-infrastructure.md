# AWS 인프라 구성

## 전체 아키텍처

```
사용자
  │
  ├── Amplify (프론트엔드 CDN + 자동 배포)
  │
  └── WAF
        ↓
   API Gateway (HTTP API)
   ├── Cognito JWT Authorizer (인증 필요 라우트)
   ├── /auth/*       → auth-service
   ├── /hotels/*     → hotel-service
   ├── /bookings/*   → booking-service
   └── /reviews/*    → review-service
        ↓ (VPC Link)
       ALB (internal, Application Load Balancer)
        ↓
   ECS Fargate
   ├── auth-service    :3001  ── Cognito 토큰 검증
   ├── hotel-service   :3002  ── Bedrock / SQS Consumer ←─ SQS rating-queue
   ├── booking-service :3003  ── SQS Publisher ──────────→ SQS booking-queue
   └── review-service  :3004  ── SQS Publisher ──────────→ SQS rating-queue
        ↓
   RDS MySQL (서비스별 독립 DB)
   DynamoDB (캐시)
   S3 (이미지/영상/로그 보관)
   Bedrock (AI 추천)

   SQS booking-queue → Lambda ──→ SES (예약 확정 이메일)
   S3 업로드 이벤트  → Lambda ──→ S3 (썸네일 리사이즈)
   Cognito 회원가입  → Lambda ──→ RDS auth_db (유저 프로필 초기화)
```

---

## AWS 서비스별 역할

| 서비스 | 역할 |
|---|---|
| **Amplify** | 프론트엔드 정적 파일 호스팅 + GitHub 자동 배포 |
| **WAF** | SQL Injection, XSS 차단 / Rate Limiting (API Gateway에 연결) |
| **API Gateway** | REST/HTTP API 엔드포인트 + Cognito JWT Authorizer + VPC Link |
| **ALB** | VPC 내부 트래픽 로드밸런싱 + ECS 서비스 경로 라우팅 (internal) |
| **ECS Fargate** | 4개 마이크로서비스 컨테이너 실행 |
| **ECR** | 서비스별 Docker 이미지 저장소 |
| **Lambda** | SQS 트리거 이메일 발송 / Cognito 후처리 / S3 이미지 리사이즈 |
| **CodePipeline** | 백엔드 CI/CD 자동화 파이프라인 |
| **CodeBuild** | Docker 이미지 빌드 + ECR push |
| **CodeDeploy** | ECS 서비스 자동 재배포 |
| **Cognito** | 회원가입/로그인 + JWT 토큰 발급 |
| **RDS MySQL** | 서비스별 독립 DB (auth/hotel/booking/review) |
| **DynamoDB** | 호텔 검색 캐시 |
| **SQS** | 서비스 간 비동기 메시지 큐 (rating-queue, booking-queue) |
| **SES** | 예약 확정 이메일 발송 (Lambda 통해 호출) |
| **S3** | 호텔 이미지 / 소개 영상 / 로그 장기 보관 |
| **Bedrock** | Claude 3 Haiku 기반 AI 숙소 추천 |
| **Secrets Manager** | DB 비밀번호, JWT 시크릿 등 민감 정보 관리 |
| **CloudWatch** | 서비스별 실시간 로그 수집 및 알람 |
| **Athena** | S3 로그 SQL 분석 |
| **VPC + Security Group** | 서비스 간 네트워크 격리 |
| **DMS** | MySQL EC2 → RDS 무중단 데이터 이전 |

---

## CI/CD 흐름

> 모노레포(단일 GitHub 저장소) 구조이므로 **경로 필터**를 설정하여 불필요한 빌드를 방지합니다.

### 프론트엔드 (Amplify)

```
GitHub push (main) — frontend/** 변경 시만 트리거
    → Amplify 자동 감지 (appRoot: frontend)
    → 빌드 (API_URL, AZURE_MAPS_KEY 환경변수 주입)
    → CDN 배포
```

**경로 필터 설정** (`amplify.yml`):
```yaml
version: 1
applications:
  - appRoot: frontend        # frontend/ 하위 변경 시만 빌드
    frontend:
      phases:
        build:
          commands:
            - echo "frontend build"
      artifacts:
        baseDirectory: public
        files:
          - '**/*'
```

### 백엔드 (CodePipeline v2)

```
GitHub push (main) — backend/** 변경 시만 트리거
    → CodePipeline 감지 (filePaths 필터)
    → CodeBuild: docker build → ECR push
    → CodeDeploy: ECS Task Definition 업데이트 → 서비스 재배포
```

**경로 필터 설정** (CodePipeline v2, CloudFormation):
```yaml
Triggers:
  - ProviderType: CodeStarSourceConnection
    GitConfiguration:
      Push:
        - FilePaths:
            Includes:
              - backend/**   # backend/ 하위 변경 시만 트리거
            Excludes:
              - frontend/**
              - docs/**
              - "*.md"
```

> **주의**: 경로 필터는 CodePipeline **V2** 에서만 지원됩니다. (`PipelineType: V2`)

### 트리거 분리 요약

| push 경로 | Amplify | CodePipeline |
|---|---|---|
| `frontend/**` | ✅ 빌드 | ❌ 스킵 |
| `backend/**` | ❌ 스킵 | ✅ 빌드 |
| `docs/**`, `*.md` | ❌ 스킵 | ❌ 스킵 |

---

## Lambda 구성

### 부착 위치 및 역할

| 트리거 | Lambda 역할 | 연결 서비스 |
|---|---|---|
| SQS `booking-queue` | 예약 확정 이메일 발송 | → SES |
| S3 업로드 이벤트 | 호텔 이미지 썸네일 리사이즈 | → S3 (처리본 저장) |
| Cognito Post Confirmation | 회원가입 후 유저 프로필 초기화 | → RDS `auth_db` |

### 흐름 상세

#### 1. 예약 이메일 (SQS → Lambda → SES)

```
booking-service
    → SQS (booking-queue) 메시지 발행
        → Lambda 트리거 (자동)
            → 메시지 파싱 (예약자 이메일, 호텔명, 날짜)
                → SES 이메일 발송
```

#### 2. 이미지 리사이즈 (S3 → Lambda → S3)

```
hotel-service
    → S3 원본 이미지 업로드 (hotels/original/)
        → S3 Event 트리거 → Lambda
            → Sharp 라이브러리로 썸네일 생성
                → S3 저장 (hotels/thumbnail/)
```

#### 3. Cognito 회원가입 후처리 (Cognito → Lambda → RDS)

```
사용자 회원가입 → Cognito 처리
    → Post Confirmation 트리거 → Lambda
        → auth_db.users 테이블에 초기 레코드 INSERT
            (APP_MODE=aws 전환 시 필요)
```

---

## API Gateway 구성

### 라우팅 규칙

| 경로 | 대상 서비스 | Cognito 인증 |
|---|---|---|
| `ANY /auth/register` | auth-service | ❌ (공개) |
| `ANY /auth/login` | auth-service | ❌ (공개) |
| `ANY /auth/{proxy+}` | auth-service | ✅ |
| `ANY /hotels/{proxy+}` | hotel-service | ✅ (조회는 선택) |
| `ANY /bookings/{proxy+}` | booking-service | ✅ |
| `ANY /reviews/{proxy+}` | review-service | ✅ |

### VPC Link 연결 구조

```
API Gateway (HTTP API)
      ↓ VPC Link (프라이빗 서브넷 연결)
  ALB (internal)  ← Security Group: API Gateway VPC Link에서만 인바운드
      ↓ 경로 기반 라우팅
  ECS 서비스 (Target Group 별)
```

- **VPC Link**: API Gateway가 프라이빗 VPC 내 ALB에 접근하기 위한 터널
- **ALB Listener Rules**: 경로별로 각 ECS Target Group으로 포워딩
- **Cognito JWT Authorizer**: 토큰 검증을 API Gateway 레벨에서 처리 → ECS 부하 감소

### API Gateway vs ALB 역할 분담

| 역할 | API Gateway | ALB |
|---|---|---|
| 외부 엔드포인트 | ✅ (퍼블릭) | ❌ (internal 전용) |
| Cognito 인증 | ✅ JWT Authorizer | ❌ |
| Rate Limiting | ✅ Usage Plan / Throttling | ❌ |
| WAF 연결 | ✅ | ❌ (API GW에 붙임) |
| 경로 라우팅 | ✅ (서비스 단위) | ✅ (세부 경로) |
| 헬스체크 | ❌ | ✅ |

---

## 보안 구성

```
인터넷
  └── WAF (악성 요청 차단)
        └── API Gateway (HTTPS, Cognito JWT 검증)
              └── VPC Link
                    └── ALB internal (Security Group: VPC Link에서만 인바운드)
                          └── ECS (Security Group: ALB에서만 인바운드 허용)
                                └── RDS (Security Group: ECS에서만 3306 허용)
```

- 모든 시크릿은 **Secrets Manager** 관리, 코드에 하드코딩 없음
- ECS Task Role: 필요한 서비스만 최소 권한 부여 (IAM)
- Cognito: `APP_MODE=aws` 전환 시 자체 JWT → Cognito 토큰 자동 전환
- API Gateway에 WAF를 연결하여 ALB는 외부에 노출하지 않음

---

## 로그 분석 파이프라인 (CloudWatch → S3 → Athena)

```
ECS 서비스 로그
      ↓
  CloudWatch Logs (실시간 수집 / 알람)
      ↓ (Export)
      S3 (로그 장기 보관, 저비용)
      ↓
   Athena (SQL로 로그 분석)
```

### 활용 예시

```sql
-- 서비스별 에러 집계
SELECT service, COUNT(*) AS error_count
FROM logs
WHERE level = 'error'
GROUP BY service ORDER BY error_count DESC;

-- 시간대별 API 호출량
SELECT endpoint, COUNT(*) AS calls
FROM logs
WHERE timestamp BETWEEN '2024-01-01' AND '2024-01-02'
GROUP BY endpoint;
```

| 서비스 | 역할 |
|---|---|
| CloudWatch Logs | 실시간 로그 수집 + 임계값 알람 |
| S3 | 저비용 로그 장기 보관 |
| Athena | 서버리스 SQL 분석, 별도 DB 불필요 |

---

## MySQL EC2 → RDS 마이그레이션 (DMS)

> 기존 MySQL EC2 데이터를 무중단으로 RDS에 이전합니다.

```
MySQL EC2 (Source)
      ↓
  DMS 복제 인스턴스
  ├── Full Load : 기존 데이터 전체 복사
  └── CDC       : 이전 중 변경사항 실시간 동기화
      ↓
  RDS MySQL (Target)
      ↓
  서비스 DB_HOST → RDS 엔드포인트로 전환
```

### 이전 전/후 비교

| 항목 | MySQL EC2 | RDS |
|---|---|---|
| 백업 | 수동 | 자동 (최대 35일) |
| 장애 복구 | 직접 대응 | Multi-AZ 자동 Failover |
| 패치/업그레이드 | 직접 | AWS 관리 |
| 모니터링 | 직접 설정 | CloudWatch 자동 연동 |

> DMS 복제 인스턴스는 이전 완료 후 즉시 삭제 (실행 시간만큼 과금)
