import { TechSpecs } from '../hooks/useMovieDetails';

interface TechBadgesProps {
  techSpecs: TechSpecs;
}

export default function TechBadges({ techSpecs }: TechBadgesProps) {
  const { certification, isImax, isDolbyAtmos, isDolbyVision } = techSpecs;
  
  const hasDolby = isDolbyAtmos || isDolbyVision;
  const hasAnyBadge = certification || isImax || hasDolby;
  
  if (!hasAnyBadge) return null;

  return (
    <div className="flex items-center gap-4 flex-wrap opacity-50">
      {/* IMAX Badge */}
      {isImax && (
        <div className="flex flex-col items-center gap-0.5">
          <img 
            src="/imax-logo.svg" 
            alt="IMAX" 
            className="h-4 w-auto"
          />
          <span className="text-[9px] text-gray-400 tracking-wide">
            EXPERIENCE IN IMAX
          </span>
        </div>
      )}

      {/* Dolby Badge */}
      {hasDolby && (
        <div className="flex flex-col items-center gap-0.5">
          <img 
            src="/dolby-logo.svg" 
            alt="Dolby" 
            className="h-4 w-auto"
          />
          <span className="text-[9px] text-gray-400 tracking-wide">
            {isDolbyAtmos && isDolbyVision ? 'ATMOS • VISION' : isDolbyAtmos ? 'DOLBY ATMOS' : 'DOLBY VISION'}
          </span>
        </div>
      )}

      {/* Certification Badge (R, PG-13, etc.) */}
      {certification && (
        <div className="flex items-center justify-center px-1.5 py-0.5 border border-gray-500 rounded">
          <span className="text-xs font-semibold text-gray-300 tracking-wide">
            {certification}
          </span>
        </div>
      )}
    </div>
  );
}
