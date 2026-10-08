<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import BottomNav from '@/components/BottomNav.vue'
import ToastHost from '@/components/ToastHost.vue'

const route = useRoute()
const showNav = computed(() => !route.meta.hideNav)
</script>

<template>
  <router-view />
  <BottomNav v-if="showNav" />
  <ToastHost />
</template>
