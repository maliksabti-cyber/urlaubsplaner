/* Foto-Dienst für „Schicht & Urlaub“
 * Nimmt ein Foto eines Dienst-/Urlaubsplans entgegen, lässt es von Claude (Bildverständnis)
 * auslesen und gibt das Ergebnis als JSON zurück.
 * - Der API-Schlüssel liegt NUR als geheime Umgebungsvariable ANTHROPIC_API_KEY im Dienst.
 * - Das Foto wird nicht gespeichert und nicht protokolliert (kein console.log mit Inhalt).
 * - Ohne Schlüssel (oder mit MOCK = "1") antwortet der Dienst mit Beispieldaten.
 */
import Anthropic from "@anthropic-ai/sdk";

const MAX_BYTES = 5 * 1024 * 1024;
const MODEL = "claude-opus-5-5";
const CODES = ["T", "S", "N", "F", "K", "X", "U"];

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["year", "year_sure", "legend_found", "marks", "entries", "note"],
  properties: {
    year: { type: "integer", description: "Jahr des Plans, 0 wenn nicht lesbar" },
    year_sure: { type: "boolean", description: "true nur, wenn das Jahr eindeutig auf dem Foto steht" },
    legend_found: { type: "boolean" },
    marks: {
      type: "array",
      description: "Jede Art von Markierung (Farbe/Form), die Tage kennzeichnet, ohne Schichtbuchstaben",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "description", "color", "shape", "legend_text", "suggestion"],
        properties: {
          id: { type: "string", description: "kurze Kennung, z. B. m1" },
          description: { type: "string", description: "kurz auf Deutsch, z. B. „grün markiert“" },
          color: { type: "string", description: "Farbe als #RRGGBB" },
          shape: { type: "string", enum: ["fill", "circle", "cross", "line", "other"] },
          legend_text: { type: "string", description: "Text aus der Legende zu dieser Markierung, sonst leer" },
          suggestion: { type: "string", enum: ["U", "T", "S", "N", "F", "K", "X", "ignore", ""] }
        }
      }
    },
    entries: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["date", "kind", "shift", "mark", "confidence"],
        properties: {
          date: { type: "string", description: "YYYY-MM-DD" },
          kind: { type: "string", enum: ["shift", "marked"] },
          shift: { type: "string", enum: ["T", "S", "N", "F", "K", "X", "U", ""] },
          mark: { type: "string", description: "id aus marks bei kind=marked, sonst leer" },
          confidence: { type: "number", description: "0 bis 1" }
        }
      }
    },
    note: { type: "string", description: "kurzer Hinweis auf Deutsch, sonst leer" }
  }
};

const PROMPT = `Auf dem Foto ist ein Dienstplan, Schichtplan oder Urlaubskalender einer Person.
Lies jeden Tag aus, an dem etwas eingetragen oder markiert ist.

Regeln:
- Erfinde niemals Tage. Gib nur Tage zurück, die du auf dem Foto wirklich siehst. Leere Tage weglassen.
- Datum immer als YYYY-MM-DD. Wenn das Jahr nicht eindeutig auf dem Foto steht: year_sure=false, year=0,
  und verwende in den Datumsangaben trotzdem das wahrscheinlichste Jahr (die App fragt dann nach).
- Schichtbuchstaben: T=Tagschicht, F=Frühschicht, S=Spätschicht, N=Nachtschicht, K=Krank, X=Frei, U=Urlaub.
  Wenn ein Tag einen solchen Buchstaben (oder ein eindeutiges Wort wie „Früh“, „Nacht“, „Urlaub“, „frei“) zeigt:
  kind="shift", shift=passender Buchstabe, mark="".
- Wenn ein Tag nur farbig hinterlegt, eingekreist, durchgestrichen o. Ä. ist: kind="marked", shift="",
  mark=id der Markierungsart. Lege jede Markierungsart genau einmal in marks an.
- Gibt es eine Legende, setze legend_found=true, übernimm den Legendentext in legend_text und schlage in
  suggestion die Bedeutung vor (U, T, S, N, F, K, X oder ignore). Ohne Legende: legend_text="" und suggestion="".
- confidence: wie sicher du bei diesem Tag bist (0 bis 1). Unter 0.8, wenn Schrift, Datum oder Markierung unklar ist.
- Ist auf dem Foto kein Plan zu erkennen, gib eine leere entries-Liste zurück und erkläre es kurz in note.`;

