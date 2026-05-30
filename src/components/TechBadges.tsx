import type { TechSpecs } from '../hooks/useMovieDetails';

interface TechBadgesProps {
  techSpecs: TechSpecs;
}

export default function TechBadges({ techSpecs }: TechBadgesProps) {
  const { isImax, isDolbyAtmos, isDolbyVision } = techSpecs;

  const hasDolby = isDolbyAtmos || isDolbyVision;
  if (!isImax && !hasDolby) return null;

  return (
    <div className="flex items-center gap-4 flex-wrap opacity-50">
      {isImax && (
        <div className="flex flex-col items-center gap-0.5">
          <img src="/imax-logo.svg" alt="IMAX" className="h-4 w-auto" />
          <span className="text-[9px] text-gray-400 tracking-wide">EXPERIENCE IN IMAX</span>
        </div>
      )}
      {hasDolby && (
        <div className="flex flex-col items-center gap-0.5">
          <img src="/dolby-logo.svg" alt="Dolby" className="h-4 w-auto" />
          <span className="text-[9px] text-gray-400 tracking-wide">
            {isDolbyAtmos && isDolbyVision ? 'ATMOS • VISION' : isDolbyAtmos ? 'DOLBY ATMOS' : 'DOLBY VISION'}
          </span>
        </div>
      )}
    </div>
  );
}
