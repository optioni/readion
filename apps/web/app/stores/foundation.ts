import { defineStore } from 'pinia'

export const useFoundationStore = defineStore('foundation', {
  state: () => ({
    appName: 'Readion',
  }),
})
