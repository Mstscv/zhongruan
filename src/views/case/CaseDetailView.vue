<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useProgressStore } from '@/stores/progress'
import { loadCase } from '@/services/contentLoader'
import { emitTaskEvent } from '@/services/events'
import type { Case } from '@/types/schema'
import TopBar from '@/components/TopBar.vue'
import AppButton from '@/components/AppButton.vue'
import { toast } from '@/composables/toast'

const route = useRoute()
const router = useRouter()
const store = useProgressStore()

const caseId = computed(() => String(route.params.id))
const data = ref<Case | null>(null)
const loading = ref(true)
const error = ref('')

const qIndex = ref(0)
const revealed = ref<Record<string, boolean>>({})
const evals = ref<Record<string, 0 | 1 | 2>>({})
const finished = ref(false)

const current = computed(() => data.value?.questions[qIndex.value] ?? null)
const currentEval = computed(() => (current.value ? evals.value[current.value.id] : undefined))

const record = computed(() => store.data.cases[caseId.value])

const draft = computed({
  get: () => (current.value ? (record.value?.draft[current.value.id] ?? '') : ''),
  set: (v: string) => {
    if (current.value) store.setCaseDraft(caseId.value, current.value.id, v)
  },
})

onMounted(async () => {
  try {
    data.value = await loadCase(caseId.value)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    loading.value = false
  }
})

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** 参考答案中高亮关键词 */
function highlightAnswer(text: string, keywords: string[]): string {
  let out = escapeHtml(text)
  for (const kw of keywords) {
    const esc = escapeHtml(kw)
    if (!esc) continue
    out = out.split(esc).join(`<mark class="kw">${esc}</mark>`)
  }
  return out
}

function reveal() {
  if (!current.value) return
  revealed.value = { ...revealed.value, [current.value.id]: true }
}

function applyEval(score: 0 | 1 | 2) {
  if (!current.value) return
  evals.value = { ...evals.value, [current.value.id]: score }
  if (qIndex.value < (data.value?.questions.length ?? 0) - 1) {
    toast('已记录，进入下一问', 'info')
    qIndex.value++
  } else {
    finish()
  }
}

function finish() {
  if (!data.value) return
  const scores = data.value.questions.map((q) => evals.value[q.id] ?? 0)
  store.recordCaseSelfEval(caseId.value, scores)
  emitTaskEvent({ kind: 'case', caseId: caseId.value })
  finished.value = true
  const level = scores.every((s) => s >= 2) ? '掌握 🎉' : '还需巩固 💪'
  toast(`本题完成，标记为「${level}」`, scores.every((s) => s >= 2) ? 'success' : 'info')
}

const evalOptions = [
  { v: 0 as const, label: '没答上', icon: '❌', cls: 'border-danger/40 text-danger' },
  { v: 1 as const, label: '答上一半', icon: '🟡', cls: 'border-warn/40 text-warn' },
  { v: 2 as const, label: '答全了', icon: '✅', cls: 'border-success/40 text-success' },
]

const overall = computed(() => {
  const scores = data.value?.questions.map((q) => evals.value[q.id]).filter((s): s is 0 | 1 | 2 => s != null) ?? []
  if (!scores.length) return null
  if (scores.every((s) => s >= 2)) return 'master'
  if (scores.some((s) => s === 0)) return 'fuzzy'
  return 'fuzzy'
})
</script>

