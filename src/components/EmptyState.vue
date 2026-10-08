<script setup lang="ts">
withDefaults(defineProps<{ icon?: string; title: string; desc?: string }>(), {
  icon: '📭',
  desc: undefined,
})
</script>

<template>
  <div class="flex flex-col items-center justify-center px-8 py-14 text-center">
    <div class="mb-3 text-4xl" aria-hidden="true">{{ icon }}</div>
    <p class="text-[16px] font-medium text-ink">{{ title }}</p>
    <p v-if="desc" class="mt-1 max-w-[260px] text-[14px] leading-relaxed text-muted">{{ desc }}</p>
    <div v-if="$slots.default" class="mt-5"><slot /></div>
  </div>
</template>
