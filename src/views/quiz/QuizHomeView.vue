<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useProgressStore } from '@/stores/progress'
import { getManifest, loadChapterQuestions } from '@/services/contentLoader'
import {
  chapterOfQid,
  mulberry32,
  selectQuestions,
  type PracticeContext,
} from '@/services/quizEngine'
import { useQuizSessionStore } from '@/stores/quizSession'
import TopBar from '@/components/TopBar.vue'
import { toast } from '@/composables/toast'

const router = useRouter()
const store = useProgressStore()
const session = useQuizSessionStore()
const manifest = getManifest()

const ctx = computed<PracticeContext>(() => ({
  answered: store.data.quiz.answered,
  wrongBook: store.data.quiz.wrongBook,
  favorites: store.data.quiz.favorites,
}))

const wrongIds = computed(() => Object.keys(store.data.quiz.wrongBook))
const unmasteredWrong = computed(
  () => wrongIds.value.filter((id) => !store.data.quiz.wrongBook[id].mastered),
)

const groups = computed(() => {
  const map = new Map<string, typeof manifest.chapters>()
  for (const ch of manifest.chapters) {
    const arr = map.get(ch.group) ?? []
    arr.push(ch)
    map.set(ch.group, arr)
  }
  return [...map.entries()]
})

function chapterStat(chapterId: string) {
  const s = store.data.quiz.chapterStats[chapterId] ?? { attempts: 0, correct: 0 }
  const total = manifest.chapters.find((c) => c.id === chapterId)?.questionCount ?? 0
  const rate = s.attempts ? Math.round((s.correct / s.attempts) * 100) : null
  const done = Object.keys(store.data.quiz.answered).filter((q) => chapterOfQid(q) === chapterId).length
  return { attempts: s.attempts, rate, done, total, pct: total ? Math.round((done / total) * 100) : 0 }
}

const recentMocks = computed(() => store.data.mock.attempts.slice(-3).reverse())

/* ── 随机抽题 ─────────────────────────────── */
const starting = ref(false)
async function startRandom() {
  if (starting.value) return
  starting.value = true
  try {
    const rand = mulberry32(Date.now() % 2147483647)
    // 逐章加载直到候选池足够（避免一次性下载全题库）
    const need = 20
    const order = [...manifest.chapters].filter((c) => c.questionCount > 0)
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1))
      ;[order[i], order[j]] = [order[j], order[i]]
    }
    const pool = []
    for (const ch of order) {
      pool.push(...(await loadChapterQuestions(ch.id)))
      if (pool.length >= need * 5) break
    }
    const picked = selectQuestions(pool, need, ctx.value, rand)
    if (!picked.length) {
      toast('题库还没有可练的题目', 'warn')
      return
    }
    session.start({ questions: picked, mode: 'practice', source: 'random', sourceLabel: '随机抽题' })
    router.push('/quiz/session')
  } finally {
    starting.value = false
  }
}

</script>

