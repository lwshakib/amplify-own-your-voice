import { create } from "zustand"

interface SearchStore {
  isOpen: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
}

export const useSearch = create<SearchStore>((set) => ({
  isOpen: false,
  setOpen: (isOpen) => set({ isOpen }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
}))
