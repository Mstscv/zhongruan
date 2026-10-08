<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useQuizSessionStore } from '@/stores/quizSession'
import { useProgressStore } from '@/stores/progress'
import { getManifest } from '@/services/contentLoader'
import ProgressRing from '@/components/ProgressRing.vue'
import Sheet from '@/components/Sheet.vue'
import AppButton from '@/components/AppButton.vue'
import { toast } from '@/composables/toast'

const router = useRouter()
const session = useQuizSessionStore()
const store = useProgressStore()
const manifest = getManifest()

/* 会话失效（直接打开网址/已结算）→ 回题库 */
onMounted(() => {
  if (!session.active) {
    router.replace('/quiz')
    return
  }
  timer = window.setInterval(() => {
    now.value = Date.now()
  }, 1000)
})
let timer = 0
const now = ref(Date.now())
onUnmounted(() => window.clearInterval(timer))

const exitSheet = ref(false)
const explainOpen = ref<Record<string, boolean>>({})

const q = computed(() => session.current)
const elapsedSec = computed(() => {
  const end = session.finishedAt ?? now.value
  return Math.max(0, Math.floor((end - session.startedAt) / 1000))
})
const clock = computed(() => {
  const m = Math.floor(elapsedSec.value / 60)
  const s = elapsedSec.value % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
})

const topicTitle = computed(() => {
  if (!q.value) return ''
  const ch = manifest.chapters.find((c) => c.id === q.value!.chapter)
  const t = ch?.topics.find((x) => x.code === q.value!.topic)
  return t ? `${t.code} ${t.title}` : q.value.topic
})

const revealed = computed(() => (q.value ? !!session.revealed[q.value.id] : false))
const myChoice = computed(() => (q.value ? session.choices[q.value.id] : undefined))

function optClass(i: number): string[] {
  if (!q.value) return []
  const letter = q.value.answer
  const correctIdx = 'ABCD'.indexOf(letter)
  if (session.mode === 'practice' && revealed.value) {
    if (i === correctIdx) return ['border-success', 'bg-success-soft']
    if (myChoice.value === i) return ['border-danger', 'bg-danger-soft']
    return ['border-line', 'opacity-55']
  }
  if (session.mode === 'self' && myChoice.value === i) {
    return ['border-accent', 'bg-accent-soft']
  }
  return ['border-line', 'bg-paper']
}

function onChoose(i: number) {
  if (session.phase !== 'answering') return
  if (session.mode === 'practice' && revealed.value) return
  session.choose(i)
}

function onToggleFav() {
  if (!q.value) return
  const added = store.toggleFavorite(q.value.id)
  toast(added ? '已收藏 ⭐' : '已取消收藏', added ? 'success' : 'info')
}

function exitPractice() {
  exitSheet.value = false
  router.push('/quiz')
}

function backToQuiz() {
  session.clear()
  router.push('/quiz')
}

function goWrongBook() {
  session.clear()
  router.push('/quiz/wrong')
}

const percent = computed(() =>
  session.total ? Math.round((session.correctCount / session.total) * 100) : 0,
)
</script>

