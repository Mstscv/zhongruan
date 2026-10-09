<script setup lang="ts">
import { computed, ref } from 'vue'
import { useProgressStore } from '@/stores/progress'
import { daysInMonth, localDateOf, todayStr } from '@/utils/date'
import TopBar from '@/components/TopBar.vue'

const store = useProgressStore()

const now = new Date()
const year = ref(now.getFullYear())
const month = ref(now.getMonth() + 1) // 1-12

const checkinSet = computed(() => new Set(store.data.checkin.days))

const monthLabel = computed(() => `${year.value} 年 ${month.value} 月`)

/** 从周一开始：周一=0 … 周日=6 */
function mondayIndex(dow: number): number {
  return (dow + 6) % 7
}

const cells = computed(() => {
  const first = new Date(year.value, month.value - 1, 1)
  const lead = mondayIndex(first.getDay())
  const total = daysInMonth(year.value, month.value)
  const list: Array<{ day: number; inMonth: boolean; date: string }> = []
  for (let i = 0; i < lead; i++) list.push({ day: 0, inMonth: false, date: '' })
  for (let d = 1; d <= total; d++) {
    const date = `${year.value}-${String(month.value).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    list.push({ day: d, inMonth: true, date })
  }
  return list
})

function shift(delta: number) {
  let m = month.value + delta
  let y = year.value
  if (m < 1) {
    m = 12
    y--
  } else if (m > 12) {
    m = 1
    y++
  }
  month.value = m
  year.value = y
}

const today = todayStr()

/** 近 7 天每日做题数（含今天） */
const last7 = computed(() => {
  const counts: { date: string; n: number }[] = []
  const d = new Date()
  for (let i = 6; i >= 0; i--) {
    const day = new Date(d)
    day.setDate(d.getDate() - i)
    const ds = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
    counts.push({
      date: ds,
      n: store.data.quiz.history.filter((h) => localDateOf(h.at) === ds).length,
    })
  }
  return counts
})
const max7 = computed(() => Math.max(5, ...last7.value.map((c) => c.n)))

const weekdayLabels = ['一', '二', '三', '四', '五', '六', '日']
</script>

<template>
  <div class="page">
    <TopBar title="学习打卡" :back="true" />

    <div class="page-body space-y-4 px-4 pt-4">
      <!-- 统计 -->
      <section class="grid grid-cols-3 gap-3">
        <div class="card p-3.5 text-center">
          <p class="text-[26px] font-bold text-accent">{{ store.streak }}</p>
          <p class="text-[12.5px] text-muted">连续打卡（天）</p>
        </div>
        <div class="card p-3.5 text-center">
          <p class="text-[26px] font-bold">{{ store.totalStudyDays }}</p>
          <p class="text-[12.5px] text-muted">累计学习（天）</p>
        </div>
        <div class="card p-3.5 text-center">
          <p class="text-[26px] font-bold">{{ store.data.quiz.history.length }}</p>
          <p class="text-[12.5px] text-muted">累计做题（次）</p>
        </div>
      </section>

      <!-- 月历 -->
      <section class="card p-4">
        <div class="mb-3 flex items-center justify-between">
          <button type="button" class="flex h-9 w-9 items-center justify-center rounded-full active:bg-surface" @click="shift(-1)">‹</button>
          <h2 class="text-[16px] font-semibold">{{ monthLabel }}</h2>
          <button type="button" class="flex h-9 w-9 items-center justify-center rounded-full active:bg-surface" @click="shift(1)">›</button>
        </div>
        <div class="grid grid-cols-7 gap-1 text-center">
          <span v-for="w in weekdayLabels" :key="w" class="pb-1 text-[12px] text-muted">{{ w }}</span>
          <template v-for="(c, i) in cells" :key="i">
            <span v-if="!c.inMonth" />
            <span
              v-else
              class="relative mx-auto flex h-9 w-9 flex-col items-center justify-center rounded-full text-[14px]"
              :class="[
                c.date === today ? 'bg-accent text-white font-bold' : '',
                c.date !== today && checkinSet.has(c.date) ? 'bg-success-soft text-success font-semibold' : '',
                c.date !== today && !checkinSet.has(c.date) ? 'text-ink2' : '',
              ]"
            >
              {{ c.day }}
              <span
                v-if="checkinSet.has(c.date) && c.date !== today"
                class="absolute -bottom-0.5 h-1.5 w-1.5 rounded-full bg-success"
              />
            </span>
          </template>
        </div>
        <p class="mt-3 text-center text-[12.5px] text-muted">完成任意一项当日任务即自动打卡 ✓</p>
      </section>

      <!-- 近7天 -->
      <section class="card p-4">
        <h2 class="mb-3 text-[16px] font-semibold">近 7 天做题</h2>
        <div class="flex h-28 items-end gap-2">
          <div v-for="c in last7" :key="c.date" class="flex flex-1 flex-col items-center gap-1">
            <span v-if="c.n" class="text-[11.5px] font-medium text-ink2">{{ c.n }}</span>
            <div
              class="w-full rounded-t-md bg-accent/75 transition-all"
              :style="{ height: `${Math.max(3, (c.n / max7) * 76)}px` }"
            />
            <span class="text-[11px] text-muted">{{ c.date.slice(8) }}</span>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
