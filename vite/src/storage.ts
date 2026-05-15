import type { AnswerLabel, EvaluationRecord, ModelId, ParticipantStatus } from "./types";

const RECORDS_KEY = "finance-blind-eval:records";
const PARTICIPANTS_KEY = "finance-blind-eval:participants";

function readJson<T>(key: string, fallback: T): T {
  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function getEvaluationRecords(): EvaluationRecord[] {
  return readJson<EvaluationRecord[]>(RECORDS_KEY, []);
}

export function saveEvaluationRecord(record: EvaluationRecord): void {
  const existing = getEvaluationRecords().filter((item) => item.id !== record.id);
  writeJson(RECORDS_KEY, [...existing, record]);
}

export function getParticipantStatuses(): ParticipantStatus[] {
  return readJson<ParticipantStatus[]>(PARTICIPANTS_KEY, []);
}

export function upsertParticipantStatus(status: ParticipantStatus): void {
  const existing = getParticipantStatuses().filter((item) => item.token !== status.token);
  writeJson(PARTICIPANTS_KEY, [...existing, status]);
}

export function clearAllEvaluationData(): void {
  window.localStorage.removeItem(RECORDS_KEY);
  window.localStorage.removeItem(PARTICIPANTS_KEY);
}

export function buildExportJson(): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      participants: getParticipantStatuses(),
      records: getEvaluationRecords(),
    },
    null,
    2,
  );
}

function csvEscape(value: unknown): string {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function buildExportCsv(): string {
  const rows = getEvaluationRecords().map((record) => ({
    participant_token: record.participantToken,
    is_business_or_finance: record.participantProfile.isBusinessOrFinance,
    grade_or_occupation: record.participantProfile.gradeOrOccupation,
    has_taken_finance_course: record.participantProfile.hasTakenFinanceCourse,
    finance_familiarity: record.participantProfile.financeFamiliarity,
    llm_experience: record.participantProfile.llmExperience,
    question_index: record.questionIndex,
    prompt_category: record.promptCategory,
    user_question: record.userQuestion,
    answer_a: record.answers.A,
    answer_b: record.answers.B,
    answer_c: record.answers.C,
    hidden_mapping_a: record.hiddenModelMapping.A,
    hidden_mapping_b: record.hiddenModelMapping.B,
    hidden_mapping_c: record.hiddenModelMapping.C,
    selected_best: record.selectedBest,
    selected_best_model: record.hiddenModelMapping[record.selectedBest],
    selected_worst: record.selectedWorst,
    selected_worst_model: record.hiddenModelMapping[record.selectedWorst],
    best_reason: record.bestReason,
    worst_reason: record.worstReason,
    quality_flags: record.qualityFlags.join("|"),
    rating_correctness: record.qualityRatings.correctness,
    rating_completeness: record.qualityRatings.completeness,
    rating_professionalism: record.qualityRatings.professionalism,
    rating_readability: record.qualityRatings.readability,
    timestamp: record.timestamp,
    response_latency_ms: record.responseLatencyMs,
    completion_status: record.completionStatus,
  }));

  const headers = Object.keys(rows[0] ?? {
    participant_token: "",
    prompt_category: "",
    user_question: "",
  });

  return [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((header) => csvEscape(row[header as keyof typeof row])).join(","),
    ),
  ].join("\n");
}

export function countModelSelections(records: EvaluationRecord[]): Record<ModelId, { best: number; worst: number }> {
  const counts: Record<ModelId, { best: number; worst: number }> = {
    "H1-best": { best: 0, worst: 0 },
    "H2-best": { best: 0, worst: 0 },
    "TAIDE-baseline": { best: 0, worst: 0 },
  };

  records.forEach((record) => {
    const bestModel = record.hiddenModelMapping[record.selectedBest];
    const worstModel = record.hiddenModelMapping[record.selectedWorst];
    counts[bestModel].best += 1;
    counts[worstModel].worst += 1;
  });

  return counts;
}

export function labelsFromMapping(mapping: Record<AnswerLabel, ModelId>): string {
  return `A=${mapping.A}, B=${mapping.B}, C=${mapping.C}`;
}
