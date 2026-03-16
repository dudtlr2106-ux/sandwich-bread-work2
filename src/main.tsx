import { createRoot } from "react-dom/client";
import { toast } from "sonner";
import App from "./App.tsx";
import "./index.css";

const UPDATE_TOAST_ID = "sw-update-toast";

function clearLegacyUpdateUi() {
  document.getElementById("sw-update-banner")?.remove();
  toast.dismiss(UPDATE_TOAST_ID);
}

function showUpdateToast() {
  clearLegacyUpdateUi();
  toast.info("새 버전이 있습니다", {
    id: UPDATE_TOAST_ID,
    duration: Infinity,
    action: {
      label: "업데이트",
      onClick: () => window.location.reload(),
    },
  });
}

createRoot(document.getElementById("root")!).render(<App />);
clearLegacyUpdateUi();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const hadController = Boolean(navigator.serviceWorker.controller);

    navigator.serviceWorker.register("/sw.js").then((registration) => {
      const notifyIfWaitingUpdate = () => {
        if (hadController && registration.waiting) {
          showUpdateToast();
        }
      };

      notifyIfWaitingUpdate();

      setInterval(() => {
        registration.update();
      }, 5 * 60 * 1000);

      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed") {
            notifyIfWaitingUpdate();
          }
        });
      });

      if (hadController) {
        navigator.serviceWorker.addEventListener("controllerchange", showUpdateToast, {
          once: true,
        });
      }
    });
  });
}
