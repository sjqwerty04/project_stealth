import { Capacitor } from '@capacitor/core';

export async function bootNativeShell(): Promise<void> {
  if (Capacitor.getPlatform() !== 'ios') return;
  document.documentElement.classList.add('native-ios');

  const [{ StatusBar, Style }, { Keyboard, KeyboardResize }, { SplashScreen }, { App }] = await Promise.all([
    import('@capacitor/status-bar'),
    import('@capacitor/keyboard'),
    import('@capacitor/splash-screen'),
    import('@capacitor/app'),
  ]);

  await StatusBar.setOverlaysWebView({ overlay: true });
  // Style.Dark is light status-bar text, which is what this black page needs.
  await StatusBar.setStyle({ style: Style.Dark });
  await Keyboard.setResizeMode({ mode: KeyboardResize.Native });

  await App.addListener('appUrlOpen', ({ url }) => {
    let next = '/';
    try {
      const opened = new URL(url);
      next = `${opened.pathname}${opened.search}${opened.hash}`;
    } catch {
      return;
    }
    if (!next.startsWith('/') || next.startsWith('//')) return;
    window.history.pushState({}, '', next);
    window.dispatchEvent(new PopStateEvent('popstate'));
  });

  const hide = () => {
    void SplashScreen.hide().catch(() => {});
  };
  requestAnimationFrame(() => requestAnimationFrame(hide));
  window.setTimeout(hide, 2500);
}
