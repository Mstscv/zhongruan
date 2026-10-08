<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MarkdownIt from 'markdown-it'
import { useProgressStore } from '@/stores/progress'
import { getManifest, loadSection, nextSection } from '@/services/contentLoader'
import { emitTaskEvent } from '@/services/events'
import { toast } from '@/composables/toast'

const route = useRoute()
const router = useRouter()
const store = useProgressStore()
const manifest = getManifest()

const md = new MarkdownIt({ linkify: false, breaks: false })
const html = ref('')
const loading = ref(true)
const error = ref('')
const progress = ref(0)

const sectionId = computed(() => String(route.params.sectionId))
const info = computed(() => {
  const chapterId = sectionId.value.split('--')[0]
  const ch = manifest.chapters.find((c) => c.id === chapterId)
  const idx = ch?.sections.find((s) => s.id === sectionId.value)
  return { ch, sec: idx }
})

const next = computed(() => nextSection(sectionId.value))

let bottomTimer = 0
let reachedBottom = false

async function load() {
  loading.value = true
  error.value = ''
  reachedBottom = false
  window.clearTimeout(bottomTimer)
  try {
    const raw = await loadSection(sectionId.value)
    html.value = md.render(raw)
    store.setLastRead(sectionId.value)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    loading.value = false
    await nextTick()
    window.scrollTo(0, 0)
  }
}
onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  void load()
})
onUnmounted(() => {
  window.removeEventListener('scroll', onScroll)
  window.clearTimeout(bottomTimer)
})

function onScroll() {
  const h = document.documentElement
  const max = h.scrollHeight - h.clientHeight
  progress.value = max > 0 ? Math.min(100, (h.scrollTop / max) * 100) : 100
  if (max > 0 && h.scrollTop >= max - 40 && !reachedBottom) {
    reachedBottom = true
    // 滚到底停留 3 秒自动标已读
    bottomTimer = window.setTimeout(() => markRead(true), 3000)
  }
}

function markRead(auto = false) {
  const added = store.markSectionRead(sectionId.value)
  if (added) {
    emitTaskEvent({ kind: 'read', sectionId: sectionId.value })
    toast(auto ? '已读完本节，自动标记 ✓' : '已标记为已读 ✓', 'success')
  } else if (!auto) {
    toast('本节已是已读状态', 'info')
  }
}

function goNext() {
  markRead(false)
  if (next.value) router.push(`/handbook/${next.value.id}`)
  else {
    toast('恭喜，手册全部读完 🎉', 'success')
    router.push('/handbook')
  }
}
</script>

<template>
  <div class="page bg-paper">
    <div class="read-progress" :style="{ width: progress + '%' }" />
    <header class="topbar">
      <div class="flex min-h-[52px] items-center gap-1 px-2">
        <button
          type="button"
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full active:bg-surface"
          aria-label="返回"
          @click="router.push('/handbook')"
        >
          <svg viewBox="0 0 24 24" class="h-6 w-6" fill="none">
            <path d="M14.5 5.5 8 12l6.5 6.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
        <div class="min-w-0 flex-1">
          <p class="truncate text-[15px] font-semibold">{{ info.sec?.title ?? '阅读' }}</p>
          <p class="truncate text-[12px] text-muted">
            第 {{ info.ch?.no }} 章 · {{ info.ch?.title }}
          </p>
        </div>
        <span
          class="shrink-0 rounded-full px-2.5 py-1 text-[12.5px] font-medium"
          :class="store.data.handbook.readSections[sectionId] ? 'bg-success-soft text-success' : 'bg-surface text-muted'"
        >
          {{ store.data.handbook.readSections[sectionId] ? '已读' : '未读' }}
        </span>
      </div>
    </header>

    <div class="page-body--nonav px-5 pb-28 pt-5">
      <div v-if="loading" class="space-y-3">
        <div class="h-7 w-2/3 animate-pulse rounded bg-line" />
        <div v-for="i in 6" :key="i" class="h-4 animate-pulse rounded bg-line" :class="i % 3 === 0 ? 'w-5/6' : 'w-full'" />
      </div>
      <div v-else-if="error" class="py-10 text-center text-danger">{{ error }}</div>
      <article v-else class="md-body" v-html="html" />
      <p v-if="!loading && !error" class="mt-8 border-t border-line pt-4 text-center text-[12.5px] text-muted">
        *本节内容为 AI 整理，以官方教程（第3版）对应章节为准。
      </p>
    </div>

    <!-- 底部：标记已读 / 下一节 -->
    <div
      class="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/96 px-4 pb-[calc(14px+env(safe-area-inset-bottom))] pt-3 backdrop-blur"
    >
      <div class="flex gap-3">
        <button
          type="button"
          class="min-h-[52px] rounded-xl border border-line px-4 text-[15.5px] font-medium active:bg-surface"
          @click="markRead(false)"
        >
          {{ store.data.handbook.readSections[sectionId] ? '已读 ✓' : '标记已读' }}
        </button>
        <button
          type="button"
          class="min-h-[52px] flex-1 rounded-xl bg-accent text-[16px] font-semibold text-white active:scale-[0.99]"
          @click="goNext"
        >
          {{ next ? `下一节：${next.title}` : '读完本章，完成手册 🎉' }}
        </button>
      </div>
    </div>
  </div>
</template>
