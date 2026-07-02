"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Shield,
  Activity,
  BellRing,
  Network,
  Heart,
  Clock,
  Eye,
  ChevronDown,
  ChevronUp,
  Zap,
  Brain,
  AlertTriangle,
  CheckCircle,
  Bell,
  BellOff,
  X,
  Link2,
  ShieldCheck,
  Calendar,
  ClipboardList,
  MessageSquare,
  PhoneCall,
  MoreHorizontal,
  MapPin,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import VoiceTriage from "../components/VoiceTriage";
import WhatsAppButton from "../components/WhatsAppButton";
import Chatbot from "../components/Chatbot";
import PastNotifications from "../components/PastNotifications";
import { apiFetch } from "@/lib/apiFetch";
import dynamic from "next/dynamic";

// Dynamically import the Ola Map (maplibre needs the browser)
const OlaMap = dynamic(() => import("../components/OlaMap"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: 340,
        borderRadius: 16,
        background: "var(--surface-muted)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--charcoal)",
        fontSize: "0.85rem",
      }}
    >
      Loading map…
    </div>
  ),
});

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

async function subscribePush(patientId: string) {
  if (
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window) ||
    !VAPID_PUBLIC
  )
    return false;
  try {
    const permission =
      Notification.permission === "granted"
        ? "granted"
        : await Notification.requestPermission();

    if (permission !== "granted") return false;

    const reg = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });
    const readyReg = await navigator.serviceWorker.ready;
    const pushReg = readyReg.scope === reg.scope ? readyReg : reg;
    const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC);
    let sub = await pushReg.pushManager.getSubscription();

    if (
      sub &&
      !sameArrayBuffer(sub.options.applicationServerKey, applicationServerKey)
    ) {
      await sub.unsubscribe();
      sub = null;
    }

    sub =
      sub ||
      (await pushReg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      }));

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || ""}/api/notify/subscribe`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: sub.toJSON(),
          patientId,
          role: "patient",
        }),
      },
    );
    return res.ok;
  } catch (error) {
    console.warn("[Web Push] Subscription failed:", error);
    return false;
  }
}

async function unsubscribePush() {
  if (!("serviceWorker" in navigator)) return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return true;

    await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || ""}/api/notify/subscribe`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      },
    );

    return await sub.unsubscribe();
  } catch (error) {
    console.warn("[Web Push] Unsubscribe failed:", error);
    return false;
  }
}

