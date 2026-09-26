import { useEffect, useState, type CSSProperties } from 'react';

/** The film's own title treatment. If the asset is missing, render nothing. */
export default function FilmLogo({
  src,
  className,
  style,
}: {
  src: string | null | undefined;
  className?: string;
  style?: CSSProperties;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (!src || failed) return null;
  return (
    <img
      src={src}
      alt=""
      data-testid="film-logo"
      className={className}
      style={style}
      onError={() => setFailed(true)}
    />
  );
}
