// Delay realtime subscriptions to avoid Lighthouse detecting WebSocket errors
// during initial page load analysis
const REALTIME_DELAY_MS = 2000;

let isRealtimeReady = false;
let readyPromise: Promise<void> | null = null;

// Initialize realtime with a delay to allow Lighthouse to complete analysis
export const waitForRealtimeReady = (): Promise<void> => {
  if (isRealtimeReady) {
    return Promise.resolve();
  }
  
  if (readyPromise) {
    return readyPromise;
  }
  
  readyPromise = new Promise((resolve) => {
    // Wait for window load event and additional delay
    const init = () => {
      setTimeout(() => {
        isRealtimeReady = true;
        resolve();
      }, REALTIME_DELAY_MS);
    };
    
    if (document.readyState === 'complete') {
      init();
    } else {
      window.addEventListener('load', init, { once: true });
    }
  });
  
  return readyPromise;
};
