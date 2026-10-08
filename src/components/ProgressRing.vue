<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    percent?: number
    size?: number
    stroke?: number
    color?: string
    track?: string
  }>(),
  { percent: 0, size: 64, stroke: 6, color: 'var(--color-accent)', track: 'var(--color-line)' },
)

const clamped = computed(() => Math.max(0, Math.min(100, props.percent)))
const r = computed(() => (props.size - props.stroke) / 2)
const c = computed(() => 2 * Math.PI * r.value)
const dash = computed(() => (clamped.value / 100) * c.value)
</script>

<template>
  <div class="relative inline-flex items-center justify-center" :style="{ width: size + 'px', height: size + 'px' }">
    <svg :width="size" :height="size" class="-rotate-90">
      <circle :cx="size / 2" :cy="size / 2" :r="r" fill="none" :stroke="track" :stroke-width="stroke" />
      <circle
        :cx="size / 2"
        :cy="size / 2"
        :r="r"
        fill="none"
        :stroke="color"
        :stroke-width="stroke"
        stroke-linecap="round"
        :stroke-dasharray="`${dash} ${c}`"
        class="transition-[stroke-dasharray] duration-500"
      />
    </svg>
    <div class="absolute inset-0 flex items-center justify-center">
      <slot />
    </div>
  </div>
</template>
