<script setup lang="ts">
import { useRoute } from 'vue-router'
import TopBar from '@/components/TopBar.vue'
import EmptyState from '@/components/EmptyState.vue'

const route = useRoute()
</script>

<template>
  <div class="page">
    <TopBar :title="String(route.meta.title ?? '')" :back="route.path !== '/' ? true : false" />
    <div class="page-body">
      <EmptyState
        icon="🚧"
        :title="String(route.meta.title ?? '建设中')"
        :desc="String(route.meta.desc ?? '此页面正在开发中')"
      />
    </div>
  </div>
</template>
