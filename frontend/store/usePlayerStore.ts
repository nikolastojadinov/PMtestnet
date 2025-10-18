import { create } from 'zustand'

type PlayerState = {}

export const usePlayerStore = create<PlayerState>(() => ({}))
