resource "aws_ecr_repository" "auth" {
  name                 = "auth-service"
  image_tag_mutability = "MUTABLE"
  force_delete         = true
  image_scanning_configuration { scan_on_push = true }
  tags = { Name = "auth-service" }
}

resource "aws_ecr_repository" "hotel" {
  name                 = "hotel-service"
  image_tag_mutability = "MUTABLE"
  force_delete         = true
  image_scanning_configuration { scan_on_push = true }
  tags = { Name = "hotel-service" }
}

resource "aws_ecr_repository" "booking" {
  name                 = "booking-service"
  image_tag_mutability = "MUTABLE"
  force_delete         = true
  image_scanning_configuration { scan_on_push = true }
  tags = { Name = "booking-service" }
}

resource "aws_ecr_repository" "review" {
  name                 = "review-service"
  image_tag_mutability = "MUTABLE"
  force_delete         = true
  image_scanning_configuration { scan_on_push = true }
  tags = { Name = "review-service" }
}
