import { useNotifikasiStore } from "../store/notifikasiStore";

describe("notifikasiStore", () => {
  beforeEach(() => useNotifikasiStore.setState({ items: [], jumlahBelumDibaca: 0 }));

  test("setNotifikasi", () => {
    useNotifikasiStore.getState().setNotifikasi([{ id: "1", dibaca: false }, { id: "2", dibaca: true }], 1);
    expect(useNotifikasiStore.getState().items.length).toBe(2);
    expect(useNotifikasiStore.getState().jumlahBelumDibaca).toBe(1);
  });

  test("tambahNotifikasi memasukkan ke depan dan menambah counter", () => {
    useNotifikasiStore.getState().setNotifikasi([{ id: "1", dibaca: true }], 0);
    useNotifikasiStore.getState().tambahNotifikasi({ id: "2", dibaca: false });
    const s = useNotifikasiStore.getState();
    expect(s.items[0].id).toBe("2");
    expect(s.jumlahBelumDibaca).toBe(1);
  });

  test("tandaiDibaca mengubah flag dan counter", () => {
    useNotifikasiStore.getState().setNotifikasi([{ id: "1", dibaca: false }, { id: "2", dibaca: false }], 2);
    useNotifikasiStore.getState().tandaiDibaca(["1"]);
    const s = useNotifikasiStore.getState();
    expect(s.items.find((n) => n.id === "1").dibaca).toBe(true);
    expect(s.jumlahBelumDibaca).toBe(1);
  });

  test("tandaiSemuaDibaca", () => {
    useNotifikasiStore.getState().setNotifikasi([{ id: "1", dibaca: false }, { id: "2", dibaca: false }], 2);
    useNotifikasiStore.getState().tandaiSemuaDibaca();
    expect(useNotifikasiStore.getState().jumlahBelumDibaca).toBe(0);
  });
});
