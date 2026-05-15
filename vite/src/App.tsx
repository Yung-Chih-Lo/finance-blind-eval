import { useMemo, useState } from "react";
import { requestBlindAnswers } from "./modelAdapter";
import {
  PROMPT_CATEGORIES,
  QUALITY_FLAGS,
  SEEDED_PARTICIPANTS,
} from "./researchConfig";
import {
  buildExportCsv,
  buildExportJson,
  clearAllEvaluationData,
  countModelSelections,
  getEvaluationRecords,
  getParticipantStatuses,
  labelsFromMapping,
  saveEvaluationRecord,
  upsertParticipantStatus,
} from "./storage";
import type {
  AnswerLabel,
  EvaluationRecord,
  ModelAnswer,
  ParticipantProfile,
  QualityRatings,
} from "./types";

const INITIAL_RATINGS: QualityRatings = {
  correctness: 3,
  completeness: 3,
  professionalism: 3,
  readability: 3,
};

type ParticipantStep = "entry" | "profile" | "question" | "done";

function normalizeToken(value: string): string {
  return value.trim().toUpperCase();
}

function currentTokenFromUrl(): string {
  return normalizeToken(new URLSearchParams(window.location.search).get("token") ?? "");
}

function downloadFile(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function ScaleInput(props: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="scale-row">
      <span>{props.label}</span>
      <div className="scale-options" role="group" aria-label={props.label}>
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            className={value === props.value ? "scale-button is-active" : "scale-button"}
            key={value}
            type="button"
            onClick={() => props.onChange(value)}
          >
            {value}
          </button>
        ))}
      </div>
    </div>
  );
}

function TokenEntry(props: { initialToken: string; onStart: (token: string) => void }) {
  const [token, setToken] = useState(props.initialToken);
  const [error, setError] = useState("");

  return (
    <main className="page-shell centered-page">
      <section className="entry-panel">
        <p className="eyebrow">Blind Model Evaluation</p>
        <h1>金融專業回答盲測</h1>
        <p className="lede">
          請使用邀請連結或受測者 token 進入。問卷只會顯示回答 A / B / C，不會揭露模型名稱。
        </p>
        <form
          className="token-form"
          onSubmit={(event) => {
            event.preventDefault();
            const normalized = normalizeToken(token);
            if (!normalized) {
              setError("請輸入受測者 token。");
              return;
            }
            props.onStart(normalized);
          }}
        >
          <label htmlFor="participant-token">受測者 token *</label>
          <div className="inline-control">
            <input
              id="participant-token"
              value={token}
              placeholder="A013"
              onBlur={() => setToken(normalizeToken(token))}
              onChange={(event) => {
                setToken(event.target.value);
                setError("");
              }}
            />
            <button type="submit">進入問卷</button>
          </div>
          {error ? <p className="field-error">{error}</p> : null}
        </form>
        <a className="admin-link" href="/admin">研究後台</a>
      </section>
    </main>
  );
}

