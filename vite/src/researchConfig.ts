import type { ModelId, PromptCategory } from "./types";

export const MODEL_IDS: ModelId[] = ["H1-best", "H2-best", "TAIDE-baseline"];

export const PROMPT_CATEGORIES: PromptCategory[] = [
  {
    id: "finance-concept",
    title: "金融概念理解",
    instruction: "請輸入一題你會用來確認模型是否真正理解金融概念的問題。",
    example: "例如：請解釋殖利率曲線倒掛代表什麼，以及它不一定預測衰退的原因。",
  },
  {
    id: "investment-judgment",
    title: "投資 / 理財判斷",
    instruction: "請輸入一題需要模型給出判斷、權衡或風險說明的投資理財問題。",
    example: "例如：升息循環中，長天期債券 ETF 和定存的風險差異是什麼？",
  },
  {
    id: "company-financials",
    title: "公司財務 / 財報",
    instruction: "請輸入一題和公司財務、財報閱讀或指標解讀有關的問題。",
    example: "例如：自由現金流為正但淨利下降，可能代表哪些營運狀況？",
  },
  {
    id: "macro-market",
    title: "市場 / 債券 / 利率 / 匯率 / 總經",
    instruction: "請輸入一題跨市場或總體經濟脈絡的問題。",
    example: "例如：美元升值通常會如何影響新興市場債券和出口企業？",
  },
  {
    id: "expertise-probe",
    title: "自己會拿來測模型專業程度的問題",
    instruction: "請輸入一題你覺得最能分辨金融專業模型和一般聊天模型的問題。",
    example: "例如：如果一家公司 ROE 很高但負債快速上升，應該追問哪些財務細節？",
  },
];

export const SEEDED_PARTICIPANTS: Record<string, { name: string; group: string }> = {
  A013: { name: "A013", group: "預設受測者" },
  B021: { name: "B021", group: "預設受測者" },
  C107: { name: "C107", group: "預設受測者" },
};

export const QUALITY_FLAGS = [
  { id: "accurate", label: "正確性" },
  { id: "complete", label: "完整性" },
  { id: "professional", label: "專業性" },
  { id: "readable", label: "可讀性" },
  { id: "hallucination", label: "疑似幻覺" },
  { id: "off-topic", label: "答非所問" },
];
