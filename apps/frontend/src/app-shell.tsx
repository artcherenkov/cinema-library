import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";

const serviceWorkerCheckIntervalMs = 10 * 60 * 1000;
const minimumServiceWorkerCheckIntervalMs = 60 * 1000;
const serviceWorkerActivationTimeoutMs = 10 * 1000;

type AppShellProps = {
  children: ReactNode;
};

type ApplicationUpdateDialogProps = {
  isRefreshing: boolean;
  onRefresh: () => void;
  open: boolean;
};

type ServiceWorkerUpdatePrompt = {
  isRefreshing: boolean;
  needRefresh: boolean;
  refreshApplication: () => Promise<void>;
};

type ControllerChangeWaiter = {
  cancel: () => void;
  promise: Promise<void>;
};

function AppShell({ children }: AppShellProps) {
  const { isRefreshing, needRefresh, refreshApplication } = useServiceWorkerUpdatePrompt();

  return (
    <>
      {children}
      <ApplicationUpdateDialog
        open={needRefresh}
        isRefreshing={isRefreshing}
        onRefresh={refreshApplication}
      />
    </>
  );
}

function ApplicationUpdateDialog({ isRefreshing, onRefresh, open }: ApplicationUpdateDialogProps) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Доступно обновление</AlertDialogTitle>
          <AlertDialogDescription>
            Вышла новая версия приложения. Обновите страницу, чтобы продолжить работу с актуальной
            версией.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={onRefresh} disabled={isRefreshing}>
            {isRefreshing ? "Обновляю..." : "Обновить"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function useServiceWorkerUpdatePrompt(): ServiceWorkerUpdatePrompt {
  const [serviceWorkerRegistration, setServiceWorkerRegistration] =
    useState<ServiceWorkerRegistration | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const lastServiceWorkerCheckAtRef = useRef(0);
  const isApplicationRefreshInProgressRef = useRef(false);
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onNeedReload() {
      if (!isApplicationRefreshInProgressRef.current) {
        window.location.reload();
      }
    },
    onRegisteredSW(_serviceWorkerUrl, registration) {
      setServiceWorkerRegistration(registration ?? null);
    },
  });

  useEffect(() => {
    if (serviceWorkerRegistration === null) {
      return;
    }

    const checkServiceWorkerUpdate = async () => {
      const now = Date.now();

      if (now - lastServiceWorkerCheckAtRef.current < minimumServiceWorkerCheckIntervalMs) {
        return;
      }

      if (serviceWorkerRegistration.installing !== null) {
        return;
      }

      if (!navigator.onLine) {
        return;
      }

      lastServiceWorkerCheckAtRef.current = now;

      try {
        await serviceWorkerRegistration.update();
      } catch {
        // A failed update check should not interrupt the app shell.
      }
    };

    const intervalId = window.setInterval(() => {
      void checkServiceWorkerUpdate();
    }, serviceWorkerCheckIntervalMs);

    const checkOnFocus = () => {
      void checkServiceWorkerUpdate();
    };

    const checkOnVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void checkServiceWorkerUpdate();
      }
    };

    window.addEventListener("focus", checkOnFocus);
    document.addEventListener("visibilitychange", checkOnVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", checkOnFocus);
      document.removeEventListener("visibilitychange", checkOnVisibilityChange);
    };
  }, [serviceWorkerRegistration]);

  const refreshApplication = async () => {
    setIsRefreshing(true);
    isApplicationRefreshInProgressRef.current = true;

    try {
      await activateServiceWorkerUpdate(updateServiceWorker);
      window.location.reload();
    } catch {
      window.location.reload();
    } finally {
      isApplicationRefreshInProgressRef.current = false;
    }
  };

  return {
    isRefreshing,
    needRefresh,
    refreshApplication,
  };
}

async function activateServiceWorkerUpdate(
  updateServiceWorker: () => Promise<void>,
): Promise<void> {
  const controllerChangeWaiter = createControllerChangeWaiter();

  try {
    await updateServiceWorker();
    await controllerChangeWaiter.promise;
  } catch (error) {
    controllerChangeWaiter.cancel();
    throw error;
  }
}

function createControllerChangeWaiter(): ControllerChangeWaiter {
  if (!("serviceWorker" in navigator)) {
    return {
      cancel: noop,
      promise: Promise.resolve(),
    };
  }

  let cleanup = noop;

  const promise = new Promise<void>((resolve, reject) => {
    const finish = (settle: () => void) => {
      cleanup();
      settle();
    };

    const handleControllerChange = () => {
      finish(resolve);
    };

    const timeoutId = window.setTimeout(() => {
      finish(() => {
        reject(new Error("Новый service worker не взял управление страницей за 10 секунд."));
      });
    }, serviceWorkerActivationTimeoutMs);

    cleanup = () => {
      window.clearTimeout(timeoutId);
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
  });

  return {
    cancel: cleanup,
    promise,
  };
}

function noop(): void {
  return undefined;
}

export { AppShell };
