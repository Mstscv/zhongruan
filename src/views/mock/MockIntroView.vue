<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useProgressStore } from '@/stores/progress'
import { useMockSessionStore } from '@/stores/mockSession'
import { getManifest, loadChapterQuestions } from '@/services/contentLoader'
import { buildPaper, mulberry32 } from '@/services/quizEngine'
import type { Question } from '@/types/schema'
import TopBar from '@/components/TopBar.vue'
import AppButton from '@/components/AppButton.vue'
import { toast } from '@/composables/toast'

const router = useRouter()
const store = useProgressStore()
const mock = useMockSessionStore()
const manifest = getManifest()

const count = ref<75 | 25>(75)
const building = ref(false)

const resumeSession = computed(() => (mock.session && !mock.session.finished ? mock.session : null))

const minutes = computed(() =>
  count.value === 75
    ? store.data.profile.paperMinutes
    : Math.max(15, Math.round((store.data.profile.paperMinutes * count.value) / 75)),
)

const best = computed(() => {
  const attempts = store.data.mock.attempts
  if (!attempts.length) return null
  return attempts.reduce((a, b) => (b.score > a.score ? b : a))
})

async function startExam() {
  if (building.value) return
  building.value = true
  try {
    const rand = mulberry32(Date.now() % 2147483647)
    // 加载全部有题章节
    const byChapter: Record<string, Question[]> = {}
    for (const ch of manifest.chapters) {
      if (ch.questionCount > 0) byChapter[ch.id] = await loadChapterQuestions(ch.id)
    }
    const totalQ = Object.values(byChapter).reduce((a, arr) => a + arr.length, 0)
    if (totalQ < manifest.blueprint.total) {
      toast(`当前题库仅 ${totalQ} 题，将按现有题量组卷`, 'info')
    }

    // 避开近 3 天做对的题
    const cutoff = Date.now() - 3 * 86_400_000
    const recentCorrect = new Set(
      Object.entries(store.data.quiz.answered)
        .filter(([, r]) => r.correct > 0 && new Date(r.lastAt).getTime() >= cutoff)
        .map(([id]) => id),
    )

    const weights: Record<string, number> = {}
    for (const [k, w] of Object.entries(manifest.blueprint.weights)) {
      if (byChapter[k]?.length) weights[k] = w
    }
    const paper = buildPaper({ byChapter, weights, recentCorrect, rand, totalCount: count.value })
    if (!paper.length) {
      toast('题库还没有题目，无法组卷', 'warn')
      return
    }
    mock.start({ qids: paper, count: paper.length, minutes: minutes.value, seed: Date.now() % 2147483647 })
    router.push('/mock/exam')
  } finally {
    building.value = false
  }
}
</script>

<template>
  <div class="page">
    <TopBar title="模拟考试" :back="true" />

    <div class="page-body--nonav space-y-4 px-4 pb-28 pt-4">
      <!-- 未完成考试 -->
      <section v-if="resumeSession" class="card border-warn/40 bg-warn-soft p-4">
        <p class="text-[15.5px] font-semibold text-warn">
          ⏳ 你有一场未完成的模拟考（{{ resumeSession.qids.length }} 题）
        </p>
        <p class="mt-0.5 text-[13.5px] text-ink2">
          剩余时间按开始时的截止时刻计算，超时会自动交卷。
        </p>
        <AppButton class="mt-3" block @click="router.push('/mock/exam')">继续作答</AppButton>
      </section>

      <!-- 规则 -->
      <section class="card p-4">
        <h2 class="text-[16px] font-semibold">考试规则</h2>
        <ul class="mt-2 space-y-1.5 text-[14.5px] leading-relaxed text-ink2">
          <li>· 卷面 {{ manifest.blueprint.total }} 题，每题 1 分，满分 {{ manifest.blueprint.total }} 分</li>
          <li>· 合格线 {{ manifest.exam.passLine }} 分（占位值，请以官方通知为准）</li>
          <li>· 默认时长 {{ store.data.profile.paperMinutes }} 分钟，可到"我的"里修改</li>
          <li>· 计时按绝对截止时刻，退出/刷新都能续考，超时自动交卷</li>
          <li>· 交卷后出成绩单：分数、按章得分分布、错题解析</li>
          <li>· 抽卷会尽量避开你近 3 天已做对的题</li>
        </ul>
      </section>

      <!-- 卷种 -->
      <section>
        <h2 class="mb-2 px-1 text-[14px] font-semibold text-muted">选择卷种</h2>
        <div class="grid grid-cols-2 gap-3">
          <button
            v-for="c in [
              { v: 75, t: '全真模拟', d: `${manifest.blueprint.total} 题 · ${store.data.profile.paperMinutes} 分钟` },
              { v: 25, t: '练习卷', d: `${25} 题 · ${Math.max(15, Math.round((store.data.profile.paperMinutes * 25) / 75))} 分钟` },
            ]"
            :key="c.v"
            type="button"
            class="rounded-2xl border p-4 text-left transition-colors"
            :class="count === c.v ? 'border-accent bg-accent-soft' : 'border-line bg-paper'"
            @click="count = c.v as 75 | 25"
          >
            <p class="text-[16.5px] font-semibold">{{ c.t }}</p>
            <p class="mt-1 text-[13px] text-muted">{{ c.d }}</p>
          </button>
        </div>
      </section>

      <!-- 历史成绩 -->
      <section v-if="store.data.mock.attempts.length" class="card p-4">
        <h2 class="mb-2 text-[16px] font-semibold">历史成绩</h2>
        <div class="space-y-1.5 text-[14.5px]">
          <div
            v-for="a in [...store.data.mock.attempts].reverse().slice(0, 5)"
            :key="a.at"
            class="flex items-center justify-between rounded-lg bg-surface px-3 py-2"
          >
            <span class="text-muted">{{ a.at.slice(0, 10) }}</span>
            <span>{{ a.total }} 题 · 用时 {{ Math.round(a.durationSec / 60) }} 分钟</span>
            <span
              class="font-bold"
              :class="a.score >= manifest.exam.passLine ? 'text-success' : 'text-danger'"
              >{{ a.score }} 分</span
            >
          </div>
        </div>
        <p v-if="best" class="mt-2 text-[13px] text-muted">
          最高分 {{ best.score }} 分 · 共 {{ store.data.mock.attempts.length }} 次
        </p>
      </section>

      <p class="px-2 pb-1 text-center text-[11.5px] text-muted">
        组卷按章节权重与难度分层抽样；题库为 AI 生成的练习材料
      </p>
    </div>

    <div
      class="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/96 px-4 pb-[calc(14px+env(safe-area-inset-bottom))] pt-3 backdrop-blur"
    >
      <AppButton block size="lg" :disabled="building" @click="startExam">
        {{ building ? '正在组卷…' : `开始考试（${count} 题 · ${minutes} 分钟）` }}
      </AppButton>
    </div>
  </div>
</template>
