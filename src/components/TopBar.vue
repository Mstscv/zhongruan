<script setup lang="ts">
import { useRouter } from 'vue-router'

const props = withDefaults(
  defineProps<{
    title: string
    back?: boolean | string
    subtitle?: string
  }>(),
  { back: false, subtitle: undefined },
)

const router = useRouter()

function onBack() {
  if (typeof props.back === 'string') router.push(props.back)
  else router.back()
}
</script>

<template>
  <header class="topbar">
    <div class="flex min-h-[52px] items-center gap-1 px-2">
      <button
        v-if="back"
        type="button"
        class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink active:bg-surface"
        aria-label="返回"
        @click="onBack"
      >
        <svg viewBox="0 0 24 24" class="h-6 w-6" fill="none">
          <path
            d="M14.5 5.5 8 12l6.5 6.5"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
      <div class="min-w-0 flex-1 px-1">
        <h1 class="truncate text-[17px] font-semibold leading-tight">{{ title }}</h1>
        <p v-if="subtitle" class="truncate text-[12.5px] text-muted leading-tight">{{ subtitle }}</p>
      </div>
      <div class="shrink-0 pr-1"><slot name="right" /></div>
    </div>
  </header>
</template>
