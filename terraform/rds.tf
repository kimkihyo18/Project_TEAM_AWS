resource "aws_security_group" "rds" {
  name        = "ThreeTier-RDS-SG"
  description = "RDS MySQL Security Group"
  vpc_id      = aws_vpc.main.id
  tags        = { Name = "ThreeTier-RDS-SG" }

  # 10.1.3.0/24: MySQL EC2(온프레미스 DB)에서 RDS 접근 허용 — DMS 마이그레이션 완료 후 제거
  ingress {
    description = "MySQL from backend subnets and on-premises DB subnet"
    from_port   = 3306
    to_port     = 3306
    protocol    = "tcp"
    cidr_blocks = ["10.1.2.0/24", "10.1.5.0/24", "10.1.3.0/24"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_db_subnet_group" "main" {
  name       = "threetier-db-subnet-group"
  subnet_ids = [aws_subnet.private_db.id, aws_subnet.private_db_2.id]
  tags       = { Name = "ThreeTier-DB-Subnet-Group" }
}

resource "aws_db_instance" "main" {
  identifier        = "threetier-mysql"
  engine            = "mysql"
  engine_version    = "8.0"
  instance_class    = "db.t3.micro"
  allocated_storage = 20
  storage_type      = "gp2"

  username = "admin"
  password = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  multi_az            = false
  publicly_accessible = false
  skip_final_snapshot = true

  tags = { Name = "ThreeTier-MySQL-RDS" }
}
