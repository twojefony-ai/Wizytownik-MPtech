import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  GripHorizontal, 
  Sparkles, 
  HelpCircle, 
  Check, 
  ArrowRight, 
  ArrowLeft 
} from 'lucide-react';

export interface TourStep {
  element: string;
  title: string;
  description: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    element: '#tour-personalization-form',
    title: '1. Zmień dane',
    description: 
      'Wypełnij formularz po prawej stronie lub kliknij bezpośrednio w tekst na podglądzie wizytówki po lewej stronie, aby edytować go w czasie rzeczywistym. Firmowy adres e-mail generuje się automatycznie na podstawie imienia i nazwiska (np. jan.kowalski@mptech.eu), ale w każdej chwili możesz go także modyfikować ręcznie.',
  },
  {
    element: '#tour-qr-section',
    title: '2. Dodaj kod QR',
    description: 
      'Aplikacja automatycznie generuje wektorowy kod QR vCard 3.0 ze wszystkimi danymi pracownika. Wgrywanie własnego pliku graficznego z kodem QR jest całkowicie opcjonalne / w razie potrzeby. Możesz również pobrać sam kod w PDF CMYK 100% K, SVG lub PNG.',
  },
  {
    element: '#tour-card-canvas',
    title: '3. Sprawdź poprawność',
    description: 
      'Zweryfikuj wizytówkę na podglądzie. Przełączaj tryby: symulację lakieru wybiórczego UV, dedykowaną maskę produkcyjną Magenta 100% (M:100) oraz linie cięcia i spady drukarskie. W zakładce „Preflight DTP” znajdziesz automatyczną walidację techniczną.',
  },
  {
    element: '#tour-export-button',
    title: '4. Eksportuj',
    description: 
      'Gdy wszystko jest gotowe, kliknij ten przycisk, aby wygenerować profesjonalny 4-stronicowy plik produkcyjny PDF w standardzie CMYK 300 DPI ze zdefiniowanymi spadami i rozdzielonymi warstwami lakieru UV.',
  },
];

const STORAGE_KEY = 'wizytownik_onboarding_tour_v5';

