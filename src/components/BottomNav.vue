<script setup lang="ts">
const tabs = [
  { to: '/', label: '首页', icon: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9.5Z' },
  {
    to: '/quiz',
    label: '题库',
    icon: 'M8 4h9a2 2 0 0 1 2 2v13.5M6 4h2M6 4v15a1.5 1.5 0 0 0 1.5 1.5H16M9 8.5h6M9 12h6M9 15.5h4',
  },
  {
    to: '/handbook',
    label: '手册',
    icon: 'M12 6.5C10.5 5 8.5 4.5 5 4.8A1.8 1.8 0 0 0 3.2 6.6v11.1c0 1 .8 1.8 1.8 1.8 3.5-.3 5.5.2 7 1.7 1.5-1.5 3.5-2 7-1.7 1 0 1.8-.8 1.8-1.8V6.6c0-.9-.7-1.7-1.6-1.8-3.5-.3-5.5.2-7 1.7Zm0 0v14.7',
  },
  {
    to: '/case',
    label: '案例',
    icon: 'M9 4h6M8 6h8a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Zm1.5 7.5 1.8 1.8 3.7-3.8',
  },
  {
    to: '/me',
    label: '我的',
    icon: 'M12 12.5a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7.5 7.5a7.5 7.5 0 0 1 15 0',
  },
]
</script>

<template>
  <nav class="tabbar flex" aria-label="主导航">
    <router-link
      v-for="tab in tabs"
      :key="tab.to"
      :to="tab.to"
      custom
      v-slot="{ navigate, isActive }"
    >
      <button
        type="button"
        class="flex min-h-[54px] flex-1 flex-col items-center justify-center gap-0.5 pt-1.5 text-[11px] transition-colors"
        :class="isActive ? 'text-accent font-semibold' : 'text-muted'"
        @click="navigate"
      >
        <svg viewBox="0 0 24 24" class="h-[22px] w-[22px]" fill="none" aria-hidden="true">
          <path
            :d="tab.icon"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <span>{{ tab.label }}</span>
      </button>
    </router-link>
  </nav>
</template>
