# ── HTTP API ──────────────────────────────────────────────────────────────────
resource "aws_apigatewayv2_api" "main" {
  name          = "ThreeTier-HTTP-API"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
    allow_headers = ["Content-Type", "Authorization"]
    max_age       = 300
  }

  tags = { Name = "ThreeTier-HTTP-API" }
}

# ── VPC Link → Internal ALB ───────────────────────────────────────────────────
resource "aws_apigatewayv2_vpc_link" "main" {
  name               = "ThreeTier-VPC-Link"
  security_group_ids = [aws_security_group.alb.id]
  subnet_ids         = [aws_subnet.private_backend.id, aws_subnet.private_backend_2.id]
  tags               = { Name = "ThreeTier-VPC-Link" }
}

# ── Integration (API Gateway → ALB) ──────────────────────────────────────────
resource "aws_apigatewayv2_integration" "alb" {
  api_id             = aws_apigatewayv2_api.main.id
  integration_type   = "HTTP_PROXY"
  integration_uri    = aws_lb_listener.http.arn
  integration_method = "ANY"
  connection_type    = "VPC_LINK"
  connection_id      = aws_apigatewayv2_vpc_link.main.id

  request_parameters = {
    "overwrite:path" = "/$request.path.proxy"
  }
}

# ── Route: 전체 경로 → ALB (경로 분기는 ALB 리스너 룰에서 처리) ──────────────
# /api/ 접두사를 제거하고 ALB로 전달 (/api/auth/login → /auth/login)
resource "aws_apigatewayv2_route" "proxy" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "ANY /api/{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.alb.id}"
}

# ── Stage ─────────────────────────────────────────────────────────────────────
resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = "$default"
  auto_deploy = true
  tags        = { Name = "ThreeTier-API-Stage" }
}
