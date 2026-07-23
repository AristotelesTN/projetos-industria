import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  api,
  type IntakeResponse,
  type Message,
  type Treatment,
} from "./src/lib/api";
import { colors, examples } from "./src/theme";

const PHONE_KEY = "dosecerta.phone";

function formatWhen(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function App() {
  const [text, setText] = useState("");
  const [phone, setPhone] = useState("5511999999999");
  const [error, setError] = useState<string | null>(null);
  const [store, setStore] = useState("…");
  const [intake, setIntake] = useState<IntakeResponse | null>(null);
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    const [health, tRes, mRes] = await Promise.all([
      api.health(),
      api.treatments(phone || undefined),
      api.messages(phone || undefined),
    ]);
    setStore(health.store);
    setTreatments(tRes.treatments ?? []);
    setMessages(mRes.messages ?? []);
  }, [phone]);

  useEffect(() => {
    void (async () => {
      const saved = await AsyncStorage.getItem(PHONE_KEY);
      if (saved) setPhone(saved);
    })();
  }, []);

  useEffect(() => {
    void AsyncStorage.setItem(PHONE_KEY, phone);
  }, [phone]);

  useEffect(() => {
    void refresh().catch((err: Error) => setError(err.message));
    const id = setInterval(() => {
      void api.tick().catch(() => undefined);
      void refresh().catch(() => undefined);
    }, 30000);
    return () => clearInterval(id);
  }, [refresh]);

  async function onRefresh() {
    setRefreshing(true);
    setError(null);
    try {
      await api.tick();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao atualizar");
    } finally {
      setRefreshing(false);
    }
  }

  async function submitIntake() {
    setLoading(true);
    setError(null);
    try {
      const result = await api.intake(text, phone || undefined);
      setIntake(result);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no intake");
    } finally {
      setLoading(false);
    }
  }

  async function confirmDraft(treatmentId: string) {
    setLoading(true);
    setError(null);
    try {
      await api.confirm(treatmentId);
      setIntake(null);
      setText("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao confirmar");
    } finally {
      setLoading(false);
    }
  }

  async function sendWhatsApp() {
    setLoading(true);
    setError(null);
    try {
      await api.whatsapp(phone || "5511999999999", text);
      setIntake(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no WhatsApp");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.brand}>DoseCerta</Text>
            <Text style={styles.meta}>Mobile · API {store}</Text>
          </View>

          <Text style={styles.heroBrand}>DoseCerta</Text>
          <Text style={styles.heroText}>
            Descreva o tratamento em linguagem natural. A IA monta as doses e avisa no
            WhatsApp até o fim.
          </Text>

          <Text style={styles.label}>WhatsApp</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="5511999999999"
            placeholderTextColor={colors.inkSoft}
          />

          <Text style={styles.label}>Seu tratamento</Text>
          <TextInput
            style={styles.textarea}
            value={text}
            onChangeText={setText}
            multiline
            textAlignVertical="top"
            placeholder='Ex.: "Amoxicilina 500mg de 8/8h por 7 dias, às 14h, avisa 15 min antes."'
            placeholderTextColor={colors.inkSoft}
          />

          <View style={styles.row}>
            <Pressable
              style={[styles.btn, styles.btnPrimary, (loading || text.trim().length < 3) && styles.btnDisabled]}
              disabled={loading || text.trim().length < 3}
              onPress={submitIntake}
            >
              <Text style={styles.btnPrimaryText}>{loading ? "…" : "Montar"}</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.btnSecondary, (loading || text.trim().length < 3) && styles.btnDisabled]}
              disabled={loading || text.trim().length < 3}
              onPress={sendWhatsApp}
            >
              <Text style={styles.btnSecondaryText}>WhatsApp</Text>
            </Pressable>
          </View>

          <View style={styles.chips}>
            {examples.map((example) => (
              <Pressable key={example} style={styles.chip} onPress={() => setText(example)}>
                <Text style={styles.chipText}>{example.slice(0, 36)}…</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.apiHint}>API: {api.baseUrl}</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {loading ? <ActivityIndicator color={colors.bgDeep} style={{ marginTop: 8 }} /> : null}

          {intake ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Revisão da IA</Text>
              {intake.status === "needs_clarification" ? (
                <Text style={styles.warn}>{intake.question}</Text>
              ) : (
                <>
                  <Text style={styles.cardLine}>
                    {intake.draft.medicationName}
                    {intake.draft.dosage ? ` · ${intake.draft.dosage}` : ""}
                  </Text>
                  <Text style={styles.cardMuted}>
                    {intake.draft.frequencyEveryHours
                      ? `a cada ${intake.draft.frequencyEveryHours}h`
                      : `${intake.draft.timesPerDay}x ao dia`}
                    {" · "}
                    {intake.draft.estimatedDoses} doses
                  </Text>
                  <Text style={styles.cardMuted}>
                    {formatWhen(intake.draft.firstDoseAt)} → {formatWhen(intake.draft.endsAt)}
                  </Text>
                  <Pressable
                    style={[styles.btn, styles.btnAccent, loading && styles.btnDisabled]}
                    disabled={loading}
                    onPress={() => confirmDraft(intake.draftId)}
                  >
                    <Text style={styles.btnAccentText}>Confirmar e ativar alertas</Text>
                  </Pressable>
                </>
              )}
            </View>
          ) : null}

          <Text style={styles.sectionTitle}>Tratamentos</Text>
          {treatments.length === 0 ? (
            <Text style={styles.empty}>Nenhum tratamento ainda.</Text>
          ) : (
            treatments.map((treatment) => (
              <View key={treatment.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardLine}>
                    {treatment.medication_name}
                    {treatment.dosage ? ` · ${treatment.dosage}` : ""}
                  </Text>
                  <Text style={styles.pill}>{treatment.status}</Text>
                </View>
                <Text style={styles.cardMuted}>
                  {formatWhen(treatment.first_dose_at)} → {formatWhen(treatment.ends_at)}
                </Text>
                <Text style={styles.cardMuted}>{treatment.dose_count} doses</Text>
                {treatment.status === "draft" ? (
                  <Pressable
                    style={[styles.btn, styles.btnSecondary, { marginTop: 10 }]}
                    onPress={() => confirmDraft(treatment.id)}
                  >
                    <Text style={styles.btnSecondaryText}>Confirmar rascunho</Text>
                  </Pressable>
                ) : null}
              </View>
            ))
          )}

          <Text style={styles.sectionTitle}>WhatsApp (log)</Text>
          {messages.length === 0 ? (
            <Text style={styles.empty}>Sem mensagens ainda.</Text>
          ) : (
            messages.slice(0, 12).map((message) => (
              <View
                key={message.id}
                style={[styles.msg, message.direction === "outbound" ? styles.msgOut : styles.msgIn]}
              >
                <Text
                  style={[
                    styles.msgMeta,
                    message.direction === "outbound" ? styles.msgMetaOut : null,
                  ]}
                >
                  {message.direction} · {formatWhen(message.created_at)}
                </Text>
                <Text
                  style={[
                    styles.msgBody,
                    message.direction === "outbound" ? styles.msgBodyOut : null,
                  ]}
                >
                  {message.body}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.foam,
  },
  scroll: {
    padding: 20,
    paddingBottom: 48,
    gap: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  brand: {
    fontFamily: "System",
    fontSize: 22,
    fontWeight: "700",
    color: colors.bgDeep,
  },
  meta: {
    fontSize: 12,
    color: colors.inkSoft,
  },
  heroBrand: {
    marginTop: 8,
    fontSize: 40,
    fontWeight: "700",
    color: colors.bgDeep,
    letterSpacing: -0.5,
  },
  heroText: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.inkSoft,
    marginBottom: 8,
  },
  label: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "600",
    color: colors.inkSoft,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.ink,
  },
  textarea: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.ink,
    fontSize: 15,
  },
  row: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  btn: {
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimary: {
    flex: 1,
    backgroundColor: colors.bgDeep,
  },
  btnPrimaryText: {
    color: colors.foam,
    fontWeight: "700",
  },
  btnSecondary: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.bgDeep,
    backgroundColor: "transparent",
  },
  btnSecondaryText: {
    color: colors.bgDeep,
    fontWeight: "700",
  },
  btnAccent: {
    marginTop: 12,
    backgroundColor: colors.accent,
  },
  btnAccentText: {
    color: colors.bgDeep,
    fontWeight: "800",
  },
  btnDisabled: {
    opacity: 0.45,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "rgba(255,255,255,0.7)",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: {
    fontSize: 12,
    color: colors.inkSoft,
  },
  apiHint: {
    fontSize: 11,
    color: colors.inkSoft,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
  },
  warn: {
    color: colors.warn,
    marginTop: 8,
    lineHeight: 20,
  },
  card: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderRadius: 18,
    padding: 14,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.bgDeep,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    alignItems: "flex-start",
  },
  cardLine: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: colors.ink,
  },
  cardMuted: {
    marginTop: 4,
    fontSize: 12,
    color: colors.inkSoft,
  },
  pill: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: colors.bgDeep,
    backgroundColor: "rgba(11,46,42,0.1)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  sectionTitle: {
    marginTop: 18,
    fontSize: 22,
    fontWeight: "700",
    color: colors.bgDeep,
  },
  empty: {
    color: colors.inkSoft,
    fontSize: 14,
  },
  msg: {
    borderRadius: 16,
    padding: 12,
    marginTop: 6,
  },
  msgOut: {
    backgroundColor: colors.bgDeep,
  },
  msgIn: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  msgMeta: {
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: colors.inkSoft,
  },
  msgMetaOut: {
    color: "rgba(244,251,248,0.7)",
  },
  msgBody: {
    marginTop: 4,
    fontSize: 14,
    color: colors.ink,
  },
  msgBodyOut: {
    color: colors.foam,
  },
});
