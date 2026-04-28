import { create } from "zustand";

export const useNotifikasiStore = create((set, get) => ({
  items: [],
  jumlahBelumDibaca: 0,

  setNotifikasi: (items, jumlahBelumDibaca) =>
    set({ items, jumlahBelumDibaca }),

  tambahNotifikasi: (notif) => {
    const items = [notif, ...get().items];
    set({ items: items.slice(0, 100), jumlahBelumDibaca: get().jumlahBelumDibaca + 1 });
  },

  tandaiDibaca: (ids) => {
    const idSet = new Set(ids);
    const items = get().items.map((n) => (idSet.has(n.id) ? { ...n, dibaca: true } : n));
    const jumlahBelumDibaca = items.filter((n) => !n.dibaca).length;
    set({ items, jumlahBelumDibaca });
  },

  tandaiSemuaDibaca: () => {
    const items = get().items.map((n) => ({ ...n, dibaca: true }));
    set({ items, jumlahBelumDibaca: 0 });
  },
}));
