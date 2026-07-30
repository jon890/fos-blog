# 디자인 방향 참고

이 문서는 fos-blog의 현재 시각 방향과 판단 근거를 정리한다.
실제 토큰과 구현의 단일 소스는 `src/app/globals.css`와 관련 컴포넌트다.
디자인 결정의 이유는 [ADR-017](./adr/017-design-system.md)에 기록한다.

## 시각 방향

- Vercel과 Linear처럼 정보 밀도가 높은 개발 도구형 화면을 기본으로 한다.
- 검정과 흰색, 얇은 테두리, 작은 모서리 반경으로 구조를 드러낸다.
- 시안 계열 강조색은 링크, 선택 상태, 주요 동작에 제한해서 사용한다.
- Stripe에서 참고한 그라디언트 mesh는 홈의 강조 영역에만 사용한다.
- 장식보다 제목, 본문, 메타데이터의 위계를 우선한다.

## 글꼴

| 영역 | 현재 방식 |
| --- | --- |
| 영문 UI와 본문 | `geist` 패키지의 Geist Sans |
| 코드와 고정폭 UI | `geist` 패키지의 Geist Mono |
| 한글 | `pretendard` 패키지의 CSS |
| Open Graph 이미지 | 저장소의 Pretendard 굵은 글꼴 부분집합 |

웹 화면은 `src/app/globals.css`에서 Pretendard CSS를 불러온다.
`src/app/layout.tsx`는 Geist Sans와 Geist Mono 변수를 `<body>`에 적용한다.

외부 글꼴 CDN을 사용하지 않는다.
빌드와 운영 환경에서 동일한 파일을 사용해 화면 재현성을 유지하기 위해서다.

## 색상과 형태

- 색상과 글꼴 토큰은 `src/app/globals.css`의 `@theme`과 `:root`에서 관리한다.
- 카테고리 색상은 `src/lib/category-meta.ts`의 안정적인 매핑과 대체 색상 계산을 사용한다.
- 카드와 입력 요소는 테두리로 경계를 표현하고 큰 그림자는 피한다.
- 다크 모드를 기본으로 하되 라이트 모드에서도 같은 정보 위계를 유지한다.

## 동작 효과

- 현재 별도 동작 효과 라이브러리를 사용하지 않는다.
- hover, focus, 색상 변화와 mesh 효과는 CSS 전환과 keyframe으로 구현한다.
- `prefers-reduced-motion` 환경에서는 반복 동작을 줄이거나 제거한다.
- 동작 효과는 정보 탐색을 돕는 경우에만 사용하고 콘텐츠 읽기를 방해하지 않아야 한다.

## 주요 화면 적용

| 영역 | 적용 원칙 |
| --- | --- |
| 홈 | 큰 제목과 제한된 mesh로 브랜드 진입점을 만든다. |
| 글 목록 | 제목과 설명을 우선하고 카테고리와 날짜는 보조 정보로 둔다. |
| 글 상세 | 본문 폭과 줄 길이를 우선하고 목차와 읽기 진행률은 탐색을 보조한다. |
| 코드 블록 | Shiki 이중 테마를 유지하고 파일명, 복사, 줄 강조를 본문과 분리한다. |
| 검색과 댓글 | 기존 UI 컴포넌트의 포커스, 오류, 로딩 상태를 일관되게 사용한다. |

## 접근성과 반응형

- 키보드 포커스는 `focus-visible` 상태로 확인할 수 있어야 한다.
- 텍스트와 배경은 WCAG AA 수준의 대비를 목표로 한다.
- 모바일에서는 부가 탐색을 접거나 별도 버튼으로 옮기고 본문을 우선한다.
- 색상만으로 선택, 오류, 카테고리를 구분하지 않는다.

## 참고 출처

- Vercel과 Next.js: 절제된 정보 화면과 타이포그래피
- Stripe: 제한된 영역의 그라디언트 mesh
- Linear: 얇은 경계와 미세한 상호작용
- shadcn/ui: 소스 소유 방식의 UI 구성

## 관련 파일

- `src/app/globals.css`
- `src/app/layout.tsx`
- `src/components/HomeHero.tsx`
- `src/components/PostCard.tsx`
- `src/components/ArticleHero.tsx`
- `src/components/CodeCard.tsx`
- `src/lib/category-meta.ts`
