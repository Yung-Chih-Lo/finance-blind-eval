// Regression harness for provider prompt composition.
// Run with:
//   cd web && npm run verify:provider-prompt

import { strict as assert } from "node:assert"

import type {
  AnswerLabel,
  ModelId,
  PromptCategory,
  ProviderSettings,
} from "@/lib/evaluation/types"
import { generateBlindAnswers } from "@/lib/server/gateway-client"
import {
  getDefaultProviderSettings,
  ProviderSettingsError,
  renderProviderUserPrompt,
  validateProviderSettings,
} from "@/lib/server/provider-settings"

delete process.env.OPENAI_COMPAT_USER_PROMPT_TEMPLATE
process.env.OPENAI_COMPAT_API_KEY = "test-key"

const answerLabels = ["A", "B", "C"] satisfies AnswerLabel[]
const modelIds = ["H1-best", "H2-best", "TAIDE-baseline"] satisfies ModelId[]
const question = "為什麼通膨下降不一定代表物價水準正在下降？"
const category: PromptCategory = {
  id: "finance-concept",
  title: "金融問題",
  instruction: "請提出一個金融、財務、投資或總經的知識或概念性問題。",
  examples: [],
}

function providerSettings(
  overrides: Partial<ProviderSettings> = {}
): ProviderSettings {
  return {
    ...getDefaultProviderSettings(),
    apiBaseUrl: "https://gateway.test/v1",
    modelsEndpointOverride: "",
    apiKeyEnvVar: "OPENAI_COMPAT_API_KEY",
    modelMapping: {
      "H1-best": "model-h1",
      "H2-best": "model-h2",
      "TAIDE-baseline": "model-taide",
    },
    systemPrompt: "system instruction",
    userPromptTemplate: "{{question}}",
    temperature: 0.2,
    maxTokens: 1200,
    ...overrides,
  }
}

function assertDefaultUserPromptIsQuestionOnly() {
  const defaults = getDefaultProviderSettings()
  assert.equal(
    defaults.userPromptTemplate,
    "{{question}}",
    "default user prompt template should send only the participant question"
  )
  assert.equal(
    renderProviderUserPrompt(defaults.userPromptTemplate, {
      categoryTitle: category.title,
      categoryInstruction: category.instruction,
      question,
    }),
    question,
    "default rendered user prompt should equal the participant question"
  )
}

function assertQuestionTemplateValidation() {
  const result = validateProviderSettings(
    providerSettings({ userPromptTemplate: "{{categoryInstruction}}" }),
    { requireEndpoint: true, requireQuestionTemplate: true }
  )
  assert.equal(
    result.ok,
    false,
    "answer generation validation should reject templates missing {{question}}"
  )
  assert.ok(
    result.issues.some((issue) =>
      issue.includes("userPromptTemplate must include {{question}}")
    ),
    "validation error should name the missing {{question}} variable"
  )
}

async function assertBadTemplateDoesNotCallGateway() {
  let fetchCalled = false
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () => {
    fetchCalled = true
    throw new Error("fetch should not be called for an invalid prompt template")
  }) as typeof fetch

  try {
    await assert.rejects(
      generateBlindAnswers({
        answerLabels,
        modelIds,
        providerSettings: providerSettings({
          userPromptTemplate: "{{categoryInstruction}}",
        }),
        participantToken: "P-TEST",
        questionIndex: 1,
        category,
        question,
      }),
      (error: unknown) =>
        error instanceof ProviderSettingsError &&
        error.issues.some((issue) =>
          issue.includes("userPromptTemplate must include {{question}}")
        ),
      "invalid provider prompt template should fail before gateway fanout"
    )
    assert.equal(
      fetchCalled,
      false,
      "invalid provider prompt template must not call the gateway"
    )
  } finally {
    globalThis.fetch = originalFetch
  }
}

async function assertGatewayPayloadUsesSystemAndQuestionOnlyUserMessage() {
  const requests: Array<{ url: string; body: Record<string, unknown> }> = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (input, init) => {
    requests.push({
      url: String(input),
      body: JSON.parse(String(init?.body)),
    })
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: `answer-${requests.length}` } }],
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )
  }) as typeof fetch

  try {
    const result = await generateBlindAnswers({
      answerLabels,
      modelIds,
      providerSettings: providerSettings(),
      participantToken: "P-TEST",
      questionIndex: 1,
      category,
      question,
    })

    assert.equal(
      requests.length,
      3,
      "answer generation should fan out to three provider models"
    )
    for (const request of requests) {
      assert.equal(
        request.url,
        "https://gateway.test/v1/chat/completions",
        "chat completions URL should be derived from apiBaseUrl"
      )
      const messages = request.body.messages as Array<{
        role: string
        content: string
      }>
      assert.deepEqual(
        messages.map((message) => message.role),
        ["system", "user"],
        "gateway payload should contain system and user messages in the same call"
      )
      assert.equal(messages[0].content, "system instruction")
      assert.equal(messages[1].content, question)
      assert.ok(
        !messages[1].content.includes(category.instruction),
        "user message should not send participant-facing category instructions as prompt text"
      )
    }
    assert.deepEqual(Object.keys(result.answers).sort(), ["A", "B", "C"])
  } finally {
    globalThis.fetch = originalFetch
  }
}

async function main() {
  assertDefaultUserPromptIsQuestionOnly()
  assertQuestionTemplateValidation()
  await assertBadTemplateDoesNotCallGateway()
  await assertGatewayPayloadUsesSystemAndQuestionOnlyUserMessage()
  console.log("verify-provider-prompt-contract: all assertions passed")
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
