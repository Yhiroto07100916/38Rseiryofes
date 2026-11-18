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
  const enabled = useState<boolean>("presence-location-enabled", () => false);
  const loadedUserId = useState<string | null>("presence-loaded-user-id", () => null);
  const manualPromptOpen = useState<boolean>("presence-manual-prompt-open", () => false);
  const permissionHelpOpen = useState<boolean>("presence-permission-help-open", () => false);
  const manualPromptDismissed = useState<boolean>(
    `presence-manual-prompt-dismissed:${auth.user?.id ?? "anonymous"}`,
    () => false,
  );

  const refresh = async () => {
    if (!import.meta.client) return;
    if (!auth.user?.id) {
      enabled.value = false;
      status.value = "unknown";
      method.value = null;
      loadedUserId.value = null;
      return;
    }
    if (loadedUserId.value !== auth.user.id) {
      status.value = "unknown";
      method.value = null;
      loadedUserId.value = auth.user.id;
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

  // showPermissionHelp は、ユーザーが明示的に再判定した場合だけ設定案内を表示する。
  const checkLocation = async (showPermissionHelp = false) => {
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
      permissionHelpOpen.value = false;
    } catch (cause: any) {
      // 位置情報取得失敗は新しい判定として扱わず、既存状態を維持する。
      if (cause?.code === 1) {
        error.value = "位置情報が許可されていません。";
        if (showPermissionHelp) {
          permissionHelpOpen.value = true;
        } else if (!manualPromptDismissed.value) {
          manualPromptOpen.value = true;
        }
      } else {
        error.value = cause?.data?.error || "位置情報を取得できませんでした。現在の在校状態は変更していません。";
      }
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

  const retryLocationPermission = async () => {
    permissionHelpOpen.value = false;
    // 設定変更後にユーザー操作から位置情報取得を再試行する。
    await checkLocation(true);
  };

  const manualRegister = async () => {
    if (!auth.user?.id || busy.value) return;
    busy.value = true;
    error.value = "";
    try {
      const result = await apiFetch<{ status: PresenceStatus; method?: string }>("/api/presence/manual", {
        method: "POST",
      });
      status.value = result.status;
      method.value = result.method ?? "manual";
      manualPromptOpen.value = false;
      manualPromptDismissed.value = true;
    } catch (cause: any) {
      error.value = cause?.data?.error || "手動登録に失敗しました。";
    } finally {
      busy.value = false;
    }
  };

  const dismissManualPrompt = () => {
    manualPromptOpen.value = false;
    manualPromptDismissed.value = true;
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

  return {
    status,
    method,
    busy,
    error,
    enabled,
    manualPromptOpen,
    permissionHelpOpen,
    refresh,
    checkLocation,
    enable,
    retryLocationPermission,
    manualRegister,
    dismissManualPrompt,
    disable,
  };
}
