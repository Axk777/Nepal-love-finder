
// Mocking Firebase services to bypass module resolution errors
// This ensures the application can run even if the firebase package is missing or incompatible.

export const rtdb: any = {};
export const analytics: any = {};
export const messaging: any = {};

export const logAnalyticsEvent = (eventName: string, params?: any) => {
  // Mock logging
  // console.debug(`[Analytics Mock] ${eventName}`, params);
};

// UPDATED: Uses actual Browser Notification API
export const requestNotificationPermission = async (): Promise<string | null> => {
  if (!('Notification' in window)) {
    console.warn("This browser does not support desktop notification");
    return null;
  }
  
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      // Return a dummy token to indicate success to the app
      return 'local-device-token-' + Date.now();
    }
  } catch (e) {
    console.error("Notification permission error", e);
  }
  return null;
};

// NEW: Helper to send local notifications
export const sendLocalNotification = (title: string, body: string) => {
  if (!('Notification' in window)) return;
  
  if (Notification.permission === 'granted') {
    try {
        new Notification(title, { 
            body, 
            icon: 'https://cdn-icons-png.flaticon.com/512/2503/2503508.png' // Heart Icon
        });
    } catch (e) {
        console.warn("Failed to send notification", e);
    }
  }
};