<template>
  <div class="page bg-paper" v-if="session.active">
    <!-- ── 小结 ─────────────────────────────── -->
    <template v-if="session.phase === 'summary'">
      <header class="topbar">
        <div class="flex min-h-[52px] items-center px-4">
          <h1 class="text-[17px] font-semibold">练习小结</h1>
          <span class="ml-2 text-[13px] text-muted">{{ session.sourceLabel }}</span>
        </div>
      </header>

      <div class="page-body--nonav space-y-4 px-4 pt-5">
        <section class="card flex items-center gap-5 p-5">
          <ProgressRing
            :percent="percent"
            :size="92"
            :stroke="8"
            :color="percent >= 60 ? 'var(--color-success)' : 'var(--color-danger)'"
          >
            <div class="text-center">
              <p class="text-[22px] font-bold leading-none">{{ percent }}%</p>
              <p class="text-[11px] text-muted">正确率</p>
            </div>
          </ProgressRing>
          <div class="flex-1 space-y-1.5 text-[15px]">
            <p>答对 <span class="font-bold text-success">{{ session.correctCount }}</span> / {{ session.total }} 题</p>
            <p>用时 <span class="font-semibold">{{ clock }}</span></p>
            <p v-if="session.wrongQuestions.length" class="text-danger">
              {{ session.wrongQuestions.length }} 道已加入错题本
            </p>
            <p v-else class="text-success">全部答对，太棒了 🎉</p>
          </div>
        </section>

        <section v-if="session.wrongQuestions.length">
          <h2 class="mb-2 px-1 text-[14px] font-semibold text-muted">做错的题（点击查看解析）</h2>
          <div class="space-y-2.5">
            <div
              v-for="wq in session.wrongQuestions"
              :key="wq.id"
              class="card overflow-hidden"
            >
              <button
                type="button"
                class="w-full px-4 py-3 text-left active:bg-surface"
                @click="explainOpen[wq.id] = !explainOpen[wq.id]"
              >
                <p class="line-clamp-2 text-[14.5px] leading-relaxed">{{ wq.stem }}</p>
                <p class="mt-1.5 text-[13px]">
                  <span class="text-danger">你的选择 {{ 'ABCD'[session.choices[wq.id] ?? -1] }}</span>
                  <span class="mx-2 text-line">|</span>
                  <span class="text-success">正确答案 {{ wq.answer }}</span>
                  <span class="ml-2 text-accent">{{ explainOpen[wq.id] ? '收起 ▲' : '解析 ▼' }}</span>
                </p>
              </button>
              <div v-if="explainOpen[wq.id]" class="border-t border-line bg-surface px-4 py-3 anim-slide-up">
                <p class="text-[13px] font-semibold text-accent">【考点】{{ wq.topic }}</p>
                <p class="mt-1.5 text-[14.5px] leading-relaxed text-ink2">{{ wq.explanation }}</p>
              </div>
            </div>
          </div>
        </section>

        <div class="grid grid-cols-2 gap-3 pb-2">
          <AppButton v-if="session.wrongQuestions.length" variant="secondary" size="lg" @click="goWrongBook">
            去错题本
          </AppButton>
          <AppButton size="lg" :block="!session.wrongQuestions.length" @click="backToQuiz">
            返回题库
          </AppButton>
        </div>
      </div>
    </template>

    <!-- ── 做题 ─────────────────────────────── -->
    <template v-else>
      <header class="topbar">
        <div class="flex min-h-[52px] items-center gap-2 px-2">
          <button
            type="button"
            class="flex h-11 w-11 items-center justify-center rounded-full active:bg-surface"
            aria-label="退出"
            @click="exitSheet = true"
          >
            <svg viewBox="0 0 24 24" class="h-6 w-6" fill="none">
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
          </button>
          <div class="min-w-0 flex-1">
            <p class="truncate text-[13.5px] font-medium">{{ session.sourceLabel }}</p>
            <p class="text-[12.5px] text-muted">
              第 {{ session.index + 1 }}/{{ session.total }} 题
              <span v-if="session.mode === 'self'"> · 已答 {{ session.answeredCount }}</span>
            </p>
          </div>
          <span class="rounded-full bg-surface px-2.5 py-1 font-mono text-[13px] text-ink2">{{ clock }}</span>
        </div>
        <div class="h-1 bg-line">
          <div
            class="h-full bg-accent transition-all duration-300"
            :style="{ width: `${((session.index + 1) / session.total) * 100}%` }"
          />
        </div>
      </header>

      <div v-if="q" class="page-body--nonav flex flex-col px-4 pb-24 pt-4">
        <!-- 考点行 -->
        <div class="mb-3 flex items-center justify-between gap-2">
          <span class="rounded-full bg-accent-soft px-2.5 py-1 text-[12.5px] font-medium text-accent">
            {{ topicTitle }}
          </span>
          <div class="flex items-center gap-2">
            <span class="text-[12px] text-muted" :title="`难度 ${q.difficulty}`">
              <span v-for="i in 3" :key="i" :class="i <= q.difficulty ? 'text-warn' : 'text-line'">●</span>
            </span>
            <button
              type="button"
              class="flex h-9 w-9 items-center justify-center rounded-full text-[18px] active:bg-surface"
              :aria-label="store.data.quiz.favorites.includes(q.id) ? '取消收藏' : '收藏'"
              @click="onToggleFav"
            >
              {{ store.data.quiz.favorites.includes(q.id) ? '⭐' : '☆' }}
            </button>
          </div>
        </div>

        <!-- 题干 -->
        <p class="text-[17.5px] font-medium leading-relaxed" data-testid="q-stem">{{ q.stem }}</p>

        <!-- 选项 -->
        <div class="mt-4 space-y-2.5">
          <button
            v-for="(opt, i) in q.options"
            :key="i"
            type="button"
            data-testid="option"
            class="flex w-full items-start gap-3 rounded-2xl border-2 px-4 py-3.5 text-left transition-colors active:scale-[0.99]"
            :class="optClass(i)"
            @click="onChoose(i)"
          >
            <span
              class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[13px] font-bold"
              :class="
                session.mode === 'practice' && revealed && i === 'ABCD'.indexOf(q.answer)
                  ? 'border-success bg-success text-white'
                  : session.mode === 'practice' && revealed && myChoice === i
                    ? 'border-danger bg-danger text-white'
                    : myChoice === i
                      ? 'border-accent bg-accent text-white'
                      : 'border-line text-muted'
              "
            >
              {{ 'ABCD'[i] }}
            </span>
            <span class="text-[15.5px] leading-relaxed">{{ opt }}</span>
          </button>
        </div>

        <!-- 解析（练习模式判分后） -->
        <div
          v-if="session.mode === 'practice' && revealed && q"
          class="anim-slide-up mt-4 rounded-2xl border border-line bg-surface p-4"
        >
          <p class="text-[15px] font-bold">
            <span :class="session.results[q.id] ? 'text-success' : 'text-danger'">
              {{ session.results[q.id] ? '✓ 回答正确' : '✗ 回答错误' }}
            </span>
            <span class="ml-2 text-ink">正确答案：{{ q.answer }}</span>
          </p>
          <p class="mt-2 text-[14.5px] leading-relaxed text-ink2">{{ q.explanation }}</p>
        </div>

        <div class="flex-1" />
      </div>

      <!-- 底部操作 -->
      <div
        class="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/96 px-4 pb-[calc(14px+env(safe-area-inset-bottom))] pt-3 backdrop-blur"
      >
        <template v-if="session.mode === 'practice'">
          <AppButton block size="lg" :disabled="!revealed" @click="session.next()">
            {{ session.index === session.total - 1 ? '查看结果' : '下一题' }}
          </AppButton>
          <p v-if="!revealed" class="mt-1.5 text-center text-[12.5px] text-muted">选择一个答案后继续</p>
        </template>
        <template v-else>
          <div class="flex items-center gap-3">
            <button
              v-if="session.index > 0"
              type="button"
              class="min-h-[52px] rounded-xl border border-line px-5 text-[16px] font-medium active:bg-surface"
              @click="session.prev()"
            >
              上一题
            </button>
            <AppButton v-if="session.index < session.total - 1" block size="lg" @click="session.next()">
              下一题
            </AppButton>
            <AppButton v-else block size="lg" @click="session.submit()">交卷（{{ session.answeredCount }}/{{ session.total }}）</AppButton>
          </div>
          <button
            v-if="session.answeredCount > 0 && session.index < session.total - 1"
            type="button"
            class="mt-1.5 w-full text-center text-[13px] text-muted underline-offset-2 active:underline"
            @click="session.submit()"
          >
            提前交卷
          </button>
        </template>
      </div>

      <!-- 退出确认 -->
      <Sheet :open="exitSheet" title="退出练习？" @close="exitSheet = false">
        <div class="space-y-3 pb-2">
          <p class="text-[14.5px] text-ink2">进度已保存，下次进来会接着做。</p>
          <div class="grid grid-cols-2 gap-3 pb-2">
            <AppButton variant="secondary" size="lg" @click="exitSheet = false">继续作答</AppButton>
            <AppButton size="lg" @click="exitPractice">退出保存</AppButton>
          </div>
        </div>
      </Sheet>
    </template>
  </div>
</template>