<template>
  <div class="page bg-paper">
    <TopBar
      v-if="data"
      :title="data.title"
      :back="true"
      :subtitle="`第 ${qIndex + 1}/${data.questions.length} 问 · 共 ${data.score} 分`"
    />
    <TopBar v-else title="案例" :back="true" />

    <!-- 加载/错误 -->
    <div v-if="loading" class="page-body--nonav space-y-3 px-4 pt-4">
      <div class="h-40 animate-pulse rounded-2xl bg-line" />
      <div class="h-24 animate-pulse rounded-2xl bg-line" />
    </div>
    <div v-else-if="error || !data" class="page-body--nonav px-6 pt-10 text-center text-danger">
      {{ error || '案例不存在' }}
    </div>

    <!-- 完成页 -->
    <div v-else-if="finished" class="page-body--nonav flex flex-col px-4 pt-6">
      <section class="card p-5 text-center">
        <p class="text-4xl">{{ overall === 'master' ? '🎉' : '💪' }}</p>
        <h2 class="mt-2 text-[20px] font-bold">
          本题完成 · 标记为「{{ overall === 'master' ? '掌握' : '模糊' }}」
        </h2>
        <div class="mt-4 space-y-1.5 text-left text-[14.5px]">
          <div
            v-for="(q, i) in data.questions"
            :key="q.id"
            class="flex items-center justify-between rounded-xl bg-surface px-3.5 py-2.5"
          >
            <span class="text-ink2">第 {{ i + 1 }} 问（{{ q.score }} 分）</span>
            <span>{{ ['❌ 没答上', '🟡 答上一半', '✅ 答全了'][evals[q.id] ?? 0] }}</span>
          </div>
        </div>
        <p v-if="data.level1Hint" class="mt-3 text-[13.5px] text-muted">💡 {{ data.level1Hint }}</p>
      </section>
      <div class="mt-5 grid grid-cols-2 gap-3">
        <AppButton variant="secondary" size="lg" @click="router.push('/case')">返回列表</AppButton>
        <AppButton
          size="lg"
          @click="
            qIndex = 0;
            revealed = {};
            evals = {};
            finished = false
          "
        >
          再练一次
        </AppButton>
      </div>
      <div class="mt-4">
        <AppButton block variant="ghost" @click="router.push(`/case/${data.id}`)">重新加载本题</AppButton>
      </div>
    </div>

    <!-- 作答流程 -->
    <template v-else-if="data && current">
      <div class="page-body--nonav flex flex-col px-4 pb-6 pt-4">
        <!-- 背景材料（可折叠，只在第一问展开） -->
        <details class="card mb-3 overflow-hidden" :open="qIndex === 0">
          <summary class="cursor-pointer px-4 py-3 text-[15px] font-semibold select-none">
            📋 项目背景（点击展开/收起）
          </summary>
          <div class="border-t border-line px-4 py-3 text-[14.5px] leading-relaxed whitespace-pre-wrap text-ink2">
            {{ data.scenario }}
          </div>
        </details>

        <!-- 当前问 -->
        <section class="card p-4">
          <div class="flex items-start justify-between gap-2">
            <p class="text-[16px] font-semibold leading-relaxed">
              问题 {{ qIndex + 1 }}：
              <span class="font-medium">{{ current.prompt }}</span>
            </p>
            <span class="shrink-0 rounded-md bg-accent-soft px-2 py-0.5 text-[13px] font-bold text-accent"
              >{{ current.score }} 分</span
            >
          </div>

          <!-- 作答区 -->
          <textarea
            v-model="draft"
            rows="5"
            class="mt-3 w-full resize-y rounded-xl border border-line bg-surface p-3 text-[15.5px] leading-relaxed outline-none focus:border-accent"
            placeholder="在这里输入你的答案（自动保存草稿，刷新也不丢）"
          />
          <p class="mt-1 text-right text-[12px] text-muted">{{ draft.length }} 字</p>

          <AppButton
            v-if="!revealed[current.id]"
            block
            variant="secondary"
            class="mt-1"
            @click="reveal"
          >
            看参考答案
          </AppButton>
        </section>

        <!-- 参考答案 -->
        <section v-if="revealed[current.id]" class="card anim-slide-up mt-3 border-accent/30 p-4">
          <h3 class="text-[15px] font-bold text-accent">参考答案与得分点</h3>
          <div class="md-body mt-2 text-[14.5px]" v-html="highlightAnswer(current.answer, current.keywords)" />
          <div class="mt-3 rounded-xl bg-surface p-3">
            <p class="mb-1.5 text-[13px] font-semibold text-ink2">得分点（对照给自己打分）：</p>
            <ul class="space-y-1 text-[14px] text-ink2">
              <li v-for="(p, i) in current.scoringPoints" :key="i">✓ {{ p }}</li>
            </ul>
          </div>

          <p class="mt-3 text-[14px] font-semibold">你的答案达到哪一档？</p>
          <div class="mt-2 grid grid-cols-3 gap-2">
            <button
              v-for="o in evalOptions"
              :key="o.v"
              type="button"
              class="min-h-[64px] rounded-xl border-2 px-1 py-2 text-center transition-colors"
              :class="[
                o.cls,
                currentEval === o.v ? 'bg-surface ring-2 ring-current' : 'bg-paper',
              ]"
              @click="applyEval(o.v)"
            >
              <span class="block text-[18px]">{{ o.icon }}</span>
              <span class="text-[12.5px] font-medium">{{ o.label }}</span>
            </button>
          </div>
          <p class="mt-2 text-[12.5px] text-muted">选择后自动进入下一问；可先在上面修改草稿</p>
        </section>

        <!-- 上一问 -->
        <button
          v-if="qIndex > 0"
          type="button"
          class="mt-4 min-h-11 w-full rounded-xl border border-line text-[15px] active:bg-surface"
          @click="qIndex--"
        >
          ← 返回上一问
        </button>

        <p v-if="data.level1Hint" class="mt-4 text-center text-[13px] text-muted">💡 {{ data.level1Hint }}</p>
      </div>
    </template>
  </div>
</template>

<style scoped>
:deep(mark.kw) {
  background: var(--color-warn-soft);
  color: var(--color-ink);
  padding: 0 2px;
  border-radius: 3px;
  font-weight: 600;
}
</style>
