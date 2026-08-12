import { StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/colors";

interface Props {
  icon: string;
  label: string;
  value?: string | number | null;
  unit?: string;
  sub?: string | null;
  color?: string;
}

export default function MetricCard({ icon, label, value, unit, sub, color }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, color ? { color } : null]}>
        {value ?? "—"}
        {value != null && unit ? <Text style={styles.unit}> {unit}</Text> : null}
      </Text>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexBasis: "47%",
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 2,
  },
  icon: { fontSize: 20, marginBottom: 4 },
  label: { color: colors.muted, fontSize: 12 },
  value: { color: colors.text, fontSize: 22, fontWeight: "700" },
  unit: { color: colors.muted, fontSize: 13, fontWeight: "400" },
  sub: { color: colors.muted, fontSize: 11, marginTop: 2 },
});
