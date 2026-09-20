export default function SwatchStrip({
  swatches,
  size = 44,
  gap = 8,
  className = '',
}: {
  swatches: readonly string[];
  size?: number;
  gap?: number;
  className?: string;
}) {
  return (
    <div className={`flex ${className}`} style={{ gap }} aria-hidden data-testid="swatch-strip">
      {swatches.map((color, index) => (
        <span
          key={index}
          className="block shrink-0"
          style={{ width: size, height: size, backgroundColor: color, borderRadius: 0 }}
        />
      ))}
    </div>
  );
}
