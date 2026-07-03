export default function NavBackButton({ onClick, label = '← Volver' }) {
  return (
    <button onClick={onClick} style={s} aria-label="Volver">
      {label}
    </button>
  );
}

const s = {
  alignSelf: 'flex-start',
  background: 'none',
  border: 'none',
  color: 'var(--text-intermediate-color)',
  cursor: 'pointer',
  fontSize: '.9rem',
  padding: '.5rem 0',
  minHeight: 48,
};
