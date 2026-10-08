<script setup lang="ts">
defineProps<{ open: boolean; title?: string }>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <Teleport to="body">
    <transition name="sheet">
      <div v-if="open" class="fixed inset-0 z-[55] flex flex-col justify-end">
        <div class="absolute inset-0 bg-black/40" @click="emit('close')" />
        <div
          class="relative max-h-[82dvh] overflow-y-auto rounded-t-2xl bg-paper pb-[calc(20px+env(safe-area-inset-bottom))] anim-slide-up"
        >
          <div
            v-if="title"
            class="sticky top-0 z-10 flex items-center justify-between rounded-t-2xl bg-paper px-5 pb-2 pt-4"
          >
            <h2 class="text-[17px] font-semibold">{{ title }}</h2>
            <button
              type="button"
              class="flex h-9 w-9 items-center justify-center rounded-full text-muted active:bg-surface"
              aria-label="关闭"
              @click="emit('close')"
            >
              <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none">
                <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
              </svg>
            </button>
          </div>
          <div class="px-5 pt-2"><slot /></div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<style scoped>
.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 0.2s ease;
}
.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}
</style>
