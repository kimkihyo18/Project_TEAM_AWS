locals {
  ami_id = data.aws_ssm_parameter.al2023_ami.value
}

# ── NAT Instance EIP ─────────────────────────────────────────────────────────
resource "aws_eip" "nat" {
  domain     = "vpc"
  depends_on = [aws_internet_gateway.main]
}

resource "aws_eip_association" "nat" {
  instance_id   = aws_instance.nat.id
  allocation_id = aws_eip.nat.id
}

# ── NAT Instance ─────────────────────────────────────────────────────────────
# Private IP: 10.1.1.100 | source_dest_check=false | iptables MASQUERADE
# ECS Fargate 프라이빗 서브넷 인터넷 출구 — 추후 VPC Endpoint로 교체 예정
resource "aws_instance" "nat" {
  ami                    = local.ami_id
  instance_type          = "t3.micro"
  key_name               = var.key_name
  iam_instance_profile   = aws_iam_instance_profile.ssm.name
  subnet_id              = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.nat_instance.id]
  private_ip             = "10.1.1.100"
  source_dest_check      = false

  tags = { Name = "ThreeTier-NATInstance" }

  user_data = <<-EOF
#!/bin/bash
hostnamectl --static set-hostname ThreeTier-NATInstance
cat <<EOT > /etc/profile.d/prompt.sh
export PS1="[\[\e[1;31m\]\u\[\e[m\]@\[\e[1;32m\]\h\[\e[m\]: \[\e[1;36m\]\w\[\e[m\]]#"
EOT
source /etc/profile
set -euxo pipefail
IFACE="$(ip route show default | awk '/default/ {print $5; exit}')"
dnf install -y iptables-services
systemctl enable --now iptables
cat > /etc/sysctl.d/90-nat.conf << 'SYSEOF'
net.ipv4.ip_forward=1
SYSEOF
sysctl --system
/sbin/iptables -t nat -F
/sbin/iptables -F FORWARD
/sbin/iptables -P FORWARD ACCEPT
/sbin/iptables -t nat -A POSTROUTING -o "$IFACE" -j MASQUERADE
service iptables save
EOF
}

# ── MySQL EC2 ─────────────────────────────────────────────────────────────────
# Private IP: 10.1.3.10 | DMS 소스 — DMS 마이그레이션 완료 후 제거 예정
resource "aws_instance" "mysql" {
  ami                    = local.ami_id
  instance_type          = "t3.micro"
  key_name               = var.key_name
  iam_instance_profile   = aws_iam_instance_profile.ssm.name
  subnet_id              = aws_subnet.private_db.id
  vpc_security_group_ids = [aws_security_group.mysql.id]
  private_ip             = "10.1.3.10"
  depends_on             = [aws_route.private_db_nat]

  tags = { Name = "ThreeTier-MySQL-EC2" }

  user_data = <<-EOF
#!/bin/bash
hostnamectl --static set-hostname ThreeTier-MySQL-EC2
cat <<EOT > /etc/profile.d/prompt.sh
export PS1="[\[\e[1;31m\]\u\[\e[m\]@\[\e[1;32m\]\h\[\e[m\]: \[\e[1;36m\]\w\[\e[m\]]#"
EOT
source /etc/profile
set -euxo pipefail
dnf install -y git
git clone --filter=blob:none --sparse ${var.github_repo_url} /opt/app
cd /opt/app
git sparse-checkout set database
sudo bash database/scripts/mysql_install.sh
bash database/scripts/run-seed.sh
EOF
}
