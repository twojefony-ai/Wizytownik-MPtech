import { driver, DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';

const TOUR_STORAGE_KEY = 'wizytownik_onboarding_tour_v4';

/**
 * Konfiguracja kroków interaktywnego samouczka (Guided Onboarding Tour)
 * Okno samouczka jest zawsze wyśrodkowane na ekranie ze stałą pozycją przycisków,
 * a aktywny element w tle otrzymuje wyraźny, świecący niebieski obrys.
 */
export const tourSteps: DriveStep[] = [
  {
    element: '#tour-personalization-form',
    popover: {
      title: '1. Zmień dane',
      description: 
        'Wypełnij formularz po prawej stronie lub kliknij bezpośrednio w tekst na podglądzie wizytówki po lewej stronie, aby edytować go w czasie rzeczywistym. Firmowy adres e-mail generuje się automatycznie na podstawie imienia i nazwiska (np. jan.kowalski@mptech.eu), ale w każdej chwili możesz go także modyfikować ręcznie.',
    },
  },
  {
    element: '#tour-qr-section',
    popover: {
      title: '2. Dodaj kod QR',
      description: 
        'Aplikacja automatycznie generuje wektorowy kod QR vCard 3.0 ze wszystkimi danymi pracownika. Wgrywanie własnego pliku graficznego z kodem QR jest całkowicie opcjonalne / w razie potrzeby. Możesz również pobrać sam kod w PDF CMYK 100% K, SVG lub PNG.',
    },
  },
  {
    element: '#tour-view-modes',
    popover: {
      title: '3. Sprawdź poprawność',
      description: 
        'Zweryfikuj wizytówkę na podglądzie. Przełączaj tryby: symulację lakieru wybiórczego UV, dedykowaną maskę produkcyjną Magenta 100% (M:100) oraz linie cięcia i spady drukarskie. W zakładce „Preflight DTP” znajdziesz automatyczną walidację techniczną.',
    },
  },
  {
    element: '#tour-export-button',
    popover: {
      title: '4. Eksportuj',
      description: 
        'Gdy wszystko jest gotowe, kliknij ten przycisk, aby wygenerować profesjonalny 4-stronicowy plik produkcyjny PDF w standardzie CMYK 300 DPI ze zdefiniowanymi spadami i rozdzielonymi warstwami lakieru UV.',
    },
  },
];

let activeDriverInstance: any = null;

const removeAllHighlights = () => {
  document.querySelectorAll('.tour-highlight-active').forEach((el) => {
    el.classList.remove('tour-highlight-active');
  });
};

/**
 * Inicjalizuje i uruchamia samouczek Driver.js
 * - Okno modalne samouczka ZAWSZE centralnie na środku ekranu
 * - Przyciski Wstecz / Dalej w stałym, niezmiennym miejscu w stopce
 * - Podświetlony element obrysowany wyraźną ramką #13A3E5 (tour-highlight-active)
 * - Okno samouczka obrysowane ramką o 25% ciemniejszą (#0e7aac)
 * - Zaciemnienie 10% black, blur 3% (1px)
 * - Przycisk "Pomiń" w stopce
 * @param force Jeśli true, samouczek uruchomi się nawet jeśli był wcześniej ukończony
 */
export function startOnboardingTour(force: boolean = false) {
  // Sprawdź czy samouczek był już ukończony / pominięty
  if (!force) {
    const isCompleted = localStorage.getItem(TOUR_STORAGE_KEY);
    if (isCompleted === 'true') {
      return;
    }
  }

  // Zamknij poprzednią instancję jeśli istnieje
  if (activeDriverInstance) {
    try {
      activeDriverInstance.destroy();
    } catch {
      // ignore
    }
  }

  removeAllHighlights();

  const driverObj = driver({
    showProgress: true,
    animate: true,
    overlayColor: 'rgba(0, 0, 0, 0.10)',
    stagePadding: 6,
    stageRadius: 12,
    allowClose: true,
    nextBtnText: 'Dalej →',
    prevBtnText: '← Wstecz',
    doneBtnText: 'Zrozumiałem',
    progressText: 'Krok {{current}} z {{total}}',
    steps: tourSteps,
    onHighlightStarted: (element) => {
      removeAllHighlights();
      if (element) {
        element.classList.add('tour-highlight-active');
        // Płynnie przewiń element do widoku jeśli znajduje się poza ekranem
        try {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch {
          // ignore
        }
      }
    },
    onDeselected: (element) => {
      if (element) {
        element.classList.remove('tour-highlight-active');
      }
    },
    onPopoverRender: (popover) => {
      // Wstrzyknij dedykowany przycisk "Pomiń" do stopki Driver.js
      if (!popover.wrapper) return;
      const footer = popover.wrapper.querySelector('.driver-popover-footer');
      if (footer && !footer.querySelector('.driver-popover-skip-btn')) {
        const skipBtn = document.createElement('button');
        skipBtn.type = 'button';
        skipBtn.className = 'driver-popover-skip-btn';
        skipBtn.textContent = 'Pomiń';
        skipBtn.title = 'Pomiń samouczek i przejdź do wypełniania';
        skipBtn.onclick = () => {
          localStorage.setItem(TOUR_STORAGE_KEY, 'true');
          removeAllHighlights();
          driverObj.destroy();
        };
        // Wstaw na początku stopki (z lewej strony)
        footer.insertBefore(skipBtn, footer.firstChild);
      }
    },
    onDestroyed: () => {
      // Zapisz stan ukończenia / pominięcia w localStorage i wyczyść obrysy
      localStorage.setItem(TOUR_STORAGE_KEY, 'true');
      removeAllHighlights();
      activeDriverInstance = null;
    },
  });

  activeDriverInstance = driverObj;

  // Sprawdź gotowość elementów w DOM i uruchom driver
  const tryStart = (attemptsLeft: number) => {
    const firstElement = document.querySelector('#tour-personalization-form');
    if (firstElement) {
      driverObj.drive();
    } else if (attemptsLeft > 0) {
      setTimeout(() => tryStart(attemptsLeft - 1), 150);
    } else {
      driverObj.drive();
    }
  };

  setTimeout(() => {
    tryStart(10);
  }, 250);
}

/**
 * Resetuje stan samouczka w localStorage i uruchamia go ponownie na żądanie użytkownika
 */
export function restartOnboardingTour() {
  localStorage.removeItem(TOUR_STORAGE_KEY);
  startOnboardingTour(true);
}
