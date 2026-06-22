import { readionVueQueryPlugin } from '~/lib/vue-query'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(readionVueQueryPlugin)
})