function ProfileForm(props: { token: string; onSubmit: (profile: ParticipantProfile) => void }) {
  const seeded = SEEDED_PARTICIPANTS[props.token];
  const [profile, setProfile] = useState<ParticipantProfile>({
    token: props.token,
    knownName: seeded?.name,
    isBusinessOrFinance: "unsure",
    gradeOrOccupation: "",
    hasTakenFinanceCourse: "no",
    financeFamiliarity: 3,
    llmExperience: "rare",
    notes: "",
  });
  const [error, setError] = useState("");

  return (
    <main className="page-shell">
      <header className="study-header">
        <div>
          <p className="eyebrow">Participant {props.token}</p>
          <h1>基本背景資料</h1>
        </div>
        <div className="progress-pill">Step 1 / 6</div>
      </header>

      <form
        className="form-panel"
        onSubmit={(event) => {
          event.preventDefault();
          if (!profile.gradeOrOccupation.trim()) {
            setError("請填寫年級或職業。");
            return;
          }
          props.onSubmit(profile);
        }}
      >
        <fieldset>
          <legend>背景分類</legend>
          <label>
            是否商學院 / 金融相關背景 *
            <select
              value={profile.isBusinessOrFinance}
              onChange={(event) =>
                setProfile({ ...profile, isBusinessOrFinance: event.target.value as ParticipantProfile["isBusinessOrFinance"] })
              }
            >
              <option value="unsure">不確定 / 跨領域</option>
              <option value="yes">是</option>
              <option value="no">否</option>
            </select>
          </label>
          <label>
            年級或職業 *
            <input
              value={profile.gradeOrOccupation}
              placeholder="例如：大三、研究生、金融業、工程師"
              onBlur={() => setProfile({ ...profile, gradeOrOccupation: profile.gradeOrOccupation.trim() })}
              onChange={(event) => {
                setProfile({ ...profile, gradeOrOccupation: event.target.value });
                setError("");
              }}
            />
          </label>
          <label>
            是否修過金融課程 *
            <select
              value={profile.hasTakenFinanceCourse}
              onChange={(event) =>
                setProfile({
                  ...profile,
                  hasTakenFinanceCourse: event.target.value as ParticipantProfile["hasTakenFinanceCourse"],
                })
              }
            >
              <option value="no">否</option>
              <option value="in_progress">正在修 / 自學中</option>
              <option value="yes">是</option>
            </select>
          </label>
        </fieldset>

        <fieldset>
          <legend>使用經驗</legend>
          <ScaleInput
            label="金融熟悉程度"
            value={profile.financeFamiliarity}
            onChange={(value) => setProfile({ ...profile, financeFamiliarity: value })}
          />
          <label>
            LLM / ChatGPT 使用經驗 *
            <select
              value={profile.llmExperience}
              onChange={(event) =>
                setProfile({ ...profile, llmExperience: event.target.value as ParticipantProfile["llmExperience"] })
              }
            >
              <option value="none">幾乎沒有</option>
              <option value="rare">偶爾用</option>
              <option value="monthly">每月使用</option>
              <option value="weekly">每週使用</option>
              <option value="daily">幾乎每天使用</option>
            </select>
          </label>
          <label>
            其他背景備註
            <textarea
              value={profile.notes}
              rows={3}
              placeholder="可留空"
              onChange={(event) => setProfile({ ...profile, notes: event.target.value })}
            />
          </label>
        </fieldset>

        {error ? <p className="field-error">{error}</p> : null}
        <div className="form-actions">
          <button type="submit">開始 5 題盲測</button>
        </div>
      </form>
    </main>
  );
}

