<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useProgressStore } from '@/stores/progress'
import { getManifest } from '@/services/contentLoader'
import TopBar from '@/components/TopBar.vue'
import EmptyState from '@/components/EmptyState.vue'

const router = useRouter()
const store = useProgressStore()
const manifest = getManifest()

const filter = ref<'all' | 'todo' | 'fuzzy' | 'master'>('all')

const allCases = manifest.chapters.flatMap((ch) =>
  ch.cases.map((c) => ({ ...c, chapterNo: ch.no, chapterTitle: ch.title })),
)

function levelOf(id: string): 'todo' | 'fuzzy' | 'master' {
  return store.data.cases[id]?.level ?? 'todo'
}

const list = computed(() =>
  filter.value === 'all' ? allCases : allCases.filter((c) => levelOf(c.id) === filter.value),
)

const counts = computed(() => ({
  all: allCases.length,
  todo: allCases.filter((c) => levelOf(c.id) === 'todo').length,
  fuzzy: allCases.filter((c) => levelOf(c.id) === 'fuzzy').length,
  master: allCases.filter((c) => levelOf(c.id) === 'master').length,
}))

const dot: Record<string, string> = {
  todo: 'bg-line',
  fuzzy: 'bg-warn',
  master: 'bg-success',
}
const levelLabel: Record<string, string> = {
  todo: '未练',
  fuzzy: '模糊',
  master: '掌握',
}
</script>

<template>
  <div class="page">
    <TopBar title="案例训练" subtitle="科目二 · 问答题自评" />

    <div class="page-body space-y-4 px-4 pt-4">
      <!-- 说明卡 -->
      <section class="card bg-accent-soft border-accent/20 p-4">
        <p class="text-[14.5px] leading-relaxed text-ink2">
          <b>练习方式：</b>先自己在心里/纸上作答，再点开参考答案，按得分点给自己打分。
          三档标记（未练 / 模糊 / 掌握），反复练到"掌握"。
        </p>
      </section>

      <!-- 筛选 -->
      <div class="flex gap-2">
        <button
          v-for="f in [
            { v: 'all', l: `全部 ${counts.all}` },
            { v: 'todo', l: `未练 ${counts.todo}` },
            { v: 'fuzzy', l: `模糊 ${counts.fuzzy}` },
            { v: 'master', l: `掌握 ${counts.master}` },
          ]"
          :key="f.v"
          type="button"
          class="min-h-9 rounded-full border px-3.5 text-[14px] font-medium"
          :class="filter === f.v ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-paper'"
          @click="filter = f.v as typeof filter"
        >
          {{ f.l }}
        </button>
      </div>

      <EmptyState
        v-if="!allCases.length"
        icon="🗂️"
        title="案例题库生成中"
        desc="第一批案例上线后会显示在这里"
      />
      <EmptyState
        v-else-if="!list.length"
        icon="✨"
        title="这个分类下没有案例"
        desc="切换上面的筛选看看"
      />

      <!-- 案例列表 -->
      <div v-else class="space-y-2.5">
        <button
          v-for="c in list"
          :key="c.id"
          type="button"
          class="card flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-surface"
          @click="router.push(`/case/${c.id}`)"
        >
          <span class="h-3 w-3 shrink-0 rounded-full" :class="dot[levelOf(c.id)]" />
          <div class="min-w-0 flex-1">
            <p class="truncate text-[15.5px] font-medium">{{ c.title }}</p>
            <p class="mt-0.5 text-[12.5px] text-muted">
              第 {{ c.chapterNo }} 章 · {{ c.chapterTitle }} · {{ c.questionCount }} 问 / {{ c.score }} 分
            </p>
          </div>
          <span
            class="shrink-0 rounded-md px-2 py-0.5 text-[12.5px] font-medium"
            :class="{
              todo: 'bg-surface text-muted',
              fuzzy: 'bg-warn-soft text-warn',
              master: 'bg-success-soft text-success',
            }[levelOf(c.id)]"
            >{{ levelLabel[levelOf(c.id)] }}</span
          >
        </button>
      </div>

      <p class="px-2 pb-1 text-center text-[11.5px] text-muted">案例由 AI 生成，参考答案请对照官方教程校对</p>
    </div>
  </div>
</template>
