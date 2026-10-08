<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useProgressStore } from '@/stores/progress'
import { getManifest, loadQuestionsByChapterIds } from '@/services/contentLoader'
import { chapterOfQid, mulberry32, selectQuestions, type PracticeContext } from '@/services/quizEngine'
import { useQuizSessionStore } from '@/stores/quizSession'
import type { Question } from '@/types/schema'
import TopBar from '@/components/TopBar.vue'
import AppButton from '@/components/AppButton.vue'
import EmptyState from '@/components/EmptyState.vue'
import { toast } from '@/composables/toast'

const router = useRouter()
const store = useProgressStore()
const session = useQuizSessionStore()
const manifest = getManifest()

const questions = ref<Question[]>([])
const loading = ref(true)
const filter = ref<'unmastered' | 'mastered' | 'all'>('unmastered')
const onlyFrequent = ref(false)

onMounted(async () => {
  const ids = Object.keys(store.data.quiz.wrongBook)
  if (ids.length) {
    const chapters = [...new Set(ids.map(chapterOfQid))]
    const all = await loadQuestionsByChapterIds(chapters)
    const map = new Map(all.map((q) => [q.id, q]))
    questions.value = ids.map((i) => map.get(i)).filter((q): q is Question => !!q)
  }
  loading.value = false
})

const list = computed(() => {
  let qs = questions.value
  const wb = store.data.quiz.wrongBook
  if (filter.value === 'unmastered') qs = qs.filter((q) => !wb[q.id]?.mastered)
  else if (filter.value === 'mastered') qs = qs.filter((q) => wb[q.id]?.mastered)
  if (onlyFrequent.value) qs = qs.filter((q) => (wb[q.id]?.wrongCount ?? 0) >= 2)
  return qs.sort((a, b) => (wb[b.id]?.wrongCount ?? 0) - (wb[a.id]?.wrongCount ?? 0))
})

const unmasteredCount = computed(
  () => Object.values(store.data.quiz.wrongBook).filter((w) => !w.mastered).length,
)

function chapterTitle(qid: string) {
  return manifest.chapters.find((c) => c.id === chapterOfQid(qid))?.title ?? ''
}

function toggleMastered(qid: string) {
  const w = store.data.quiz.wrongBook[qid]
  if (!w) return
  store.setMastered(qid, !w.mastered)
  toast(!w.mastered ? '已标记为掌握 ✓' : '已放回待攻克', 'success')
}

function remove(qid: string) {
  store.removeFromWrongBook(qid)
  questions.value = questions.value.filter((q) => q.id !== qid)
  toast('已移出错题本', 'info')
}

async function startPractice(qs: Question[] = list.value) {
  if (!qs.length) {
    toast('这里暂时没有题目', 'warn')
    return
  }
  const picked = selectQuestions(
    qs,
    20,
    { answered: store.data.quiz.answered, wrongBook: store.data.quiz.wrongBook, favorites: store.data.quiz.favorites } satisfies PracticeContext,
    mulberry32(Date.now() % 2147483647),
  )
  session.start({ questions: picked, mode: 'practice', source: 'wrong', sourceLabel: '错题重练' })
  router.push('/quiz/session')
}
</script>

<template>
  <div class="page">
    <TopBar title="错题本" :back="true" :subtitle="`未掌握 ${unmasteredCount} 道`" />

    <div class="page-body--nonav px-4 pb-28 pt-4">
      <!-- 筛选 -->
      <div class="mb-3 flex gap-2">
        <button
          v-for="f in [
            { v: 'unmastered', l: '未掌握' },
            { v: 'mastered', l: '已掌握' },
            { v: 'all', l: '全部' },
          ]"
          :key="f.v"
          type="button"
          class="min-h-9 rounded-full border px-3.5 text-[14px] font-medium"
          :class="filter === f.v ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-paper'"
          @click="filter = f.v as typeof filter"
        >
          {{ f.l }}
        </button>
        <button
          type="button"
          class="min-h-9 rounded-full border px-3.5 text-[14px] font-medium"
          :class="onlyFrequent ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-paper'"
          @click="onlyFrequent = !onlyFrequent"
        >
          错≥2次
        </button>
      </div>

      <!-- 列表 -->
      <div v-if="loading" class="space-y-3">
        <div v-for="i in 4" :key="i" class="card h-24 animate-pulse bg-line/40" />
      </div>
      <EmptyState
        v-else-if="!list.length"
        icon="🎉"
        title="没有符合条件的错题"
        desc="错题连续两次答对会自动标记为已掌握；也可以切换筛选看看。"
      />
      <div v-else class="space-y-2.5">
        <div v-for="q in list" :key="q.id" class="card p-4" data-testid="wrong-row">
          <p class="line-clamp-2 text-[15px] leading-relaxed">{{ q.stem }}</p>
          <div class="mt-2.5 flex flex-wrap items-center gap-2 text-[12.5px]">
            <span class="rounded-md bg-surface px-2 py-0.5 text-muted">{{ chapterTitle(q.id) }}</span>
            <span class="rounded-md bg-danger-soft px-2 py-0.5 font-medium text-danger">
              错 {{ store.data.quiz.wrongBook[q.id]?.wrongCount ?? 0 }} 次
            </span>
            <span
              class="rounded-md px-2 py-0.5 font-medium"
              :class="store.data.quiz.wrongBook[q.id]?.mastered ? 'bg-success-soft text-success' : 'bg-warn-soft text-warn'"
            >
              {{ store.data.quiz.wrongBook[q.id]?.mastered ? '已掌握' : '待攻克' }}
            </span>
            <span class="flex-1" />
            <button type="button" class="min-h-8 rounded-lg border border-line px-2.5 active:bg-surface" @click="toggleMastered(q.id)">
              {{ store.data.quiz.wrongBook[q.id]?.mastered ? '回炉' : '标掌握' }}
            </button>
            <button type="button" class="min-h-8 rounded-lg border border-line px-2.5 text-muted active:bg-surface" @click="remove(q.id)">
              移出
            </button>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="list.length"
      class="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/96 px-4 pb-[calc(14px+env(safe-area-inset-bottom))] pt-3 backdrop-blur"
    >
      <AppButton block size="lg" @click="startPractice()">
        重练这 {{ Math.min(20, list.length) }} 题
      </AppButton>
    </div>
  </div>
</template>