function QuestionFlow(props: {
  token: string;
  profile: ParticipantProfile;
  onComplete: () => void;
}) {
  const [questionIndex, setQuestionIndex] = useState(0);
  const [question, setQuestion] = useState("");
  const [answers, setAnswers] = useState<ModelAnswer[]>([]);
  const [selectedBest, setSelectedBest] = useState<AnswerLabel | "">("");
  const [selectedWorst, setSelectedWorst] = useState<AnswerLabel | "">("");
  const [bestReason, setBestReason] = useState("");
  const [worstReason, setWorstReason] = useState("");
  const [qualityFlags, setQualityFlags] = useState<string[]>([]);
  const [qualityRatings, setQualityRatings] = useState<QualityRatings>(INITIAL_RATINGS);
  const [latencyMs, setLatencyMs] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const category = PROMPT_CATEGORIES[questionIndex];
  const progressLabel = `${questionIndex + 1} / ${PROMPT_CATEGORIES.length}`;
  const answerMap = Object.fromEntries(answers.map((answer) => [answer.label, answer.text])) as
    | Record<AnswerLabel, string>
    | undefined;
  const mapping = Object.fromEntries(answers.map((answer) => [answer.label, answer.modelId])) as
    | Record<AnswerLabel, ModelAnswer["modelId"]>
    | undefined;

  async function submitQuestion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (question.trim().length < 8) {
      setError("請輸入較完整的問題，至少 8 個字。");
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const response = await requestBlindAnswers({
        participantToken: props.token,
        questionIndex,
        category,
        question,
      });
      setAnswers(response.answers);
      setLatencyMs(response.latencyMs);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "模型 endpoint 呼叫失敗。");
    } finally {
      setIsLoading(false);
    }
  }

  function resetForNextQuestion() {
    setQuestion("");
    setAnswers([]);
    setSelectedBest("");
    setSelectedWorst("");
    setBestReason("");
    setWorstReason("");
    setQualityFlags([]);
    setQualityRatings(INITIAL_RATINGS);
    setLatencyMs(0);
    setError("");
  }

  function saveJudgment() {
    if (!answerMap || !mapping) {
      return;
    }
    if (!selectedBest || !selectedWorst) {
      setError("請選出最好與最差的回答。");
      return;
    }
    if (selectedBest === selectedWorst) {
      setError("最好與最差不能選同一個回答。");
      return;
    }
    if (!bestReason.trim() && !worstReason.trim()) {
      setError("請至少填寫一欄原因。");
      return;
    }

    const record: EvaluationRecord = {
      id: `${props.token}-${questionIndex + 1}-${Date.now()}`,
      participantToken: props.token,
      participantProfile: props.profile,
      questionIndex: questionIndex + 1,
      promptCategory: category.title,
      userQuestion: question.trim(),
      answers: answerMap,
      hiddenModelMapping: mapping,
      selectedBest,
      selectedWorst,
      bestReason: bestReason.trim(),
      worstReason: worstReason.trim(),
      qualityFlags,
      qualityRatings,
      timestamp: new Date().toISOString(),
      responseLatencyMs: latencyMs,
      completionStatus: "answered",
    };

    saveEvaluationRecord(record);

    if (questionIndex === PROMPT_CATEGORIES.length - 1) {
      upsertParticipantStatus({
        token: props.token,
        profile: props.profile,
        completionStatus: "completed",
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      });
      props.onComplete();
      return;
    }

    setQuestionIndex((value) => value + 1);
    resetForNextQuestion();
  }

  return (
    <main className="page-shell eval-page">
      <header className="study-header">
        <div>
          <p className="eyebrow">Participant {props.token}</p>
          <h1>{category.title}</h1>
        </div>
        <div className="progress-pill">題目 {progressLabel}</div>
      </header>

      <div className="stepper" aria-label="問卷進度">
        {PROMPT_CATEGORIES.map((item, index) => (
          <span
            aria-label={`第 ${index + 1} 題 ${item.title}`}
            className={index <= questionIndex ? "step-dot is-active" : "step-dot"}
            key={item.id}
          />
        ))}
      </div>

      <section className="question-layout">
        <form className="prompt-panel" onSubmit={submitQuestion}>
          <p className="panel-kicker">題型引導</p>
          <h2>{category.instruction}</h2>
          <p className="example-text">{category.example}</p>
          <label htmlFor="user-question">你的測試問題 *</label>
          <textarea
            id="user-question"
            value={question}
            rows={6}
            placeholder="請直接輸入你想問三個模型的金融問題"
            disabled={answers.length > 0 || isLoading}
            onChange={(event) => {
              setQuestion(event.target.value);
              setError("");
            }}
          />
          {!answers.length ? (
            <button disabled={isLoading} type="submit">
              {isLoading ? "產生 A / B / C 中..." : "送出並產生盲測回答"}
            </button>
          ) : null}
        </form>

        {answers.length ? (
          <section className="comparison-panel" aria-label="盲測回答比較">
            <div className="comparison-head">
              <div>
                <p className="panel-kicker">Blind Comparison</p>
                <h2>選出最好與最差</h2>
              </div>
              <span>{latencyMs} ms</span>
            </div>

            <div className="answer-grid">
              {answers.map((answer) => (
                <article className="answer-card" key={answer.label}>
                  <div className="answer-label">回答 {answer.label}</div>
                  <p>{answer.text}</p>
                </article>
              ))}
            </div>

            <fieldset className="judgment-grid">
              <legend>必填判斷</legend>
              <label>
                哪個最好 *
                <select
                  value={selectedBest}
                  onChange={(event) => {
                    setSelectedBest(event.target.value as AnswerLabel);
                    setError("");
                  }}
                >
                  <option value="">請選擇</option>
                  <option value="A">回答 A</option>
                  <option value="B">回答 B</option>
                  <option value="C">回答 C</option>
                </select>
              </label>
              <label>
                哪個最差 *
                <select
                  value={selectedWorst}
                  onChange={(event) => {
                    setSelectedWorst(event.target.value as AnswerLabel);
                    setError("");
                  }}
                >
                  <option value="">請選擇</option>
                  <option value="A">回答 A</option>
                  <option value="B">回答 B</option>
                  <option value="C">回答 C</option>
                </select>
              </label>
              <label>
                最好的原因
                <textarea
                  value={bestReason}
                  rows={3}
                  onChange={(event) => {
                    setBestReason(event.target.value);
                    setError("");
                  }}
                />
              </label>
              <label>
                最差的原因
                <textarea
                  value={worstReason}
                  rows={3}
                  onChange={(event) => {
                    setWorstReason(event.target.value);
                    setError("");
                  }}
                />
              </label>
            </fieldset>

            <section className="quality-panel">
              <h3>品質標記與量表</h3>
              <div className="flag-grid">
                {QUALITY_FLAGS.map((flag) => (
                  <label className="check-option" key={flag.id}>
                    <input
                      checked={qualityFlags.includes(flag.id)}
                      type="checkbox"
                      onChange={(event) => {
                        setQualityFlags((current) =>
                          event.target.checked
                            ? [...current, flag.id]
                            : current.filter((item) => item !== flag.id),
                        );
                      }}
                    />
                    {flag.label}
                  </label>
                ))}
              </div>
              <div className="rating-grid">
                <ScaleInput
                  label="正確性"
                  value={qualityRatings.correctness}
                  onChange={(value) => setQualityRatings({ ...qualityRatings, correctness: value })}
                />
                <ScaleInput
                  label="完整性"
                  value={qualityRatings.completeness}
                  onChange={(value) => setQualityRatings({ ...qualityRatings, completeness: value })}
                />
                <ScaleInput
                  label="專業性"
                  value={qualityRatings.professionalism}
                  onChange={(value) => setQualityRatings({ ...qualityRatings, professionalism: value })}
                />
                <ScaleInput
                  label="可讀性"
                  value={qualityRatings.readability}
                  onChange={(value) => setQualityRatings({ ...qualityRatings, readability: value })}
                />
              </div>
            </section>

            {error ? <p className="field-error">{error}</p> : null}
            <div className="form-actions">
              <button className="secondary-button" type="button" onClick={resetForNextQuestion}>
                重新輸入本題
              </button>
              <button type="button" onClick={saveJudgment}>
                {questionIndex === PROMPT_CATEGORIES.length - 1 ? "完成問卷" : "儲存並進入下一題"}
              </button>
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}

function DonePage() {
  return (
    <main className="page-shell centered-page">
      <section className="entry-panel">
        <p className="eyebrow">Complete</p>
        <h1>感謝完成本次盲測</h1>
        <p className="lede">
          你的回答已記錄。為了維持研究盲測設計，本頁不顯示模型身份與比較結果。
        </p>
      </section>
    </main>
  );
}

function ParticipantApp() {
  const initialToken = currentTokenFromUrl();
  const [token, setToken] = useState(initialToken);
  const [profile, setProfile] = useState<ParticipantProfile | null>(null);
  const [step, setStep] = useState<ParticipantStep>(initialToken ? "profile" : "entry");

  if (step === "entry") {
    return (
      <TokenEntry
        initialToken={initialToken}
        onStart={(nextToken) => {
          setToken(nextToken);
          window.history.replaceState(null, "", `/eval?token=${encodeURIComponent(nextToken)}`);
          setStep("profile");
        }}
      />
    );
  }

  if (step === "profile" || !profile) {
    return (
      <ProfileForm
        token={token}
        onSubmit={(nextProfile) => {
          setProfile(nextProfile);
          upsertParticipantStatus({
            token,
            profile: nextProfile,
            completionStatus: "in_progress",
            startedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          setStep("question");
        }}
      />
    );
  }

  if (step === "done") {
    return <DonePage />;
  }

  return (
    <QuestionFlow
      token={token}
      profile={profile}
      onComplete={() => setStep("done")}
    />
  );
}

function AdminApp() {
  const [version, setVersion] = useState(0);
  const records = useMemo(() => getEvaluationRecords(), [version]);
  const participants = useMemo(() => getParticipantStatuses(), [version]);
  const modelCounts = countModelSelections(records);
  const completedCount = participants.filter((participant) => participant.completionStatus === "completed").length;
  const financeBackgroundCount = participants.filter(
    (participant) => participant.profile?.isBusinessOrFinance === "yes",
  ).length;
  const nonFinanceBackgroundCount = participants.filter(
    (participant) => participant.profile?.isBusinessOrFinance === "no",
  ).length;

  return (
    <main className="page-shell admin-page">
      <header className="study-header">
        <div>
          <p className="eyebrow">Research Admin</p>
          <h1>盲測資料後台</h1>
        </div>
        <a className="admin-link" href="/eval?token=A013">開啟受測者入口</a>
      </header>

      <section className="stats-grid" aria-label="研究狀態統計">
        <article className="stat-card">
          <span>受測者</span>
          <strong>{participants.length}</strong>
        </article>
        <article className="stat-card">
          <span>完成</span>
          <strong>{completedCount}</strong>
        </article>
        <article className="stat-card">
          <span>題目紀錄</span>
          <strong>{records.length}</strong>
        </article>
        <article className="stat-card">
          <span>金融 / 非金融背景</span>
          <strong>{financeBackgroundCount} / {nonFinanceBackgroundCount}</strong>
        </article>
      </section>

      <section className="admin-actions">
        <button
          type="button"
          onClick={() => downloadFile("finance-blind-eval.json", buildExportJson(), "application/json")}
        >
          匯出 JSON
        </button>
        <button
          type="button"
          onClick={() => downloadFile("finance-blind-eval.csv", buildExportCsv(), "text/csv;charset=utf-8")}
        >
          匯出 CSV
        </button>
        <button
          className="danger-button"
          type="button"
          onClick={() => {
            if (window.confirm("確定清除本機 demo 資料？")) {
              clearAllEvaluationData();
              setVersion((value) => value + 1);
            }
          }}
        >
          清除 demo 資料
        </button>
      </section>

      <section className="table-section">
        <div className="section-heading">
          <h2>模型 best / worst 次數</h2>
        </div>
        <div className="model-counts">
          {Object.entries(modelCounts).map(([modelId, counts]) => (
            <article className="model-count-card" key={modelId}>
              <h3>{modelId}</h3>
              <p>Best: {counts.best}</p>
              <p>Worst: {counts.worst}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="table-section">
        <div className="section-heading">
          <h2>受測者完成狀態</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Token</th>
                <th>背景</th>
                <th>金融熟悉度</th>
                <th>LLM 經驗</th>
                <th>狀態</th>
                <th>完成題數</th>
              </tr>
            </thead>
            <tbody>
              {participants.map((participant) => (
                <tr key={participant.token}>
                  <td>{participant.token}</td>
                  <td>{participant.profile?.isBusinessOrFinance ?? "-"}</td>
                  <td>{participant.profile?.financeFamiliarity ?? "-"}</td>
                  <td>{participant.profile?.llmExperience ?? "-"}</td>
                  <td>{participant.completionStatus}</td>
                  <td>{records.filter((record) => record.participantToken === participant.token).length} / 5</td>
                </tr>
              ))}
              {!participants.length ? (
                <tr>
                  <td colSpan={6}>尚無受測者紀錄。</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="table-section">
        <div className="section-heading">
          <h2>每題紀錄</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Token</th>
                <th>題號</th>
                <th>題型</th>
                <th>問題</th>
                <th>Best</th>
                <th>Worst</th>
                <th>Hidden mapping</th>
                <th>Latency</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <td>{record.participantToken}</td>
                  <td>{record.questionIndex}</td>
                  <td>{record.promptCategory}</td>
                  <td>{record.userQuestion}</td>
                  <td>{record.selectedBest} / {record.hiddenModelMapping[record.selectedBest]}</td>
                  <td>{record.selectedWorst} / {record.hiddenModelMapping[record.selectedWorst]}</td>
                  <td>{labelsFromMapping(record.hiddenModelMapping)}</td>
                  <td>{record.responseLatencyMs} ms</td>
                </tr>
              ))}
              {!records.length ? (
                <tr>
                  <td colSpan={8}>尚無題目紀錄。</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

export function App() {
  const isAdmin = window.location.pathname.startsWith("/admin");
  return isAdmin ? <AdminApp /> : <ParticipantApp />;
}
