variable "key_name" {
  description = "EC2 KeyPair 이름"
  type        = string
}

variable "github_repo_url" {
  description = "GitHub 레포지토리 HTTPS URL"
  type        = string
  default     = "https://github.com/yubin05/Project_TEAM_AWS.git"
}

variable "jwt_secret" {
  description = "JWT 시크릿 (모든 서비스 공유)"
  type        = string
  sensitive   = true
  default     = "change-me-jwt-secret-32chars"
}

variable "internal_secret" {
  description = "서비스 간 내부 통신 시크릿"
  type        = string
  sensitive   = true
  default     = "change-me-internal-secret"
}

variable "github_token" {
  description = "GitHub Personal Access Token (repo 권한 필요) — Amplify 소스 연결용"
  type        = string
  sensitive   = true
}

variable "db_password" {
  description = "RDS MySQL 관리자 비밀번호"
  type        = string
  sensitive   = true
  default     = "Change-me-db-password1!"
}