/* ---------- Beispieldaten (Mock) ---------- */
function mockResult(kind) {
  const y = new Date().getFullYear() + (new Date().getMonth() >= 10 ? 1 : 0);
  const m = "03", d = n => `${y}-${m}-${String(n).padStart(2, "0")}`;
  const entries = [];
  const shifts = ["F", "F", "S", "S", "N", "N", "X", "X"];
  for (let i = 1; i <= 14; i++) entries.push({ date: d(i), kind: "shift", shift: shifts[(i - 1) % 8], mark: "", confidence: i === 5 ? 0.6 : 0.95 });
  for (let i = 16; i <= 20; i++) entries.push({ date: d(i), kind: "marked", shift: "", mark: "m1", confidence: i === 20 ? 0.7 : 0.92 });
  entries.push({ date: d(24), kind: "marked", shift: "", mark: "m2", confidence: 0.9 });
  const legend = kind !== "nolegend";
  return {
    year: kind === "noyear" ? 0 : y,
    year_sure: kind !== "noyear",
    legend_found: legend,
    marks: [
      { id: "m1", description: "grün markiert", color: "#2E8B57", shape: "fill", legend_text: legend ? "Urlaub" : "", suggestion: legend ? "U" : "" },
      { id: "m2", description: "rot eingekreist", color: "#D32F2F", shape: "circle", legend_text: legend ? "krank" : "", suggestion: legend ? "K" : "" }
    ],
    entries,
    note: "",
    mock: true
  };
}

/* ---------- Hilfen ---------- */
function allowed(env) {
  return String(env.ALLOWED_ORIGINS || "https://maliksabti-cyber.github.io").split(",").map(s => s.trim()).filter(Boolean);
}
function cors(origin, env) {
  const h = { "Vary": "Origin" };
  if (origin && allowed(env).includes(origin)) {
    h["Access-Control-Allow-Origin"] = origin;
    h["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    h["Access-Control-Allow-Headers"] = "Content-Type, X-Device";
    h["Access-Control-Max-Age"] = "86400";
  }
  return h;
}
function json(body, status, origin, env) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...cors(origin, env) }
  });
}
function fail(code, msg, status, origin, env) { return json({ error: code, message: msg }, status, origin, env); }

async function sha(s) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].slice(0, 12).map(x => x.toString(16).padStart(2, "0")).join("");
}

/* Tageszähler pro Gerät (und großzügiger pro Internetanschluss). Mit KV dauerhaft, sonst nur im Speicher. */
const memCount = new Map();
async function overLimit(req, env) {
  const limit = Math.max(1, parseInt(env.DAILY_LIMIT || "20", 10) || 20);
  const day = new Date().toISOString().slice(0, 10);
  const dev = String(req.headers.get("X-Device") || "").slice(0, 64);
  const ip = req.headers.get("CF-Connecting-IP") || "";
  const keys = [[`d:${day}:${await sha("dev" + dev + ip)}`, limit], [`i:${day}:${await sha("ip" + ip)}`, limit * 3]];
  for (const [k, max] of keys) {
    let n;
    if (env.LIMITS) n = parseInt((await env.LIMITS.get(k)) || "0", 10);
    else n = memCount.get(k) || 0;
    if (n >= max) return true;
  }
  for (const [k] of keys) {
    if (env.LIMITS) {
      const n = parseInt((await env.LIMITS.get(k)) || "0", 10);
      await env.LIMITS.put(k, String(n + 1), { expirationTtl: 60 * 60 * 26 });
    } else {
      if (memCount.size > 5000) memCount.clear();
      memCount.set(k, (memCount.get(k) || 0) + 1);
    }
  }
  return false;
}

