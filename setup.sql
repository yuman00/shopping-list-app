-- shopping_items 테이블 생성
CREATE TABLE shopping_items (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  text TEXT NOT NULL,
  checked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security 활성화
ALTER TABLE shopping_items ENABLE ROW LEVEL SECURITY;

-- 공개 쇼핑 리스트: 모든 사용자 읽기/쓰기 허용
CREATE POLICY "Allow public access" ON shopping_items
  FOR ALL
  USING (true)
  WITH CHECK (true);
