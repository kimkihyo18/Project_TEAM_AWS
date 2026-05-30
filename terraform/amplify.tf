# ── Amplify App ───────────────────────────────────────────────────────────────
# 프론트엔드 전용 — amplify.yml (appRoot: frontend) 기준으로 빌드
resource "aws_amplify_app" "frontend" {
  name         = "ThreeTier-Frontend"
  repository   = replace(var.github_repo_url, ".git", "")
  access_token = var.github_token

  # 레포 루트의 amplify.yml 자동 사용 (appRoot: frontend 포함)
  # build_spec 미지정 시 Amplify가 레포에서 amplify.yml을 직접 읽음

  environment_variables = {
    API_URL = aws_apigatewayv2_api.main.api_endpoint
  }

  # frontend/ 외 경로 변경 시 빌드 스킵 (CodePipeline과 역할 분리)
  custom_rule {
    source = "/<*>"
    status = "404"
    target = "/index.html"
  }
}

# ── Amplify Branch (main) ──────────────────────────────────────────────────────
resource "aws_amplify_branch" "main" {
  app_id      = aws_amplify_app.frontend.id
  branch_name = "main"

  enable_auto_build = true
}
