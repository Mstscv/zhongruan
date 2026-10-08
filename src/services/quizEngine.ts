import type { Question } from '@/types/schema'

/** 纯函数抽题引擎：题库练习 / 错题重练 / 模拟组卷共用。不依赖 Vue。 */

export type Scope = 'all' | 'undone' | 'wrong' | 'fav'
export type SessionMode = 'practice' | 'self'

export interface PracticeContext {
  answered: Record<string, { correct: number; wrong: number }>
  wrongBook: Record<string, { mastered: boolean }>
  favorites: string[]
}

export interface MockContext {
  answered: Record<string, { correct: number; wrong: number }>
}

/** 可复现的伪随机数发生器（种子相同 → 序列相同） */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 'Q-C07-0001' → 'ch07'（题号第 3~4 位是章号） */
export function chapterOfQid(qid: string): string {
  return `ch${qid.slice(3, 5)}`
}

/** 抽题优先级：0=没做过 1=错题本里的 2=已做对过 */
export function tierOf(qid: string, ctx: PracticeContext): 0 | 1 | 2 {
  if (!ctx.answered[qid]) return 0
  if (ctx.wrongBook[qid] && !ctx.wrongBook[qid].mastered) return 1
  return 2
}

export function filterByScope(pool: Question[], scope: Scope, ctx: PracticeContext): Question[] {
  switch (scope) {
    case 'all':
      return pool
    case 'undone':
      return pool.filter((q) => !ctx.answered[q.id])
    case 'wrong':
      return pool.filter((q) => ctx.wrongBook[q.id] && !ctx.wrongBook[q.id].mastered)
    case 'fav':
      return pool.filter((q) => ctx.favorites.includes(q.id))
  }
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * 从 pool 中抽 count 道：严格按"未做 > 未掌握错题 > 其他"优先填满
 * （档内随机），最后整体打乱返回。count <= 0 或 ≥ pool 长度时返回全量打乱。
 */
export function selectQuestions(
  pool: Question[],
  count: number,
  ctx: PracticeContext,
  rand: () => number,
): Question[] {
  const target = count > 0 ? Math.min(count, pool.length) : pool.length
  if (target >= pool.length) return shuffle(pool, rand)

  const items = pool.map((q) => ({ q, t: tierOf(q.id, ctx), r: rand() }))
  items.sort((a, b) => a.t - b.t || a.r - b.r)
  return shuffle(
    items.slice(0, target).map((it) => it.q),
    rand,
  )
}

/** 判分：选项下标 0-3 */
export function grade(q: Question, choice: number): boolean {
  return 'ABCD'.indexOf(q.answer) === choice
}

/* ── 模拟考组卷 ─────────────────────────────────────── */

export interface BuildPaperOptions {
  /** 全题库按章分组 */
  byChapter: Record<string, Question[]>
  /** 每章题数蓝图（合计 = 卷面题数） */
  weights: Record<string, number>
  /** 近期已答对的题（qid），抽样时尽量避开 */
  recentCorrect: Set<string>
  rand: () => number
  /** 测试参数：非空时按比例从全卷缩样（如 25 题练习卷） */
  totalCount?: number
}

/**
 * 按蓝图组卷：每章取 weights[章] 道，章内按难度 3:5:2 分层；
 * 避开 recentCorrect（不足时回填）。返回题号数组（顺序即卷面顺序）。
 */
export function buildPaper(opts: BuildPaperOptions): string[] {
  const full = Object.values(opts.weights).reduce((a, b) => a + b, 0)
  const targetCount = opts.totalCount ?? full

  // 1) 按蓝图比例分配目标题数（可升可降），再按各章实际题量封顶
  const keys = Object.keys(opts.weights)
  const desired: Record<string, number> = {}
  let acc = 0
  keys.forEach((k, i) => {
    if (i === keys.length - 1) {
      desired[k] = targetCount - acc
    } else {
      const v = full > 0 ? Math.floor((opts.weights[k] / full) * targetCount) : 0
      desired[k] = v
      acc += v
    }
  })

  const avail = (k: string) => (opts.byChapter[k] ?? []).length
  const quota: Record<string, number> = {}
  let deficit = 0
  for (const k of keys) {
    quota[k] = Math.max(0, Math.min(desired[k] ?? 0, avail(k)))
    deficit += (desired[k] ?? 0) - quota[k]
  }
  // 2) 题量不足的缺口 → 分给还有余量的章（随机顺序）
  if (deficit > 0) {
    const donors = shuffle(keys.filter((k) => avail(k) > quota[k]), opts.rand)
    for (const k of donors) {
      if (deficit <= 0) break
      const room = avail(k) - quota[k]
      const give = Math.min(room, deficit)
      quota[k] += give
      deficit -= give
    }
  }

  // 3) 每章按配额抽题（章内难度分层 3:5:2，避开近期做对的题）
  const paper: string[] = []
  for (const [chapterId, need] of Object.entries(quota)) {
    if (need <= 0) continue
    const all = opts.byChapter[chapterId] ?? []
    if (all.length === 0) continue

    const ratio = [0.3, 0.5, 0.2]
    const byDiff: Question[][] = [[], [], []]
    for (const q of all) byDiff[q.difficulty - 1].push(q)

    const picked: Question[] = []
    const take = (bucket: Question[], n: number) => {
      const fresh = bucket.filter((q) => !opts.recentCorrect.has(q.id))
      const src =
        fresh.length >= n ? fresh : [...fresh, ...bucket.filter((q) => opts.recentCorrect.has(q.id))]
      const shuffled = shuffle(src, opts.rand)
      picked.push(...shuffled.slice(0, n))
    }
    for (let d = 0; d < 3; d++) {
      const n =
        d === 2
          ? need - Math.round(need * ratio[0]) - Math.round(need * ratio[1])
          : Math.round(need * ratio[d])
      take(byDiff[d], Math.max(0, n))
    }
    if (picked.length < need) {
      const rest = shuffle(
        all.filter((q) => !picked.includes(q)),
        opts.rand,
      )
      picked.push(...rest.slice(0, need - picked.length))
    }
    paper.push(...picked.slice(0, need).map((q) => q.id))
  }
  return shuffle(paper, opts.rand)
}
