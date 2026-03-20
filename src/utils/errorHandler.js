import { Alert } from 'react-native';

// ── Prevent multiple alerts stacking ──────────────────────────────────────
let isShowingError = false;

const showErrorAlert = (title, message) => {
  if (isShowingError) return;
  isShowingError = true;
  Alert.alert(
    title,
    message,
    [{ text: 'OK', onPress: () => { isShowingError = false; } }],
    { cancelable: false }
  );
};

// ── Global JS error handler (replaces the default red-screen crash) ────────
export const setupGlobalErrorHandler = () => {
  const prevHandler = ErrorUtils.getGlobalHandler();

  ErrorUtils.setGlobalHandler((error, isFatal) => {
    console.error('[GlobalError]', error);

    const title = isFatal ? '💥 Fatal Error' : '⚠️ Unexpected Error';
    const message = error?.message || String(error) || 'An unknown error occurred.';

    showErrorAlert(title, `${message}\n\nPlease try again or restart the app if this persists.`);

    // Let the original handler run too (keeps dev tools working)
    if (__DEV__ && prevHandler) prevHandler(error, isFatal);
  });

  // ── Unhandled promise rejections ─────────────────────────────────────────
  const originalPromise = global.Promise;

  // React Native 0.63+ surfaces these via ErrorUtils automatically,
  // but we add a belt-and-suspenders fallback for older RN:
  if (global.HermesInternal) {
    // Hermes engine exposes this
    global.HermesInternal.enablePromiseRejectionTracker?.({
      allRejections: true,
      onUnhandled: (id, rejection) => {
        const msg = rejection?.message || String(rejection) || 'Unhandled promise rejection';
        console.warn('[UnhandledPromise]', msg);
        showErrorAlert('⚠️ Async Error', msg);
      },
    });
  }
};
