import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { BRAND } from '@/lib/brand';

// A persistent localStorage flag suppresses the intro on every future visit.
// Keep completion scoped to this tab session so a fresh app entry can show it.
const INTRO_STORAGE_KEY = 'growmoney-first-visit-intro-session-v2';

function wasIntroCompleted() {
  try {
    return window.sessionStorage.getItem(INTRO_STORAGE_KEY) === 'complete';
  } catch {
    return false;
  }
}

export function FirstVisitIntro() {
  const [visible, setVisible] = useState(() => !wasIntroCompleted());
  const overlayRef = useRef<HTMLDivElement>(null);
  const growLogoRef = useRef<HTMLDivElement>(null);
  const agencyLogoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible) return;

    const overlay = overlayRef.current;
    const growLogo = growLogoRef.current;
    const agencyLogo = agencyLogoRef.current;
    if (!overlay || !growLogo || !agencyLogo) return;

    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fadeDuration = reducedMotion ? 0.15 : 0.55;
    const holdDuration = 3 - fadeDuration * 2;
    const timeline = gsap.timeline({
      onComplete: () => {
        try {
          window.sessionStorage.setItem(INTRO_STORAGE_KEY, 'complete');
        } catch {
          // Keep the introduction usable when browser storage is unavailable.
        }
        setVisible(false);
      },
    });

    timeline
      .set([growLogo, agencyLogo], { autoAlpha: 0, y: reducedMotion ? 0 : 12, scale: reducedMotion ? 1 : 0.97 })
      .to(growLogo, { autoAlpha: 1, y: 0, scale: 1, duration: fadeDuration, ease: 'power2.out' })
      .to({}, { duration: holdDuration })
      .to(growLogo, { autoAlpha: 0, y: reducedMotion ? 0 : -8, duration: fadeDuration, ease: 'power2.in' })
      .to(agencyLogo, { autoAlpha: 1, y: 0, scale: 1, duration: fadeDuration, ease: 'power2.out' })
      .to({}, { duration: holdDuration })
      .to(agencyLogo, { autoAlpha: 0, y: reducedMotion ? 0 : -8, duration: fadeDuration, ease: 'power2.in' })
      .to(overlay, { yPercent: -100, duration: reducedMotion ? 0.01 : 0.95, ease: 'power3.inOut' });

    return () => {
      timeline.kill();
      document.body.style.overflow = priorOverflow;
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[10000] grid h-[100svh] w-full place-items-center overflow-hidden bg-white text-slate-950"
      role="status"
      aria-label="Apresentação inicial do GrowMoney e da Agência AFRICA"
    >
      <div className="relative grid w-full place-items-center px-6">
        <div ref={growLogoRef} className="col-start-1 row-start-1 opacity-0" aria-hidden="true">
          <img
            src={BRAND.logoLight}
            alt="GrowMoney"
            className="h-auto max-h-[22svh] w-auto max-w-[min(78vw,380px)] object-contain"
            decoding="async"
          />
        </div>
        <div
          ref={agencyLogoRef}
          className="col-start-1 row-start-1 flex flex-col items-center opacity-0"
          role="img"
          aria-label="Agência AFRICA"
        >
          <span className="font-sans text-[clamp(2.75rem,10vw,5.5rem)] font-black leading-none tracking-[-0.075em] text-slate-950">
            AFRICA
          </span>
          <span className="mt-3 h-1 w-24 rounded-full bg-[#ff6a00]" aria-hidden="true" />
          <span className="mt-3 font-sans text-sm font-semibold uppercase tracking-[0.42em] text-slate-600 sm:text-base">
            Agência
          </span>
        </div>
      </div>
    </div>
  );
}
