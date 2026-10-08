import { createRouter, createWebHashHistory } from 'vue-router'
import { useProgressStore } from '@/stores/progress'

/**
 * hash 路由：同一份构建可部署到任意静态托管，也可离线 file:// 双击打开。
 * meta.hideNav = 沉浸流程（不显示底部导航）。
 */
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
      meta: { title: '首页' },
    },
    {
      path: '/onboard',
      name: 'onboard',
      component: () => import('@/views/OnboardingView.vue'),
      meta: { title: '开始设置', hideNav: true },
    },
    { path: '/plan', component: () => import('@/views/PlanView.vue'), meta: { title: '学习计划' } },
    {
      path: '/calendar',
      component: () => import('@/views/CalendarView.vue'),
      meta: { title: '打卡日历' },
    },

    { path: '/quiz', component: () => import('@/views/quiz/QuizHomeView.vue'), meta: { title: '题库' } },
    {
      path: '/quiz/ch/:id',
      component: () => import('@/views/quiz/ChapterConfigView.vue'),
      meta: { title: '章节练习', hideNav: true },
    },
    {
      path: '/quiz/session',
      component: () => import('@/views/quiz/SessionView.vue'),
      meta: { title: '做题', hideNav: true },
    },
    {
      path: '/quiz/wrong',
      component: () => import('@/views/quiz/WrongBookView.vue'),
      meta: { title: '错题本', hideNav: true },
    },
    {
      path: '/quiz/favorites',
      component: () => import('@/views/quiz/FavoritesView.vue'),
      meta: { title: '收藏夹', hideNav: true },
    },

    {
      path: '/mock/intro',
      component: () => import('@/views/mock/MockIntroView.vue'),
      meta: { title: '模拟考试', hideNav: true },
    },
    {
      path: '/mock/exam',
      component: () => import('@/views/mock/MockExamView.vue'),
      meta: { title: '考试中', hideNav: true },
    },
    {
      path: '/mock/result',
      component: () => import('@/views/mock/MockResultView.vue'),
      meta: { title: '成绩单' },
    },

    {
      path: '/handbook',
      component: () => import('@/views/handbook/HandbookIndexView.vue'),
      meta: { title: '手册' },
    },
    {
      path: '/handbook/:sectionId',
      component: () => import('@/views/handbook/ReaderView.vue'),
      meta: { title: '阅读', hideNav: true },
    },

    { path: '/case', component: () => import('@/views/case/CaseListView.vue'), meta: { title: '案例训练' } },
    {
      path: '/case/:id',
      component: () => import('@/views/case/CaseDetailView.vue'),
      meta: { title: '案例作答', hideNav: true },
    },

    { path: '/me', component: () => import('@/views/MeView.vue'), meta: { title: '我的' } },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior(to, from, saved) {
    if (saved) return saved
    if (to.path === from.path) return false
    return { top: 0 }
  },
})

/** 未完成引导 → 强制进引导页 */
router.beforeEach((to) => {
  const store = useProgressStore()
  if (!store.data.profile.onboarded && to.path !== '/onboard') {
    return '/onboard'
  }
  if (store.data.profile.onboarded && to.path === '/onboard') {
    return '/'
  }
  return true
})

router.afterEach((to) => {
  const t = to.meta.title
  document.title = t ? `${t} · 软考备考站` : '软考备考站 · 系统集成项目管理工程师'
})

export default router
