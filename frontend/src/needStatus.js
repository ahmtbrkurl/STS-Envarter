// Ihtiyac "Tedarik Durumu" adimlari - satin alma biriminin Excel sablonundaki
// ("Списки" sekmesi, Статус) 6 adimla birebir eslesir:
//   Bekleniyor   = К оформлению / Onay bekliyor
//   Onaylandi    = Согласовано / Onaylandı
//   Siparis Verildi = Заказано / Sipariş verildi
//   Yolda        = В пути / Yolda
//   KismenAlindi = Частично получено / Kısmen alındı
//   Karsilandi   = Получено полностью / Tamamen alındı
// (Iptal ayri kalir, plana girmez.)
export const NEED_FLOW = ['Bekleniyor', 'Onaylandi', 'Siparis Verildi', 'Yolda', 'KismenAlindi', 'Karsilandi'];
// Henuz siparis VERILMEMIS adimlar (tarih/kur icin Planlanan Tarih kullanilir).
export const PRE_ORDER = ['Bekleniyor', 'Onaylandi'];
// Siparis verilmis ama tam teslim alinmamis adimlar.
export const ORDERED_OPEN = ['Siparis Verildi', 'Yolda', 'KismenAlindi'];
// Acik isler (iptal ve tamamen alinan haric).
export const OPEN_NEED = [...PRE_ORDER, ...ORDERED_OPEN];

export const PLAN_STATUS_TEXT = {
  Bekleniyor: 'К оформлению / Onay bekliyor',
  Onaylandi: 'Согласовано / Onaylandı',
  'Siparis Verildi': 'Заказано / Sipariş verildi',
  Yolda: 'В пути / Yolda',
  KismenAlindi: 'Частично получено / Kısmen alındı',
  Karsilandi: 'Получено полностью / Tamamen alındı'
};
