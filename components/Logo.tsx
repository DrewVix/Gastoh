// Marca de Gastoh: tres barras ascendentes (evocan el propio gráfico de
// evolución mensual del Dashboard), plano, sin gradiente ni sombra —
// hereda color por currentColor para quedar ligado al mismo verde de acento
// que usa el wordmark de texto.
export default function Logo({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="12" width="4" height="8" rx="2" fill="currentColor" />
      <rect x="10" y="8" width="4" height="12" rx="2" fill="currentColor" />
      <rect x="17" y="4" width="4" height="16" rx="2" fill="currentColor" />
    </svg>
  )
}