function urlBase64ToUint8Array(base64: string) {
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

function sameArrayBuffer(left: ArrayBuffer | null, right: Uint8Array) {
  if (!left || left.byteLength !== right.byteLength) return false;
  const leftBytes = new Uint8Array(left);
  return leftBytes.every((value, index) => value === right[index]);
}

interface ConsentState {
  emergency: boolean;
  specialist: boolean;
  research: boolean;
}
interface AuditEntry {
  clinician: string;
  reason: string;
  timestamp: string;
}

function timeAgo(iso: string) {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return `${Math.round(d)}s ago`;
  if (d < 3600) return `${Math.round(d / 60)}m ago`;
  if (d < 86400) return `${Math.round(d / 3600)}h ago`;
  return `${Math.round(d / 86400)}d ago`;
}

const SHOWN_POPUP_STORAGE = "nalamShownAlertPopups";

function loadShownPopups(patientId: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(`${SHOWN_POPUP_STORAGE}:${patientId}`);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function persistShownPopups(patientId: string, ids: Set<string>) {
  try {
    localStorage.setItem(
      `${SHOWN_POPUP_STORAGE}:${patientId}`,
      JSON.stringify([...ids]),
    );
  } catch {
    /* quota / private mode */
  }
}

function ConsentToggle({
  label,
  desc,
  active,
  onToggle,
}: {
  label: string;
  desc: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className="flex-between"
      style={{
        padding: "0.7rem 0.9rem",
        background: active ? "var(--primary-light)" : "var(--surface-muted)",
        borderRadius: 10,
        border: `1.5px solid ${active ? "var(--primary)" : "var(--border)"}`,
        transition: "all 0.25s",
        gap: "0.75rem",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 600,
            fontSize: "0.84rem",
            color: "var(--deep-blue)",
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: "0.73rem",
            color: "var(--charcoal)",
            marginTop: 1,
            lineHeight: 1.35,
          }}
        >
          {desc}
        </div>
      </div>
      <button
        onClick={onToggle}
        style={{
          width: 44,
          height: 24,
          borderRadius: 12,
          background: active ? "var(--primary)" : "#CBD5E0",
          border: "none",
          position: "relative",
          cursor: "pointer",
          transition: "background 0.3s",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "#fff",
            position: "absolute",
            top: 3,
            left: active ? 23 : 3,
            transition: "left 0.3s",
            boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
          }}
        />
      </button>
    </div>
  );
}

export default function PatientDashboard() {
  const getPatientId = () =>
    sessionStorage.getItem("nalamPatientId") ||
    localStorage.getItem("nalamPatientId") ||
    "P001";
  const { t, lang } = useLanguage();
  const [patient, setPatient] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [consent, setConsent] = useState<ConsentState>({
    emergency: false,
    specialist: false,
    research: false,
  });
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [patientAlerts, setPatientAlerts] = useState<any[]>([]);
  const [showAudit, setShowAudit] = useState(false);
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null);
  const [intervention, setIntervention] = useState<any>(null);
  const [fhirData, setFhirData] = useState<any>(null);
  const [fhirLoading, setFhirLoading] = useState(false);
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [dismissedPopups, setDismissedPopups] = useState<Set<string>>(
    new Set(),
  );
  const [alertsReady, setAlertsReady] = useState(false);
  const autoDismissTimers = useRef<
    Record<string, ReturnType<typeof setTimeout>>
  >({});
  const alertsBootstrapped = useRef(false);
  const knownAlertIds = useRef<Set<string>>(new Set());
  const sessionPopupAlertIds = useRef<Set<string>>(new Set());

  const [abha, setAbha] = useState<{
    verified: boolean;
    masked: string | null;
  }>({ verified: false, masked: null });
  const [showAbhaModal, setShowAbhaModal] = useState(false);
  const [abhaInput, setAbhaInput] = useState("");
  const [showAmbulanceModal, setShowAmbulanceModal] = useState(false);
  const [callingAmbulance, setCallingAmbulance] = useState(false);
  const [abhaSaving, setAbhaSaving] = useState(false);
  const [abhaError, setAbhaError] = useState<string | null>(null);

  const [baseVitals, setBaseVitals] = useState({
    hr: 72,
    spo2: 98,
    resp: 16,
    temp: 36.6,
    sys: 120,
    dia: 80,
  });
  const [vitals, setVitals] = useState({
    hr: 72,
    spo2: 98,
    resp: 16,
    temp: 36.6,
    sys: 120,
    dia: 80,
  });
  const vitalsRef = useRef(vitals);

  const [anomaly, setAnomaly] = useState<any>(null);
  const [anomalyLoading, setAL] = useState(false);

  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [showAlertEnablePopup, setShowAlertEnablePopup] = useState(false);
  const [showPastNotifications, setShowPastNotifications] = useState(false);
  const [demoScenario, setDemoScenario] = useState<string | null>(null);
  const [chatUnread, setChatUnread] = useState(0);
  const anomalyRef = useRef<any>(null);
  const router = useRouter();

  useEffect(() => {
    vitalsRef.current = vitals;
  }, [vitals]);

  const dismissPopup = useCallback((id: string) => {
    if (autoDismissTimers.current[id]) {
      clearTimeout(autoDismissTimers.current[id]);
      delete autoDismissTimers.current[id];
    }
    setDismissedPopups((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev).add(id);
      persistShownPopups(getPatientId(), next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!alertsReady) return;
    const pending = patientAlerts.filter(
      (a) =>
        (a.severity === "critical" || a.severity === "warning") &&
        !dismissedPopups.has(a.id),
    );
    const active = pending[0];
    if (!active || autoDismissTimers.current[active.id]) return;
    autoDismissTimers.current[active.id] = setTimeout(() => {
      dismissPopup(active.id);
    }, 5000);
  }, [patientAlerts, dismissedPopups, dismissPopup, alertsReady]);

  useEffect(
    () => () => {
      Object.values(autoDismissTimers.current).forEach(clearTimeout);
      autoDismissTimers.current = {};
    },
    [],
  );

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("Notification" in window)) return;

    navigator.serviceWorker
      .getRegistration("/")
      .then(async (reg) => {
        const sub = await reg?.pushManager.getSubscription();
        setPushEnabled(Notification.permission === "granted" && Boolean(sub));
        if (Notification.permission !== "granted" || !sub) {
          setShowAlertEnablePopup(true);
        }
      })
      .catch(() => {});
  }, []);

  // Listen for custom event to open Past Notifications modal
  useEffect(() => {
    const handleOpenPastNotifications = () => setShowPastNotifications(true);
    window.addEventListener('openPastNotifications', handleOpenPastNotifications);
    return () => window.removeEventListener('openPastNotifications', handleOpenPastNotifications);
  }, []);

  useEffect(() => {
    const iv = setInterval(() => {
      setVitals({
        hr: Math.max(
          45,
          Math.min(200, baseVitals.hr + Math.floor(Math.random() * 5) - 2),
        ),
        spo2: Math.max(
          88,
          Math.min(
            100,
            baseVitals.spo2 +
              (Math.random() > 0.8 ? (Math.random() > 0.5 ? 1 : -1) : 0),
          ),
        ),
        resp: Math.max(
          10,
          Math.min(40, baseVitals.resp + Math.floor(Math.random() * 3) - 1),
        ),
        temp: parseFloat(
          Math.max(
            35,
            Math.min(41, baseVitals.temp + (Math.random() * 0.2 - 0.1)),
          ).toFixed(1),
        ),
        sys: Math.max(
          70,
          Math.min(250, baseVitals.sys + Math.floor(Math.random() * 5) - 2),
        ),
        dia: Math.max(
          40,
          Math.min(150, baseVitals.dia + Math.floor(Math.random() * 4) - 2),
        ),
      });
    }, 2000);
    return () => clearInterval(iv);
  }, [baseVitals]);

  const showNewAlertImmediately = useCallback((alert: any) => {
    if (!alert?.id) return;
    sessionPopupAlertIds.current.add(alert.id);
    knownAlertIds.current.add(alert.id);
    setPatientAlerts((prev) =>
      prev.some((a) => a.id === alert.id) ? prev : [alert, ...prev],
    );
    setDismissedPopups((prev) => {
      if (!prev.has(alert.id)) return prev;
      const next = new Set(prev);
      next.delete(alert.id);
      persistShownPopups(getPatientId(), next);
      return next;
    });
    setAlertsReady(true);
  }, []);

  const checkAnomaly = useCallback(
    async (currentVitals: typeof vitals) => {
      setAL(true);
      try {
        const patientId = getPatientId();
        const payload = {
          heart_rate: currentVitals.hr,
          spo2: currentVitals.spo2,
          resp: currentVitals.resp,
          temp: currentVitals.temp,
          sys: currentVitals.sys,
          dia: currentVitals.dia,
          lang,
          patientId,
          notifyNative: true,
        };
        const res = await apiFetch(
          `${process.env.NEXT_PUBLIC_API_URL || ""}/api/anomaly`,
          { method: "POST", body: JSON.stringify(payload) },
        );
        const data = await res.json();
        setAnomaly(data);
        anomalyRef.current = data;
        if (data.alertCreated && data.alert)
          showNewAlertImmediately(data.alert);
        // The clinical alert is stored server-side and displayed through the in-app panel/toast.
      } catch {
      } finally {
        setAL(false);
      }
    },
    [lang, showNewAlertImmediately],
  );

  useEffect(() => {
    if (!demoScenario) {
      checkAnomaly(vitalsRef.current);
      const iv = setInterval(() => checkAnomaly(vitalsRef.current), 30000);
      return () => clearInterval(iv);
    }
  }, [checkAnomaly, demoScenario]);

  const runDemo = (scenario: string) => {
    setDemoScenario(scenario);
    let newBase = { hr: 72, spo2: 98, resp: 16, temp: 36.6, sys: 120, dia: 80 };
    if (scenario === "tachycardia")
      newBase = { hr: 135, spo2: 97, resp: 22, temp: 37.1, sys: 125, dia: 82 };
    if (scenario === "hypoxemia")
      newBase = { hr: 95, spo2: 91, resp: 28, temp: 37.2, sys: 130, dia: 85 };
    if (scenario === "hypertension")
      newBase = { hr: 88, spo2: 98, resp: 18, temp: 36.9, sys: 185, dia: 115 };
    setBaseVitals(newBase);
    setVitals(newBase);
    checkAnomaly(newBase);
  };

  const explainAnomaly = () => {
    const q = new URLSearchParams({
      heart_rate: vitals.hr.toString(),
      spo2: vitals.spo2.toString(),
      resp: vitals.resp.toString(),
      temp: vitals.temp.toString(),
      sys: vitals.sys.toString(),
      dia: vitals.dia.toString(),
    });
    router.push(`/xai?${q.toString()}`);
  };

  const fetchAlerts = useCallback(
    async (opts?: { translate?: boolean }) => {
      try {
        const patientId = getPatientId();
        const params = new URLSearchParams({ patientId });
        params.set("lang", lang);
        if (!opts?.translate) params.set("fast", "1");
        const alRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || ""}/api/notify/alerts?${params}`,
          { cache: "no-store" },
        );
        if (!alRes.ok) return;
        const alData = await alRes.json();
        const alerts: any[] = alData.alerts || [];

        if (!opts?.translate && !alertsBootstrapped.current) {
          alertsBootstrapped.current = true;
          knownAlertIds.current = new Set(alerts.map((a) => a.id));
          const seed = new Set(loadShownPopups(patientId));
          alerts.forEach((a) => {
            if (!sessionPopupAlertIds.current.has(a.id)) seed.add(a.id);
          });
          persistShownPopups(patientId, seed);
          setDismissedPopups(seed);
          setPatientAlerts(alerts);
          setAlertsReady(true);
          return;
        }

        if (!opts?.translate) {
          const prevKnown = knownAlertIds.current;
          const arrived = alerts.filter((a) => !prevKnown.has(a.id));
          knownAlertIds.current = new Set(alerts.map((a) => a.id));
          if (arrived.length > 0 && alertsBootstrapped.current) {
            setDismissedPopups((prev) => {
              const next = new Set(prev);
              arrived.forEach((a) => next.delete(a.id));
              return next;
            });
          }
        }

        setPatientAlerts(alerts);
      } catch {
        /* ignore */
      }
    },
    [lang],
  );

  const fetchAudit = useCallback(async () => {
    try {
      const patientId = getPatientId();
      const base = process.env.NEXT_PUBLIC_API_URL || "";
      const [auditRes, unRes] = await Promise.all([
        fetch(`${base}/api/audit?patientId=${patientId}`),
        fetch(`${base}/api/chat/unread?patientId=${patientId}&role=patient`),
      ]);
      if (auditRes.ok) {
        const d = await auditRes.json();
        setAuditLog(d.entries || []);
      }
      if (unRes.ok) {
        const unData = await unRes.json();
        setChatUnread(unData.unreadCount || 0);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const role =
      sessionStorage.getItem("nalamRole") || localStorage.getItem("nalamRole");
    if (!role) {
      router.push("/");
      return;
    }
    if (role === "clinician") {
      router.push("/clinician");
      return;
    }
    (async () => {
      try {
        const patientId = getPatientId();
        const res = await apiFetch(
          `${process.env.NEXT_PUBLIC_API_URL || ""}/api/patient?id=${patientId}&lang=${lang}`,
        );
        if (!res.ok) throw new Error(`API Error: ${res.status}`);
        const data = await res.json();
        setPatient(data.patient);
        setRecords(data.records || []);
        setConsent({
          emergency: data.patient.consent_emergency === "true",
          specialist: data.patient.consent_specialist === "true",
          research: data.patient.consent_research === "true",
        });
        const ir = await apiFetch(
          `${process.env.NEXT_PUBLIC_API_URL || ""}/api/agents/intervention`,
          {
            method: "POST",
            body: JSON.stringify({
              patient: data.patient,
              records: data.records,
              lang,
            }),
          },
        );
        if (ir.ok) setIntervention(await ir.json());
        const ar = await apiFetch(
          `${process.env.NEXT_PUBLIC_API_URL || ""}/api/abha?patientId=${patientId}`,
        );
        if (ar.ok) setAbha(await ar.json());
      } catch (e) {
        console.error(e);
      }
    })();
    fetchAudit();
    fetchAlerts();
    const auditIv = setInterval(fetchAudit, 15000);
    const alertIv = setInterval(() => fetchAlerts(), 4000);
    return () => {
      clearInterval(auditIv);
      clearInterval(alertIv);
    };
  }, [fetchAudit, fetchAlerts, router, lang]);

  const toggleConsent = async (type: keyof ConsentState) => {
    const next = { ...consent, [type]: !consent[type] };
    setConsent(next);
    await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || ""}/api/patient/consent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: getPatientId(), ...next }),
      },
    );
  };

  if (!patient)
    return (
      <div
        className="container flex-center"
        style={{ minHeight: "60vh", flexDirection: "column", gap: "1rem" }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            border: "3px solid var(--primary)",
            borderTopColor: "transparent",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <span
          style={{
            color: "var(--primary)",
            fontWeight: 600,
            fontSize: "0.9rem",
          }}
        >
          {t("dashboard.loading")}
        </span>
      </div>
    );

  const riskColor =
    intervention?.riskLevel === "High"
      ? "var(--accent-red)"
      : intervention?.riskLevel === "Medium"
        ? "var(--accent-amber)"
        : "var(--accent-teal)";
  const getAlertDestination = (alert: any) => {
    const text = `${alert.title || ""} ${alert.message || ""}`.toLowerCase();
    if (text.includes("appointment") || text.includes("reschedule"))
      return "/appointments/requests";
    if (text.includes("record") || alert.severity === "otp")
      return "/dashboard/records";
    if (
      alert.severity === "critical" ||
      alert.severity === "warning" ||
      text.includes("vital") ||
      text.includes("triage")
    )
      return "/xai";
    return "/dashboard";
  };

  const markAlertRead = async (id: string) => {
    await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/api/notify/alerts`, {
      method: "PATCH",
      body: JSON.stringify({ id }),
      headers: { "Content-Type": "application/json" },
    });
    setPatientAlerts((prev) => prev.filter((a) => a.id !== id));
    dismissPopup(id);
  };

  const pendingPopups = alertsReady
    ? patientAlerts.filter(
        (a) =>
          !dismissedPopups.has(a.id) &&
          (a.severity === "otp" ||
            a.severity === "critical" ||
            a.severity === "warning"),
      )
    : [];
  const activePopup =
    pendingPopups.find((a) => a.severity === "otp") ??
    pendingPopups.find(
      (a) => a.severity === "critical" || a.severity === "warning",
    ) ??
    null;

  return (
    <>
    <div className="container fade-in">
      {/* ── Notifications Modal (bell panel only — no auto popups here) ── */}
      {showNotificationsModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            backdropFilter: "blur(3px)",
          }}
        >
          <div
            className="glass-panel slide-up"
            style={{
              width: "100%",
              maxWidth: "500px",
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
              background: "var(--background)",
              padding: 0,
              overflow: "hidden",
            }}
          >
            <div
              className="flex-between"
              style={{
                padding: "1.25rem",
                borderBottom: "1px solid var(--border)",
                background: "var(--surface)",
              }}
            >
              <h3
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  color: "var(--deep-blue)",
                  fontSize: "1.1rem",
                  margin: 0,
                }}
              >
                <Bell size={20} color="var(--primary)" /> Notifications
              </h3>
              <button
                onClick={() => setShowNotificationsModal(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--foreground-muted)",
                }}
              >
                <X size={20} />
              </button>
            </div>
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "1.25rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              {patientAlerts.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    color: "var(--foreground-muted)",
                    padding: "2rem 0",
                  }}
                >
                  No new notifications
                </div>
              ) : (
                patientAlerts.map((alert) => {
                  const destination = getAlertDestination(alert);
                  const panelColor = "#0EA5E9";
                  const panelBg = "#E0F2FE";
                  return (
                    <div
                      key={alert.id}
                      onClick={async () => {
                        try {
                          await markAlertRead(alert.id);
                        } catch {}
                        setShowNotificationsModal(false);
                        router.push(destination);
                      }}
                      style={{
                        padding: "0.85rem 1rem",
                        background: panelBg,
                        borderLeft: `4px solid ${panelColor}`,
                        borderRadius: 8,
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "0.65rem",
                        cursor: "pointer",
                      }}
                    >
                      <Bell
                        size={16}
                        color={panelColor}
                        style={{ marginTop: 3 }}
                      />
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            fontWeight: 700,
                            color: panelColor,
                            fontSize: "0.9rem",
                            marginBottom: "0.2rem",
                          }}
                        >
                          {alert.title}
                        </div>
                        <div
                          style={{
                            fontSize: "0.85rem",
                            color: "var(--foreground)",
                            lineHeight: 1.4,
                          }}
                        >
                          {alert.message}
                        </div>
                      </div>
                      <button
                        onClick={async (event) => {
                          event.stopPropagation();
                          try {
                            await markAlertRead(alert.id);
                          } catch {}
                        }}
                        style={{
                          background: "rgba(14,165,233,0.12)",
                          padding: "0.35rem 0.65rem",
                          borderRadius: 6,
                          border: "none",
                          cursor: "pointer",
                          color: panelColor,
                          fontSize: "0.75rem",
                          fontWeight: 600,
                        }}
                      >
                        Clear
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
      {showAbhaModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            className="glass-panel slide-up"
            style={{
              width: "100%",
              maxWidth: 440,
              background: "var(--background)",
            }}
          >
            <div className="flex-between" style={{ marginBottom: "1rem" }}>
              <h3
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  color: "var(--deep-blue)",
                  fontSize: "1rem",
                }}
              >
                <ShieldCheck size={18} color="var(--primary)" />{" "}
                {t("abha.modalTitle")}
              </h3>
              <button
                onClick={() => {
                  setShowAbhaModal(false);
                  setAbhaError(null);
                  setAbhaInput("");
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--foreground-muted)",
                }}
              >
                <X size={18} />
              </button>
            </div>
            <p
              style={{
                fontSize: "0.82rem",
                color: "var(--charcoal)",
                marginBottom: "1rem",
                lineHeight: 1.6,
              }}
            >
              {t("abha.modalDesc")}
            </p>
            <label
              style={{
                display: "block",
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "var(--foreground-muted)",
                marginBottom: "0.4rem",
              }}
            >
              {t("abha.label")}
            </label>
            <input
              type="text"
              placeholder="91-1234-5678-0000"
              value={abhaInput}
              onChange={(e) => {
                setAbhaInput(e.target.value);
                setAbhaError(null);
              }}
              maxLength={19}
              style={{
                width: "100%",
                padding: "0.7rem 0.9rem",
                borderRadius: 10,
                border: `1.5px solid ${abhaError ? "var(--accent-red)" : "var(--border)"}`,
                background: "var(--surface)",
                color: "var(--foreground)",
                fontSize: "1rem",
                fontFamily: "monospace",
                boxSizing: "border-box",
                outline: "none",
                marginBottom: "0.5rem",
              }}
            />
            {abhaError && (
              <p
                style={{
                  fontSize: "0.78rem",
                  color: "var(--accent-red)",
                  marginBottom: "0.75rem",
                }}
              >
                {abhaError}
              </p>
            )}
            <p
              style={{
                fontSize: "0.73rem",
                color: "var(--foreground-muted)",
                marginBottom: "1rem",
              }}
            >
              {t("abha.formatHint")}
            </p>
            <div
              style={{
                display: "flex",
                gap: "0.6rem",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => {
                  setShowAbhaModal(false);
                  setAbhaError(null);
                  setAbhaInput("");
                }}
                className="glass-button"
              >
                {t("abha.cancel")}
              </button>
              <button
                disabled={
                  abhaSaving || abhaInput.replace(/[^0-9]/g, "").length !== 14
                }
                onClick={async () => {
                  setAbhaSaving(true);
                  setAbhaError(null);
                  try {
                    const res = await fetch(
                      `${process.env.NEXT_PUBLIC_API_URL || ""}/api/abha`,
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          patientId: getPatientId(),
                          abha_id: abhaInput,
                        }),
                      },
                    );
                    const data = await res.json();
                    if (!res.ok) {
                      setAbhaError(data.error || t("abha.error"));
                      return;
                    }
                    setAbha({ verified: true, masked: data.masked });
                    setShowAbhaModal(false);
                    setAbhaInput("");
                  } catch {
                    setAbhaError(t("abha.error"));
                  } finally {
                    setAbhaSaving(false);
                  }
                }}
                style={{
                  padding: "0.6rem 1.25rem",
                  borderRadius: 10,
                  background: "var(--primary)",
                  color: "white",
                  border: "none",
                  fontWeight: 700,
                  fontSize: "0.88rem",
                  cursor:
                    abhaInput.replace(/[^0-9]/g, "").length !== 14
                      ? "not-allowed"
                      : "pointer",
                  opacity:
                    abhaInput.replace(/[^0-9]/g, "").length !== 14 ? 0.5 : 1,
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                }}
              >
                {abhaSaving ? (
                  <div
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      border: "2px solid white",
                      borderTopColor: "transparent",
                      animation: "spin 0.8s linear infinite",
                    }}
                  />
                ) : (
                  <ShieldCheck size={14} />
                )}
                {abhaSaving ? t("abha.saving") : t("abha.save")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── FHIR Modal ── */}
      {fhirData && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            backdropFilter: "blur(3px)",
          }}
        >
          <div
            className="glass-panel slide-up"
            style={{
              width: "100%",
              maxWidth: "700px",
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
              background: "var(--background)",
            }}
          >
            <div
              className="flex-between"
              style={{
                paddingBottom: "0.85rem",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <h3
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  color: "var(--deep-blue)",
                  fontSize: "1rem",
                }}
              >
                <Network size={18} color="var(--primary)" />{" "}
                {t("dashboard.fhirReady")}
              </h3>
              <button
                onClick={() => setFhirData(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--foreground-muted)",
                }}
              >
                <X size={18} />
              </button>
            </div>
            <p
              style={{
                fontSize: "0.82rem",
                color: "var(--charcoal)",
                margin: "0.85rem 0",
              }}
            >
              {t("dashboard.fhirDesc")}
            </p>
            <div
              style={{
                flex: 1,
                overflow: "hidden",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--surface-muted)",
              }}
            >
              <pre
                style={{
                  width: "100%",
                  height: "100%",
                  overflow: "auto",
                  padding: "0.85rem",
                  fontSize: "0.75rem",
                  color: "var(--foreground)",
                  margin: 0,
                  fontFamily: "monospace",
                }}
              >
                {JSON.stringify(fhirData, null, 2)}
              </pre>
            </div>
            <div
              style={{
                display: "flex",
                gap: "0.6rem",
                marginTop: "0.85rem",
                paddingTop: "0.85rem",
                borderTop: "1px solid var(--border)",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => setFhirData(null)}
                className="glass-button"
              >
                {t("dashboard.cancelFHIR")}
              </button>
              <button
                onClick={() => {
                  const blob = new Blob([JSON.stringify(fhirData, null, 2)], {
                    type: "application/json",
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `ABDM_FHIR_Bundle_${patient.id}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                  setFhirData(null);
                }}
                className="glass-button"
                style={{
                  background: "var(--primary)",
                  color: "white",
                  border: "none",
                }}
              >
                {t("dashboard.downloadFHIR")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── HEADER ── */}
      <div className="slide-up stagger-1" style={{ marginBottom: "1rem" }}>
        {/* Name row */}
        {/* Name row */}
        <div
          className="flex-between"
          style={{ marginBottom: "0.6rem", gap: "0.75rem", flexWrap: "wrap" }}
        >
          <div>
            <h2
              style={{
                fontSize: "1.35rem",
                marginBottom: "0.1rem",
                lineHeight: 1.25,
              }}
            >
              {t("dashboard.welcome")} {patient.name} 👋
            </h2>
            <p
              style={{
                color: "var(--accent-teal)",
                fontWeight: 600,
                fontSize: "0.8rem",
              }}
            >
              {t("dashboard.verified")} · {patient.id}
            </p>
          </div>
          {/* ABHA chip */}
          {abha.verified ? (
            <div
              style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
            >
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  padding: "0.22rem 0.65rem",
                  borderRadius: 20,
                  background: "rgba(34,197,94,0.12)",
                  border: "1px solid rgba(34,197,94,0.35)",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  color: "#16a34a",
                }}
              >
                <ShieldCheck size={12} /> {abha.masked}
              </div>
              <button
                onClick={() => {
                  if (confirm("Unlink ABHA ID?"))
                    setAbha({ verified: false, masked: null });
                }}
                style={{
                  padding: "0.22rem 0.6rem",
                  background: "var(--accent-red-bg)",
                  border: "1px solid var(--accent-red)",
                  color: "var(--accent-red)",
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  borderRadius: 8,
                  cursor: "pointer",
                }}
              >
                Unlink
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAbhaModal(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.3rem",
                padding: "0.22rem 0.65rem",
                borderRadius: 20,
                background: "rgba(0,82,165,0.08)",
                border: "1px dashed var(--primary)",
                fontSize: "0.75rem",
                fontWeight: 700,
                color: "var(--primary)",
                cursor: "pointer",
              }}
            >
              <Link2 size={11} /> {t("abha.link")}
            </button>
          )}
        </div>

        {/* Action Buttons — horizontally scrollable on mobile */}
        <div className="action-row" style={{ gap: "0.4rem" }}>
          <button
            className="glass-button"
            onClick={() => router.push("/dashboard/chat")}
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
              background:
                chatUnread > 0 ? "var(--primary)" : "var(--primary-light)",
              color: chatUnread > 0 ? "white" : "var(--primary)",
              borderColor: "var(--primary)",
              flexShrink: 0,
            }}
          >
            <MessageSquare size={13} /> Chat
            {chatUnread > 0 && (
              <span
                style={{
                  background: "var(--accent-red)",
                  color: "white",
                  fontSize: "0.62rem",
                  fontWeight: 800,
                  padding: "0.08rem 0.35rem",
                  borderRadius: 10,
                  border: "2px solid white",
                  minWidth: 16,
                  textAlign: "center",
                }}
              >
                {chatUnread}
              </span>
            )}
          </button>
          <button
            className="glass-button"
            onClick={() => router.push("/appointments/book")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
              flexShrink: 0,
            }}
          >
            <Calendar size={13} /> Book Appt
          </button>
          <button
            className="glass-button"
            onClick={() => router.push("/xai")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
              flexShrink: 0,
            }}
          >
            <Brain size={13} /> AI Insights
          </button>
          <button
            className="glass-button"
            onClick={() => router.push("/appointments/requests")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
              flexShrink: 0,
            }}
          >
            <ClipboardList size={13} /> Requests
          </button>
          <button
            className="glass-button"
            onClick={() => {
              fetchAlerts({ translate: true });
              setShowNotificationsModal(true);
            }}
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
              flexShrink: 0,
              background:
                patientAlerts.length > 0
                  ? "var(--primary-light)"
                  : "var(--surface)",
              color:
                patientAlerts.length > 0
                  ? "var(--primary)"
                  : "var(--foreground)",
            }}
          >
            <Bell size={13} /> Notifications
            {patientAlerts.length > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: -4,
                  right: -4,
                  width: 10,
                  height: 10,
                  background: "var(--accent-red)",
                  borderRadius: "50%",
                  border: "2px solid white",
                }}
              />
            )}
          </button>
          <button
            className="glass-button"
            onClick={() => {
              setShowMoreActions((p) => !p);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
              flexShrink: 0,
            }}
          >
            <MoreHorizontal size={13} /> More
          </button>
        </div>

        {/* Expanded "More" options */}
        {showMoreActions && (
          <div
            className="fade-in"
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.4rem",
              marginTop: "0.5rem",
              padding: "0.6rem",
              background: "var(--surface-muted)",
              borderRadius: 10,
              border: "1px solid var(--border)",
            }}
          >
            <button
              className="glass-button"
              onClick={async () => {
                if (fhirLoading) return;
                setFhirLoading(true);
                try {
                  const res = await fetch(
                    `${process.env.NEXT_PUBLIC_API_URL || ""}/api/patient/export?id=${patient.id}`,
                  );
                  setFhirData(await res.json());
                } catch (e) {
                  console.error(e);
                } finally {
                  setFhirLoading(false);
                }
              }}
              style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}
            >
              {fhirLoading ? (
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    border: "2px solid var(--primary)",
                    borderTopColor: "transparent",
                    animation: "spin 0.8s linear infinite",
                  }}
                />
              ) : (
                <Network size={13} />
              )}
              {fhirLoading ? "Downloading…" : t("dashboard.exportFHIR")}
            </button>
            <button
              className="glass-button"
              onClick={() => {
                setShowAudit((p) => !p);
                fetchAudit();
                setShowMoreActions(false);
              }}
              style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}
            >
              <Clock size={13} /> {t("dashboard.auditLog")}
            </button>
            <button
              id="push-toggle"
              disabled={pushLoading}
              onClick={async () => {
                setPushLoading(true);
                const patientId = getPatientId();
                const ok = pushEnabled
                  ? await unsubscribePush()
                  : await subscribePush(patientId);
                if (!pushEnabled && ok) {
                  fetch(
                    `${process.env.NEXT_PUBLIC_API_URL || ""}/api/notify/send`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        patientId,
                        title: "Nalam.ai Notifications Enabled",
                        message:
                          "You will now receive appointment and health alerts.",
                        severity: "info",
                        url: "/dashboard",
                      }),
                    },
                  ).catch(() => {});
                }
                setPushEnabled(pushEnabled ? !ok : ok);
                setPushLoading(false);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.35rem",
                padding: "0.45rem 0.8rem",
                borderRadius: 8,
                border: `1px solid ${pushEnabled ? "var(--accent-green)" : "var(--border)"}`,
                background: pushEnabled
                  ? "var(--accent-green-bg)"
                  : "var(--surface)",
                color: pushEnabled
                  ? "var(--accent-green)"
                  : "var(--foreground-muted)",
                fontWeight: 600,
                fontSize: "0.8rem",
                cursor: "pointer",
                opacity: pushLoading ? 0.6 : 1,
                fontFamily: "inherit",
              }}
            >
              {pushEnabled ? <Bell size={13} /> : <BellOff size={13} />}
              {pushEnabled ? "Alerts On" : "Enable Alerts"}
            </button>
          </div>
        )}
      </div>

      {/* ── LIVE VITALS ── */}
      <section
        className="glass-panel slide-up stagger-1"
        style={{ marginBottom: "1rem" }}
      >
        <div className="flex-between" style={{ marginBottom: "0.75rem" }}>
          <h3
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              color: "var(--accent-teal)",
              fontSize: "0.95rem",
            }}
          >
            <Activity size={17} /> {t("dashboard.liveVitals")}
          </h3>
          <span
            className="badge teal"
            style={{ display: "flex", alignItems: "center", gap: 4 }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#22c55e",
                display: "inline-block",
                animation: "pulseGlow 1.4s infinite",
              }}
            />{" "}
            {t("dashboard.syncing")}
          </span>
        </div>
        <div className="vitals-grid">
          {[
            {
              label: t("dashboard.heartRate"),
              value: `${vitals.hr}`,
              unit: "BPM",
              color: "#FCA5A5",
              icon: Heart,
              pulse: true,
            },
            {
              label: t("dashboard.spo2"),
              value: `${vitals.spo2}`,
              unit: "%",
              color: "#A5D8FF",
              icon: Activity,
              pulse: false,
            },
            {
              label: "Resp",
              value: `${vitals.resp}`,
              unit: "bpm",
              color: "#86EFAC",
              icon: Activity,
              pulse: false,
            },
            {
              label: "Temp",
              value: `${vitals.temp}`,
              unit: "°C",
              color: "#FDE68A",
              icon: Activity,
              pulse: false,
            },
            {
              label: "BP",
              value: `${vitals.sys}/${vitals.dia}`,
              unit: "mmHg",
              color: "#C7D2FE",
              icon: Activity,
              pulse: false,
            },
          ].map(({ label, value, unit, color, icon: Icon, pulse }) => (
            <div
              key={label}
              className="vital-card"
              style={{
                background: `${color}1A`,
                border: `1px solid ${color}55`,
                animation: pulse ? "pulseGlow 1.5s infinite" : "none",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: `${color}33`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon size={14} color={color} />
                </div>
                <div>
                  <div className="vital-value">
                    {value}
                    <span className="vital-unit">{unit}</span>
                  </div>
                </div>
              </div>
              <div className="vital-label">{label}</div>
            </div>
          ))}
        </div>
        {patient?.mobile && (
          <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'center' }}>
            <WhatsAppButton
              phoneNumber={patient.mobile}
              message={t('whatsapp.emergency')
                .replace('{name}', patient.name || 'Patient')
                .replace('{id}', getPatientId())
                .replace('{hr}', vitals.hr.toString())
                .replace('{spo2}', vitals.spo2.toString())
                .replace('{sys}', vitals.sys.toString())
                .replace('{dia}', vitals.dia.toString())
              }
              label="Share Emergency Vitals"
              allowRecipientChoice={true}
            />
          </div>
        )}
      </section>

      {/* ── VOICE TRIAGE ── */}
      <VoiceTriage />

      {/* ── BOOK APPOINTMENT ── */}
      <section
        className="glass-panel slide-up stagger-2"
        style={{
          marginBottom: "1rem",
          background:
            "linear-gradient(135deg, rgba(0,82,165,0.05) 0%, rgba(92,53,161,0.05) 100%)",
          border: "1.5px solid rgba(0,82,165,0.18)",
        }}
      >
        <div
          style={{ display: "flex", alignItems: "flex-start", gap: "0.85rem" }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "var(--primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              boxShadow: "0 4px 14px rgba(0,82,165,0.3)",
            }}
          >
            <Calendar size={22} color="white" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3
              style={{
                fontSize: "0.95rem",
                marginBottom: "0.15rem",
                color: "var(--deep-blue)",
              }}
            >
              Book an Appointment
            </h3>
            <p
              style={{
                fontSize: "0.78rem",
                color: "var(--charcoal)",
                lineHeight: 1.45,
                marginBottom: "0.75rem",
              }}
            >
              Consult with Dr. Dhanush or Dr. Monissha. Vitals auto-attached.
            </p>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                onClick={() => router.push("/appointments/requests")}
                className="glass-button"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.3rem",
                  fontSize: "0.8rem",
                }}
              >
                <ClipboardList size={13} /> My Requests
              </button>
              <button
                onClick={() => router.push("/appointments/book")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  padding: "0.5rem 1.1rem",
                  borderRadius: 10,
                  background: "var(--primary)",
                  color: "white",
                  border: "none",
                  fontWeight: 700,
                  fontSize: "0.82rem",
                  cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(0,82,165,0.28)",
                }}
              >
                <Calendar size={14} /> Book Now
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── AUDIT LOG ── */}
      {showAudit && (
        <section
          className="glass-panel slide-up"
          style={{ marginBottom: "1rem" }}
        >
          <div className="flex-between" style={{ marginBottom: "0.85rem" }}>
            <h3
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                color: "var(--accent-purple)",
                fontSize: "0.92rem",
              }}
            >
              <Eye size={16} /> {t("dashboard.auditTitle")}
            </h3>
            <span className="badge purple">
              {auditLog.length} {t("dashboard.auditEvents")}
            </span>
          </div>
          {auditLog.length === 0 ? (
            <p style={{ color: "var(--charcoal)", fontSize: "0.85rem" }}>
              {t("dashboard.noAudit")}
            </p>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.4rem",
              }}
            >
              {auditLog.map((e, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: "0.6rem",
                    alignItems: "center",
                    padding: "0.55rem 0.75rem",
                    background: "var(--surface-muted)",
                    borderRadius: 8,
                    borderLeft: "3px solid var(--accent-purple)",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: "0.84rem",
                        color: "var(--deep-blue)",
                      }}
                    >
                      {e.clinician}
                    </div>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--charcoal)",
                        marginTop: 1,
                      }}
                    >
                      {e.reason}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: "0.72rem",
                      color: "var(--charcoal-light)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {timeAgo(e.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── MAIN CONTENT ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {/* Anomaly Monitor */}
        <section
          className="glass-panel slide-up stagger-2"
          style={{
            borderColor: anomaly?.is_anomaly
              ? anomaly.severity === "critical"
                ? "var(--accent-red)"
                : "var(--accent-amber)"
              : "var(--glass-border)",
          }}
        >
          <div className="flex-between" style={{ marginBottom: "0.7rem" }}>
            <h3
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                color: anomaly?.is_anomaly
                  ? anomaly.severity === "critical"
                    ? "var(--accent-red)"
                    : "var(--accent-amber)"
                  : "var(--accent-green)",
                fontSize: "0.92rem",
              }}
            >
              <Zap size={16} /> {t("dashboard.anomalyMonitor")}
            </h3>
            <span
              style={{
                padding: "0.18rem 0.55rem",
                borderRadius: 50,
                fontSize: "0.72rem",
                fontWeight: 700,
                background: anomaly?.is_anomaly
                  ? anomaly.severity === "critical"
                    ? "var(--accent-red-bg)"
                    : "var(--accent-amber-bg)"
                  : "var(--accent-green-bg)",
                color: anomaly?.is_anomaly
                  ? anomaly.severity === "critical"
                    ? "var(--accent-red)"
                    : "var(--accent-amber)"
                  : "var(--accent-green)",
              }}
            >
              {anomalyLoading
                ? t("dashboard.checking")
                : anomaly?.is_anomaly
                  ? `⚠ ${anomaly.severity?.toUpperCase()}`
                  : t("dashboard.normal")}
            </span>
          </div>

          {anomaly?.flags?.length > 0 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.35rem",
                marginBottom: "0.65rem",
              }}
            >
              {anomaly.flags.map((f: any, i: number) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "0.4rem",
                    padding: "0.5rem 0.65rem",
                    borderRadius: 8,
                    background:
                      f.severity === "critical"
                        ? "var(--accent-red-bg)"
                        : "var(--accent-amber-bg)",
                    borderLeft: `3px solid ${f.severity === "critical" ? "var(--accent-red)" : "var(--accent-amber)"}`,
                  }}
                >
                  <AlertTriangle
                    size={13}
                    color={
                      f.severity === "critical"
                        ? "var(--accent-red)"
                        : "var(--accent-amber)"
                    }
                    style={{ marginTop: 2, flexShrink: 0 }}
                  />
                  <span
                    style={{
                      fontSize: "0.8rem",
                      color: "var(--foreground)",
                      lineHeight: 1.4,
                    }}
                  >
                    {f.message}
                  </span>
                </div>
              ))}
            </div>
          ) : anomaly && !anomaly.is_anomaly ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                padding: "0.45rem 0.65rem",
                borderRadius: 8,
                background: "var(--accent-green-bg)",
                marginBottom: "0.65rem",
              }}
            >
              <CheckCircle size={13} color="var(--accent-green)" />
              <span
                style={{
                  fontSize: "0.8rem",
                  color: "var(--accent-green)",
                  fontWeight: 600,
                }}
              >
                {t("dashboard.allVitalsNormal")}
              </span>
            </div>
          ) : null}

          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
            <button
              id="anomaly-check"
              onClick={() => checkAnomaly(vitals)}
              disabled={anomalyLoading}
              className="glass-button"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.3rem",
                opacity: anomalyLoading ? 0.6 : 1,
                fontSize: "0.8rem",
              }}
            >
              <Zap size={12} /> {t("dashboard.checkNow")}
            </button>
            <div style={{ position: "relative", display: "inline-block" }}>
              <select
                value={demoScenario || ""}
                onChange={(e) => runDemo(e.target.value)}
                style={{
                  appearance: "none",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "0.38rem 1.8rem 0.38rem 0.7rem",
                  fontSize: "0.78rem",
                  color: "var(--foreground)",
                  cursor: "pointer",
                  outline: "none",
                  fontFamily: "inherit",
                }}
              >
                <option value="" disabled>
                  {t("dashboard.simulateDemo")}
                </option>
                <option value="normal">{t("dashboard.normalVitals")}</option>
                <option value="tachycardia">
                  {t("dashboard.tachycardia")}
                </option>
                <option value="hypoxemia">{t("dashboard.hypoxemia")}</option>
                <option value="hypertension">
                  {t("dashboard.hypertension")}
                </option>
              </select>
              <ChevronDown
                size={12}
                style={{
                  position: "absolute",
                  right: "0.5rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  pointerEvents: "none",
                  color: "var(--foreground-muted)",
                }}
              />
            </div>
            <button
              className="glass-button"
              onClick={explainAnomaly}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.3rem",
                fontSize: "0.8rem",
              }}
            >
              <Brain size={12} /> {t("dashboard.explain")}
            </button>
          </div>
        </section>

        {/* Medical Timeline */}
        <section className="glass-panel slide-up stagger-3">
          <div className="flex-between" style={{ marginBottom: "1rem" }}>
            <h3
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                color: "var(--primary)",
                fontSize: "0.92rem",
              }}
            >
              <Activity size={16} /> {t("dashboard.timeline")}
            </h3>
            <span className="badge blue">
              {records.length} {t("dashboard.records")}
            </span>
          </div>
          <div style={{ position: "relative", paddingLeft: "1.25rem" }}>
            <div
              style={{
                position: "absolute",
                left: "4px",
                top: 0,
                bottom: 0,
                width: 2,
                background:
                  "linear-gradient(to bottom, var(--powder-blue), var(--border))",
              }}
            />
            {records
              .slice(
                0,
                parseInt(process.env.NEXT_PUBLIC_TIMELINE_LIMIT || "10", 10),
              )
              .map((r, i) => (
                <div
                  key={r.record_id}
                  className={`timeline-entry${expandedRecord === r.record_id ? " expanded" : ""}`}
                  style={{
                    position: "relative",
                    marginBottom: "0.4rem",
                    animationDelay: `${i * 0.05}s`,
                  }}
                  onClick={() =>
                    setExpandedRecord(
                      expandedRecord === r.record_id ? null : r.record_id,
                    )
                  }
                >
                  <div
                    className="timeline-dot"
                    style={{
                      position: "absolute",
                      left: "-1.25rem",
                      top: "0.2rem",
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background:
                        expandedRecord === r.record_id
                          ? "var(--primary)"
                          : "var(--powder-blue-dark)",
                      border: "2px solid var(--primary)",
                      boxShadow: "0 0 0 3px rgba(165,216,255,0.25)",
                    }}
                  />
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom:
                        expandedRecord === r.record_id ? "0.4rem" : 0,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.35rem",
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: "0.84rem",
                          color: "var(--deep-blue)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {r.diagnosis || r.type}
                      </span>
                      <ChevronDown
                        size={12}
                        color="var(--charcoal)"
                        style={{
                          transform:
                            expandedRecord === r.record_id
                              ? "rotate(180deg)"
                              : "none",
                          transition: "transform 0.25s",
                          flexShrink: 0,
                        }}
                      />
                    </div>
                    <span
                      style={{
                        fontSize: "0.7rem",
                        color: "var(--charcoal-light)",
                        whiteSpace: "nowrap",
                        marginLeft: "0.4rem",
                        flexShrink: 0,
                      }}
                    >
                      {r.date}
                    </span>
                  </div>
                  <div
                    style={{ fontSize: "0.76rem", color: "var(--charcoal)" }}
                  >
                    {r.provider}
                  </div>
                  {expandedRecord === r.record_id && (
                    <div
                      className="fade-in"
                      style={{
                        background: "white",
                        borderRadius: 8,
                        padding: "0.6rem 0.75rem",
                        marginTop: "0.35rem",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.3rem",
                      }}
                    >
                      {r.notes && (
                        <p
                          style={{
                            fontSize: "0.79rem",
                            color: "var(--charcoal)",
                            lineHeight: 1.5,
                          }}
                        >
                          <strong>{t("dashboard.notes")}</strong> {r.notes}
                        </p>
                      )}
                      {r.lab_results && (
                        <p
                          style={{
                            fontSize: "0.79rem",
                            color: "var(--primary)",
                            fontWeight: 600,
                          }}
                        >
                          <strong style={{ color: "var(--charcoal)" }}>
                            {t("dashboard.labs")}
                          </strong>{" "}
                          {r.lab_results}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
          </div>
        </section>
      </div>

      {/* ── INTERVENTION ENGINE ── */}
      {intervention && (
        <section
          className="glass-panel slide-up stagger-3"
          style={{ borderColor: `${riskColor}44`, marginTop: "1rem" }}
        >
          <div className="flex-between" style={{ marginBottom: "0.75rem" }}>
            <h3
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                color: riskColor,
                fontSize: "0.92rem",
              }}
            >
              <BellRing size={16} /> {t("dashboard.interventionEngine")}
            </h3>
            <span className="badge amber pulse-glow">
              {intervention.riskLevel} {t("dashboard.riskLevel")}
            </span>
          </div>
          <div
            style={{
              background: `${riskColor}0D`,
              borderLeft: `4px solid ${riskColor}`,
              padding: "0.75rem 0.85rem",
              borderRadius: 8,
            }}
          >
            <div
              style={{
                fontWeight: 700,
                fontSize: "0.82rem",
                color: "var(--deep-blue)",
                marginBottom: "0.25rem",
              }}
            >
              {t("dashboard.detectedPattern")}
            </div>
            <p
              style={{
                fontSize: "0.82rem",
                color: "var(--charcoal)",
                marginBottom: "0.65rem",
                lineHeight: 1.55,
              }}
            >
              {intervention.detectedPattern}
            </p>
            <div
              style={{
                fontWeight: 700,
                fontSize: "0.82rem",
                color: "var(--deep-blue)",
                marginBottom: "0.25rem",
              }}
            >
              {t("dashboard.actionPlan")}
            </div>
            <p
              style={{
                fontSize: "0.82rem",
                color: "var(--charcoal)",
                lineHeight: 1.55,
              }}
            >
              {intervention.actionPlan}
            </p>
          </div>
        </section>
      )}

      {/* ── NEARBY HOSPITALS MAP (Ola Maps) ── */}
      <section
        className="glass-panel slide-up stagger-2"
        style={{ marginTop: "1rem" }}
      >
        <div className="flex-between" style={{ marginBottom: "0.75rem" }}>
          <h3
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              color: "var(--deep-blue)",
              fontSize: "0.95rem",
            }}
          >
            <MapPin size={17} color="#0052A5" /> Nearby Hospitals
          </h3>
          <span
            className="badge"
            style={{
              background: "#EBF4FF",
              color: "var(--primary)",
              fontSize: "0.72rem",
              fontWeight: 700,
              padding: "0.2rem 0.55rem",
              borderRadius: 6,
            }}
          >
            Tamil Nadu
          </span>
        </div>
        <OlaMap height="340px" />
        <p
          style={{
            fontSize: "0.72rem",
            color: "var(--charcoal)",
            marginTop: "0.5rem",
            textAlign: "center",
          }}
        >
          Click any marker to see hospital details
        </p>
      </section>

      <style>{`
        @keyframes slideDown { from { transform: translate(-50%, -20px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
        @keyframes slideUpRight { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes toastFromBottomRight { from { transform: translate(28px, 28px); opacity: 0; } to { transform: translate(0, 0); opacity: 1; } }
        @keyframes shrinkBar { from { width:100% } to { width:0% } }
        @keyframes spin { to { transform: rotate(360deg); } }
        .notification-popup { max-width: 420px; }
        @media (max-width: 640px) {
          .notification-popup {
            right: 0.75rem !important;
            bottom: calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + 1rem) !important;
            width: calc(100vw - 1.5rem) !important;
          }
        }
        @media (max-width: 640px) {
          .ambulance-button-mobile {
            bottom: calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + 6.5rem) !important;
            right: 0.75rem !important;
          }
        }
      `}</style>

      {/* ── Bottom-right slide-in notification (single toast only) ── */}
      {activePopup &&
        (() => {
          if (activePopup.severity === "otp") {
            const otpMatch = activePopup.message.match(/\b(\d{3}\s\d{3})\b/);
            const otpCode = otpMatch ? otpMatch[1] : null;
            return (
              <div
                className="notification-popup"
                style={{
                  position: "fixed",
                  bottom:
                    "calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + 1rem)",
                  right: "1rem",
                  zIndex: 9998,
                  animation: "toastFromBottomRight 0.4s ease",
                  width: "min(420px, calc(100vw - 2rem))",
                  pointerEvents: "auto",
                }}
              >
                <div
                  style={{
                    background: "linear-gradient(135deg,#1E3A5F,#0052A5)",
                    borderRadius: 16,
                    padding: "1rem 1.25rem",
                    boxShadow: "0 10px 40px rgba(0,82,165,0.4)",
                    color: "white",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.6rem",
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <span style={{ fontSize: "1.25rem" }}>🔐</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800, fontSize: "0.95rem" }}>
                        {activePopup.title}
                      </div>
                      <div
                        style={{
                          fontSize: "0.78rem",
                          opacity: 0.8,
                          marginTop: 2,
                        }}
                      >
                        Records access request — expires in 2 minutes
                      </div>
                    </div>
                    <button
                      onClick={() => dismissPopup(activePopup.id)}
                      style={{
                        background: "rgba(255,255,255,0.15)",
                        border: "none",
                        color: "white",
                        borderRadius: 8,
                        width: 28,
                        height: 28,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                  {otpCode && (
                    <div
                      style={{
                        background: "rgba(255,255,255,0.12)",
                        borderRadius: 12,
                        padding: "0.75rem 1rem",
                        textAlign: "center",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "0.72rem",
                          fontWeight: 600,
                          opacity: 0.8,
                          marginBottom: 4,
                          textTransform: "uppercase",
                          letterSpacing: "0.1em",
                        }}
                      >
                        Your OTP Code
                      </div>
                      <div
                        style={{
                          fontSize: "2.2rem",
                          fontWeight: 900,
                          letterSpacing: "0.25em",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {otpCode}
                      </div>
                    </div>
                  )}
                  <p
                    style={{
                      fontSize: "0.78rem",
                      opacity: 0.75,
                      lineHeight: 1.5,
                      margin: 0,
                    }}
                  >
                    Share this code <strong>only</strong> with the provider
                    requesting access. Do not share it with anyone else.
                  </p>
                </div>
              </div>
            );
          }
          const isCritical = activePopup.severity === "critical";
          const color = isCritical
            ? "var(--accent-red)"
            : "var(--accent-amber)";
          const bg = isCritical
            ? "var(--accent-red-bg)"
            : "var(--accent-amber-bg)";
          return (
            <div
              className="notification-popup"
              onClick={() => {
                dismissPopup(activePopup.id);
                router.push(getAlertDestination(activePopup));
              }}
              style={{
                position: "fixed",
                bottom:
                  "calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + 1rem)",
                right: "1rem",
                zIndex: 9998,
                width: "min(420px, calc(100vw - 2rem))",
                background: bg,
                borderLeft: `4px solid ${color}`,
                borderRadius: 12,
                padding: "0.85rem 1rem",
                boxShadow: isCritical
                  ? "0 8px 32px rgba(239,68,68,0.24)"
                  : "0 8px 32px rgba(245,158,11,0.24)",
                display: "flex",
                alignItems: "flex-start",
                gap: "0.75rem",
                animation: "toastFromBottomRight 0.35s ease",
                pointerEvents: "auto",
                overflow: "hidden",
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  height: 3,
                  background: color,
                  borderRadius: "0 0 0 12px",
                  animation: "shrinkBar 5s linear forwards",
                }}
              />
              <AlertTriangle
                size={20}
                color={color}
                style={{ flexShrink: 0, marginTop: 2 }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 800,
                    color,
                    fontSize: "0.9rem",
                    marginBottom: "0.1rem",
                  }}
                >
                  {activePopup.title}
                </div>
                <div
                  style={{
                    fontSize: "0.82rem",
                    color: "var(--foreground)",
                    lineHeight: 1.4,
                  }}
                >
                  {activePopup.message}
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  dismissPopup(activePopup.id);
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color,
                  flexShrink: 0,
                }}
              >
                <X size={16} />
              </button>
            </div>
          );
        })()}

      {/* ── AMBULANCE BUTTON ── */}
      <button
        onDoubleClick={() => setShowAmbulanceModal(true)}
        className="ambulance-button-mobile"
        style={{
          position: "fixed",
          bottom:
            "calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + 8rem)",
          right: "1.5rem",
          zIndex: 90,
          background: "linear-gradient(135deg, #ef4444, #dc2626)",
          color: "white",
          border: "none",
          borderRadius: "50%",
          width: "60px",
          height: "60px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 8px 24px rgba(239, 68, 68, 0.4)",
          cursor: "pointer",
          animation: "pulseGlow 2s infinite",
        }}
        title="Double Click to Call Ambulance"
      >
        <PhoneCall size={24} />
      </button>

      {/* ── AMBULANCE MODAL ── */}
      {showAmbulanceModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(4px)",
            padding: "1rem",
          }}
        >
          <div
            style={{
              background: "white",
              padding: "2rem",
              borderRadius: 20,
              maxWidth: 380,
              width: "100%",
              textAlign: "center",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
              animation: "slideUp 0.3s ease",
            }}
          >
            {callingAmbulance ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "1rem",
                }}
              >
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: "50%",
                    background: "#FEE2E2",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    animation: "heartbeat 1s infinite",
                  }}
                >
                  <PhoneCall size={36} color="#DC2626" />
                </div>
                <h2
                  style={{
                    fontSize: "1.3rem",
                    color: "#1A2B4A",
                    fontWeight: 800,
                  }}
                >
                  Calling Ambulance...
                </h2>
                <p style={{ color: "#64748B", fontSize: "0.88rem" }}>
                  Connecting to emergency services
                </p>
              </div>
            ) : (
              <>
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: "50%",
                    background: "#FEF2F2",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 1.25rem",
                  }}
                >
                  <AlertTriangle size={28} color="#DC2626" />
                </div>
                <h2
                  style={{
                    fontSize: "1.3rem",
                    color: "#1A2B4A",
                    fontWeight: 800,
                    marginBottom: "0.4rem",
                  }}
                >
                  Emergency Services
                </h2>
                <p
                  style={{
                    color: "#64748B",
                    marginBottom: "1.5rem",
                    fontSize: "0.88rem",
                  }}
                >
                  Are you sure you want to call an ambulance?
                </p>
                <div style={{ display: "flex", gap: "0.75rem" }}>
                  <button
                    onClick={() => setShowAmbulanceModal(false)}
                    style={{
                      flex: 1,
                      padding: "0.75rem",
                      background: "#F1F5F9",
                      color: "#475569",
                      border: "none",
                      borderRadius: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      fontSize: "0.9rem",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setCallingAmbulance(true);
                      const audio = new Audio("/ringing.mp3");
                      audio.loop = true;
                      audio.play().catch(() => {});
                      window.location.href = 'tel:100';
                      setTimeout(() => {
                        audio.pause();
                        setCallingAmbulance(false);
                        setShowAmbulanceModal(false);
                      }, 1000);
                    }}
                    style={{
                      flex: 1,
                      padding: "0.75rem",
                      background: "#DC2626",
                      color: "white",
                      border: "none",
                      borderRadius: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      fontSize: "0.9rem",
                      boxShadow: "0 4px 12px rgba(220,38,38,0.3)",
                    }}
                  >
                    Proceed
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Alert Enable Popup */}
      {showAlertEnablePopup && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 16,
              padding: '1.5rem',
              maxWidth: '400px',
              width: '90%',
              boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                marginBottom: '1rem',
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: 'var(--primary-light)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </div>
              <div>
                <h3
                  style={{
                    fontSize: '1.1rem',
                    fontWeight: 700,
                    color: 'var(--deep-blue)',
                    margin: 0,
                  }}
                >
                  Enable Health Alerts
                </h3>
                <p
                  style={{
                    fontSize: '0.85rem',
                    color: 'var(--charcoal)',
                    margin: '0.25rem 0 0',
                  }}
                >
                  Stay informed about your health status
                </p>
              </div>
            </div>
            <p
              style={{
                fontSize: '0.9rem',
                color: 'var(--charcoal)',
                lineHeight: 1.5,
                marginBottom: '1.25rem',
              }}
            >
              Enable push notifications to receive important health alerts and reminders about your medical appointments.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => setShowAlertEnablePopup(false)}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: 'var(--surface-muted)',
                  color: 'var(--charcoal)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                }}
              >
                Close
              </button>
              <button
                onClick={async () => {
                  setPushLoading(true);
                  const success = await subscribePush(getPatientId());
                  setPushEnabled(success);
                  setPushLoading(false);
                  setShowAlertEnablePopup(false);
                }}
                disabled={pushLoading}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: 'var(--primary)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: pushLoading ? 'not-allowed' : 'pointer',
                  fontSize: '0.9rem',
                  opacity: pushLoading ? 0.7 : 1,
                }}
              >
                {pushLoading ? 'Enabling...' : 'Enable Alerts'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Past Notifications Modal */}
      <PastNotifications
        isOpen={showPastNotifications}
        onClose={() => setShowPastNotifications(false)}
        patientId={getPatientId()}
        isHospitalDesk={false}
      />

    </div>

    {/* Chatbot */}
    <Chatbot userRole="patient" />
    </>
  );
}
