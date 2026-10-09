<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useProgressStore } from '@/stores/progress'
import { getManifest } from '@/services/contentLoader'
import { ensureTodayTasks } from '@/services/bootstrap'
import { PHASE_META, phaseOf } from '@/services/plan'
import ProgressRing from '@/components/ProgressRing.vue'
import { todayStr } from '@/utils/date'

const router = useRouter()
const store = useProgressStore()
const manifest = getManifest()

onMounted(() => {
  if (!store.data.profile.onboarded) router.replace('/onboard')
  store.ensureStartDate()
  ensureTodayTasks(store)
})

const phase = computed(() => phaseOf(store.data.profile))
const phaseMeta = computed(() => PHASE_META[phase.value])

const daysLeft = computed(() => Math.max(0, store.daysLeft))

const stats = computed(() => {
  const totalSections = manifest.chapters.reduce((a, c) => a + c.sections.length, 0)
  const readIds = new Set(Object.keys(store.data.handbook.readSections))
  const read = manifest.chapters.reduce(
    (a, c) => a + c.sections.filter((s) => readIds.has(s.id)).length,
    0,
  )
  const totalQ = manifest.chapters.reduce((a, c) => a + c.questionCount, 0)
  const answeredQ = Object.keys(store.data.quiz.answered).length
  const totalCases = manifest.chapters.reduce((a, c) => a + c.cases.length, 0)
  const doneCases = Object.keys(store.data.cases).length
  const todayTasks = store.data.plan.tasksByDate[todayStr()] ?? []
  const taskDone = todayTasks.filter((t) => t.done).length
  const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0)
  return {
    read,
    totalSections,
    readPct: pct(read, totalSections),
    answeredQ,
    totalQ,
    quizPct: pct(answeredQ, totalQ),
    doneCases,
    totalCases,
    casePct: pct(doneCases, totalCases),
    todayTasks,
    taskDone,
    planPct: todayTasks.length ? pct(taskDone, todayTasks.length) : 0,
  }
})

const lastReadTitle = computed(() => {
  const id = store.data.handbook.lastRead
  if (!id) return null
  const ch = manifest.chapters.find((c) => c.id === id.split('--')[0])
  const s = ch?.sections.find((x) => x.id === id)
  return s ? { id: s.id, title: s.title } : null
})
</script>

