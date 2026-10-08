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

const questions = ref<Question[]>([])
const loading = ref(true)

onMounted(async () => {
  const ids = store.data.quiz.favorites
  if (ids.length) {
    const chapters = [...new Set(ids.map(chapterOfQid))]
    const all = await loadQuestionsByChapterIds(chapters)
    const map = new Map(all.map((q) => [q.id, q]))
    questions.value = ids.map((i) => map.get(i)).filter((q): q is Question => !!q)
  }
  loading.value = false
})

const list = computed(() => questions.value)

function chapterTitle(qid: string) {
  return getManifest().chapters.find((c) => c.id === chapterOfQid(qid))?.title ?? ''
}

function remove(qid: string) {
  store.toggleFavorite(qid)
  questions.value = questions.value.filter((q) => q.id !== qid)
  toast('已取消收藏', 'info')
}

async function startPractice() {
  if (!list.value.length) {
    toast('收藏夹是空的', 'warn')
    return
  }
  const picked = selectQuestions(
    list.value,
    50,
    {
      answered: store.data.quiz.answered,
      wrongBook: store.data.quiz.wrongBook,
      favorites: store.data.quiz.favorites,
    } satisfies PracticeContext,
    mulberry32(Date.now() % 2147483647),
  )
  session.start({ questions: picked, mode: 'practice', source: 'fav', sourceLabel: '收藏练习' })
  router.push('/quiz/session')
}
</script>

<template>
  <div class="page">
    <TopBar title="收藏夹" :back="true" :subtitle="`${list.length} 道收藏`" />

    <div class="page-body--nonav px-4 pb-28 pt-4">
      <div v-if="loading" class="space-y-3">
        <div v-for="i in 3" :key="i" class="card h-24 animate-pulse bg-line/40" />
      </div>
      <EmptyState
        v-else-if="!list.length"
        icon="⭐"
        title="还没有收藏"
        desc="做题时点右上角的 ☆，把值得反复看的题收进来。"
      />
      <div v-else class="space-y-2.5">
        <div v-for="q in list" :key="q.id" class="card p-4">
          <p class="line-clamp-2 text-[15px] leading-relaxed">{{ q.stem }}</p>
          <div class="mt-2.5 flex items-center gap-2 text-[12.5px]">
            <span class="rounded-md bg-surface px-2 py-0.5 text-muted">{{ chapterTitle(q.id) }}</span>
            <span class="rounded-md bg-accent-soft px-2 py-0.5 text-accent">{{ q.topic }}</span>
            <span class="flex-1" />
            <button type="button" class="min-h-8 rounded-lg border border-line px-2.5 text-muted active:bg-surface" @click="remove(q.id)">
              取消收藏
            </button>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="list.length"
      class="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/96 px-4 pb-[calc(14px+env(safe-area-inset-bottom))] pt-3 backdrop-blur"
    >
      <AppButton block size="lg" @click="startPractice()">练习全部收藏（{{ Math.min(50, list.length) }} 题）</AppButton>
    </div>
  </div>
</template>
