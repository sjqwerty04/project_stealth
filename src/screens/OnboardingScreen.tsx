import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, LayoutGroup } from 'framer-motion';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { useHandle, normalizeHandle, isValidHandle } from '../hooks/useHandle';
import { setVerdict } from '../lib/library';
import { posterUrl } from '../lib/fallbackCatalog';
import { recordTasteEvent } from '../lib/taste';
import type { Axis } from '../lib/taste/types';
import {
  anyImportDone,
  anyImportRunning,
  filmsRead,
  initialOnboardingState,
  onboardingReducer,
  STEP_ORDER,
} from '../lib/onboarding/state';
import {
  axesFromSeed,
  forgetSeed,
  profileAlreadyFinished,
  readRememberedSeed,
  seedFilmDoc,
  stateFromSeed,
  type MarketingSeed,
} from '../lib/onboarding/seed';
import { buildTasteGraph } from '../lib/onboarding/graph';
import Armature from '../components/Armature';
import PickWall from '../components/PickWall';
import { BarUnit, Button, Mark } from '../components/ui';
import ImportHub from './onboarding/ImportHub';
import { Cta, Label, Question, StepBody } from './onboarding/StepFrame';
import { InsightsStep, NegativeProfileStep, ReadingStep } from './onboarding/RewardSteps';
import { useReading } from './onboarding/useReading';

const AXIS_OPTIONS: { value: Axis; label: string; sub: string }[] = [
  { value: 'story', label: 'A flawless screenplay', sub: 'Structure · dialogue · the writing' },
  { value: 'visual', label: 'The room and the projection', sub: '70mm · the crowd · the dark' },
  { value: 'mood', label: 'Both, depending on the night', sub: 'And I will tell you which' },
];

