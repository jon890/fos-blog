import type { ImportDryRunRequest } from "@/lib/study/contracts";

export const careerOsPlan115UrlIdentity = {
  inputs: [
    "https://youtu.be/dQw4w9WgXcQ?t=42",
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  ],
  canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  contentKey: "youtube:dQw4w9WgXcQ",
} as const;

export const careerOsPlan115LegacyHistory = {
  reports: [{
    reportId: "career-os-plan115-history",
    recommendedAt: "2025-01-15T00:00:00.000Z",
    entries: [{
      studyTopicKey: "backend-video",
      studyTopic: "백엔드 학습 영상",
      sourceKey: "career-os-plan115-youtube",
      title: "기존 추천 영상",
      url: careerOsPlan115UrlIdentity.inputs[0],
    }],
  }],
} as const;

export const careerOsPlan115Import: ImportDryRunRequest = {
  importKey: "career-os-plan115-import",
  reports: [{
    reportId: careerOsPlan115LegacyHistory.reports[0].reportId,
    generatedAt: careerOsPlan115LegacyHistory.reports[0].recommendedAt,
    topics: [{
      topicKey: careerOsPlan115LegacyHistory.reports[0].entries[0].studyTopicKey,
      title: careerOsPlan115LegacyHistory.reports[0].entries[0].studyTopic,
      careerQuestion: null,
      items: [{
        contentKey: careerOsPlan115UrlIdentity.contentKey,
        canonicalUrl: careerOsPlan115UrlIdentity.canonicalUrl,
        sourceKey: careerOsPlan115LegacyHistory.reports[0].entries[0].sourceKey,
        title: careerOsPlan115LegacyHistory.reports[0].entries[0].title,
        category: "video",
        summary: null,
        reason: null,
        careerValue: null,
      }],
    }],
  }],
};
