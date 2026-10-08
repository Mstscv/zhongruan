<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useProgressStore } from '@/stores/progress'
import { getManifest, loadChapterQuestions } from '@/services/contentLoader'
import {
  chapterOfQid,
  filterByScope,
  mulberry32,
  selectQuestions,
  type PracticeContext,
  type Scope,
  type SessionMode,
} from '@/services/quizEngine'
import { useQuizSessionStore } from '@/stores/quizSession'
import TopBar from '@/components/TopBar.vue'
import AppButton from '@/components/AppButton.vue'
import { toast } from '@/composables/toast'

const route = useRoute()
const router = useRouter()
const store = useProgressStore()
const session = useQuizSessionStore()

const chapter = computed(() => getManifest().chapters.find((c) => c.id === route.params.id))

const mode = ref<SessionMode>('practice')
const count = ref<20 | 50 | 0>(20)
const scope = ref<Scope>('all')
const starting = ref(false)

const ctx = computed<PracticeContext>(() => ({
  answered: store.data.quiz.answered,
  wrongBook: store.data.quiz.wrongBook,
  favorites: store.data.quiz.favorites,
}))

const scopeCounts = computed(() => {
  const ch = chapter.value
  if (!ch) return { all: 0, undone: 0, wrong: 0, fav: 0 }
  const ids = Object.keys(store.data.quiz.answered).filter((q) => chapterOfQid(q) === ch.id)
  const wrong = Object.keys(store.data.quiz.wrongBook).filter(
    (q) => chapterOfQid(q) === ch.id && !store.data.quiz.wrongBook[q].mastered,
  )
  const fav = store.data.quiz.favorites.filter((q) => chapterOfQid(q) === ch.id)
  return { all: ch.questionCount, undone: Math.max(0, ch.questionCount - ids.length), wrong: wrong.length, fav: fav.length }
})

const scopeOptions: Array<{ v: Scope; label: string }> = [
  { v: 'all', label: '全部' },
  { v: 'undone', label: '未做' },
  { v: 'wrong', label: '错题' },
  { v: 'fav', label: '收藏' },
]

async function start() {
  if (starting.value || !chapter.value) return
  starting.value = true
  try {
    const all = await loadChapterQuestions(chapter.value.id)
    const pool = filterByScope(all, scope.value, ctx.value)
    if (!pool.length) {
      toast(
        scope.value === 'wrong' ? '这一章没有待重练的错题' : scope.value === 'fav' ? '这一章还没有收藏' : '这一章暂时没有题目',
        'warn',
      )
      return
    }
    const picked = selectQuestions(pool, count.value, ctx.value, mulberry32(Date.now() % 2147483647))
    session.start({
      questions: picked,
      mode: mode.value,
      source: chapter.value.id,
      sourceLabel: `${chapter.value.no}. ${chapter.value.title}`,
    })
    router.push('/quiz/session')
  } finally {
    starting.value = false
  }
}
</script>

<template>
  <div class="page" v-if="chapter">
    <TopBar :title="chapter.title" :back="true" :subtitle="`第 ${chapter.no} 章 · ${chapter.group}`" />

    <div class="page-body--nonav space-y-5 px-4 pb-28 pt-4">
      <!-- 知识点 -->
      <section class="card p-4">
        <h2 class="mb-2 text-[15px] font-semibold">本章知识点</h2>
        <div class="flex flex-wrap gap-2">
          <span
            v-for="t in chapter.topics"
            :key="t.code"
            class="rounded-full bg-surface px-2.5 py-1 text-[13px] text-ink2"
            >{{ t.code }} {{ t.title }}</span
          >
        </div>
      </section>

      <!-- 模式 -->
      <section>
        <h2 class="mb-2 px-1 text-[14px] font-semibold text-muted">练习方式</h2>
        <div class="grid grid-cols-2 gap-3">
          <button
            v-for="m in [
              { v: 'practice', t: '练习模式', d: '答完立即判分，边学边记' },
              { v: 'self', t: '自测模式', d: '做完统一交卷看解析' },
            ]"
            :key="m.v"
            type="button"
            class="rounded-2xl border p-4 text-left transition-colors"
            :class="mode === m.v ? 'border-accent bg-accent-soft' : 'border-line bg-paper'"
            @click="mode = m.v as SessionMode"
          >
            <p class="text-[16px] font-semibold">{{ m.t }}</p>
            <p class="mt-1 text-[13px] leading-snug text-muted">{{ m.d }}</p>
          </button>
        </div>
      </section>

      <!-- 题数 -->
      <section>
        <h2 class="mb-2 px-1 text-[14px] font-semibold text-muted">题量</h2>
        <div class="flex gap-2">
          <button
            v-for="c in [
              { v: 20, l: '20 题' },
              { v: 50, l: '50 题' },
              { v: 0, l: '全部' },
            ]"
            :key="c.v"
            type="button"
            class="min-h-11 flex-1 rounded-xl border text-[15px] font-medium"
            :class="count === c.v ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-paper'"
            @click="count = c.v as 20 | 50 | 0"
          >
            {{ c.l }}
          </button>
        </div>
      </section>

      <!-- 范围 -->
      <section>
        <h2 class="mb-2 px-1 text-[14px] font-semibold text-muted">范围</h2>
        <div class="flex gap-2">
          <button
            v-for="s in scopeOptions"
            :key="s.v"
            type="button"
            class="min-h-11 flex-1 rounded-xl border text-[14.5px] font-medium"
            :class="scope === s.v ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-paper'"
            :disabled="s.v !== 'all' && scopeCounts[s.v] === 0"
            :style="s.v !== 'all' && scopeCounts[s.v] === 0 ? { opacity: 0.4 } : {}"
            @click="scope = s.v"
          >
            {{ s.label }}
            <span v-if="s.v !== 'all'" class="text-[12.5px]">{{ scopeCounts[s.v] }}</span>
          </button>
        </div>
      </section>

      <p class="px-1 text-[13px] text-muted">
        本章题库共 {{ scopeCounts.all }} 题，你已做 {{ scopeCounts.all - scopeCounts.undone }} 题。
        <span v-if="!scopeCounts.all" class="text-warn">（本章题库还在生成中）</span>
      </p>
    </div>

    <div
      class="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/96 px-4 pb-[calc(14px+env(safe-area-inset-bottom))] pt-3 backdrop-blur"
    >
      <AppButton block size="lg" :disabled="starting || !scopeCounts.all" @click="start">
        {{ starting ? '正在出题…' : '开始练习' }}
      </AppButton>
    </div>
  </div>
  <div v-else class="page">
    <TopBar title="章节练习" :back="true" />
    <div class="page-body--nonav pt-8 text-center text-muted">章节不存在</div>
  </div>
</template>
