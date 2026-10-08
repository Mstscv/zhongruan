<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useProgressStore } from '@/stores/progress'
import AppButton from '@/components/AppButton.vue'
import { todayStr, daysBetween } from '@/utils/date'

const router = useRouter()
const store = useProgressStore()

const step = ref(0)
const agreed = ref(false)
const examDate = ref(store.data.profile.examDate)
const dailyMinutes = ref(store.data.profile.dailyMinutes)

const presetDates = [
  { label: '2027年5月', value: '2027-05-22', hint: '约7个月准备期' },
  { label: '2027年11月', value: '2027-11-07', hint: '约13个月，更从容' },
]
const presetMinutes = [
  { v: 30, label: '30分钟', hint: '通勤碎片时间' },
  { v: 60, label: '1小时', hint: '推荐起步' },
  { v: 90, label: '1.5小时', hint: '稳扎稳打' },
  { v: 120, label: '2小时', hint: '冲刺强度' },
]

const daysUntilSelected = computed(() => daysBetween(examDate.value, todayStr()))

const canNext = computed(() => {
  if (step.value === 0) return agreed.value
  if (step.value === 1) return !!examDate.value && examDate.value >= todayStr()
  return true
})

function next() {
  if (!canNext.value) return
  if (step.value < 2) {
    step.value++
    return
  }
  store.setProfile({
    onboarded: true,
    examDate: examDate.value,
    dailyMinutes: dailyMinutes.value,
    startDate: todayStr(),
  })
  router.replace('/')
}

function preset(v: string) {
  examDate.value = v
}
</script>

<template>
  <div class="page bg-paper">
    <header class="topbar flex min-h-[52px] items-center gap-2 px-2">
      <button
        v-if="step > 0"
        type="button"
        class="flex h-11 w-11 items-center justify-center rounded-full active:bg-surface"
        aria-label="上一步"
        @click="step--"
      >
        <svg viewBox="0 0 24 24" class="h-6 w-6" fill="none">
          <path d="M14.5 5.5 8 12l6.5 6.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
      <div class="flex gap-1.5 px-2">
        <span
          v-for="i in 3"
          :key="i"
          class="h-1.5 rounded-full transition-all"
          :class="i - 1 <= step ? 'w-7 bg-accent' : 'w-3 bg-line'"
        />
      </div>
    </header>

    <div class="page-body--nonav flex flex-1 flex-col overflow-y-auto px-6 pb-8 pt-6">
      <!-- 第1屏：免责与欢迎 -->
      <template v-if="step === 0">
        <div class="flex-1">
          <p class="text-[13.5px] font-medium text-accent">软考 · 中级</p>
          <h1 class="mt-2 text-[28px] font-bold leading-snug">
            系统集成项目管理工程师<br />备考站
          </h1>
          <p class="mt-4 text-[15.5px] leading-relaxed text-ink2">
            零基础也没关系：按计划读手册、刷题、练案例，每天一点，直到考试。
          </p>

          <div class="mt-6 rounded-2xl bg-warn-soft border border-warn/30 p-4">
            <p class="text-[14.5px] font-semibold text-warn">开始前请知悉</p>
            <ul class="mt-2 space-y-1.5 text-[14px] leading-relaxed text-ink2">
              <li>· 本工具的手册、题库为 AI 生成的练习材料</li>
              <li>· 知识点请对照《系统集成项目管理工程师教程（第3版）》校对</li>
              <li>· 考试日期、题型分值以官方通知为准，可在"我的"里修改</li>
              <li>· 学习记录保存在本机，请定期"导出备份"</li>
            </ul>
          </div>

          <label class="mt-5 flex cursor-pointer items-center gap-3 rounded-2xl border border-line p-4 active:bg-surface">
            <input
              v-model="agreed"
              type="checkbox"
              class="h-5 w-5 shrink-0 accent-accent"
            />
            <span class="text-[15px]">我已知悉并同意以上说明</span>
          </label>
        </div>
        <AppButton block size="lg" :disabled="!agreed" @click="next">开始设置</AppButton>
      </template>

      <!-- 第2屏：考试日期 -->
      <template v-else-if="step === 1">
        <div class="flex-1">
          <h1 class="text-[24px] font-bold">你打算哪次考试？</h1>
          <p class="mt-2 text-[15px] text-ink2">软考每年5月、11月各举行一次，之后可随时修改。</p>

          <div class="mt-6 space-y-3">
            <button
              v-for="p in presetDates"
              :key="p.value"
              type="button"
              class="flex w-full items-center justify-between rounded-2xl border px-5 py-4 text-left transition-colors"
              :class="examDate === p.value ? 'border-accent bg-accent-soft' : 'border-line bg-paper'"
              @click="preset(p.value)"
            >
              <div>
                <p class="text-[16.5px] font-semibold">{{ p.label }}</p>
                <p class="text-[13.5px] text-muted">{{ p.hint }}</p>
              </div>
              <span
                class="flex h-6 w-6 items-center justify-center rounded-full text-[13px] text-white"
                :class="examDate === p.value ? 'bg-accent' : 'bg-line text-transparent'"
                >✓</span
              >
            </button>

            <div class="rounded-2xl border border-line bg-paper px-5 py-4">
              <p class="mb-2 text-[14.5px] font-medium">或自定义日期</p>
              <input
                v-model="examDate"
                type="date"
                :min="todayStr()"
                class="w-full rounded-xl bg-surface px-3 py-2.5 text-[16px] outline-none"
              />
            </div>
          </div>
          <p class="mt-4 text-[13.5px] text-muted">
            已选：{{ examDate
            }}{{ daysUntilSelected >= 0 ? `（还有 ${daysUntilSelected} 天）` : '（日期已过，请重新选择）' }}
          </p>
        </div>
        <AppButton block size="lg" :disabled="!canNext" @click="next">下一步</AppButton>
      </template>

      <!-- 第3屏：每日时长 -->
      <template v-else>
        <div class="flex-1">
          <h1 class="text-[24px] font-bold">每天能学多久？</h1>
          <p class="mt-2 text-[15px] text-ink2">用来安排每日任务量，之后可在"我的"里调整。</p>

          <div class="mt-6 grid grid-cols-2 gap-3">
            <button
              v-for="p in presetMinutes"
              :key="p.v"
              type="button"
              class="rounded-2xl border px-4 py-5 text-left transition-colors"
              :class="dailyMinutes === p.v ? 'border-accent bg-accent-soft' : 'border-line bg-paper'"
              @click="dailyMinutes = p.v"
            >
              <p class="text-[19px] font-bold">{{ p.label }}</p>
              <p class="mt-0.5 text-[13.5px] text-muted">{{ p.hint }}</p>
            </button>
          </div>

          <div class="mt-6 rounded-2xl bg-accent-soft p-4">
            <p class="text-[14.5px] leading-relaxed text-ink2">
              接下来会按"基础学习 → 强化刷题 → 冲刺模拟"三个阶段，把每天的任务拆好。
              第一天的任务在首页生成，随时可以调整。
            </p>
          </div>
        </div>
        <AppButton block size="lg" @click="next">生成我的计划</AppButton>
      </template>
    </div>
  </div>
</template>
