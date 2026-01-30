// ===== DB 관련 타입 정의 =====

export interface PostData {
  title: string;
  path: string;
  slug: string;
  category: string;
  subcategory?: string | null;
  folders?: string[];
  content?: string | null;
  description?: string | null;
}

export interface FolderItemData {
  name: string;
  type: "folder" | "file";
  path: string;
  count?: number;
}

export interface CategoryData {
  name: string;
  slug: string;
  icon: string | null;
  count: number;
}

export interface FolderContentsResult {
  folders: FolderItemData[];
  posts: PostData[];
  readme: string | null;
}
