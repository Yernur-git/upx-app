import posthog from 'posthog-js';

const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;

export function initAnalytics() {
  if (!KEY) return;
  posthog.init(KEY, {
    api_host: 'https://app.posthog.com',
    autocapture: false,
    capture_pageview: true,
    persistence: 'localStorage',
  });
}

export function identifyUser(userId: string, email?: string) {
  if (!KEY) return;
  posthog.identify(userId, email ? { email } : undefined);
}

export function resetAnalyticsUser() {
  if (!KEY) return;
  posthog.reset();
}

export function track(event: string, props?: Record<string, unknown>) {
  if (!KEY) return;
  posthog.capture(event, props);
}
