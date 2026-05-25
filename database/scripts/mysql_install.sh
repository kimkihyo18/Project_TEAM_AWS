#!/bin/bash
set -euxo pipefail

rpm --import https://repo.mysql.com/RPM-GPG-KEY-mysql-2023
rpm --import https://repo.mysql.com/RPM-GPG-KEY-mysql-2022
rm -f /etc/yum.repos.d/mysql*
dnf install -y https://dev.mysql.com/get/mysql80-community-release-el9-1.noarch.rpm
dnf install -y mysql-community-server
cat <<EOT > /etc/my.cnf
[mysqld]
datadir=/var/lib/mysql
socket=/var/lib/mysql/mysql.sock

log-error=/var/log/mysqld.log
pid-file=/var/run/mysqld/mysqld.pid

collation-server=utf8mb4_general_ci
character-set-server=utf8mb4
default_authentication_plugin=mysql_native_password

[client]
default-character-set=utf8mb4

[mysql]
default-character-set=utf8mb4
EOT
systemctl enable --now mysqld
chgrp ec2-user /var/log/mysqld.log
TEMP_PW=$(grep 'temporary password' /var/log/mysqld.log | awk '{print $NF}')
mysql --connect-expired-password -u root -p$TEMP_PW <<EOT
CREATE USER 'root'@'%' IDENTIFIED BY 'P@ssw0rd';
DELETE FROM mysql.user WHERE User='';
DROP DATABASE IF EXISTS test;
DELETE FROM mysql.db WHERE Db='test' OR Db='test\\_%';
FLUSH PRIVILEGES;
EOT
mysql -u root -p'P@ssw0rd' <<EOT
CREATE USER user1@'%' IDENTIFIED BY 'P@ssw0rd';
GRANT ALL PRIVILEGES ON *.* TO user1@'%' WITH grant option;
FLUSH PRIVILEGES;
EOT
