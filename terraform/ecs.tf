# ── ECS Cluster ──────────────────────────────────────────────────────────────
resource "aws_ecs_cluster" "main" {
  name = "ThreeTier-Cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = { Name = "ThreeTier-Cluster" }
}

# ── ECS Task Execution Role ───────────────────────────────────────────────────
resource "aws_iam_role" "ecs_task_execution" {
  name = "ThreeTier-ECS-TaskExecution-Role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = { Name = "ThreeTier-ECS-TaskExecution-Role" }
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# ── ECS Task Role (Secrets Manager 설정 완료 후 주석 해제) ────────────────────
# resource "aws_iam_role" "ecs_task" {
#   name = "ThreeTier-ECS-Task-Role"
#
#   assume_role_policy = jsonencode({
#     Version = "2012-10-17"
#     Statement = [{
#       Effect    = "Allow"
#       Principal = { Service = "ecs-tasks.amazonaws.com" }
#       Action    = "sts:AssumeRole"
#     }]
#   })
#
#   tags = { Name = "ThreeTier-ECS-Task-Role" }
# }
#
# resource "aws_iam_role_policy_attachment" "ecs_task_sqs" {
#   role       = aws_iam_role.ecs_task.name
#   policy_arn = "arn:aws:iam::aws:policy/AmazonSQSFullAccess"
# }
#
# resource "aws_iam_role_policy_attachment" "ecs_task_dynamodb" {
#   role       = aws_iam_role.ecs_task.name
#   policy_arn = "arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess"
# }
#
# resource "aws_iam_role_policy_attachment" "ecs_task_bedrock" {
#   role       = aws_iam_role.ecs_task.name
#   policy_arn = "arn:aws:iam::aws:policy/AmazonBedrockFullAccess"
# }
#
# resource "aws_iam_role_policy_attachment" "ecs_task_ses" {
#   role       = aws_iam_role.ecs_task.name
#   policy_arn = "arn:aws:iam::aws:policy/AmazonSESFullAccess"
# }

# ── ECS Tasks Security Group ──────────────────────────────────────────────────
resource "aws_security_group" "ecs_tasks" {
  name        = "ThreeTier-ECS-Tasks-SG"
  description = "ECS Fargate Tasks Security Group"
  vpc_id      = aws_vpc.main.id
  tags        = { Name = "ThreeTier-ECS-Tasks-SG" }

  ingress {
    description     = "From ALB to service ports"
    from_port       = 3001
    to_port         = 3004
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ── CloudWatch Log Groups ─────────────────────────────────────────────────────
resource "aws_cloudwatch_log_group" "auth" {
  name              = "/ecs/auth-service"
  retention_in_days = 30
}

resource "aws_cloudwatch_log_group" "hotel" {
  name              = "/ecs/hotel-service"
  retention_in_days = 30
}

resource "aws_cloudwatch_log_group" "booking" {
  name              = "/ecs/booking-service"
  retention_in_days = 30
}

resource "aws_cloudwatch_log_group" "review" {
  name              = "/ecs/review-service"
  retention_in_days = 30
}

# ── Task Definitions ──────────────────────────────────────────────────────────
# NOTE: ECR 이미지는 CodePipeline으로 푸시한 후 ECS 서비스가 정상 기동됩니다.

resource "aws_ecs_task_definition" "auth" {
  family                   = "auth-service"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  # TODO: Secrets Manager 설정 완료 후 아래 작업 필요
  # 1. task_role_arn 주석 해제 (aws_iam_role.ecs_task 리소스 복구 필요)
  # 2. APP_MODE = "local" → "aws" 로 변경 (4개 서비스 모두)

  container_definitions = jsonencode([{
    name  = "auth-service"
    image = "${aws_ecr_repository.auth.repository_url}:latest"
    portMappings = [{ containerPort = 3001, protocol = "tcp" }]
    environment = [
      { name = "APP_MODE",        value = "local" },
      { name = "PORT",            value = "3001" },
      { name = "DB_HOST",         value = aws_db_instance.main.address },
      { name = "DB_PORT",         value = "3306" },
      { name = "DB_USER",         value = "admin" },
      { name = "DB_PASSWORD",     value = var.db_password },
      { name = "DB_NAME",         value = "auth_db" },
      { name = "JWT_SECRET",      value = var.jwt_secret },
      { name = "INTERNAL_SECRET", value = var.internal_secret },
      { name = "AWS_REGION",      value = "ap-northeast-2" }
    ]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = "/ecs/auth-service"
        "awslogs-region"        = "ap-northeast-2"
        "awslogs-stream-prefix" = "ecs"
      }
    }
  }])
}

resource "aws_ecs_task_definition" "hotel" {
  family                   = "hotel-service"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 512
  memory                   = 1024
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  # TODO: Secrets Manager 설정 완료 후 아래 작업 필요
  # 1. task_role_arn 주석 해제 (aws_iam_role.ecs_task 리소스 복구 필요)
  # 2. APP_MODE = "local" → "aws" 로 변경 (4개 서비스 모두)

  container_definitions = jsonencode([{
    name  = "hotel-service"
    image = "${aws_ecr_repository.hotel.repository_url}:latest"
    portMappings = [{ containerPort = 3002, protocol = "tcp" }]
    environment = [
      { name = "APP_MODE",            value = "local" },
      { name = "PORT",                value = "3002" },
      { name = "DB_HOST",             value = aws_db_instance.main.address },
      { name = "DB_PORT",             value = "3306" },
      { name = "DB_USER",             value = "admin" },
      { name = "DB_PASSWORD",         value = var.db_password },
      { name = "DB_NAME",             value = "hotel_db" },
      { name = "JWT_SECRET",          value = var.jwt_secret },
      { name = "INTERNAL_SECRET",     value = var.internal_secret },
      { name = "AWS_REGION",          value = "ap-northeast-2" },
      { name = "BOOKING_SERVICE_URL", value = "http://${aws_lb.internal.dns_name}" },
      { name = "REVIEW_SERVICE_URL",  value = "http://${aws_lb.internal.dns_name}" }
    ]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = "/ecs/hotel-service"
        "awslogs-region"        = "ap-northeast-2"
        "awslogs-stream-prefix" = "ecs"
      }
    }
  }])
}

