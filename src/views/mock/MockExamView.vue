<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useMockSessionStore } from '@/stores/mockSession'
import { useProgressStore } from '@/stores/progress'
import { loadQuestionMap } from '@/services/contentLoader'
import { grade } from '@/services/quizEngine'
import { emitTaskEvent } from '@/services/events'
import type { Question } from '@/types/schema'
import Sheet from '@/components/Sheet.vue'
import AppButton from '@/components/AppButton.vue'
import { toast } from '@/composables/toast'

const router = useRouter()
const mock = useMockSessionStore()
const store = useProgressStore()

const questions = ref<Question[]>([])
const loading = ref(true)
const submitting = ref(false)
const now = ref(Date.now())
const exitSheet = ref(false)
const cardSheet = ref(false)
let timer = 0

const q = computed(() => {
  const s = mock.session
  if (!s) return null
  return questions.value.find((x) => x.id === s.qids[s.current]) ?? null
})

const remainingMs = computed(() => {
  if (!mock.session) return 0
  return Math.max(0, mock.session.endAtEpochMs - now.value)
})
const clock = computed(() => {
  const sec = Math.floor(remainingMs.value / 1000)
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
})
const danger = computed(() => remainingMs.value < 5 * 60_000)
const answeredCount = computed(() => Object.keys(mock.session?.answers ?? {}).length)

onMounted(async () => {
  if (!mock.session || mock.session.finished) {
    router.replace('/mock/intro')
    return
  }
  try {
    const map = await loadQuestionMap(mock.session.qids)
    questions.value = mock.session.qids
      .map((id) => map.get(id))
      .filter((q): q is Question => !!q)
    if (questions.value.length !== mock.session.qids.length) {
      toast('部分题目缺失，已按现有题目考试', 'warn')
    }
  } finally {
    loading.value = false
  }
  timer = window.setInterval(() => {
    now.value = Date.now()
    if (remainingMs.value <= 0 && !submitting.value) {
      toast('时间到，自动交卷', 'warn')
      void submit(true)
    }
  }, 1000)
})
onUnmounted(() => window.clearInterval(timer))

function onChoose(i: number) {
  if (!mock.session || !q.value) return
  mock.answer(q.value.id, i)
}

function classFor(i: number): string[] {
  const chosen = mock.session?.answers[q.value?.id ?? ''] === i
  return chosen ? ['border-accent', 'bg-accent-soft'] : ['border-line', 'bg-paper']
}