export default function OnboardingScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nextPath = searchParams.get('next') || '/app';
  const retake = searchParams.get('retake') === 'true';
  const { user } = useAuth();
  const { claimHandle, isAvailable } = useHandle();
  const seed = useRef<MarketingSeed | null>(retake ? null : readRememberedSeed()).current;

  const [state, dispatch] = useReducer(onboardingReducer, seed, (incoming) =>
    incoming ? stateFromSeed(incoming) : initialOnboardingState,
  );
  const [saving, setSaving] = useState(false);
  const reading = useReading(state, dispatch, user?.uid ?? null);
  const wroteSeed = useRef(false);

  const finish = useCallback(() => {
    sessionStorage.removeItem('isNewUser');
    sessionStorage.removeItem('pendingInviteCode');
    forgetSeed();
    navigate(nextPath, { replace: true });
  }, [navigate, nextPath]);

  useEffect(() => {
    if (retake) forgetSeed();
  }, [retake]);

  useEffect(() => {
    if (!user || !seed || retake || wroteSeed.current) return;
    wroteSeed.current = true;
    const axes = axesFromSeed(seed.axes);
    void (async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid, 'profile_data', 'taste_profile'));
        if (profileAlreadyFinished(snap.data())) {
          forgetSeed();
          navigate(nextPath, { replace: true });
          return;
        }
        try {
          await updateDoc(doc(db, 'users', user.uid), { 'profile.displayName': seed.name });
        } catch (err) {
          console.error('Failed to save display name:', err);
        }
        await setDoc(
          doc(db, 'users', user.uid, 'profile_data', 'taste_profile'),
          {
            onboardingCompleted: true,
            favoriteFilms: seed.positive.map(seedFilmDoc),
            dislikedFilms: seed.negative.map(seedFilmDoc),
            filmPreference: axes[0] ?? null,
            axes,
            lightsDownHour: seed.hour,
            completedAt: serverTimestamp(),
            version: 2,
          },
          { merge: true },
        );
        await recordTasteEvent(
          user.uid,
          {
            type: 'onboarding',
            favoriteFilms: seed.positive.map((film) => ({ movieId: film.id, title: film.title, year: film.year })),
            dislikedFilms: seed.negative.map((film) => ({ movieId: film.id, title: film.title, year: film.year })),
            axis: axes[0] ?? null,
          },
          { email: user.email },
        );
      } catch (err) {
        wroteSeed.current = false;
        console.error('Failed to save seeded taste profile:', err);
      }
    })();
  }, [user, seed, retake, navigate, nextPath]);

  const tryClaimHandleSilently = useCallback(async () => {
    if (!user) return;
    try {
      const raw = user.displayName ?? user.email?.split('@')[0] ?? '';
      const lower = normalizeHandle(raw);
      if (!isValidHandle(lower)) return;
      if (await isAvailable(lower)) await claimHandle(lower);
    } catch {
      // A handle is a nicety. The flow never waits on it.
    }
  }, [user, isAvailable, claimHandle]);

  /** Runs once the three questions are answered, before any import can seed the same doc. */
  const saveAnswers = useCallback(async () => {
    if (!user) return;
    setSaving(true);
    const favorite = state.positive.map((f) => ({ movieId: f.id, title: f.title, year: f.year }));
    const disliked = state.negative.map((f) => ({ movieId: f.id, title: f.title, year: f.year }));
    try {
      await setDoc(
        doc(db, 'users', user.uid, 'profile_data', 'taste_profile'),
        {
          onboardingCompleted: true,
          favoriteFilms: state.positive,
          dislikedFilms: state.negative,
          filmPreference: state.axes[0] ?? null,
          axes: state.axes,
          completedAt: serverTimestamp(),
          version: 2,
        },
        { merge: true },
      );
      for (const film of state.positive) {
        const poster = !film.posterPath
          ? ''
          : film.posterPath.startsWith('http')
            ? film.posterPath
            : posterUrl(film.posterPath, 'w500');
        await setVerdict(
          user.uid,
          { movieId: film.id, title: film.title, year: film.year, poster },
          'liked',
          'manual',
        );
      }
      await recordTasteEvent(
        user.uid,
        { type: 'onboarding', favoriteFilms: favorite, dislikedFilms: disliked, axis: state.axes[0] ?? null },
        { email: user.email },
      );
    } catch (e) {
      console.error('Failed to save taste profile:', e);
    } finally {
      setSaving(false);
    }
    dispatch({ type: 'next' });
  }, [user, state.positive, state.negative, state.axes]);

  const graph = useMemo(
    () => (state.stats ? buildTasteGraph(state.stats.graphSeed, reading.colours.length ? reading.colours : [state.stats.colourHex]) : null),
    [state.stats, reading.colours],
  );

  const stepIndex = STEP_ORDER.indexOf(state.step);
  const showProgress = state.step !== 'splash';

  return (
    <LayoutGroup>
      <div className="h-dvh min-h-screen overflow-hidden bg-base flex flex-col w-full max-w-[480px] mx-auto" data-testid="onboarding-screen" data-step={state.step}>
        {showProgress && (
          <div className="flex gap-1.5 px-7 pt-6" aria-label="Onboarding progress">
            {STEP_ORDER.slice(1).map((s, i) => (
              <BarUnit key={s} state={i + 1 <= stepIndex ? (i + 1 === stepIndex ? 'select' : 'on') : 'empty'} />
            ))}
          </div>
        )}

        <div className={state.step === 'splash' ? 'pt-[22vh]' : 'pt-4'}>
          <Armature step={state.step} />
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {state.step === 'splash' && (
            <StepBody key="splash" testId="onboarding-0" className="items-center justify-center px-7">
              <Mark variant="lockup" size={40} />
              <Label className="mt-3">The take worth keeping</Label>
              <Button className="w-full max-w-sm mt-10" onClick={() => dispatch({ type: 'next' })} data-testid="onboarding-cta">
                Begin
              </Button>
            </StepBody>
          )}

          {state.step === 'positive' && (
            <StepBody key="positive" testId="onboarding-1">
              <div className="px-7 pb-3">
                <Label accent>Building · Positive profile</Label>
                <Question>If you could rent a theatre and watch one film in it forever, what is it?</Question>
              </div>
              <div className="flex-1 relative min-h-0">
                <PickWall
                  wall="positive"
                  selected={state.positive}
                  onToggle={(film) => dispatch({ type: 'togglePick', wall: 'positive', film })}
                  searchPlaceholder="search any film"
                />
              </div>
              <Cta
                label={state.positive.length ? `Next · ${state.positive.length} picked` : 'Pick at least one'}
                onPress={() => dispatch({ type: 'next' })}
                disabled={state.positive.length < 1}
              />
            </StepBody>
          )}

          {state.step === 'negative' && (
            <StepBody key="negative" testId="onboarding-3">
              <div className="px-7 pb-3">
                <Label accent>Building · Negative profile</Label>
                <Question>What did everyone love that never landed for you?</Question>
              </div>
              <div className="flex-1 relative min-h-0">
                <PickWall
                  wall="negative"
                  selected={state.negative}
                  onToggle={(film) => dispatch({ type: 'togglePick', wall: 'negative', film })}
                  searchPlaceholder="search the ones you resisted"
                />
              </div>
              <Cta label={state.negative.length ? `Next · ${state.negative.length} struck` : 'Next · or skip'} onPress={() => dispatch({ type: 'next' })} />
            </StepBody>
          )}

          {state.step === 'neutral' && (
            <StepBody key="neutral" testId="onboarding-4">
              <div className="px-7 pb-3">
                <Label accent>Building · Neutral profile</Label>
                <Question>What are you actually there for?</Question>
                <Label className="mt-2">Pick as many as are true</Label>
              </div>
              <div className="flex-1 px-7 flex flex-col gap-2 pt-2">
                {AXIS_OPTIONS.map((opt) => {
                  const on = state.axes.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      aria-pressed={on}
                      onClick={() => dispatch({ type: 'toggleAxis', axis: opt.value })}
                      className={`w-full min-h-11 border p-4 text-left transition-colors ${on ? 'border-select bg-base-3' : 'border-line bg-base-2'}`}
                    >
                      <p className="text-fg font-display">{opt.label}</p>
                      <Label className="mt-1">{opt.sub}</Label>
                    </button>
                  );
                })}
              </div>
              <Cta label="Continue" onPress={saveAnswers} loading={saving} />
            </StepBody>
          )}

          {state.step === 'import' && (
            <StepBody key="import" testId="onboarding-5">
              <div className="flex-1 overflow-y-auto no-scrollbar min-h-0">
                {seed && seed.positive.length > 0 && (
                  <div data-testid="seed-picks" className="px-7 pt-2 pb-4">
                    <p className="font-spec text-[10px] uppercase tracking-widest text-fg-3">You kept</p>
                    <ul className="mt-2 space-y-1">
                      {seed.positive.map((film) => (
                        <li key={film.id} className="text-sm text-fg">
                          {film.title} <span className="font-spec text-[10px] text-fg-3">{film.year}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <ImportHub imports={state.imports} dispatch={dispatch} letterboxdUsername={seed?.letterboxd ?? ''} />
              </div>
              <Cta
                label={anyImportDone(state) ? `Read my library · ${filmsRead(state)} films` : 'Read my library'}
                onPress={() => dispatch({ type: 'next' })}
                disabled={!anyImportDone(state) || anyImportRunning(state)}
                secondary={{ label: 'Skip for now', onPress: () => dispatch({ type: 'next' }), testId: 'onboarding-skip-lb' }}
              />
            </StepBody>
          )}

          {state.step === 'reading' && (
            <StepBody key="reading" testId="onboarding-reading">
              <ReadingStep count={reading.count} sampled={reading.sampled} total={reading.total} colours={reading.colours} />
            </StepBody>
          )}

          {state.step === 'negativeProfile' && state.stats && state.profile && graph && (
            <StepBody key="negativeProfile" testId="onboarding-6">
              <NegativeProfileStep stats={state.stats} profile={state.profile} graph={graph} />
              <Cta label="Insights" onPress={() => dispatch({ type: 'next' })} />
            </StepBody>
          )}

          {state.step === 'insights' && state.profile && (
            <StepBody key="insights" testId="onboarding-7">
              <InsightsStep profile={state.profile} />
              <Cta
                label="Open the Assembly"
                onPress={() => {
                  tryClaimHandleSilently();
                  finish();
                }}
              />
            </StepBody>
          )}
        </AnimatePresence>
      </div>
    </LayoutGroup>
  );
}
