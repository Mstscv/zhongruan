<script setup lang="ts">
import { computed, ref } from 'vue'
import { useProgressStore } from '@/stores/progress'
import { downloadBackup, parseBackup, pickBackupFile, summarize } from '@/services/backup'
import { storageSize } from '@/stores/persistence'
import { PROGRESS_KEY } from '@/stores/progress'
import { getManifest } from '@/services/contentLoader'
import type { Progress } from '@/types/schema'
import TopBar from '@/components/TopBar.vue'
import AppButton from '@/components/AppButton.vue'
import Sheet from '@/components/Sheet.vue'
import { toast } from '@/composables/toast'
import { todayStr } from '@/utils/date'

const store = useProgressStore()
const manifest = getManifest()

const stats = computed(() => ({
  answered: Object.keys(store.data.quiz.answered).length,
  wrong: Object.keys(store.data.quiz.wrongBook).length,
  read: Object.keys(store.data.handbook.readSections).length,
  days: store.totalStudyDays,
  mocks: store.data.mock.attempts.length,
}))

const sizeKB = computed(() => Math.max(1, Math.round(storageSize(PROGRESS_KEY) / 1024)))

/* ── 导入备份 ───────────────────────────── */
const importSheet = ref(false)
const pendingBackup = ref<Progress | null>(null)
const pendingSummary = ref<ReturnType<typeof summarize> | null>(null)
const importError = ref('')

async function onImport() {
  importError.value = ''
  try {
    const text = await pickBackupFile()
    const result = parseBackup(text)
    if (!result.ok) {
      importError.value = result.error
      toast(result.error, 'warn')
      return
    }
    pendingBackup.value = result.backup.progress
    pendingSummary.value = summarize(result.backup.progress)
    importSheet.value = true
  } catch (e) {
    /* 用户取消选择 */
  }
}

function confirmImport() {
  if (!pendingBackup.value) return
  store.importProgress(pendingBackup.value)
  importSheet.value = false
  pendingBackup.value = null
  toast('备份已恢复，进度回来了 ✓', 'success')
}

function onExport() {
  downloadBackup(store.data)
  toast('备份文件已下载', 'success')
}

/* ── 清空数据 ───────────────────────────── */
const confirmClear = ref(false)
function clearAll() {
  store.clearAll()
  confirmClear.value = false
  toast('已清空全部学习数据', 'warn')
}

/* ── 设置 ──────────────────────────────── */
const examDate = ref(store.data.profile.examDate)
const dailyMinutes = ref(store.data.profile.dailyMinutes)
const paperMinutes = ref(store.data.profile.paperMinutes)

function saveSettings() {
  store.setProfile({
    examDate: examDate.value,
    dailyMinutes: Number(dailyMinutes.value),
    paperMinutes: Number(paperMinutes.value),
  })
  toast('设置已保存', 'success')
}
</script>

