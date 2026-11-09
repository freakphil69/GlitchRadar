import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { fetch as expoFetch } from "expo/fetch";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MaterialCommunityIcons from "@react-native-vector-icons/material-design-icons";

import { apiGet } from "@/src/lib/api";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

type Msg = { role: "user" | "assistant"; text: string };
const SUGGESTIONS = ["Lohnt sich das?", "Wie hoch ist das Storno-Risiko?", "Wie löse ich den Code ein?"];

async function sessionId(): Promise<string> {
  const key = "glitchradar.chatSession";
  let id = await AsyncStorage.getItem(key);
  if (!id) {
    id = `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    await AsyncStorage.setItem(key, id);
  }
  return id;
}

// Ask the AI (Claude) questions about one deal; answers stream in word by word.
export function DealChat({ glitchId }: { glitchId: string }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [sid, setSid] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    sessionId().then(async (id) => {
      setSid(id);
      try {
        const h = await apiGet<Msg[]>(`/glitches/${glitchId}/chat?session_id=${id}`);
        if (alive.current) setMsgs(h);
      } catch {
        // history is optional
      }
    });
    return () => {
      alive.current = false;
    };
  }, [glitchId]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || !sid || busy) return;
    setInput("");
    setError(null);
    setBusy(true);
    setMsgs((m) => [...m, { role: "user", text: q }, { role: "assistant", text: "" }]);
    try {
      const res = await expoFetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/glitches/${glitchId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({ session_id: sid, message: q }),
      });
      if (!res.ok || !res.body) throw new Error("http");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          const data = line.replace(/^data: /, "");
          if (data === "[DONE]") continue;
          const ev = JSON.parse(data) as { delta?: string; error?: string };
          if (ev.error) setError(ev.error);
          if (ev.delta && alive.current) {
            setMsgs((m) => {
              const copy = [...m];
              copy[copy.length - 1] = { role: "assistant", text: copy[copy.length - 1].text + ev.delta };
              return copy;
            });
          }
        }
      }
    } catch {
      setError("Die KI ist gerade nicht erreichbar. Bitte gleich nochmal versuchen.");
    } finally {
      setMsgs((m) => (m.length && m[m.length - 1].role === "assistant" && !m[m.length - 1].text ? m.slice(0, -1) : m));
      setBusy(false);
    }
  };

  return (
    <View style={styles.box} testID="deal-chat">
      <View style={styles.head}>
        <MaterialCommunityIcons name="robot-outline" size={20} color={colors.brandPrimary} />
        <Text style={styles.title}>FRAG DIE KI ZU DIESEM DEAL</Text>
      </View>
      {msgs.map((m, i) => (
        <View
          key={i}
          style={[styles.bubble, m.role === "user" ? styles.user : styles.ai]}
          testID={`deal-chat-msg-${m.role}`}
        >
          {m.text ? (
            <Text style={m.role === "user" ? styles.userText : styles.aiText}>{m.text}</Text>
          ) : (
            <ActivityIndicator size="small" color={colors.brandPrimary} />
          )}
        </View>
      ))}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {msgs.length === 0 ? (
        <View style={styles.suggestWrap}>
          {SUGGESTIONS.map((s) => (
            <Pressable key={s} testID={`deal-chat-suggest-${s}`} onPress={() => send(s)} style={styles.chip}>
              <Text style={styles.chipText}>{s}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <View style={styles.inputRow}>
        <TextInput
          testID="deal-chat-input"
          value={input}
          onChangeText={setInput}
          placeholder="Deine Frage…"
          placeholderTextColor={colors.muted}
          style={styles.input}
          maxLength={500}
          returnKeyType="send"
          onSubmitEditing={() => send(input)}
          editable={!busy}
        />
        <Pressable
          testID="deal-chat-send"
          onPress={() => send(input)}
          disabled={busy || !input.trim()}
          style={[styles.send, (busy || !input.trim()) && { opacity: 0.4 }]}
        >
          <MaterialCommunityIcons name="send" size={18} color={colors.onBrandPrimary} />
        </Pressable>
      </View>
      <Text style={styles.note}>KI-Antworten können falsch sein – prüfe den Original-Beitrag.</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  box: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.md,
    backgroundColor: c.surfaceSecondary,
  },
  head: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.5, color: c.onSurfaceSecondary },
  bubble: { borderRadius: radius.md, padding: spacing.sm + 2, maxWidth: "90%" },
  user: { alignSelf: "flex-end", backgroundColor: c.brandPrimary },
  ai: { alignSelf: "flex-start", backgroundColor: c.surfaceTertiary, minWidth: 48 },
  userText: { fontFamily: fonts.text, fontSize: 14, color: c.onBrandPrimary },
  aiText: { fontFamily: fonts.textRegular, fontSize: 14, lineHeight: 20, color: c.onSurface },
  error: { fontFamily: fonts.textRegular, fontSize: 12, color: c.error },
  suggestWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    height: 36,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceTertiary,
  },
  chipText: { fontFamily: fonts.text, fontSize: 13, color: c.onSurfaceSecondary },
  inputRow: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
  input: {
    flex: 1,
    height: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceTertiary,
    paddingHorizontal: spacing.md,
    color: c.onSurface,
    fontFamily: fonts.text,
    fontSize: 14,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: c.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  note: { fontFamily: fonts.textRegular, fontSize: 11, color: c.muted },
}));