interface OnboardingTourModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OnboardingTourModal: React.FC<OnboardingTourModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const modalRef = useRef<HTMLDivElement>(null);

  // Initialize position to center of screen when opened
  useEffect(() => {
    if (isOpen) {
      setCurrentStepIndex(0);
      if (!position) {
        const modalWidth = Math.min(460, window.innerWidth - 32);
        const modalHeight = 280;
        const initialX = Math.max(16, (window.innerWidth - modalWidth) / 2);
        const initialY = Math.max(80, (window.innerHeight - modalHeight) / 2);
        setPosition({ x: initialX, y: initialY });
      }
    }
  }, [isOpen]);

  // Clean all highlight and parent elevation classes
  const cleanupHighlights = () => {
    document.querySelectorAll('.tour-highlight-active').forEach((el) => {
      el.classList.remove('tour-highlight-active');
    });
    document.querySelectorAll('.tour-parent-elevated').forEach((el) => {
      el.classList.remove('tour-parent-elevated');
    });
  };

  // Highlight active element in DOM and elevate stacking parents
  useEffect(() => {
    if (!isOpen) {
      cleanupHighlights();
      return;
    }

    const step = TOUR_STEPS[currentStepIndex];
    if (!step) return;

    cleanupHighlights();

    const targetEl = document.querySelector(step.element) as HTMLElement | null;
    if (targetEl) {
      targetEl.classList.add('tour-highlight-active');

      // Elevate all parent stacking contexts (e.g. sticky column or header) above the blur overlay
      let parent: HTMLElement | null = targetEl.parentElement;
      while (parent && parent !== document.body) {
        parent.classList.add('tour-parent-elevated');
        parent = parent.parentElement;
      }

      try {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch {
        // ignore
      }
    }

    return () => {
      cleanupHighlights();
    };
  }, [isOpen, currentStepIndex]);

  // Handle Dragging logic
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!modalRef.current) return;
    const rect = modalRef.current.getBoundingClientRect();
    dragOffsetRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    setIsDragging(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const modalWidth = modalRef.current?.offsetWidth || 440;
      const modalHeight = modalRef.current?.offsetHeight || 260;

      let newX = e.clientX - dragOffsetRef.current.x;
      let newY = e.clientY - dragOffsetRef.current.y;

      // Clamp within viewport
      newX = Math.max(8, Math.min(window.innerWidth - modalWidth - 8, newX));
      newY = Math.max(8, Math.min(window.innerHeight - modalHeight - 8, newY));

      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  if (!isOpen) return null;

  const currentStep = TOUR_STEPS[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === TOUR_STEPS.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      localStorage.setItem(STORAGE_KEY, 'true');
      cleanupHighlights();
      onClose();
    } else {
      setCurrentStepIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirstStep) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  const handleSkip = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    cleanupHighlights();
    onClose();
  };

  return (
    <>
      {/* 10% Black Background Overlay with 3% (1px) Blur */}
      <div 
        className="fixed inset-0 z-[99990] bg-black/10 backdrop-blur-[1px] transition-opacity duration-200 pointer-events-auto"
        onClick={handleSkip}
      />

      {/* Draggable Onboarding Window - Preserves Position Across Steps */}
      <div
        ref={modalRef}
        style={{
          left: position ? `${position.x}px` : '50%',
          top: position ? `${position.y}px` : '50%',
          transform: position ? 'none' : 'translate(-50%, -50%)',
        }}
        className="fixed z-[99999] w-[460px] max-w-[calc(100vw-32px)] bg-[#171717] text-neutral-100 rounded-2xl border-2 border-[#0e7aac] shadow-[0_25px_60px_-10px_rgba(0,0,0,0.95),0_0_25px_rgba(14,122,172,0.45)] backdrop-blur-xl flex flex-col select-none animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Draggable Header Bar */}
        <div
          onMouseDown={handleMouseDown}
          className={`flex items-center justify-between px-4 py-3 border-b border-neutral-800/80 bg-neutral-900/60 rounded-t-2xl cursor-grab active:cursor-grabbing ${
            isDragging ? 'bg-[#0e7aac]/20' : 'hover:bg-neutral-800/40'
          } transition-colors`}
          title="Kliknij i przeciągnij, aby przesunąć okno samouczka w dowolne miejsce"
        >
          <div className="flex items-center gap-2 text-neutral-300">
            <GripHorizontal className="w-4 h-4 text-[#13A3E5]" />
            <span className="text-xs font-semibold text-neutral-300">
              Przewodnik po aplikacji
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-[#13A3E5] font-semibold bg-[#13A3E5]/10 px-2 py-0.5 rounded-full border border-[#13A3E5]/30">
              Krok {currentStepIndex + 1} z {TOUR_STEPS.length}
            </span>

            <button
              type="button"
              onClick={handleSkip}
              className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
              title="Zamknij samouczek"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Step Body Content - Spacious, never clipped */}
        <div className="p-5 flex-1 select-text">
          <h3 className="text-base font-bold text-white flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-[#13A3E5] inline-block shadow-[0_0_8px_#13A3E5]" />
            <span>{currentStep.title}</span>
          </h3>

          <p className="text-[13.5px] leading-relaxed text-neutral-300">
            {currentStep.description}
          </p>
        </div>

        {/* Stable Fixed Footer Button Layout */}
        <div className="px-5 py-3.5 bg-neutral-900/40 border-t border-neutral-800/80 rounded-b-2xl flex items-center justify-between gap-3">
          {/* Przycisk Pomiń po lewej stronie */}
          <button
            type="button"
            onClick={handleSkip}
            className="text-xs text-neutral-400 hover:text-white underline underline-offset-4 hover:text-neutral-200 transition-colors cursor-pointer"
          >
            Pomiń samouczek
          </button>

          {/* Przyciski Wstecz i Dalej po prawej stronie w stałym miejscu */}
          <div className="flex items-center gap-2.5">
            {!isFirstStep && (
              <button
                type="button"
                onClick={handlePrev}
                className="px-3.5 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs font-semibold border border-neutral-700 transition-all cursor-pointer min-w-[85px] text-center"
              >
                ← Wstecz
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              className="px-4 py-1.5 rounded-xl bg-[#13A3E5] hover:bg-[#0e8ec9] active:scale-95 text-white text-xs font-bold border border-[#13A3E5]/50 shadow-md shadow-[#13A3E5]/30 transition-all cursor-pointer min-w-[105px] text-center flex items-center justify-center gap-1.5"
            >
              <span>{isLastStep ? 'Zrozumiałem' : 'Dalej →'}</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
