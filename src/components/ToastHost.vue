<script setup lang="ts">
import { toasts } from '@/composables/toast'

const colors: Record<string, string> = {
  info: 'bg-ink/90 text-white',
  success: 'bg-success text-white',
  warn: 'bg-warn text-white',
}
</script>

<template>
  <div
    class="pointer-events-none fixed inset-x-0 z-[60] flex flex-col items-center gap-2 px-6"
    :style="{ bottom: 'calc(76px + env(safe-area-inset-bottom))' }"
  >
    <transition-group name="toast">
      <div
        v-for="t in toasts"
        :key="t.id"
        class="anim-slide-up max-w-[86vw] rounded-full px-4 py-2.5 text-center text-[15px] font-medium shadow-lg"
        :class="colors[t.type]"
      >
        {{ t.msg }}
      </div>
    </transition-group>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.2s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
