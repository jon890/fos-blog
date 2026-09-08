import { describe, expect, it } from "vitest";
import {
  canonicalizeStudyUrl,
  isYouTubeStudyUrl,
  studyContentKey,
} from "./url-identity";

describe("학습자료 URL 식별", () => {
  it("YouTube URL 형식이 달라도 video ID의 대소문자를 보존한 같은 키를 만든다", () => {
    const variants = [
      "https://youtu.be/AbC123?si=tracking",
      "https://www.youtube.com/watch?v=AbC123&utm_source=test",
      "https://m.youtube.com/shorts/AbC123#comments",
      "https://youtube.com/live/AbC123?feature=share",
      "https://www.youtube.com/embed/AbC123",
    ];

    for (const value of variants) {
      expect(canonicalizeStudyUrl(value)).toBe("https://www.youtube.com/watch?v=AbC123");
      expect(studyContentKey(value)).toBe("youtube:AbC123");
      expect(isYouTubeStudyUrl(value)).toBe(true);
    }
    expect(studyContentKey("https://youtu.be/abc123")).toBe("youtube:abc123");
    expect(studyContentKey("https://youtu.be/AbC123")).not.toBe(
      studyContentKey("https://youtu.be/abc123"),
    );
  });

  it("일반 URL의 추적 query와 fragment를 제거하고 query를 정렬한다", () => {
    expect(
      canonicalizeStudyUrl(
        "https://example.com/Post/?z=last&UTM_Source=newsletter&a=first&fbclid=x#section",
      ),
    ).toBe("https://example.com/Post?a=first&z=last");
  });

  it("일반 URL의 의미 있는 query, www와 경로 대소문자는 구분한다", () => {
    const plain = studyContentKey("https://example.com/Post?lang=ko");

    expect(plain).not.toBe(studyContentKey("https://www.example.com/Post?lang=ko"));
    expect(plain).not.toBe(studyContentKey("https://example.com/post?lang=ko"));
    expect(plain).not.toBe(studyContentKey("https://example.com/Post?lang=en"));
  });

  it("루트 외 trailing slash만 제거하고 루트 URL은 유지한다", () => {
    expect(canonicalizeStudyUrl("https://example.com/path///")).toBe(
      "https://example.com/path",
    );
    expect(canonicalizeStudyUrl("https://example.com/")).toBe("https://example.com/");
  });

  it.each(["http://example.com/post", "ftp://example.com/post", "not-a-url"])(
    "HTTPS가 아닌 URL을 거절한다: %s",
    (value) => {
      expect(() => studyContentKey(value)).toThrow();
    },
  );
});