/* Ergebnis prüfen und bereinigen – nichts übernehmen, was nicht ins Format passt */
export function clean(r) {
  const out = { year: 0, year_sure: false, legend_found: false, marks: [], entries: [], note: "" };
  if (!r || typeof r !== "object") return out;
  out.year = Number.isInteger(r.year) && r.year >= 2000 && r.year <= 2100 ? r.year : 0;
  out.year_sure = !!r.year_sure && out.year > 0;
  out.legend_found = !!r.legend_found;
  out.note = typeof r.note === "string" ? r.note.slice(0, 300) : "";
  const ids = new Set();
  for (const m of Array.isArray(r.marks) ? r.marks.slice(0, 12) : []) {
    if (!m || typeof m.id !== "string" || !m.id || ids.has(m.id)) continue;
    ids.add(m.id);
    out.marks.push({
      id: m.id.slice(0, 16),
      description: String(m.description || "Markierung").slice(0, 60),
      color: /^#[0-9a-fA-F]{6}$/.test(m.color || "") ? m.color : "#888888",
      shape: ["fill", "circle", "cross", "line", "other"].includes(m.shape) ? m.shape : "other",
      legend_text: String(m.legend_text || "").slice(0, 60),
      suggestion: [...CODES, "ignore"].includes(m.suggestion) ? m.suggestion : ""
    });
  }
  const seen = new Set();
  for (const e of Array.isArray(r.entries) ? r.entries.slice(0, 400) : []) {
    if (!e || !/^\d{4}-\d\d-\d\d$/.test(e.date || "")) continue;
    const dt = new Date(e.date + "T12:00:00Z");
    if (isNaN(dt) || dt.toISOString().slice(0, 10) !== e.date || seen.has(e.date)) continue;
    const c = Math.max(0, Math.min(1, Number(e.confidence) || 0));
    if (e.kind === "shift" && CODES.includes(e.shift)) out.entries.push({ date: e.date, kind: "shift", shift: e.shift, mark: "", confidence: c });
    else if (e.kind === "marked" && ids.has(e.mark)) out.entries.push({ date: e.date, kind: "marked", shift: "", mark: e.mark, confidence: c });
    else continue;
    seen.add(e.date);
  }
  return out;
}

async function readPhoto(env, data, mediaType) {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const msg = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: mediaType, data } },
        { type: "text", text: PROMPT }
      ]
    }]
  });
  if (msg.stop_reason === "refusal") return { refused: true };
  const t = msg.content.find(b => b.type === "text");
  if (!t) throw new Error("no text");
  return clean(JSON.parse(t.text));
}

export default {
  async fetch(req, env) {
    const origin = req.headers.get("Origin") || "";
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin, env) });
    if (req.method !== "POST" || url.pathname !== "/lesen") return fail("not_found", "Nicht gefunden.", 404, origin, env);
    if (!allowed(env).includes(origin)) return fail("origin", "Diese Anfrage ist nicht erlaubt.", 403, origin, env);

    const len = parseInt(req.headers.get("Content-Length") || "0", 10);
    if (len > MAX_BYTES * 1.4) return fail("too_large", "Das Foto ist zu groß (höchstens 5 MB).", 413, origin, env);

    let body;
    try { body = await req.json(); } catch { return fail("bad_request", "Das Foto konnte nicht gelesen werden.", 400, origin, env); }
    const data = typeof body?.image === "string" ? body.image : "";
    const mediaType = ["image/jpeg", "image/png", "image/webp"].includes(body?.type) ? body.type : "image/jpeg";
    if (!data || !/^[A-Za-z0-9+/=]+$/.test(data.slice(0, 200))) return fail("bad_request", "Das Foto konnte nicht gelesen werden.", 400, origin, env);
    if (Math.floor(data.length * 3 / 4) > MAX_BYTES) return fail("too_large", "Das Foto ist zu groß (höchstens 5 MB).", 413, origin, env);

    if (await overLimit(req, env)) return fail("limit", "Für heute sind alle Foto-Auswertungen aufgebraucht. Bitte morgen erneut versuchen.", 429, origin, env);

    if (!env.ANTHROPIC_API_KEY || env.MOCK === "1") return json(mockResult(url.searchParams.get("mock") || ""), 200, origin, env);

    try {
      const r = await readPhoto(env, data, mediaType);
      if (r.refused) return fail("refused", "Dieses Foto kann nicht ausgewertet werden.", 422, origin, env);
      return json(r, 200, origin, env);
    } catch (e) {
      const st = e && e.status;
      if (st === 429 || st === 529) return fail("busy", "Der Dienst ist gerade ausgelastet. Bitte später erneut versuchen.", 503, origin, env);
      // Nur den Fehlertyp melden – niemals das Foto
      console.error("lesen fehlgeschlagen", st || (e && e.name) || "Fehler");
      return fail("server", "Das Foto konnte gerade nicht gelesen werden. Bitte später erneut versuchen.", 502, origin, env);
    }
  }
};
