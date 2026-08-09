export default function TableSkeleton({ rows = 10, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <tbody>
        {Array.from({ length: rows }).map((_, i) => (
          <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
            {Array.from({ length: cols }).map((_, j) => (
              <td key={j} style={{ padding: '10px 12px' }}>
                <div style={{
                  height: 16,
                  borderRadius: 4,
                  background: 'linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)',
                  backgroundSize: '200% 100%',
                  animation: 'shimmer 1.2s infinite',
                  width: j === 0 ? '40%' : j === cols-1 ? '60%' : '80%',
                }} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}