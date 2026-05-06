"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const createSchema = z.object({
  nickname: z.string().min(1, "닉네임을 입력하세요").max(100),
  password: z.string().min(4, "비밀번호는 4자 이상").max(255),
  content: z.string().min(1, "내용을 입력하세요").max(5000),
});
const editSchema = createSchema.pick({ password: true, content: true });

type CreateValues = z.infer<typeof createSchema>;
type EditValues = z.infer<typeof editSchema>;
export type CommentFormValues = CreateValues | EditValues;

export type CommentFormProps =
  | {
      mode: "create";
      onSubmit: (values: CreateValues) => Promise<void>;
      onCancel?: () => void;
    }
  | {
      mode: "edit";
      initialContent: string;
      initialNickname: string;
      onSubmit: (values: EditValues) => Promise<void>;
      onCancel?: () => void;
    };

export function CommentForm(props: CommentFormProps) {
  const isEdit = props.mode === "edit";

  const form = useForm<CreateValues | EditValues>({
    resolver: zodResolver(isEdit ? editSchema : createSchema),
    defaultValues: isEdit
      ? { password: "", content: props.initialContent }
      : { nickname: "", password: "", content: "" },
  });

  const isSubmitting = form.formState.isSubmitting;

  const handleSubmit = form.handleSubmit(async (values) => {
    if (props.mode === "edit") {
      await props.onSubmit(values as EditValues);
    } else {
      await props.onSubmit(values as CreateValues);
      form.reset();
    }
  });

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {isEdit ? (
          <p className="text-sm text-[var(--color-fg-muted)]">
            수정 중: <span className="font-medium text-[var(--color-fg-primary)]">{props.initialNickname}</span>
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="nickname"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>닉네임</FormLabel>
                  <FormControl>
                    <Input placeholder="닉네임" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>비밀번호</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="비밀번호 (4자 이상)" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

        {isEdit && (
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>비밀번호 확인</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="비밀번호" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormLabel>내용</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="댓글을 작성해주세요..."
                  rows={4}
                  className="resize-none"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          {props.onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={props.onCancel}
              disabled={isSubmitting}
            >
              취소
            </Button>
          )}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            {isEdit ? "수정" : "댓글 작성"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
