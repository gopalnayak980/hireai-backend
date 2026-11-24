const crypto = require('crypto')
const { GoogleGenerativeAI, TaskType } = require('@google/generative-ai')

const EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001'
const MAX_CHARS = 6000 // keep each text well inside the embedding input limit
const BATCH_SIZE = 50 // batchEmbedContents accepts up to 100 requests; stay below it
const CACHE_LIMIT = 2000

// Small in-memory cache (text -> vector) so repeated searches don't re-embed the same jobs.
const cache = new Map()

const cacheKey = (text, taskType) =>
  crypto.createHash('sha1').update(`${EMBEDDING_MODEL}|${taskType}|${text}`).digest('hex')

const cacheSet = (key, vec) => {
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value) // evict oldest
  cache.set(key, vec)
}

const clean = (text) =>
  String(text || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_CHARS)

let model
const getModel = () => {
  if (!model) {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL })
  }
  return model
}

/**
 * Embed an array of texts. Returns an array of vectors in the same order.
 * taskType: 'document' for job descriptions, 'query' for resumes / search queries.
 */
async function embedTexts(texts, taskType = 'document') {
  const gemTask =
    taskType === 'query' ? TaskType.RETRIEVAL_QUERY : TaskType.RETRIEVAL_DOCUMENT
  const cleaned = texts.map(clean)
  const out = new Array(cleaned.length)
  const missing = []

  cleaned.forEach((text, i) => {
    const hit = cache.get(cacheKey(text, gemTask))
    if (hit) out[i] = hit
    else missing.push(i)
  })

  for (let start = 0; start < missing.length; start += BATCH_SIZE) {
    const idxs = missing.slice(start, start + BATCH_SIZE)
    const res = await getModel().batchEmbedContents({
      requests: idxs.map((i) => ({
        content: { role: 'user', parts: [{ text: cleaned[i] || ' ' }] },
        taskType: gemTask,
      })),
    })
    res.embeddings.forEach((emb, k) => {
      const i = idxs[k]
      out[i] = emb.values
      cacheSet(cacheKey(cleaned[i], gemTask), emb.values)
    })
  }
  return out
}

function cosineSimilarity(a, b) {
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0
}

/**
 * Rank jobs against a query vector. Pure function (easy to test).
 * Returns jobs sorted by similarity, each with semanticScore (0-100) and rank.
 */
function rankBySimilarity(queryVec, jobs, jobVecs) {
  return jobs
    .map((job, i) => ({ job, sim: cosineSimilarity(queryVec, jobVecs[i]) }))
    .sort((x, y) => y.sim - x.sim)
    .map(({ job, sim }, idx) => ({
      ...job,
      semanticScore: Math.max(0, Math.round(sim * 100)),
      rank: idx + 1,
    }))
}

module.exports = { embedTexts, cosineSimilarity, rankBySimilarity, clean, EMBEDDING_MODEL }