<template>
  <div class="page">
    <TopBar title="我的" />

    <div class="page-body space-y-4 px-4 pt-4">
      <!-- 学习统计 -->
      <section class="card p-4">
        <h2 class="mb-3 text-[16px] font-semibold">学习统计</h2>
        <div class="grid grid-cols-5 gap-1 text-center">
          <div v-for="s in [
            { n: stats.answered, label: '已刷题' },
            { n: stats.wrong, label: '错题' },
            { n: stats.read, label: '已读节' },
            { n: stats.days, label: '学习天' },
            { n: stats.mocks, label: '模拟考' },
          ]" :key="s.label">
            <p class="text-[19px] font-bold leading-tight">{{ s.n }}</p>
            <p class="mt-0.5 text-[12px] text-muted">{{ s.label }}</p>
          </div>
        </div>
      </section>

      <!-- 考试与计划设置 -->
      <section class="card space-y-4 p-4">
        <h2 class="text-[16px] font-semibold">考试设置</h2>
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
        <label class="block">
          <span class="text-[14px] text-ink2">模拟考时长（分钟）</span>
          <input
            v-model.number="paperMinutes"
            type="number"
            min="10"
            max="400"
            class="mt-1.5 w-full rounded-xl bg-surface px-3 py-2.5 text-[16px] outline-none"
          />
        </label>
        <AppButton block @click="saveSettings">保存设置</AppButton>
        <p class="text-[12.5px] leading-relaxed text-muted">
          考试日期、时长、合格线（{{ manifest.exam.passLine }}/{{ manifest.exam.passScore }} 分）等参数均为占位默认值，请对照官方通知校对后在此修改。
        </p>
      </section>

      <!-- 备份 -->
      <section class="card space-y-3 p-4">
        <h2 class="text-[16px] font-semibold">备份与恢复</h2>
        <p class="text-[13.5px] leading-relaxed text-muted">
          学习记录只存在本机浏览器里（当前占用约 {{ sizeKB }} KB）。
          换手机或清理浏览器前，请先导出备份；新设备导入同一个文件即可恢复全部进度。
        </p>
        <div class="grid grid-cols-2 gap-3">
          <AppButton variant="secondary" @click="onExport">⬇︎ 导出备份</AppButton>
          <AppButton variant="secondary" @click="onImport">⬆︎ 导入备份</AppButton>
        </div>
        <p v-if="importError" class="text-[13.5px] text-danger">{{ importError }}</p>
      </section>

      <!-- 关于 -->
      <section class="card space-y-2 p-4">
        <h2 class="text-[16px] font-semibold">关于</h2>
        <p class="text-[13.5px] leading-relaxed text-ink2">{{ manifest.disclaimer }}</p>
        <p class="text-[12.5px] text-muted">
          官方教程：《系统集成项目管理工程师教程（第3版）》，清华大学出版社。
        </p>
        <button
          type="button"
          class="mt-2 min-h-11 w-full rounded-xl border border-danger/40 text-[15px] font-medium text-danger active:bg-danger-soft"
          @click="confirmClear = true"
        >
          清空全部学习数据
        </button>
      </section>

      <p class="pb-2 text-center text-[12px] text-muted">软考备考站 v0.1 · 本地存储版</p>
    </div>

    <!-- 导入预览 -->
    <Sheet :open="importSheet" title="确认恢复备份？" @close="importSheet = false">
      <div v-if="pendingSummary" class="space-y-3 pb-2">
        <div class="grid grid-cols-3 gap-2 rounded-xl bg-surface p-3 text-center text-[14px]">
          <div><p class="font-bold">{{ pendingSummary.answered }}</p><p class="text-muted text-[12px]">已刷题</p></div>
          <div><p class="font-bold">{{ pendingSummary.wrong }}</p><p class="text-muted text-[12px]">错题</p></div>
          <div><p class="font-bold">{{ pendingSummary.checkinDays }}</p><p class="text-muted text-[12px]">打卡天</p></div>
          <div><p class="font-bold">{{ pendingSummary.readSections }}</p><p class="text-muted text-[12px]">已读节</p></div>
          <div><p class="font-bold">{{ pendingSummary.mockAttempts }}</p><p class="text-muted text-[12px]">模拟考</p></div>
          <div><p class="font-bold">{{ pendingSummary.examDate }}</p><p class="text-muted text-[12px]">考试日期</p></div>
        </div>
        <p class="text-[13.5px] text-danger">恢复会覆盖本机当前全部进度，且不可撤销。</p>
        <div class="grid grid-cols-2 gap-3 pb-2">
          <AppButton variant="secondary" @click="importSheet = false">取消</AppButton>
          <AppButton variant="danger" @click="confirmImport">确认覆盖恢复</AppButton>
        </div>
      </div>
    </Sheet>

    <!-- 清空确认 -->
    <Sheet :open="confirmClear" title="清空全部数据？" @close="confirmClear = false">
      <div class="space-y-3 pb-2">
        <p class="text-[14.5px] leading-relaxed text-ink2">
          将删除本机的全部刷题记录、错题本、打卡、计划与案例进度，且不可恢复（除非你已导出过备份）。
        </p>
        <div class="grid grid-cols-2 gap-3 pb-2">
          <AppButton variant="secondary" @click="confirmClear = false">取消</AppButton>
          <AppButton variant="danger" @click="clearAll">确认清空</AppButton>
        </div>
      </div>
    </Sheet>
  </div>
</template>
