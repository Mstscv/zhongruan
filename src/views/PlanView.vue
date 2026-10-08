<script setup lang="ts">
import { computed, ref } from 'vue'
import { useProgressStore } from '@/stores/progress'
import { ensureTodayTasks } from '@/services/bootstrap'
import { PHASE_META, phaseOf, phaseSegments, planSignature } from '@/services/plan'
import { todayStr, daysBetween } from '@/utils/date'
import TopBar from '@/components/TopBar.vue'
import AppButton from '@/components/AppButton.vue'
import { toast } from '@/composables/toast'

const store = useProgressStore()

const examDate = ref(store.data.profile.examDate)
const dailyMinutes = ref(store.data.profile.dailyMinutes)
const phase = computed(() => phaseOf(store.data.profile))
const segments = computed(() => phaseSegments(store.data.profile))
const todayTasks = computed(() => store.data.plan.tasksByDate[todayStr()] ?? [])

const daysLeft = computed(() => Math.max(0, daysBetween(store.data.profile.examDate, todayStr())))

function save() {
  store.setProfile({ examDate: examDate.value, dailyMinutes: Number(dailyMinutes.value) })
  ensureTodayTasks(store)
  toast('已保存，今日任务已按新设置刷新', 'success')
}

function regenerate() {
  const today = todayStr()
  delete store.data.plan.tasksByDate[today]
  ensureTodayTasks(store)
  toast('已重新生成今日任务（已达成的项会自动勾选，打卡保留）', 'info')
}
</script>

<template>
  <div class="page">
    <TopBar title="学习计划" :back="true" />

    <div class="page-body space-y-4 px-4 pt-4">
      <!-- 当前阶段 -->
      <section class="card p-4">
        <div class="flex items-center gap-2">
          <span class="h-3 w-3 rounded-full" :style="{ background: PHASE_META[phase].color }" />
          <h2 class="text-[17px] font-bold">{{ PHASE_META[phase].label }}</h2>
          <span class="ml-auto text-[13.5px] text-muted">距考试 {{ daysLeft }} 天</span>
        </div>
        <p class="mt-1 text-[14px] text-ink2">{{ PHASE_META[phase].desc }}</p>

        <!-- 阶段时间线 -->
        <div class="mt-4 space-y-2">
          <div
            v-for="s in segments"
            :key="s.phase"
            class="flex items-center gap-3 rounded-xl px-3 py-2"
            :class="s.phase === phase ? 'bg-accent-soft' : ''"
          >
            <span
              class="h-2.5 w-2.5 shrink-0 rounded-full"
              :style="{ background: PHASE_META[s.phase].color, opacity: s.phase === phase ? 1 : 0.35 }"
            />
            <span
              class="w-20 shrink-0 text-[14px] font-medium"
              :class="s.phase === phase ? 'text-accent' : 'text-muted'"
              >{{ PHASE_META[s.phase].label }}</span
            >
            <span class="text-[12.5px] text-muted">{{ s.from }} ~ {{ s.to }}</span>
          </div>
        </div>
      </section>

      <!-- 今日任务 -->
      <section class="card p-4">
        <div class="mb-2 flex items-center justify-between">
          <h2 class="text-[16px] font-semibold">今日任务</h2>
          <span class="text-[13px] text-muted"
            >{{ todayTasks.filter((t) => t.done).length }}/{{ todayTasks.length }} 完成</span
          >
        </div>
        <ul v-if="todayTasks.length" class="space-y-2.5">
          <li
            v-for="t in todayTasks"
            :key="t.id"
            class="flex items-center justify-between gap-3 rounded-xl bg-surface px-3.5 py-3"
          >
            <div class="min-w-0">
              <p class="truncate text-[15px]" :class="t.done ? 'text-muted line-through' : ''">{{ t.label }}</p>
              <p class="text-[12.5px] text-muted">约 {{ t.estMin }} 分钟</p>
            </div>
            <span
              class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[14px]"
              :class="t.done ? 'bg-success text-white' : 'border-2 border-line text-transparent'"
              >✓</span
            >
          </li>
        </ul>
        <p v-else class="text-[14px] text-muted">今天还没有任务</p>
        <button
          type="button"
          class="mt-3 min-h-10 w-full rounded-xl border border-line text-[14.5px] text-ink2 active:bg-surface"
          @click="regenerate"
        >
          重新生成今日任务
        </button>
      </section>

      <!-- 设置 -->
      <section class="card space-y-4 p-4">
        <h2 class="text-[16px] font-semibold">计划设置</h2>
        <label class="block">
          <span class="text-[14px] text-ink2">考试日期</span>
          <input
            v-model="examDate"
            type="date"
            :min="todayStr()"
            class="mt-1.5 w-full rounded-xl bg-surface px-3 py-2.5 text-[16px] outline-none"
          />
        </label>
        <div>
          <span class="text-[14px] text-ink2">每日学习时长</span>
          <div class="mt-1.5 flex gap-2">
            <button
              v-for="m in [30, 60, 90, 120]"
              :key="m"
              type="button"
              class="min-h-10 flex-1 rounded-xl border text-[15px] font-medium"
              :class="dailyMinutes === m ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-paper'"
              @click="dailyMinutes = m"
            >
              {{ m }} 分钟
            </button>
          </div>
        </div>
        <AppButton block @click="save">保存并刷新任务</AppButton>
        <p class="text-[12.5px] text-muted">
          当前计划指纹：{{ planSignature(store.data.profile) }}（改动只影响今天及以后，历史打卡保留）
        </p>
      </section>
    </div>
  </div>
</template>
