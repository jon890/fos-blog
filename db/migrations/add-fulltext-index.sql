-- FULLTEXT 인덱스 추가 (검색 성능 향상)
-- MySQL 5.6+ / MySQL 8.0 InnoDB에서 지원

-- 기존 FULLTEXT 인덱스가 있으면 삭제
DROP INDEX IF EXISTS ft_search_idx ON posts;

-- title, content, description에 FULLTEXT 인덱스 생성
ALTER TABLE posts ADD FULLTEXT INDEX ft_search_idx (title, content, description);

-- 인덱스 확인
SHOW INDEX FROM posts WHERE Index_type = 'FULLTEXT';
