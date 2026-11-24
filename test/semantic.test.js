const test = require('node:test')
const assert = require('node:assert')
const { cosineSimilarity, rankBySimilarity, clean } = require('../services/embeddings')

test('cosineSimilarity: identical, orthogonal and zero vectors', () => {
  assert.strictEqual(cosineSimilarity([1, 2, 3], [1, 2, 3]).toFixed(5), '1.00000')
  assert.strictEqual(cosineSimilarity([1, 0], [0, 1]), 0)
  assert.strictEqual(cosineSimilarity([0, 0], [1, 1]), 0)
})

test('rankBySimilarity orders jobs by closeness to the query vector', () => {
  const jobs = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
  const vecs = [[0, 1], [1, 0.1], [0.7, 0.7]]
  const ranked = rankBySimilarity([1, 0], jobs, vecs)
  assert.deepStrictEqual(ranked.map((j) => j.id), ['b', 'c', 'a'])
  assert.deepStrictEqual(ranked.map((j) => j.rank), [1, 2, 3])
  assert.ok(ranked[0].semanticScore > ranked[1].semanticScore)
  assert.strictEqual(ranked[2].semanticScore, 0)
})

test('clean strips HTML tags and collapses whitespace', () => {
  assert.strictEqual(clean('<b>React</b>   dev\n\njob'), 'React dev job')
})