<template>
  <div class="page">
    <header class="topbar">
      <div class="flex min-h-[52px] items-center justify-between px-4">
        <div>
          <p class="text-[13px] text-muted">系统集成项目管理工程师</p>
          <h1 class="text-[17px] font-bold leading-tight">软考备考站</h1>
        </div>
        <router-link
          to="/calendar"
          class="flex min-h-10 items-center gap-1.5 rounded-full border border-line bg-paper px-3 text-[14px] font-medium active:bg-surface"
        >
          <span aria-hidden="true">🔥</span>
          连续 {{ store.streak }} 天
        </router-link>
      </div>
    </header>

    <div class="page-body space-y-4 px-4 pt-4">
      <!-- 倒计时 -->
      <section class="card overflow-hidden">
        <div class="flex items-end justify-between bg-accent-soft px-5 pb-4 pt-5">
          <div>
            <p class="text-[13.5px] font-medium text-accent">距考试还有</p>
            <p class="mt-0.5 flex items-baseline gap-1.5">
              <span class="text-[52px] font-bold leading-none tracking-tight text-ink">{{
                daysLeft
              }}</span>
              <span class="text-[15px] font-medium text-ink2">天</span>
            </p>
            <p class="mt-2 inline-flex items-center gap-1.5 rounded-full bg-paper px-2.5 py-1 text-[12.5px] font-medium">
              <span class="h-2 w-2 rounded-full" :style="{ background: phaseMeta.color }" />
              {{ phaseMeta.label }} · {{ phaseMeta.desc }}
            </p>
            <p class="mt-2 text-[13px] text-muted">
              考试日期 {{ store.data.profile.examDate }}
              <router-link to="/me" class="ml-1 text-accent underline-offset-2">修改</router-link>
            </p>
          </div>
          <div class="shrink-0 whitespace-nowrap pb-1 text-right">
            <p class="text-[12.5px] text-muted">今日学习</p>
            <p class="text-[15px] font-semibold">
              {{ stats.taskDone }}/{{ stats.todayTasks.length || '—' }} 项
            </p>
          </div>
        </div>
      </section>

      <!-- 今日任务 -->
      <section v-if="stats.todayTasks.length" class="card p-4">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="text-[16px] font-semibold">今日任务</h2>
          <router-link to="/plan" class="text-[13.5px] text-accent">计划详情 ›</router-link>
        </div>
        <ul class="space-y-2.5">
          <li
            v-for="t in stats.todayTasks"
            :key="t.id"
            class="flex items-center justify-between gap-3 rounded-xl bg-surface px-3.5 py-3"
          >
            <div class="min-w-0">
              <p class="truncate text-[15px]" :class="t.done ? 'text-muted line-through' : 'text-ink'">
                {{ t.label }}
              </p>
              <p class="text-[12.5px] text-muted">约 {{ t.estMin }} 分钟</p>
            </div>
            <span
              class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[14px]"
              :class="t.done ? 'bg-success text-white' : 'border-2 border-line text-transparent'"
              >✓</span
            >
          </li>
        </ul>
      </section>

      <!-- 快速入口 -->
      <section class="grid grid-cols-4 gap-3">
        <router-link
          v-for="q in [
            { to: '/quiz', icon: '📝', label: '刷题' },
            { to: '/handbook', icon: '📖', label: '手册' },
            { to: '/case', icon: '🗂️', label: '案例' },
            { to: '/mock/intro', icon: '⏱️', label: '模拟考' },
          ]"
          :key="q.to"
          :to="q.to"
          class="card flex flex-col items-center gap-1 py-3.5 active:bg-surface"
        >
          <span class="text-[22px]" aria-hidden="true">{{ q.icon }}</span>
          <span class="text-[13px] font-medium">{{ q.label }}</span>
        </router-link>
      </section>

      <!-- 继续上次 -->
      <section v-if="lastReadTitle" class="card flex items-center justify-between gap-3 px-4 py-3.5">
        <div class="min-w-0">
          <p class="text-[12.5px] text-muted">继续上次阅读</p>
          <p class="truncate text-[15px] font-medium">《{{ lastReadTitle.title }}》</p>
        </div>
        <router-link :to="`/handbook/${lastReadTitle.id}`" class="shrink-0">
          <span class="inline-flex min-h-10 items-center rounded-xl bg-accent px-4 text-[15px] font-semibold text-white"
            >继续</span
          >
        </router-link>
      </section>

      <!-- 四模块进度 -->
      <section class="card p-4">
        <h2 class="mb-3 text-[16px] font-semibold">学习进度</h2>
        <div class="grid grid-cols-4 gap-1">
          <div v-for="m in [
            { label: '手册', pct: stats.readPct, n: `${stats.read}/${stats.totalSections}`, color: 'var(--color-accent)' },
            { label: '刷题', pct: stats.quizPct, n: `${stats.answeredQ}/${stats.totalQ}`, color: 'var(--color-success)' },
            { label: '案例', pct: stats.casePct, n: `${stats.doneCases}/${stats.totalCases}`, color: 'var(--color-warn)' },
            { label: '今日', pct: stats.planPct, n: `${stats.taskDone}/${stats.todayTasks.length || 0}`, color: 'var(--color-ink)' },
          ]" :key="m.label" class="flex flex-col items-center gap-1.5">
            <ProgressRing :percent="m.pct" :size="58" :stroke="5" :color="m.color">
              <span class="text-[13px] font-semibold">{{ m.pct }}%</span>
            </ProgressRing>
            <p class="text-[13px] font-medium">{{ m.label }}</p>
            <p class="text-[11.5px] text-muted">{{ m.n }}</p>
          </div>
        </div>
      </section>

      <p class="px-2 pb-2 text-center text-[11.5px] leading-relaxed text-muted">
        {{ manifest.disclaimer }}
      </p>
    </div>
  </div>
</template>
