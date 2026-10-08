import { createRouter, createWebHashHistory } from 'vue-router'
import { useProgressStore } from '@/stores/progress'

/**
 * hash 路由：同一份构建可部署到任意静态托管，也可离线 file:// 双击打开。
 * meta.hideNav = 沉浸流程（不显示底部导航）。
 * 暂未实现的页面统一指向 Placeholder（读取 meta.title / meta.desc），
 * 各阶段完成后把 component 换成真实视图即可。
 */
const Placeholder = () => import('@/views/Placeholder.vue')

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
    {
      path: '/plan',
      component: Placeholder,
      meta: { title: '学习计划', desc: '阶段划分与每日任务安排将在下一阶段上线' },
    },
    {
      path: '/calendar',
      component: Placeholder,
      meta: { title: '打卡日历', desc: '打卡记录与连续天数统计将在下一阶段上线' },
    },

    { path: '/quiz', component: Placeholder, meta: { title: '题库', desc: '章节练习、错题本、模拟考将在下一阶段上线' } },
    {
      path: '/quiz/ch/:id',
      component: Placeholder,
      meta: { title: '章节练习' },
    },
    {
      path: '/quiz/session',
      component: Placeholder,
      meta: { title: '做题', hideNav: true },
    },
    { path: '/quiz/wrong', component: Placeholder, meta: { title: '错题本' } },
    { path: '/quiz/favorites', component: Placeholder, meta: { title: '收藏夹' } },

    { path: '/mock/intro', component: Placeholder, meta: { title: '模拟考试' } },
    {
      path: '/mock/exam',
      component: Placeholder,
      meta: { title: '考试中', hideNav: true },
    },
    { path: '/mock/result', component: Placeholder, meta: { title: '成绩单' } },

    { path: '/handbook', component: Placeholder, meta: { title: '手册', desc: '知识点手册将在下一阶段上线' } },
    {
      path: '/handbook/:sectionId',
      component: Placeholder,
      meta: { title: '阅读', hideNav: true },
    },

    { path: '/case', component: Placeholder, meta: { title: '案例训练', desc: '案例问答训练将在下一阶段上线' } },
    {
      path: '/case/:id',
      component: Placeholder,
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
