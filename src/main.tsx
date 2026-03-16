import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Register service worker with auto-update
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      // Check for updates every 5 minutes
      setInterval(() => {
        registration.update();
      }, 5 * 60 * 1000);

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version available - show update banner
              showUpdateBanner();
            }
          });
        }
      });
    });
  });
}

function showUpdateBanner() {
  // Avoid duplicate banners
  if (document.getElementById('sw-update-banner')) return;

  const banner = document.createElement('div');
  banner.id = 'sw-update-banner';
  banner.style.cssText = `
    position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%);
    z-index: 9999; background: hsl(var(--primary)); color: hsl(var(--primary-foreground));
    padding: 12px 20px; border-radius: 8px; font-size: 14px;
    display: flex; align-items: center; gap: 12px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15); cursor: pointer;
  `;
  banner.innerHTML = `
    <span>새 버전이 있습니다</span>
    <button style="background: hsl(var(--primary-foreground)); color: hsl(var(--primary));
      border: none; padding: 4px 12px; border-radius: 4px; font-size: 13px; font-weight: 600; cursor: pointer;">
      업데이트
    </button>
  `;
  banner.addEventListener('click', () => window.location.reload());
  document.body.appendChild(banner);
}
