import { create } from 'zustand'

type UIState = {}

export const useUIStore = create<UIState>(() => ({}))