resource "aws_ecs_task_definition" "booking" {
  family                   = "booking-service"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  # TODO: Secrets Manager 설정 완료 후 아래 작업 필요
  # 1. task_role_arn 주석 해제 (aws_iam_role.ecs_task 리소스 복구 필요)
  # 2. APP_MODE = "local" → "aws" 로 변경 (4개 서비스 모두)

  container_definitions = jsonencode([{
    name  = "booking-service"
    image = "${aws_ecr_repository.booking.repository_url}:latest"
    portMappings = [{ containerPort = 3003, protocol = "tcp" }]
    environment = [
      { name = "APP_MODE",          value = "local" },
      { name = "PORT",              value = "3003" },
      { name = "DB_HOST",           value = aws_db_instance.main.address },
      { name = "DB_PORT",           value = "3306" },
      { name = "DB_USER",           value = "admin" },
      { name = "DB_PASSWORD",       value = var.db_password },
      { name = "DB_NAME",           value = "booking_db" },
      { name = "JWT_SECRET",        value = var.jwt_secret },
      { name = "INTERNAL_SECRET",   value = var.internal_secret },
      { name = "AWS_REGION",        value = "ap-northeast-2" },
      { name = "HOTEL_SERVICE_URL", value = "http://${aws_lb.internal.dns_name}" }
    ]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = "/ecs/booking-service"
        "awslogs-region"        = "ap-northeast-2"
        "awslogs-stream-prefix" = "ecs"
      }
    }
  }])
}

resource "aws_ecs_task_definition" "review" {
  family                   = "review-service"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  # TODO: Secrets Manager 설정 완료 후 아래 작업 필요
  # 1. task_role_arn 주석 해제 (aws_iam_role.ecs_task 리소스 복구 필요)
  # 2. APP_MODE = "local" → "aws" 로 변경 (4개 서비스 모두)

  container_definitions = jsonencode([{
    name  = "review-service"
    image = "${aws_ecr_repository.review.repository_url}:latest"
    portMappings = [{ containerPort = 3004, protocol = "tcp" }]
    environment = [
      { name = "APP_MODE",            value = "local" },
      { name = "PORT",                value = "3004" },
      { name = "DB_HOST",             value = aws_db_instance.main.address },
      { name = "DB_PORT",             value = "3306" },
      { name = "DB_USER",             value = "admin" },
      { name = "DB_PASSWORD",         value = var.db_password },
      { name = "DB_NAME",             value = "review_db" },
      { name = "JWT_SECRET",          value = var.jwt_secret },
      { name = "INTERNAL_SECRET",     value = var.internal_secret },
      { name = "AWS_REGION",          value = "ap-northeast-2" },
      { name = "BOOKING_SERVICE_URL", value = "http://${aws_lb.internal.dns_name}" },
      { name = "HOTEL_SERVICE_URL",   value = "http://${aws_lb.internal.dns_name}" }
    ]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = "/ecs/review-service"
        "awslogs-region"        = "ap-northeast-2"
        "awslogs-stream-prefix" = "ecs"
      }
    }
  }])
}

# ── ECS Services ──────────────────────────────────────────────────────────────
resource "aws_ecs_service" "auth" {
  name            = "auth-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.auth.arn
  desired_count   = 2
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = [aws_subnet.private_backend.id, aws_subnet.private_backend_2.id]
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.auth.arn
    container_name   = "auth-service"
    container_port   = 3001
  }

  wait_for_steady_state = false
  depends_on            = [aws_lb_listener.http]
}

resource "aws_ecs_service" "hotel" {
  name            = "hotel-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.hotel.arn
  desired_count   = 2
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = [aws_subnet.private_backend.id, aws_subnet.private_backend_2.id]
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.hotel.arn
    container_name   = "hotel-service"
    container_port   = 3002
  }

  wait_for_steady_state = false
  depends_on            = [aws_lb_listener.http]
}

resource "aws_ecs_service" "booking" {
  name            = "booking-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.booking.arn
  desired_count   = 2
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = [aws_subnet.private_backend.id, aws_subnet.private_backend_2.id]
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.booking.arn
    container_name   = "booking-service"
    container_port   = 3003
  }

  wait_for_steady_state = false
  depends_on            = [aws_lb_listener.http]
}

resource "aws_ecs_service" "review" {
  name            = "review-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.review.arn
  desired_count   = 2
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = [aws_subnet.private_backend.id, aws_subnet.private_backend_2.id]
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.review.arn
    container_name   = "review-service"
    container_port   = 3004
  }

  wait_for_steady_state = false
  depends_on            = [aws_lb_listener.http]
}
