// Endereço do servidor.
// - Navegador servido pelo próprio servidor do jogo: usa a mesma origem.
// - App Android/iOS (Capacitor): usa VITE_SERVER_URL definido no build (ex.: wss://hipe-online.onrender.com/ws).
// - O jogador pode trocar em "Servidor" na tela de login (salvo no aparelho).
const BUILD_URL = import.meta.env.VITE_SERVER_URL || '';

export function isNativeApp() {
  return !!window.Capacitor?.isNativePlatform?.() || location.protocol === 'capacitor:' || (location.hostname === 'localhost' && !location.port);
}

export function defaultServerUrl() {
  if (BUILD_URL) return BUILD_URL;
  if (isNativeApp()) return 'ws://10.0.2.2:8080/ws'; // emulador Android -> PC
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}/ws`;
}

export function serverUrl() {
  return localStorage.getItem('hipe.server') || defaultServerUrl();
}

export function setServerUrl(url) {
  if (url) localStorage.setItem('hipe.server', url);
  else localStorage.removeItem('hipe.server');
}
