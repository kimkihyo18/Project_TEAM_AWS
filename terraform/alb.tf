resource "aws_security_group" "alb" {
  name        = "ThreeTier-ALB-SG"
  description = "Internal ALB Security Group"
  vpc_id      = aws_vpc.main.id
  tags        = { Name = "ThreeTier-ALB-SG" }

  ingress {
    description = "HTTP from VPC (API Gateway VPC Link)"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["10.1.0.0/16"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ── Internal ALB ─────────────────────────────────────────────────────────────
resource "aws_lb" "internal" {
  name               = "ThreeTier-ALB-Internal"
  internal           = true
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = [aws_subnet.private_backend.id, aws_subnet.private_backend_2.id]
  tags               = { Name = "ThreeTier-ALB-Internal" }
}

# ── Target Groups (Fargate awsvpc → target_type = ip) ────────────────────────
resource "aws_lb_target_group" "auth" {
  name        = "ThreeTier-Auth-TG"
  port        = 3001
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"
  health_check {
    path                = "/health"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    interval            = 30
  }
  tags = { Name = "ThreeTier-Auth-TG" }
}

resource "aws_lb_target_group" "hotel" {
  name        = "ThreeTier-Hotel-TG"
  port        = 3002
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"
  health_check {
    path                = "/health"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    interval            = 30
  }
  tags = { Name = "ThreeTier-Hotel-TG" }
}

resource "aws_lb_target_group" "booking" {
  name        = "ThreeTier-Booking-TG"
  port        = 3003
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"
  health_check {
    path                = "/health"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    interval            = 30
  }
  tags = { Name = "ThreeTier-Booking-TG" }
}

resource "aws_lb_target_group" "review" {
  name        = "ThreeTier-Review-TG"
  port        = 3004
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"
  health_check {
    path                = "/health"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    interval            = 30
  }
  tags = { Name = "ThreeTier-Review-TG" }
}

# ── Listener + Path-based Routing ────────────────────────────────────────────
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.internal.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "fixed-response"
    fixed_response {
      content_type = "text/plain"
      message_body = "Not Found"
      status_code  = "404"
    }
  }
}

resource "aws_lb_listener_rule" "auth" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 10
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.auth.arn
  }
  condition {
    path_pattern { values = ["/auth/*"] }
  }
}

resource "aws_lb_listener_rule" "hotel" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 20
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.hotel.arn
  }
  condition {
    path_pattern { values = ["/hotels/*"] }
  }
}

resource "aws_lb_listener_rule" "booking" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 30
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.booking.arn
  }
  condition {
    path_pattern { values = ["/bookings/*"] }
  }
}

resource "aws_lb_listener_rule" "review" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 40
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.review.arn
  }
  condition {
    path_pattern { values = ["/reviews/*"] }
  }
}
