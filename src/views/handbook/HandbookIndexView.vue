<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useProgressStore } from '@/stores/progress'
import { getManifest } from '@/services/contentLoader'
import TopBar from '@/components/TopBar.vue'
import ProgressRing from '@/components/ProgressRing.vue'

const router = useRouter()
const store = useProgressStore()
const manifest = getManifest()

const readSet = computed(() => new Set(Object.keys(store.data.handbook.readSections)))

const totalSections = manifest.chapters.reduce((a, c) => a + c.sections.length, 0)
const readCount = computed(
  () => manifest.chapters.reduce((a, c) => a + c.sections.filter((s) => readSet.value.has(s.id)).length, 0),
)
const pct = computed(() => (totalSections ? Math.round((readCount.value / totalSections) * 100) : 0))

// 默认展开最近阅读的章节
const expanded = ref<Set<string>>(new Set())
{
  const lastId = store.data.handbook.lastRead
  if (lastId) expanded.value.add(lastId.split('--')[0])
  else if (manifest.chapters[0]) expanded.value.add(manifest.chapters[0].id)
}

function toggle(chapterId: string) {
  const s = new Set(expanded.value)
  if (s.has(chapterId)) s.delete(chapterId)
  else s.add(chapterId)
  expanded.value = s
}
</script>

<template>
  <div class="page">
    <TopBar title="手册" />

    <div class="page-body space-y-3 px-4 pt-4">
      <!-- 总进度 -->
      <section class="card flex items-center gap-4 p-4">
        <ProgressRing :percent="pct" :size="64" :stroke="6">
          <span class="text-[14px] font-bold">{{ pct }}%</span>
        </ProgressRing>
        <div>
          <h2 class="text-[16px] font-semibold">知识点手册</h2>
          <p class="mt-0.5 text-[13.5px] text-muted">
            已读 {{ readCount }}/{{ totalSections }} 节 · 19 章零基础笔记
          </p>
          <p v-if="store.data.handbook.lastRead" class="mt-1 text-[13px] text-accent">
            上次读到：{{
              (() => {
                const ch = manifest.chapters.find((c) => c.id === store.data.handbook.lastRead!.split('--')[0])
                const s = ch?.sections.find((x) => x.id === store.data.handbook.lastRead)
                return s?.title ?? ''
              })()
            }}
          </p>
        </div>
      </section>

      <!-- 章节折叠列表 -->
      <section
        v-for="ch in manifest.chapters"
        :key="ch.id"
        class="card overflow-hidden"
      >
        <button
          type="button"
          class="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-surface"
          @click="toggle(ch.id)"
        >
          <span
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[13px] font-bold"
            :class="ch.sections.length ? 'bg-accent-soft text-accent' : 'bg-surface text-muted'"
            >{{ ch.no }}</span
          >
          <div class="min-w-0 flex-1">
            <p class="truncate text-[15.5px] font-medium">{{ ch.title }}</p>
            <p class="text-[12.5px] text-muted">
              <template v-if="ch.sections.length">
                {{ ch.sections.filter((s) => readSet.has(s.id)).length }}/{{ ch.sections.length }} 节已读
              </template>
              <template v-else><span class="text-warn">内容生成中</span></template>
            </p>
          </div>
          <svg
            viewBox="0 0 24 24"
            class="h-5 w-5 shrink-0 text-muted transition-transform"
            :class="expanded.has(ch.id) ? 'rotate-90' : ''"
            fill="none"
          >
            <path d="m9.5 5.5 6.5 6.5-6.5 6.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>

        <div v-if="expanded.has(ch.id) && ch.sections.length" class="border-t border-line">
          <button
            v-for="s in ch.sections"
            :key="s.id"
            type="button"
            class="flex w-full items-center gap-3 px-4 py-3 pl-6 text-left active:bg-surface"
            @click="router.push(`/handbook/${s.id}`)"
          >
            <span
              class="h-2.5 w-2.5 shrink-0 rounded-full border-2"
              :class="readSet.has(s.id) ? 'border-success bg-success' : 'border-line bg-paper'"
            />
            <span class="min-w-0 flex-1 truncate text-[15px]" :class="readSet.has(s.id) ? 'text-ink2' : ''">
              {{ s.title }}
            </span>
            <span class="shrink-0 text-[12px] text-muted">{{ s.topic }}</span>
          </button>
        </div>
      </section>

      <p class="px-2 pb-1 text-center text-[11.5px] text-muted">
        手册为 AI 整理的复习笔记，请对照官方教程（第3版）校对使用
      </p>
    </div>
  </div>
</template>
