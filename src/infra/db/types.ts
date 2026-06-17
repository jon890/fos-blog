// ===== DB 관련 타입 정의 =====

export interface PostData {
  title: string;
  path: string;
  slug: string;
  category: string;
  categories?: string[];
  subcategory?: string | null;
  folders?: string[];
  content?: string | null;
  description?: string | null;
  series?: string | null;
  seriesOrder?: number | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
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

export interface SeriesInfo {
  name: string;
  postCount: number;
  latestUpdatedAt: Date | null;
  firstPost: {
    title: string;
    description: string | null;
    category: string;
    slug: string;
    path: string;
  };
}
