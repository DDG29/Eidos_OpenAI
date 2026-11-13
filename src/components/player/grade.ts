"use client";

import { postJSON } from "@/lib/sse/client";
import type { GradeRequest, GradeResult } from "@/lib/api/schemas";
import type { Beat, Level, World } from "@/lib/world/types";

/** Free-text answers go to the Evaluator (spec 9.8). */
export function gradeAnswer(world: World, beat: Beat, answer: string, level: Level): Promise<GradeResult> {
  const req: GradeRequest = {
    question: beat.check.question,
    idealAnswer: beat.check.idealAnswer,
    answer,
    misconceptions: world.misconceptions,
    facts: world.facts.map((f) => ({ id: f.id, text: f.text })),
    level,
    lang: world.spec.language,
  };
  return postJSON<GradeResult>("/api/grade", req);
}
