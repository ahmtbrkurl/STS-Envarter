const MAP = {
  Kullanimda: 'accent',
  Stok: 'gray',
  Rezerve: 'amber',
  Onarimda: 'amber',
  Arizali: 'red',
  Kayip: 'red',
  Hurda: 'gray',
  'Elden Cikarildi': 'gray',
  'Kartus Bitti': 'amber',
  Iade: 'gray'
};

export default function StatusBadge({ status }) {
  const cls = MAP[status] || 'gray';
  return <span className={`badge badge-${cls}`}>{status || '—'}</span>;
}
