import { eq, desc } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { comments } from "../schema";
import { BaseRepository } from "./BaseRepository";

export interface CommentData {
  id: number;
  postSlug: string;
  nickname: string;
  content: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface CreateCommentInput {
  postSlug: string;
  nickname: string;
  password: string;
  content: string;
}

export class CommentRepository extends BaseRepository {
  private readonly SALT_ROUNDS = 10;

  async getCommentsByPostSlug(postSlug: string): Promise<CommentData[]> {
    const result = await this.db
      .select({
        id: comments.id,
        postSlug: comments.postSlug,
        nickname: comments.nickname,
        content: comments.content,
        createdAt: comments.createdAt,
        updatedAt: comments.updatedAt,
      })
      .from(comments)
      .where(eq(comments.postSlug, postSlug))
      .orderBy(desc(comments.createdAt));

    return result;
  }

  async createComment(input: CreateCommentInput): Promise<CommentData> {
    const hashedPassword = await bcrypt.hash(input.password, this.SALT_ROUNDS);

    const result = await this.db.insert(comments).values({
      postSlug: input.postSlug,
      nickname: input.nickname,
      password: hashedPassword,
      content: input.content,
    });

    const insertId = result[0].insertId;

    const created = await this.db
      .select({
        id: comments.id,
        postSlug: comments.postSlug,
        nickname: comments.nickname,
        content: comments.content,
        createdAt: comments.createdAt,
        updatedAt: comments.updatedAt,
      })
      .from(comments)
      .where(eq(comments.id, insertId))
      .limit(1);

    return created[0];
  }

  async updateComment(
    id: number,
    password: string,
    content: string
  ): Promise<CommentData | null> {
    const comment = await this.db
      .select()
      .from(comments)
      .where(eq(comments.id, id))
      .limit(1);

    if (!comment[0]) {
      return null;
    }

    const isValidPassword = await bcrypt.compare(password, comment[0].password);
    if (!isValidPassword) {
      throw new Error("비밀번호가 일치하지 않습니다.");
    }

    await this.db.update(comments).set({ content }).where(eq(comments.id, id));

    const updated = await this.db
      .select({
        id: comments.id,
        postSlug: comments.postSlug,
        nickname: comments.nickname,
        content: comments.content,
        createdAt: comments.createdAt,
        updatedAt: comments.updatedAt,
      })
      .from(comments)
      .where(eq(comments.id, id))
      .limit(1);

    return updated[0];
  }

  async deleteComment(id: number, password: string): Promise<boolean> {
    const comment = await this.db
      .select()
      .from(comments)
      .where(eq(comments.id, id))
      .limit(1);

    if (!comment[0]) {
      return false;
    }

    const isValidPassword = await bcrypt.compare(password, comment[0].password);
    if (!isValidPassword) {
      throw new Error("비밀번호가 일치하지 않습니다.");
    }

    await this.db.delete(comments).where(eq(comments.id, id));
    return true;
  }

  async getCommentCount(postSlug: string): Promise<number> {
    const result = await this.db
      .select({ id: comments.id })
      .from(comments)
      .where(eq(comments.postSlug, postSlug));

    return result.length;
  }
}
