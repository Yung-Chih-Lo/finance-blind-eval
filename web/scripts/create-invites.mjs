#!/usr/bin/env node

import { createHash, randomBytes } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import QRCode from "qrcode"

const args = new Map()
for (let index = 2; index < process.argv.length; index += 1) {
  const item = process.argv[index]
  if (!item.startsWith("--")) {
    continue
  }
  const [rawKey, inlineValue] = item.slice(2).split(/=(.*)/s, 2)
  const key = rawKey.trim()
  if (!key) {
    continue
  }
  if (inlineValue !== undefined) {
    args.set(key, inlineValue || "true")
    continue
  }
  const value = process.argv[index + 1]?.startsWith("--") ? "true" : process.argv[index + 1] || "true"
  args.set(key, value)
  if (value !== "true") {
    index += 1
  }
}

const count = Math.min(Math.max(Number(args.get("count") || 40), 1), 500)
const baseUrl = String(args.get("base-url") || "http://localhost:5174").replace(/\/$/, "")
const labelPrefix = String(args.get("label-prefix") || "invite")
const maxUses = Math.min(Math.max(Number(args.get("max-uses") || 1), 1), 20)
const expiresAt = args.get("expires-at") ? String(args.get("expires-at")) : undefined
const dataPath = String(args.get("data-path") || join(process.cwd(), ".data", "evaluation-store.json"))
const qrDir = String(args.get("qr-dir") || join(process.cwd(), ".data", "invite-qr"))

const emptyStore = {
  participants: [],
  invites: [],
  sessions: [],
  pendingQuestions: [],
  records: [],
}

function normalizeInviteCode(value) {
  return value.trim().replace(/\s+/g, "").toUpperCase()
}

function hashInviteCode(value) {
  return createHash("sha256").update(normalizeInviteCode(value)).digest("hex")
}

function randomCode(length) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  const bytes = randomBytes(length)
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("")
}

async function readStore() {
  try {
    const parsed = JSON.parse(await readFile(dataPath, "utf8"))
    return { ...emptyStore, ...parsed }
  } catch {
    return { ...emptyStore }
  }
}

function csvEscape(value) {
  const text = String(value ?? "")
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

const store = await readStore()
const usedHashes = new Set((store.invites || []).map((invite) => invite.codeHash))
const now = new Date().toISOString()
const rows = []
const createdInvites = []

for (let index = 0; index < count; index += 1) {
  let code = ""
  let codeHash = ""
  for (let attempts = 0; attempts < 200; attempts += 1) {
    code = `${randomCode(4)}-${randomCode(4)}`
    codeHash = hashInviteCode(code)
    if (!usedHashes.has(codeHash)) {
      usedHashes.add(codeHash)
      break
    }
  }

  const invite = {
    id: randomBytes(12).toString("base64url"),
    codeHash,
    label: `${labelPrefix}-${index + 1}`,
    maxUses,
    uses: 0,
    createdAt: now,
    expiresAt,
    participantTokens: [],
  }
  const link = `${baseUrl}/eval?invite=${encodeURIComponent(code)}`
  const qrPath = join(qrDir, `${invite.label}.svg`)
  await mkdir(dirname(qrPath), { recursive: true })
  await QRCode.toFile(qrPath, link, {
    errorCorrectionLevel: "M",
    margin: 2,
    type: "svg",
    width: 320,
  })

  createdInvites.push(invite)
  rows.push({
    label: invite.label,
    code,
    link,
    qr_path: qrPath,
    expires_at: expiresAt || "",
  })
}

const nextStore = {
  ...store,
  invites: [...(store.invites || []), ...createdInvites],
}
await mkdir(dirname(dataPath), { recursive: true })
await writeFile(dataPath, `${JSON.stringify(nextStore, null, 2)}\n`, "utf8")

const csvPath = join(qrDir, "invites.csv")
const headers = ["label", "code", "link", "qr_path", "expires_at"]
await writeFile(
  csvPath,
  [headers.join(","), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))].join("\n"),
  "utf8",
)

console.log(`Created ${rows.length} invite code(s).`)
console.log(`Store: ${dataPath}`)
console.log(`CSV: ${csvPath}`)
console.log(`QR SVG directory: ${qrDir}`)
