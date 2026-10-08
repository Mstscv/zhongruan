<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useProgressStore } from '@/stores/progress'
import { getManifest, loadQuestionMap } from '@/services/contentLoader'
import { chapterOfQid } from '@/services/quizEngine'
import type { Question } from '@/types/schema'
import TopBar from '@/components/TopBar.vue'
import AppButton from '@/components/AppButton.vue'
import EmptyState from '@/components/EmptyState.vue'
import ProgressRing from '@/components/ProgressRing.vue'

const router = useRouter()
const store = useProgressStore()
const manifest = getManifest()

const attempt = computed(() => store.data.mock.attempts[store.data.mock.attempts.length - 1])
const passed = computed(() => attempt.value && attempt.value.score >= manifest.exam.passLine)

const wrongQuestions = ref<Question[]>([])
const explainOpen = ref<Record<string, boolean>>({})
const loadingWrong = ref(false)

onMounted(async () => {
  if (!attempt.value?.wrongQids.length) return
  loadingWrong.value = true
  try {
    const map = await loadQuestionMap(attempt.value.wrongQids)
    wrongQuestions.value = attempt.value.wrongQids
      .map((id) => map.get(id))
      .filter((q): q is Question => !!q)
  } finally {
    loadingWrong.value = false
  }
})

/** 按章得分分布（paper 为整卷题号） */
const chapterStats = computed(() => {
  const a = attempt.value
  if (!a || !a.paper.length) return []
  const wrongSet = new Set(a.wrongQids)
  const map = new Map<string, { total: number; wrong: number }>()
  for (const qid of a.paper) {
    const ch = chapterOfQid(qid)
    const cur = map.get(ch) ?? { total: 0, wrong: 0 }
    cur.total++
    if (wrongSet.has(qid)) cur.wrong++
    map.set(ch, cur)
  }
  return [...map.entries()]
    .map(([chId, s]) => ({
      chId,
      title: manifest.chapters.find((c) => c.id === chId)?.title ?? chId,
      ...s,
      correct: s.total - s.wrong,
      pct: Math.round(((s.total - s.wrong) / s.total) * 100),
    }))
    .sort((a2, b2) => a2.pct - b2.pct)
})

const history = computed(() => [...store.data.mock.attempts].reverse())
</script>

<template>
  <div class="page">
    <TopBar title="成绩单" :back="true" />

    <div class="page-body space-y-4 px-4 pt-4">
      <EmptyState
        v-if="!attempt"
        icon="🏁"
        title="还没有考试记录"
        desc="去组一套卷子，检验一下自己吧"
      >
        <AppButton @click="router.push('/mock/intro')">去模拟考</AppButton>
      </EmptyState>

      <template v-else>
        <!-- 分数 -->
        <section class="card flex items-center gap-5 p-5">
          <ProgressRing
            :percent="Math.round((attempt.score / attempt.total) * 100)"
            :size="96"
            :stroke="9"
            :color="passed ? 'var(--color-success)' : 'var(--color-danger)'"
          >
            <div class="text-center">
              <p class="text-[28px] font-bold leading-none" :class="passed ? 'text-success' : 'text-danger'">
                {{ attempt.score }}
              </p>
              <p class="text-[11px] text-muted">/{{ attempt.total }} 分</p>
            </div>
          </ProgressRing>
          <div class="flex-1">
            <p class="text-[20px] font-bold" :class="passed ? 'text-success' : 'text-danger'">
              {{ passed ? '🎉 达标' : '未达合格线' }}
            </p>
            <p class="mt-1 text-[14px] text-ink2">
              合格线 {{ manifest.exam.passLine }} 分（占位值）
            </p>
            <p class="text-[13.5px] text-muted">
              用时 {{ Math.round(attempt.durationSec / 60) }} 分钟 ·
              {{ attempt.at.slice(0, 10) }}
            </p>
          </div>
        </section>

        <!-- 按章分布 -->
        <section v-if="chapterStats.length" class="card p-4">
          <h2 class="mb-3 text-[16px] font-semibold">各章得分率（从弱到强）</h2>
          <div class="space-y-2.5">
            <div v-for="c in chapterStats" :key="c.chId">
              <div class="mb-1 flex justify-between text-[13.5px]">
                <span class="truncate pr-2">{{ c.title }}</span>
                <span class="shrink-0 text-muted">{{ c.correct }}/{{ c.total }}</span>
              </div>
              <div class="h-2 overflow-hidden rounded-full bg-surface">
                <div
                  class="h-full rounded-full"
                  :class="c.pct >= 60 ? 'bg-success' : c.pct >= 40 ? 'bg-warn' : 'bg-danger'"
                  :style="{ width: `${c.pct}%` }"
                />
              </div>
            </div>
          </div>
        </section>

        <!-- 错题解析 -->
        <section v-if="wrongQuestions.length">
          <h2 class="mb-1 px-1 text-[14px] font-semibold text-muted">
            错题解析（{{ wrongQuestions.length }} 道）
          </h2>
          <p class="mb-2 px-1 text-[12.5px] text-muted">答错的题已自动收入错题本；未作答的只计入成绩。</p>
          <div class="space-y-2.5">
            <div v-for="wq in wrongQuestions" :key="wq.id" class="card overflow-hidden">
              <button
                type="button"
                class="w-full px-4 py-3 text-left active:bg-surface"
                @click="explainOpen[wq.id] = !explainOpen[wq.id]"
              >
                <p class="line-clamp-2 text-[14.5px] leading-relaxed">{{ wq.stem }}</p>
                <p class="mt-1.5 text-[13px]">
                  <span v-if="attempt?.unanswered.includes(wq.id)" class="text-warn">未作答</span>
                  <span v-else class="text-success">正确 {{ wq.answer }}</span>
                  <span class="ml-2 text-accent">{{ explainOpen[wq.id] ? '收起 ▲' : '看解析 ▼' }}</span>
                </p>
              </button>
              <div v-if="explainOpen[wq.id]" class="border-t border-line bg-surface px-4 py-3 anim-slide-up">
                <p class="text-[13px] font-semibold text-accent">【考点】{{ wq.topic }}</p>
                <p class="mt-1.5 text-[14.5px] leading-relaxed text-ink2">{{ wq.explanation }}</p>
              </div>
            </div>
          </div>
        </section>
        <p v-else-if="!loadingWrong" class="text-center text-[14px] text-success">全部答对，零错题 🎉</p>

        <!-- 操作 -->
        <div class="grid grid-cols-2 gap-3">
          <AppButton variant="secondary" size="lg" @click="router.push('/quiz')">返回题库</AppButton>
          <AppButton size="lg" @click="router.push('/mock/intro')">再考一次</AppButton>
        </div>

        <!-- 全部历史 -->
        <section class="card p-4">
          <h2 class="mb-2 text-[16px] font-semibold">全部成绩（{{ history.length }} 次）</h2>
          <div class="space-y-1.5 text-[14px]">
            <div
              v-for="(a, i) in history"
              :key="a.at"
              class="flex items-center justify-between rounded-lg bg-surface px-3 py-2"
            >
              <span class="text-muted">#{{ history.length - i }} · {{ a.at.slice(0, 10) }}</span>
              <span class="text-ink2">{{ Math.round(a.durationSec / 60) }} 分钟</span>
              <span class="font-bold" :class="a.score >= manifest.exam.passLine ? 'text-success' : 'text-danger'">
                {{ a.score }} 分
              </span>
            </div>
          </div>
        </section>
      </template>
    </div>
  </div>
</template>
