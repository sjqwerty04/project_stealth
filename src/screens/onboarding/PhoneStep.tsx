import { useState } from 'react';
import { Input } from '../../components/ui';
import { toE164 } from '../../lib/phone';
import { lookupVoicePhone, type VoiceLookup } from '../../lib/voice/importClient';
import { Cta, Label, Question } from './StepFrame';

type Props = {
  idToken: () => Promise<string>;
  onReady: (lookup: VoiceLookup) => Promise<void>;
};

export default function PhoneStep({ idToken, onReady }: Props) {
  const [raw, setRaw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lookup, setLookup] = useState<VoiceLookup | null>(null);

  const e164 = toE164(raw);
  const checked = Boolean(lookup && e164 && lookup.phone === e164);

  const submit = async () => {
    if (busy) return;
    if (!e164) {
      setLookup(null);
      setError('Enter a real phone number, with the country code.');
      return;
    }
    if (checked && lookup) {
      setBusy(true);
      setError(null);
      try {
        await onReady(lookup);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not bring that call over.');
      } finally {
        setBusy(false);
      }
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const token = await idToken();
      setLookup(await lookupVoicePhone(e164, token));
    } catch (err) {
      setLookup(null);
      setError(err instanceof Error ? err.message : 'Could not check that number.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto no-scrollbar min-h-0 px-7">
        <Label accent>From a call</Label>
        <Question>What number do you call Selects from?</Question>
        <Label className="mt-2">If you have talked to Selects, we start from what you said you liked. No text is sent.</Label>
        <div className="mt-6">
          <Input
            id="onboarding-phone-input"
            data-testid="onboarding-phone-input"
            inputMode="tel"
            autoComplete="tel"
            value={raw}
            placeholder="+1 202 555 0100"
            onChange={(event) => {
              setRaw(event.target.value);
              setError(null);
            }}
          />
        </div>
        {error && (
          <p className="mt-3 font-spec text-[10px] uppercase tracking-widest text-select" data-testid="onboarding-phone-error" role="alert">
            {error}
          </p>
        )}
        {checked && lookup?.found === false && (
          <p className="mt-6 text-fg-2" data-testid="onboarding-phone-empty">
            No call on this number yet. The next questions start your taste.
          </p>
        )}
        {checked && lookup?.found && lookup.alreadyImported && (
          <p className="mt-6 text-fg-2" data-testid="onboarding-phone-already">
            This number was already brought into Selects.
          </p>
        )}
        {checked && lookup?.found && !lookup.alreadyImported && (
          <div className="mt-6 space-y-4" data-testid="onboarding-phone-import">
            {lookup.likes.length > 0 && (
              <div data-testid="onboarding-phone-likes">
                <Label>What you liked</Label>
                <ul className="mt-2 space-y-3">
                  {lookup.likes.map((like) => (
                    <li key={like.title}>
                      <p className="text-fg font-display">{like.title}{like.year ? ` · ${like.year}` : ''}</p>
                      {like.reason && <p className="text-fg-2 text-sm mt-1">{like.reason}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {lookup.picks.length > 0 && (
              <div data-testid="onboarding-phone-picks">
                <Label>On your watchlist</Label>
                <p className="text-fg mt-2">{lookup.picks.map((pick) => pick.title).join(', ')}</p>
              </div>
            )}
          </div>
        )}
      </div>
      <Cta label={checked ? 'Continue' : 'Check this number'} onPress={submit} loading={busy} />
    </>
  );
}
