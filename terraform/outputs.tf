output "nat_instance_public_ip" {
  description = "NAT Instance 퍼블릭 IP"
  value       = aws_eip.nat.public_ip
}

output "mysql_private_ip" {
  description = "MySQL EC2 프라이빗 IP (DMS 소스)"
  value       = aws_instance.mysql.private_ip
}

output "api_gateway_endpoint" {
  description = "API Gateway 엔드포인트 URL (Amplify API_URL에 설정)"
  value       = aws_apigatewayv2_api.main.api_endpoint
}

output "alb_internal_dns" {
  description = "Internal ALB DNS (서비스 간 통신용)"
  value       = aws_lb.internal.dns_name
}

output "rds_endpoint" {
  description = "RDS MySQL 엔드포인트 (DMS 타깃)"
  value       = aws_db_instance.main.address
}

output "ecr_auth_url" {
  description = "ECR auth-service URL"
  value       = aws_ecr_repository.auth.repository_url
}

output "ecr_hotel_url" {
  description = "ECR hotel-service URL"
  value       = aws_ecr_repository.hotel.repository_url
}

output "ecr_booking_url" {
  description = "ECR booking-service URL"
  value       = aws_ecr_repository.booking.repository_url
}

output "ecr_review_url" {
  description = "ECR review-service URL"
  value       = aws_ecr_repository.review.repository_url
}