async function submit(auto = false) {
  if (submitting.value || !mock.session) return
  if (!auto) {
    const left = questions.value.length - answeredCount.value
    if (left > 0) {
      const ok = window.confirm(`还有 ${left} 题未作答，确定交卷吗？`)
      if (!ok) return
    }
  }
  submitting.value = true
  try {
    const s = mock.session!
    let map: Map<string, Question>
    if (questions.value.length) {
      map = new Map(questions.value.map((x): [string, Question] => [x.id, x]))
    } else {
      map = await loadQuestionMap(s.qids)
    }
    let score = 0
    const wrongQids: string[] = []
    const unanswered: string[] = []
    for (const qid of s.qids) {
      const question = map.get(qid)
      if (!question) continue
      const choice = s.answers[qid]
      if (choice == null) {
        wrongQids.push(qid)
        unanswered.push(qid)
        continue
      }
      const ok = grade(question, choice)
      if (ok) score++
      else wrongQids.push(qid)
      store.recordAnswer(question, choice, ok, 'mock')
    }
    const durationSec = Math.round((Date.now() - new Date(s.startAt).getTime()) / 1000)
    store.pushMockAttempt({
      at: new Date().toISOString(),
      score,
      total: s.qids.length,
      durationSec,
      wrongQids,
      seed: s.seed,
      paper: s.qids,
      unanswered,
    })
    emitTaskEvent({ kind: 'mock', score, total: s.qids.length })
    mock.clear()
    router.replace('/mock/result')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="page bg-paper">
    <!-- 顶栏 -->
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
        <div class="flex-1 text-center">
          <p class="text-[13px] text-muted">
            第 {{ (mock.session?.current ?? 0) + 1 }}/{{ mock.session?.qids.length ?? 0 }} 题 ·
            已答 {{ answeredCount }}
          </p>
        </div>
        <span
          class="mr-1 rounded-full px-3 py-1.5 font-mono text-[16px] font-bold"
          :class="danger ? 'bg-danger-soft text-danger' : 'bg-surface text-ink'"
          >{{ clock }}</span
        >
      </div>
    </header>

    <div v-if="loading" class="page-body--nonav space-y-3 px-4 pt-4">
      <div class="h-6 w-40 animate-pulse rounded bg-line" />
      <div class="h-24 animate-pulse rounded-2xl bg-line" />
    </div>

    <template v-else-if="q && mock.session">
      <div class="page-body--nonav flex flex-col px-4 pb-44 pt-4">
        <div class="mb-3 flex items-center justify-between">
          <span class="rounded-full bg-accent-soft px-2.5 py-1 text-[12.5px] font-medium text-accent">
            {{ q.topic }}
          </span>
          <button
            type="button"
            class="min-h-9 rounded-full border px-3 text-[13.5px] font-medium"
            :class="mock.session.marked.includes(q.id) ? 'border-warn bg-warn-soft text-warn' : 'border-line text-muted'"
            @click="mock.toggleMark(q.id)"
          >
            {{ mock.session.marked.includes(q.id) ? '★ 已标记' : '☆ 标记本题' }}
          </button>
        </div>

        <p class="text-[17.5px] font-medium leading-relaxed" data-testid="q-stem">{{ q.stem }}</p>

        <div class="mt-4 space-y-2.5">
          <button
            v-for="(opt, i) in q.options"
            :key="i"
            type="button"
            data-testid="option"
            class="flex w-full items-start gap-3 rounded-2xl border-2 px-4 py-3.5 text-left transition-colors active:scale-[0.99]"
            :class="classFor(i)"
            @click="onChoose(i)"
          >
            <span
              class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[13px] font-bold"
              :class="
                mock.session.answers[q.id] === i
                  ? 'border-accent bg-accent text-white'
                  : 'border-line text-muted'
              "
              >{{ 'ABCD'[i] }}</span
            >
            <span class="text-[15.5px] leading-relaxed">{{ opt }}</span>
          </button>
        </div>

        <div class="flex-1" />
      </div>

      <!-- 底部：翻页 + 答题卡 + 交卷（固定，拇指可达） -->
      <div
        class="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/96 px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-2.5 backdrop-blur"
      >
        <div class="flex gap-2">
          <button
            type="button"
            class="min-h-11 rounded-xl border border-line px-4 text-[15px] font-medium active:bg-surface"
            :disabled="mock.session.current === 0"
            :class="mock.session.current === 0 ? 'opacity-40' : ''"
            @click="mock.jump(mock.session.current - 1)"
          >
            上一题
          </button>
          <button
            type="button"
            class="min-h-11 flex-1 rounded-xl border border-line text-[15px] font-medium active:bg-surface"
            @click="cardSheet = true"
          >
            答题卡
          </button>
          <button
            type="button"
            class="min-h-11 flex-1 rounded-xl border border-line text-[15px] font-medium active:bg-surface"
            :disabled="mock.session.current >= mock.session.qids.length - 1"
            :class="mock.session.current >= mock.session.qids.length - 1 ? 'opacity-40' : ''"
            @click="mock.jump(mock.session.current + 1)"
          >
            下一题
          </button>
        </div>
        <AppButton block size="lg" class="mt-2" :disabled="submitting" @click="submit(false)">
          {{ submitting ? '交卷中…' : `交卷（${answeredCount}/${mock.session.qids.length}）` }}
        </AppButton>
      </div>

      <!-- 答题卡 -->
      <Sheet :open="cardSheet" title="答题卡" @close="cardSheet = false">
        <div class="pb-2">
          <div class="mb-3 flex gap-4 text-[12.5px] text-muted">
            <span><i class="mr-1 inline-block h-3 w-3 rounded bg-accent align-[-2px]" />已答</span>
            <span><i class="mr-1 inline-block h-3 w-3 rounded border-2 border-line align-[-2px]" />未答</span>
            <span><i class="mr-1 inline-block h-3 w-3 rounded bg-warn align-[-2px]" />标记</span>
          </div>
          <div class="grid grid-cols-8 gap-2">
            <button
              v-for="(qid, i) in mock.session.qids"
              :key="qid"
              type="button"
              class="flex h-11 items-center justify-center rounded-lg border-2 text-[14.5px] font-medium"
              :class="
                mock.session!.current === i
                  ? 'border-accent bg-accent text-white'
                  : mock.session!.marked.includes(qid)
                    ? 'border-warn bg-warn-soft text-warn'
                    : mock.session!.answers[qid] != null
                      ? 'border-accent/40 bg-accent-soft text-accent'
                      : 'border-line text-ink2'
              "
              @click="mock.jump(i); cardSheet = false"
            >
              {{ i + 1 }}
            </button>
          </div>
          <AppButton block size="lg" class="mt-4" :disabled="submitting" @click="cardSheet = false; submit(false)">
            去交卷（{{ answeredCount }}/{{ mock.session.qids.length }}）
          </AppButton>
        </div>
      </Sheet>

      <!-- 退出确认 -->
      <Sheet :open="exitSheet" title="暂时退出？" @close="exitSheet = false">
        <div class="space-y-3 pb-2">
          <p class="text-[14.5px] text-ink2">
            进度已保存，计时继续走（按绝对截止时刻）。回来时若时间已到，会自动交卷。
          </p>
          <div class="grid grid-cols-2 gap-3 pb-2">
            <AppButton variant="secondary" size="lg" @click="exitSheet = false">继续作答</AppButton>
            <AppButton size="lg" @click="exitSheet = false; router.push('/mock/intro')">退出（可续考）</AppButton>
          </div>
        </div>
      </Sheet>
    </template>
  </div>
</template>
