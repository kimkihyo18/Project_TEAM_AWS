# ── VPC ────────────────────────────────────────────────────────────────────
resource "aws_vpc" "main" {
  cidr_block           = "10.1.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags                 = { Name = "ThreeTier-VPC" }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "ThreeTier-IGW" }
}

# ── 서브넷 ──────────────────────────────────────────────────────────────────
# 퍼블릭: Frontend EC2(10.1.1.10), NAT Instance(10.1.1.100)
resource "aws_subnet" "public" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.1.1.0/24"
  availability_zone = data.aws_availability_zones.available.names[0]
  tags              = { Name = "ThreeTier-PublicSN" }
}

# 프라이빗 백엔드: Auth(10.1.2.10) / Hotel(10.1.2.20) / Booking(10.1.2.30) / Review(10.1.2.40)
resource "aws_subnet" "private_backend" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.1.2.0/24"
  availability_zone = data.aws_availability_zones.available.names[0]
  tags              = { Name = "ThreeTier-PrivateBackendSN" }
}

# 프라이빗 DB: MySQL EC2(10.1.3.10)
resource "aws_subnet" "private_db" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.1.3.0/24"
  availability_zone = data.aws_availability_zones.available.names[0]
  tags              = { Name = "ThreeTier-PrivateDBSN" }
}

# ── 라우팅 테이블 ────────────────────────────────────────────────────────────
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "ThreeTier-PublicRT" }
}

resource "aws_route" "public_default" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.main.id
}

resource "aws_route_table" "private_backend" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "ThreeTier-PrivateBackendRT" }
}

# 백엔드 → NAT Instance (git clone, Docker pull 등 외부 통신)
resource "aws_route" "private_backend_nat" {
  route_table_id         = aws_route_table.private_backend.id
  destination_cidr_block = "0.0.0.0/0"
  network_interface_id   = aws_instance.nat.primary_network_interface_id
  depends_on             = [aws_instance.nat]
}

resource "aws_route_table" "private_db" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "ThreeTier-PrivateDBRT" }
}

# DB → NAT Instance (mysql_install.sh, run-seed.sh 등 외부 통신)
resource "aws_route" "private_db_nat" {
  route_table_id         = aws_route_table.private_db.id
  destination_cidr_block = "0.0.0.0/0"
  network_interface_id   = aws_instance.nat.primary_network_interface_id
  depends_on             = [aws_instance.nat]
}

# ── 서브넷 - RT 연결 ──────────────────────────────────────────────────────────
resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "private_backend" {
  subnet_id      = aws_subnet.private_backend.id
  route_table_id = aws_route_table.private_backend.id
}

resource "aws_route_table_association" "private_db" {
  subnet_id      = aws_subnet.private_db.id
  route_table_id = aws_route_table.private_db.id
}

# ── 2번째 AZ 서브넷 (ALB 2 AZ 필수, RDS 서브넷 그룹 2 AZ 필수) ────────────────
resource "aws_subnet" "public_2" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.1.4.0/24"
  availability_zone = data.aws_availability_zones.available.names[1]
  tags              = { Name = "ThreeTier-PublicSN-2" }
}

resource "aws_subnet" "private_backend_2" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.1.5.0/24"
  availability_zone = data.aws_availability_zones.available.names[1]
  tags              = { Name = "ThreeTier-PrivateBackendSN-2" }
}

resource "aws_subnet" "private_db_2" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.1.6.0/24"
  availability_zone = data.aws_availability_zones.available.names[1]
  tags              = { Name = "ThreeTier-PrivateDBSN-2" }
}

resource "aws_route_table_association" "public_2" {
  subnet_id      = aws_subnet.public_2.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "private_backend_2" {
  subnet_id      = aws_subnet.private_backend_2.id
  route_table_id = aws_route_table.private_backend.id
}

resource "aws_route_table_association" "private_db_2" {
  subnet_id      = aws_subnet.private_db_2.id
  route_table_id = aws_route_table.private_db.id
}
