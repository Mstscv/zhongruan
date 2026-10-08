import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { initTaskEngine } from '@/services/bootstrap'
import { useProgressStore } from '@/stores/progress'
import './style.css'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
initTaskEngine(useProgressStore(pinia))
app.use(router)
app.mount('#app')