<template>
  <div class="page">
    <TopBar title="题库" />

    <div class="page-body space-y-4 px-4 pt-4">
      <!-- 顶部功能卡 -->
      <div class="grid grid-cols-2 gap-3">
        <button
          type="button"
          class="card flex flex-col items-start gap-1 p-4 text-left active:bg-surface"
          @click="router.push('/mock/intro')"
        >
          <span class="text-[22px]">⏱️</span>
          <span class="text-[15.5px] font-semibold">模拟考试</span>
          <span class="text-[12.5px] text-muted">{{ manifest.blueprint.total }} 题计时全真卷</span>
        </button>
        <button
          type="button"
          class="card flex flex-col items-start gap-1 p-4 text-left active:bg-surface"
          :disabled="starting"
          @click="startRandom"
        >
          <span class="text-[22px]">🎲</span>
          <span class="text-[15.5px] font-semibold">随机抽题</span>
          <span class="text-[12.5px] text-muted">20 题 · 未做优先</span>
        </button>
        <button
          type="button"
          class="card flex items-center justify-between gap-2 p-4 text-left active:bg-surface"
          @click="router.push('/quiz/wrong')"
        >
          <div>
            <p class="text-[15.5px] font-semibold">错题本</p>
            <p class="text-[12.5px] text-muted">{{ unmasteredWrong.length }} 道待攻克</p>
          </div>
          <span
            v-if="unmasteredWrong.length"
            class="flex h-8 min-w-8 items-center justify-center rounded-full bg-danger-soft px-2 text-[14px] font-bold text-danger"
            >{{ unmasteredWrong.length }}</span
          >
        </button>
        <button
          type="button"
          class="card flex items-center justify-between gap-2 p-4 text-left active:bg-surface"
          @click="router.push('/quiz/favorites')"
        >
          <div>
            <p class="text-[15.5px] font-semibold">收藏夹</p>
            <p class="text-[12.5px] text-muted">{{ store.data.quiz.favorites.length }} 道收藏</p>
          </div>
          <span class="text-[18px]">⭐</span>
        </button>
      </div>

      <!-- 最近模拟考 -->
      <section v-if="recentMocks.length" class="card p-4">
        <div class="mb-2 flex items-center justify-between">
          <h2 class="text-[16px] font-semibold">最近模拟考</h2>
          <button type="button" class="text-[13.5px] text-accent" @click="router.push('/mock/result')">查看全部 ›</button>
        </div>
        <div class="flex items-end gap-3">
          <div v-for="a in recentMocks" :key="a.at" class="flex flex-1 flex-col items-center gap-1">
            <span
              class="text-[17px] font-bold"
              :class="a.score >= manifest.exam.passLine ? 'text-success' : 'text-danger'"
              >{{ a.score }}</span
            >
            <div class="w-full rounded-md bg-surface" :style="{ height: `${Math.max(8, (a.score / a.total) * 56)}px` }">
              <div class="w-full rounded-md bg-accent/70" :style="{ height: '100%' }" />
            </div>
            <span class="text-[11px] text-muted">{{ a.at.slice(5, 10) }}</span>
          </div>
        </div>
      </section>

      <!-- 章节列表 -->
      <section v-for="[group, chapters] in groups" :key="group">
        <h2 class="mb-2 mt-1 px-1 text-[14px] font-semibold text-muted">{{ group }}</h2>
        <div class="card divide-y divide-line overflow-hidden">
          <button
            v-for="ch in chapters"
            :key="ch.id"
            type="button"
            class="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-surface"
            @click="router.push(`/quiz/ch/${ch.id}`)"
          >
            <span
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[13px] font-bold"
              :class="ch.questionCount ? 'bg-accent-soft text-accent' : 'bg-surface text-muted'"
              >{{ ch.no }}</span
            >
            <div class="min-w-0 flex-1">
              <p class="truncate text-[15.5px] font-medium">{{ ch.title }}</p>
              <div class="mt-1 flex items-center gap-2 text-[12.5px] text-muted">
                <span>{{ chapterStat(ch.id).done }}/{{ ch.questionCount }} 已做</span>
                <span v-if="chapterStat(ch.id).rate !== null" class="text-accent"
                  >正确率 {{ chapterStat(ch.id).rate }}%</span
                >
                <span v-if="!ch.questionCount" class="text-warn">题库待上线</span>
              </div>
            </div>
            <svg viewBox="0 0 24 24" class="h-5 w-5 shrink-0 text-muted" fill="none">
              <path d="m9.5 5.5 6.5 6.5-6.5 6.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </div>
      </section>

      <p class="px-2 pb-1 text-center text-[11.5px] text-muted">
        共 {{ manifest.chapters.reduce((a, c) => a + c.questionCount, 0) }} 道题 ·
        由 AI 生成，以官方教程为准
      </p>
    </div>
  </div>
</template>
