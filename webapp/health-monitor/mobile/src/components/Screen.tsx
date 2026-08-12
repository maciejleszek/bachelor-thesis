import { PropsWithChildren } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../theme/colors";

interface Props extends PropsWithChildren {
  title: string;
  refreshing?: boolean;
  onRefresh?: () => void;
}

export default function Screen({ title, refreshing, onRefresh, children }: Props) {
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
          ) : undefined
        }
      >
        <Text style={styles.title}>{title}</Text>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Card({ title, children }: PropsWithChildren<{ title?: string }>) {
  return (
    <View style={styles.card}>
      {title ? <Text style={styles.cardTitle}>{title}</Text> : null}
      {children}
    </View>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  title: { color: colors.text, fontSize: 26, fontWeight: "700", marginBottom: 4 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 8,
  },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: "600" },
  empty: { padding: 24, alignItems: "center" },
  emptyText: { color: colors.muted, fontSize: 13, textAlign: "center" },
});
