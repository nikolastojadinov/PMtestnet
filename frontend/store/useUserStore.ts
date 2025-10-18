import { create } from 'zustand'

type UserState = {}

export const useUserStore = create<UserState>(() => ({}))
