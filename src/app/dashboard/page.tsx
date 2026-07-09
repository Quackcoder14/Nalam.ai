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
  TrendingUp,
  ChevronRight,
  Droplets,
  Wind,
  Info,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import VoiceTriage from "../components/VoiceTriage";
import WhatsAppButton from "../components/WhatsAppButton";
import Chatbot from "../components/Chatbot";
import PastNotifications from "../components/PastNotifications";
import IntakeModal from "../components/IntakeModal";
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
  const [showExplanation, setShowExplanation] = useState(false);
  const [fhirData, setFhirData] = useState<any>(null);
  const [fhirLoading, setFhirLoading] = useState(false);
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [dismissedPopups, setDismissedPopups] = useState<Set<string>>(
    new Set(),
  );
  const [fadingPopups, setFadingPopups] = useState<Set<string>>(new Set());
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
  const [vitalsSource, setVitalsSource] = useState<'simulate' | 'rook'>('simulate');
  const [rookConnected, setRookConnected] = useState(false);
  const [rookLoading, setRookLoading] = useState(false);
  const [rookDataSource, setRookDataSource] = useState('Fitbit');
  const router = useRouter();

  useEffect(() => {
    // Check if we just returned from Rook OAuth
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('rook') === 'connected' || localStorage.getItem('rookConnected') === 'true') {
        setRookConnected(true);
        setVitalsSource('rook');
        // Clean up URL if needed
        if (urlParams.get('rook') === 'connected') {
          router.replace('/dashboard', { scroll: false });
        }
      } else {
        // Otherwise, ask backend if authorized
        apiFetch(`/api/patient/vitals/rook/connect?patientId=${getPatientId()}`)
          .then(res => res.json())
          .then(data => {
            if (data.authorized) {
              setRookConnected(true);
              setVitalsSource('rook');
              localStorage.setItem('rookConnected', 'true');
            }
          })
          .catch(() => {});
      }
    }
  }, [router]);

  const [anomaly, setAnomaly] = useState<any>(null);
  const [anomalyLoading, setAL] = useState(false);

  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [showAlertEnablePopup, setShowAlertEnablePopup] = useState(false);
  const [showPastNotifications, setShowPastNotifications] = useState(false);
  const [demoScenario, setDemoScenario] = useState<string | null>(null);
  const [chatUnread, setChatUnread] = useState(0);
  const anomalyRef = useRef<any>(null);

  // ── Intake Request (Pre-Consultation) polling ───────────────────────────────
  const [pendingIntake, setPendingIntake] = useState<any | null>(null);
  const [showIntakeModal, setShowIntakeModal] = useState(false);
  const [hideIntakeBanner, setHideIntakeBanner] = useState(false);
  const [intakeDismissed, setIntakeDismissed] = useState(false);
  const submittedIntakeIds = useRef<Set<string>>(new Set());
  const intakeDismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Dismiss intake notification → archives it as a read alert so it appears in PastNotifications
  const dismissIntakeNotification = useCallback(async (intake: any) => {
    if (!intake) return;
    try {
      await apiFetch('/api/notify/alerts', {
        method: 'POST',
        body: JSON.stringify({
          patientId: intake.patient_id,
          severity: 'info',
          title: 'Symptom Intake Request (Dismissed)',
          message: 'A symptom intake request from the hospital desk was dismissed without completing.',
        }),
      }).then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          // Immediately mark as read so it goes straight to past notifications
          if (data.alert?.id) {
            await apiFetch('/api/notify/alerts', {
              method: 'PATCH',
              body: JSON.stringify({ id: data.alert.id }),
            });
          }
        }
      });
    } catch {}
    submittedIntakeIds.current.add(intake.id);
    
    // Persist manual dismissal so it doesn't show up again on refresh
    const dismissed = JSON.parse(localStorage.getItem('nalamDismissedIntakes') || '{}');
    dismissed[intake.id] = true;
    localStorage.setItem('nalamDismissedIntakes', JSON.stringify(dismissed));
    
    setIntakeDismissed(true);
    setPendingIntake(null);
  }, []);

  const dismissIntakeBanner = useCallback(() => {
    if (intakeDismissTimer.current) clearTimeout(intakeDismissTimer.current);
    intakeDismissTimer.current = null;
    setPendingIntake(null);
  }, []);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await apiFetch(`/api/intake?role=patient`, { skipCache: true });
        const data = await res.json();
        const items = Array.isArray(data) ? data : [];
        // Filter out intakes that were submitted this session or manually dismissed previously
        const dismissed = JSON.parse(localStorage.getItem('nalamDismissedIntakes') || '{}');
        const fresh = items.filter((i: any) => !submittedIntakeIds.current.has(i.id) && !dismissed[i.id]);
        if (fresh.length > 0) {
          setPendingIntake((prev: any) => {
            // Only update if it's a new intake (different ID)
            if (prev?.id === fresh[0].id) return prev;
            return fresh[0];
          });
        } else {
          setPendingIntake(null);
        }
      } catch {}
    };
    poll();
    const interval = setInterval(poll, 8000);
    return () => clearInterval(interval);
  }, []);

  // Auto-dismiss intake banner after 10 seconds if not interacted with, and persist this state
  useEffect(() => {
    if (pendingIntake && !showIntakeModal && !hideIntakeBanner) {
      // Check if already auto-dismissed in a previous session
      const shownIntakes = JSON.parse(localStorage.getItem('nalamShownIntakes') || '{}');
      if (shownIntakes[pendingIntake.id]) {
        setHideIntakeBanner(true);
        return;
      }

      if (intakeDismissTimer.current) clearTimeout(intakeDismissTimer.current);
      intakeDismissTimer.current = setTimeout(() => {
        setHideIntakeBanner(true);
        // Save to localStorage so it doesn't show again on refresh
        const updated = JSON.parse(localStorage.getItem('nalamShownIntakes') || '{}');
        updated[pendingIntake.id] = true;
        localStorage.setItem('nalamShownIntakes', JSON.stringify(updated));
        
        intakeDismissTimer.current = null;
      }, 10000);
    } else if (!pendingIntake) {
      setHideIntakeBanner(false);
    }
    return () => {
      if (intakeDismissTimer.current) clearTimeout(intakeDismissTimer.current);
    };
  }, [pendingIntake, showIntakeModal, hideIntakeBanner]);

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
        (a.severity === "critical" || a.severity === "warning" || a.severity === "otp") &&
        !dismissedPopups.has(a.id) &&
        !fadingPopups.has(a.id),
    );
    const active = pending[0];
    if (!active || autoDismissTimers.current[active.id]) return;
    autoDismissTimers.current[active.id] = setTimeout(() => {
      // Start fade out
      setFadingPopups(prev => new Set(prev).add(active.id));
      // Then dismiss after fade completes
      setTimeout(() => {
        dismissPopup(active.id);
        setFadingPopups(prev => {
          const next = new Set(prev);
          next.delete(active.id);
          return next;
        });
      }, 500); // 500ms fade duration
    }, 5000);
  }, [patientAlerts, dismissedPopups, fadingPopups, dismissPopup, alertsReady]);

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
    // Only run simulation when vitalsSource is 'simulate'
    if (vitalsSource !== 'simulate') return;
    
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
  }, [baseVitals, vitalsSource]);

  // Fetch vitals from Rook API when vitalsSource is 'rook'
  useEffect(() => {
    if (vitalsSource !== 'rook' || !rookConnected) return;
    
    const fetchRookVitals = async () => {
      try {
        const patientId = getPatientId();
        const res = await apiFetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/patient/vitals/rook?patientId=${patientId}`, { skipCache: true });
        if (res.ok) {
          const data = await res.json();
          if (data.vitals && data.source !== 'no_data') {
            setVitals(data.vitals);
          }
          // If no_data, keep current vitals — UI will show "Waiting for device"
        }
      } catch (error) {
        console.error('Failed to fetch Rook vitals:', error);
      }
    };

    fetchRookVitals();
    const iv = setInterval(fetchRookVitals, 15000); // Poll every 15 seconds for live feel
    return () => clearInterval(iv);
  }, [vitalsSource, rookConnected]);

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

    // Trigger native Windows/desktop notification
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(alert.title || "Nalam.ai Alert", {
        body: alert.message || alert.title,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: alert.id,
        requireInteraction: alert.severity === "critical" || alert.severity === "otp",
      });
    }
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
      {/* ── Intake Request Notification Banner ── */}
      {pendingIntake && !showIntakeModal && !hideIntakeBanner && (
        <div
          className="notification-popup"
          onClick={() => setShowIntakeModal(true)}
          style={{
            position: 'fixed',
            bottom: 'calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + 1rem)',
            right: '1rem',
            zIndex: 9998,
            width: 'min(420px, calc(100vw - 2rem))',
            background: 'var(--surface)',
            borderLeft: '4px solid #0EA5E9',
            borderRadius: 12,
            padding: '0.85rem 1rem',
            boxShadow: '0 8px 32px rgba(14,165,233,0.24)',
            display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
            animation: 'toastFromBottomRight 0.35s ease',
            pointerEvents: 'auto',
            overflow: 'hidden',
            cursor: 'pointer',
          }}
        >
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              height: 3,
              background: "#0EA5E9",
              borderRadius: "0 0 0 12px",
              animation: "shrinkBar 10s linear forwards",
            }}
          />
          <div style={{ flexShrink: 0, marginTop: 2 }}>
             <ClipboardList size={20} color="#0EA5E9" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, color: '#0EA5E9', fontSize: '0.95rem', marginBottom: '0.15rem' }}>
              {lang === 'ta' ? 'அறிகுறி பதிவு கோரிக்கை' : 'Symptom Intake Requested'}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--foreground)', lineHeight: 1.4 }}>
              {lang === 'ta' ? 'மருத்துவமனை மேசையிலிருந்து — தட்டி பதிவு செய்யவும்' : 'From the hospital desk — tap to record your symptoms'}
            </div>
          </div>
          <ChevronRight size={18} color="#0EA5E9" style={{ marginTop: 2 }} />
        </div>
      )}
      {showIntakeModal && pendingIntake && (
        <IntakeModal
          intakeId={pendingIntake.id}
          patientId={pendingIntake.patient_id}
          lang={lang}
          onClose={() => setShowIntakeModal(false)}
          onSubmitted={() => {
            submittedIntakeIds.current.add(pendingIntake.id);
            setShowIntakeModal(false);
            setPendingIntake(null);
          }}
        />
      )}
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
                <Bell size={20} color="var(--primary)" /> {t("dashboard.notifications")}
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
              {/* Intake Request Notification */}
              {pendingIntake && !intakeDismissed && (
                <div
                  style={{
                    padding: "0.85rem 1rem",
                    background: "var(--primary-light)",
                    borderLeft: "4px solid var(--primary)",
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "0.65rem",
                  }}
                >
                  <ClipboardList size={16} color="var(--primary)" style={{ marginTop: 3 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: "var(--primary)", fontSize: "0.9rem", marginBottom: "0.2rem" }}>
                      Symptom Intake Requested
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "var(--charcoal)", lineHeight: 1.4 }}>
                      From the hospital desk — tap to record your symptoms.
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.6rem" }}>
                      <button
                        onClick={() => {
                          setShowNotificationsModal(false);
                          setHideIntakeBanner(false);
                          setShowIntakeModal(true);
                        }}
                        style={{ padding: "0.35rem 0.8rem", borderRadius: 6, border: "none", background: "var(--primary)", color: "white", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer" }}
                      >Fill Now</button>
                      <button
                        onClick={() => {
                          setShowNotificationsModal(false);
                          dismissIntakeNotification(pendingIntake);
                        }}
                        style={{ padding: "0.35rem 0.8rem", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--charcoal)", fontWeight: 600, fontSize: "0.78rem", cursor: "pointer" }}
                      >Dismiss</button>
                    </div>
                  </div>
                </div>
              )}

              {patientAlerts.length === 0 && !pendingIntake ? (
                <div
                  style={{
                    textAlign: "center",
                    color: "var(--foreground-muted)",
                    padding: "2rem 0",
                  }}
                >
                  {t("dashboard.noNewNotifications")}
                </div>
              ) : (
                patientAlerts.map((alert) => {
                  const destination = getAlertDestination(alert);
                  const panelColor = "var(--primary)";
                  const panelBg = "var(--primary-light)";
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
                          background: "rgba(0,82,165,0.12)",
                          padding: "0.35rem 0.65rem",
                          borderRadius: 6,
                          border: "none",
                          cursor: "pointer",
                          color: panelColor,
                          fontSize: "0.75rem",
                          fontWeight: 600,
                        }}
                      >
                        {t("dashboard.clear")}
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
                  color: "var(--accent-green)",
                }}
              >
                <ShieldCheck size={12} /> {abha.masked}
              </div>
              <button
                onClick={() => {
                  if (confirm(t("dashboard.unlinkAbha")))
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
                {t("dashboard.unlink")}
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
            <MessageSquare size={13} /> {t("dashboard.chat")}
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
            <Calendar size={13} /> {t("dashboard.bookAppt")}
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
            <Brain size={13} /> {t("dashboard.aiInsights")}
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
            <ClipboardList size={13} /> {t("dashboard.requests")}
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
            <Bell size={13} /> {t("dashboard.notifications")}
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
            <MoreHorizontal size={13} /> {t("dashboard.more")}
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
              {fhirLoading ? t("dashboard.downloading") : t("dashboard.exportFHIR")}
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
              {pushEnabled ? t("dashboard.alertsOn") : t("dashboard.enableAlerts")}
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
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {/* Vitals Source Toggle */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                background: "var(--surface-muted)",
                padding: "0.3rem 0.5rem",
                borderRadius: 8,
                border: "1px solid var(--border)",
              }}
            >
              <button
                onClick={() => setVitalsSource('simulate')}
                style={{
                  padding: "0.3rem 0.6rem",
                  borderRadius: 6,
                  border: "none",
                  background: vitalsSource === 'simulate' ? "var(--primary)" : "transparent",
                  color: vitalsSource === 'simulate' ? "white" : "var(--foreground-muted)",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Simulate
              </button>
              <button
                onClick={() => setVitalsSource('rook')}
                style={{
                  padding: "0.3rem 0.6rem",
                  borderRadius: 6,
                  border: "none",
                  background: vitalsSource === 'rook' ? "var(--primary)" : "transparent",
                  color: vitalsSource === 'rook' ? "white" : "var(--foreground-muted)",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Rook API
              </button>
            </div>
            {vitalsSource === 'rook' && (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <select
                  value={rookDataSource}
                  onChange={(e) => setRookDataSource(e.target.value)}
                  disabled={rookConnected || rookLoading}
                  style={{
                    padding: "0.2rem 0.5rem",
                    borderRadius: 6,
                    border: "1px solid var(--border)",
                    fontSize: "0.75rem",
                    background: "white",
                    cursor: rookConnected || rookLoading ? "not-allowed" : "pointer",
                  }}
                >
                  <option value="Fitbit">Fitbit</option>
                  <option value="Garmin">Garmin</option>
                  <option value="Oura">Oura</option>
                  <option value="Apple Health">Apple Health</option>
                  <option value="Withings">Withings</option>
                </select>
                <button
                  onClick={async () => {
                    setRookLoading(true);
                    try {
                      const patientId = getPatientId();
                      const baseUrl = window.location.origin;
                      
                      const res = await apiFetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/patient/vitals/rook/connect`, {
                        method: 'POST',
                        body: JSON.stringify({ patientId, dataSource: rookDataSource, baseUrl }),
                      });
                      if (res.ok) {
                        const data = await res.json();
                        if (data.authUrl) {
                          window.location.href = data.authUrl;
                        } else {
                          setRookConnected(true);
                        }
                      }
                    } catch (error) {
                      console.error('Failed to connect Rook:', error);
                    } finally {
                      setRookLoading(false);
                    }
                  }}
                  disabled={rookConnected || rookLoading}
                  style={{
                    padding: "0.3rem 0.6rem",
                    borderRadius: 6,
                    border: "1px solid var(--primary)",
                    background: rookConnected ? "var(--accent-green-bg)" : "var(--primary)",
                    color: rookConnected ? "var(--accent-green)" : "white",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    cursor: rookConnected || rookLoading ? "not-allowed" : "pointer",
                    opacity: rookLoading ? 0.6 : 1,
                  }}
                >
                  {rookLoading ? 'Connecting...' : rookConnected ? '✓ Connected' : 'Connect Watch'}
                </button>
              </div>
            )}
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
              {vitalsSource === 'rook' ? (rookConnected ? 'Live' : 'Disconnected') : t("dashboard.syncing")}
            </span>
          </div>
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
              label: t("dashboard.resp"),
              value: `${vitals.resp}`,
              unit: "bpm",
              color: "#86EFAC",
              icon: Activity,
              pulse: false,
            },
            {
              label: t("dashboard.temp"),
              value: `${vitals.temp}`,
              unit: "°C",
              color: "#FDE68A",
              icon: Activity,
              pulse: false,
            },
            {
              label: t("dashboard.bp"),
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
              label={t("dashboard.shareEmergencyVitals")}
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
              {t("dashboard.bookAppointment")}
            </h3>
            <p
              style={{
                fontSize: "0.78rem",
                color: "var(--charcoal)",
                lineHeight: 1.45,
                marginBottom: "0.75rem",
              }}
            >
              {t("dashboard.bookAppointmentDesc")}
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
                <ClipboardList size={13} /> {t("dashboard.myRequests")}
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
                <Calendar size={14} /> {t("dashboard.bookNow")}
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
      {intervention && (() => {
        const score: number = intervention.risk_score ?? 0;
        const vitals = intervention.vitals ?? {};

        // Derive urgency from risk score
        const urgency = score >= 6
          ? { label: t('dashboard.urgencyImmediate'), color: 'var(--accent-red)', bg: '#FEE2E2' }
          : score >= 3
            ? { label: t('dashboard.urgencyWeek'), color: 'var(--accent-amber)', bg: '#FEF3C7' }
            : { label: t('dashboard.urgencyMonth'), color: 'var(--accent-teal)', bg: '#D1FAE5' };

        // Parse action plan into bullet steps
        const actionSteps: string[] = (() => {
          const raw: string = intervention.actionPlan ?? '';
          // Try numbered list first (1. ... 2. ...)
          const numbered = raw.match(/\d+\.\s+[^.!?]+[.!?]/g);
          if (numbered && numbered.length > 1) return numbered.map((s: string) => s.replace(/^\d+\.\s+/, '').trim());
          // Otherwise split by sentence
          return raw.split(/(?<=[.!?])\s+/).filter((s: string) => s.trim().length > 10);
        })();

        // Vitals breakdown with status indicators
        const vitalItems = [
          {
            label: t('dashboard.vitalBP'),
            value: vitals.systolic && vitals.diastolic ? `${vitals.systolic}/${vitals.diastolic}` : '—',
            unit: 'mmHg',
            icon: Heart,
            status: vitals.systolic >= 160 ? 'high' : vitals.systolic >= 140 ? 'medium' : vitals.systolic >= 130 ? 'borderline' : 'normal',
            range: '< 130/80 normal',
          },
          {
            label: t('dashboard.vitalHba1c'),
            value: vitals.hba1c ? `${vitals.hba1c}` : '—',
            unit: '%',
            icon: Droplets,
            status: vitals.hba1c >= 8 ? 'high' : vitals.hba1c >= 6.5 ? 'medium' : vitals.hba1c >= 5.7 ? 'borderline' : 'normal',
            range: '< 5.7% normal',
          },
          {
            label: t('dashboard.vitalEgfr'),
            value: vitals.egfr ? `${vitals.egfr}` : '—',
            unit: 'ml/min',
            icon: Wind,
            status: vitals.egfr < 45 ? 'high' : vitals.egfr < 60 ? 'medium' : vitals.egfr < 75 ? 'borderline' : 'normal',
            range: '≥ 90 optimal',
          },
        ];

        const statusColor = (s: string) =>
          s === 'high' ? 'var(--accent-red)' : s === 'medium' ? 'var(--accent-amber)' : s === 'borderline' ? '#F59E0B' : 'var(--accent-teal)';
        const statusLabel = (s: string) =>
          s === 'high' ? t('dashboard.statusHigh') : s === 'medium' ? t('dashboard.statusElevated') : s === 'borderline' ? t('dashboard.statusBorderline') : t('dashboard.statusNormal');

        // Plain-language explanation
        const explanation = score >= 6
          ? "Your health data shows a pattern that needs prompt medical attention. Your blood pressure, blood sugar, or kidney function may be significantly outside the healthy range. Please contact your doctor soon — acting quickly can prevent serious complications."
          : score >= 3
            ? "Some of your health indicators are slightly outside the healthy range. This is a good time to revisit your diet, activity levels, and any medications. A follow-up with your doctor this week is recommended to get these under control."
            : "Your health indicators are mostly within acceptable ranges. Keep up with your current routine, maintain a balanced diet, stay active, and continue your prescribed medications. A routine check-up within the month is still a good idea.";

        // Risk history — only records that have at least one parseable lab value, limited to last 12 months
        const cutoffDate = new Date();
        cutoffDate.setMonth(cutoffDate.getMonth() - 12);
        const riskHistory = (records || [])
          .filter((r: any) => {
            if (!r.date) return false;
            const labs: string = r.lab_results ?? '';
            const hasLab = /BP[:\s]*(\d+)\/(\d+)/i.test(labs) || /HbA1c[:\s]*([\d.]+)/i.test(labs) || /eGFR[:\s]*(\d+)/i.test(labs);
            const d = new Date(r.date);
            return hasLab && !isNaN(d.getTime()) && d >= cutoffDate;
          })
          .slice(-6)
          .map((r: any) => {
            const labs: string = r.lab_results ?? '';
            const bpM = labs.match(/BP[:\s]*(\d+)\/(\d+)/i);
            const haM = labs.match(/HbA1c[:\s]*([\d.]+)/i);
            const egM = labs.match(/eGFR[:\s]*(\d+)/i);
            const sys = bpM ? parseInt(bpM[1]) : 130;
            const ha = haM ? parseFloat(haM[1]) : 5.7;
            const eg = egM ? parseInt(egM[1]) : 90;
            let s = 0;
            if (sys >= 160) s += 3; else if (sys >= 140) s += 2; else if (sys >= 130) s += 1;
            if (ha >= 8.0) s += 3; else if (ha >= 6.5) s += 2; else if (ha >= 5.7) s += 1;
            if (eg < 45) s += 3; else if (eg < 60) s += 2; else if (eg < 75) s += 1;
            // Format date as "Jan '24" style
            const d = new Date(r.date);
            const label = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
            return { date: label, score: s, level: s >= 6 ? 'High' : s >= 3 ? 'Medium' : 'Low' };
          });
        // Add current score at the end
        const allHistory = [...riskHistory, { date: 'Now', score, level: intervention.riskLevel }];

        return (
          <section
            className="glass-panel slide-up stagger-3"
            style={{ borderColor: `${riskColor}44`, marginTop: '1rem', padding: '1.25rem' }}
          >
            {/* Header */}
            <div className="flex-between" style={{ marginBottom: '1rem' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: riskColor, fontSize: '0.95rem', fontWeight: 700 }}>
                <BellRing size={17} /> {t('dashboard.interventionEngine')}
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ background: urgency.bg, color: urgency.color, fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: 20, border: `1px solid ${urgency.color}44` }}>
                  <Clock size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                  {urgency.label}
                </span>
                <span className="badge amber pulse-glow">{intervention.riskLevel} {t('dashboard.riskLevel')}</span>
              </div>
            </div>

            {/* Risk Score Gauge */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--charcoal)' }}>{t('dashboard.riskScore')}</span>
                <span style={{ fontSize: '0.88rem', fontWeight: 800, color: riskColor }}>{score}/10</span>
              </div>
              <div style={{ height: 8, borderRadius: 99, background: 'var(--surface-muted)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(score * 10, 100)}%`, borderRadius: 99, background: `linear-gradient(90deg, var(--accent-teal), ${riskColor})`, transition: 'width 1s ease' }} />
              </div>
            </div>

            {/* Vitals Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem', marginBottom: '1rem' }}>
              {vitalItems.map(({ label, value, unit, icon: Icon, status, range }) => (
                <div key={label} style={{ background: `${statusColor(status)}0D`, border: `1.5px solid ${statusColor(status)}33`, borderRadius: 10, padding: '0.6rem 0.5rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--charcoal)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</div>
                  <Icon size={16} color={statusColor(status)} style={{ marginBottom: '0.15rem' }} />
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: statusColor(status), lineHeight: 1.1 }}>{value}</div>
                  <div style={{ fontSize: '0.62rem', color: 'var(--charcoal)', marginTop: '0.1rem' }}>{unit}</div>
                  <div style={{ fontSize: '0.65rem', fontWeight: 700, color: statusColor(status), marginTop: '0.2rem' }}>{statusLabel(status)}</div>
                  <div style={{ fontSize: '0.6rem', color: 'var(--foreground-muted)', marginTop: '0.15rem' }}>{range}</div>
                </div>
              ))}
            </div>

            {/* Detected Pattern */}
            <div style={{ background: `${riskColor}0D`, borderLeft: `4px solid ${riskColor}`, padding: '0.7rem 0.85rem', borderRadius: 8, marginBottom: '0.85rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--deep-blue)', marginBottom: '0.25rem' }}>{t('dashboard.detectedPattern')}</div>
              <p style={{ fontSize: '0.82rem', color: 'var(--charcoal)', lineHeight: 1.55, margin: 0 }}>{intervention.detectedPattern}</p>
            </div>

            {/* Action Steps */}
            <div style={{ marginBottom: '0.85rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--deep-blue)', marginBottom: '0.5rem' }}>{t('dashboard.actionPlan')}</div>
              <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {actionSteps.map((step, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--charcoal)', lineHeight: 1.5 }}>
                    <span style={{ minWidth: 22, height: 22, borderRadius: '50%', background: `${riskColor}20`, color: riskColor, fontWeight: 800, fontSize: '0.72rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>

            {/* Risk Timeline */}
            {allHistory.length > 1 && (
              <div style={{ marginBottom: '0.85rem' }}>
                <div style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--deep-blue)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <TrendingUp size={13} /> {t('dashboard.riskHistory')}
                </div>
                {/* Legend */}
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.5rem' }}>
                  {[['High', 'var(--accent-red)'], ['Medium', 'var(--accent-amber)'], ['Low', 'var(--accent-teal)']].map(([lbl, col]) => (
                    <span key={lbl} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.65rem', color: 'var(--charcoal)' }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: col as string, display: 'inline-block' }} />
                      {lbl}
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.4rem', height: 56 }}>
                  {allHistory.map((h, i) => {
                    const hColor = h.level === 'High' ? 'var(--accent-red)' : h.level === 'Medium' ? 'var(--accent-amber)' : 'var(--accent-teal)';
                    const heightPct = Math.max((h.score / 10) * 100, 10);
                    const isNow = i === allHistory.length - 1;
                    return (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                        <div
                          title={`${h.level} — Score ${h.score}/10`}
                          style={{ width: '100%', height: `${heightPct}%`, background: hColor, borderRadius: 4, opacity: isNow ? 1 : 0.6, minHeight: 6, transition: 'height 0.8s ease', border: isNow ? `2px solid ${hColor}` : 'none', boxSizing: 'border-box' }}
                        />
                        <span style={{ fontSize: '0.62rem', color: isNow ? riskColor : 'var(--foreground-muted)', fontWeight: isNow ? 700 : 400, whiteSpace: 'nowrap', overflow: 'hidden', maxWidth: '100%', textAlign: 'center' }}>
                          {h.date}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* What does this mean? */}
            <div style={{ marginBottom: '1rem', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              <button
                onClick={() => setShowExplanation(v => !v)}
                style={{ width: '100%', padding: '0.6rem 0.85rem', background: 'var(--surface-muted)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 700, color: 'var(--foreground)', fontFamily: 'inherit' }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Info size={14} /> {t('dashboard.whatMeansForMe')}
                </span>
                {showExplanation ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>
              {showExplanation && (
                <div style={{ padding: '0.75rem 0.85rem', background: 'var(--surface)', fontSize: '0.82rem', color: 'var(--charcoal)', lineHeight: 1.65 }}>
                  {explanation}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => router.push('/appointments/book')}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 1rem', borderRadius: 10, background: riskColor, color: 'white', border: 'none', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                <Calendar size={14} /> {t('dashboard.bookAppointment')}
              </button>
              <button
                onClick={() => router.push('/appointments/requests')}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 1rem', borderRadius: 10, background: 'var(--surface-muted)', color: 'var(--foreground)', border: '1.5px solid var(--border)', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                <ChevronRight size={14} /> {t('dashboard.scheduleFollowUp')}
              </button>
            </div>
          </section>
        );
      })()}

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
            <MapPin size={17} color="#0052A5" /> {t("dashboard.nearbyHospitals")}
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
            {t("dashboard.tamilNadu")}
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
          {t("dashboard.clickMarker")}
        </p>
      </section>

      <style>{`
        @keyframes slideDown { from { transform: translate(-50%, -20px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
        @keyframes slideUpRight { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes toastFromBottomRight { from { transform: translate(28px, 28px); opacity: 0; } to { transform: translate(0, 0); opacity: 1; } }
        @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
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
            bottom: calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + 5.75rem) !important;
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
                  zIndex: 10000,
                  animation: fadingPopups.has(activePopup.id) ? "fadeOut 0.5s ease forwards" : "toastFromBottomRight 0.4s ease",
                  width: "min(420px, calc(100vw - 2rem))",
                  pointerEvents: "auto",
                }}
              >
                <div
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 16,
                    padding: "1rem 1.25rem",
                    boxShadow: "0 10px 40px rgba(0,0,0,0.1)",
                    color: "var(--foreground)",
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
                        background: "var(--surface-muted)",
                        border: "1px solid var(--border)",
                        color: "var(--foreground-muted)",
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
                        background: "var(--surface-muted)",
                        border: "1px solid var(--border)",
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
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderLeft: `4px solid ${color}`,
                borderRadius: 12,
                padding: "0.85rem 1rem",
                boxShadow: isCritical
                  ? "0 8px 32px rgba(239,68,68,0.24)"
                  : "0 8px 32px rgba(245,158,11,0.24)",
                display: "flex",
                alignItems: "flex-start",
                gap: "0.75rem",
                animation: fadingPopups.has(activePopup.id) ? "fadeOut 0.5s ease forwards" : "toastFromBottomRight 0.35s ease",
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
          bottom: "calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + 8.75rem)",
          right: "1.5rem",
          zIndex: 90,
          background: "linear-gradient(135deg, #ef4444, #dc2626)",
          color: "white",
          border: "none",
          borderRadius: "50%",
          width: "56px",
          height: "56px",
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
                      window.location.href = 'tel:108';
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

    {/* Chatbot */}
    <Chatbot
      userRole="patient"
      patientData={patient ? {
        id: patient.id,
        name: patient.name_enc,
        dob: patient.dob,
        bloodType: patient.blood_type_enc,
        allergies: patient.allergies_enc,
        chronicConditions: patient.chronic_conditions_enc,
        currentMedications: patient.current_medications_enc,
        gender: patient.gender_enc,
        abhaId: patient.abha_id,
      } : undefined}
      records={records?.slice(0, 10)}
      intervention={intervention ? {
        riskLevel: intervention.riskLevel,
        risk_score: intervention.risk_score,
        detectedPattern: intervention.detectedPattern,
        actionPlan: intervention.actionPlan,
        vitals: intervention.vitals,
      } : undefined}
    />

    </div>
    </>
  );
}
