-- 초기 데이터베이스 설정
-- Docker Compose가 실행될 때 자동으로 실행됩니다.

-- 문자셋 설정 확인
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- 타임존 설정 (한국 시간)
SET time_zone = '+09:00';

-- 데이터베이스가 이미 생성되어 있으므로 사용만 합니다
USE fos_blog;

-- fos_user에게 fos_blog 데이터베이스에 대한 모든 권한 부여
GRANT ALL PRIVILEGES ON fos_blog.* TO 'fos_user'@'%';
FLUSH PRIVILEGES;
