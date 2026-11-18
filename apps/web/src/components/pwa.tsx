"use client";

import { createContext, useContext, useEffect, useState } from "react";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const InstallContext = createContext<{ available: boolean; installed: boolean; ios: boolean; install: () => Promise<void> }>({
  available: false, installed: false, ios: false, install: async () => {},
});

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const displayMode = window.matchMedia("(display-mode: standalone)");
    const checkInstalled = () => setInstalled(displayMode.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    const updateConnection = () => setOffline(!navigator.onLine);
    const frame = requestAnimationFrame(() => {
      checkInstalled();
      updateConnection();
      setIos(/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
    });
    const beforeInstall = (event: Event) => { event.preventDefault(); setPrompt(event as InstallEvent); };
    const onInstalled = () => { setInstalled(true); setPrompt(null); };
    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("offline", updateConnection);
    window.addEventListener("online", updateConnection);
    displayMode.addEventListener("change", checkInstalled);

    // Keep the development HMR cycle independent of service-worker lifecycle.
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator && window.isSecureContext) {
      void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
        // Installation remains available; a failed worker must not block navigation.
      });
    }
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("offline", updateConnection);
      window.removeEventListener("online", updateConnection);
      displayMode.removeEventListener("change", checkInstalled);
    };
  }, []);

  async function install() {
    if (!prompt) return;
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
    } catch {
      // Fall back to the browser-menu instructions when the native prompt fails.
    } finally {
      setPrompt(null);
    }
  }

  return <InstallContext.Provider value={{ available: Boolean(prompt), installed, ios, install }}>
    {offline && <div className="connection-status" role="status">Sem conexão. Reconecte para consultar e salvar alterações.</div>}
    {children}
  </InstallContext.Provider>;
}

export function InstallApp() {
  const { available, installed, ios, install } = useContext(InstallContext);
  if (installed) return null;
  return <details className="install-app">
    <summary>Instalar aplicativo CIP <span aria-hidden="true">↧</span></summary>
    {available ? <button type="button" className="cip-btn cip-btn--secondary" onClick={() => void install()}>Adicionar à tela inicial</button> :
      <p>{ios
        ? "No Safari, toque em Compartilhar e em Adicionar à Tela de Início. Depois, toque em Adicionar."
        : "No menu do navegador, escolha Instalar aplicativo ou Adicionar à tela inicial. Se a opção não aparecer, abra este endereço no Chrome ou Safari."}</p>}
    <small>O acesso aos dados e o envio de alterações precisam de conexão.</small>
  </details>;
}
