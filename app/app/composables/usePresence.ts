import { computed, ref } from "vue";

const CONSENT_KEY = "38r-presence-location-enabled";

export type PresenceStatus = "inside" | "outside" | "unknown";

export function usePresence() {
  const { apiFetch } = useApi();
  const auth = useAuthStore();
  const consentKey = computed(() => `${CONSENT_KEY}:${auth.user?.id ?? "anonymous"}`);
  const status = useState<PresenceStatus>("presence-status", () => "unknown");
  const method = useState<string | null>("presence-method", () => null);
  const busy = ref(false);
  const error = ref("");
  const enabled = ref(false);

  const refresh = async () => {
    if (!import.meta.client) return;
    if (!auth.user?.id) {
      enabled.value = false;
      return;
    }
    enabled.value = localStorage.getItem(consentKey.value) === "true";
    try {
      const result = await apiFetch<{ status: PresenceStatus; method?: string | null }>("/api/presence/me");
      status.value = result.status;
      method.value = result.method ?? null;
    } catch (cause) {
      console.error("Failed to load presence state", cause);
    }
  };

  const checkLocation = async () => {
    if (!import.meta.client || !auth.user?.id || !enabled.value || busy.value || !navigator.geolocation) return;
    busy.value = true;
    error.value = "";
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          maximumAge: 60_000,
          timeout: 12_000,
        });
      });
      const result = await apiFetch<{ status: PresenceStatus; method?: string }>("/api/presence/check", {
        method: "POST",
        body: {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        },
      });
      status.value = result.status;
      method.value = result.method ?? "gps";
    } catch (cause: any) {
      // 位置情報取得失敗は新しい判定として扱わず、既存状態を維持する。
      error.value = cause?.data?.error || (cause?.code === 1
        ? "位置情報が許可されていません。ブラウザの設定を確認してください。"
        : "位置情報を取得できませんでした。現在の在校状態は変更していません。");
    } finally {
      busy.value = false;
    }
  };

  const enable = async () => {
    if (!import.meta.client || !auth.user?.id) return;
    localStorage.setItem(consentKey.value, "true");
    enabled.value = true;
    await checkLocation();
  };

  const manualRegister = async () => {
    busy.value = true;
    error.value = "";
    try {
      const result = await apiFetch<{ status: PresenceStatus; method?: string }>("/api/presence/manual", {
        method: "POST",
      });
      status.value = result.status;
      method.value = result.method ?? "manual";
    } catch (cause: any) {
      error.value = cause?.data?.error || "手動登録に失敗しました。";
    } finally {
      busy.value = false;
    }
  };

  const disable = async () => {
    if (!import.meta.client || !auth.user?.id) return;
    localStorage.removeItem(consentKey.value);
    enabled.value = false;
    busy.value = true;
    try {
      await apiFetch("/api/presence/me", { method: "DELETE" });
      status.value = "unknown";
      method.value = null;
    } catch (cause) {
      console.error("Failed to disable presence detection", cause);
      error.value = "在校状態を解除できませんでした。";
    } finally {
      busy.value = false;
    }
  };

  if (import.meta.client && auth.user?.id) {
    enabled.value = localStorage.getItem(consentKey.value) === "true";
  }

  return { status, method, busy, error, enabled, refresh, checkLocation, enable, manualRegister, disable };
}
