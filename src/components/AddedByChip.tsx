type Props = {
  displayName: string;
  handle?: string | null;
  photoURL?: string;
  size?: number;
};

export default function AddedByChip({ displayName, handle, photoURL, size = 22 }: Props) {
  const initial = (handle || displayName || '?').charAt(0).toUpperCase();
  return (
    <div
      className="flex items-center justify-center rounded-full ring-2 ring-black/70 overflow-hidden bg-gray-700 text-white"
      style={{ width: size, height: size, fontSize: size * 0.5 }}
      title={handle ? `@${handle}` : displayName}
    >
      {photoURL ? (
        <img
          src={photoURL}
          alt={displayName}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span className="font-semibold leading-none">{initial}</span>
      )}
    </div>
  );
}
