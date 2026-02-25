import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

import type { ConsolidationOutput } from '@/lib/ai/consolidation.schema';

export type ConsolidationReportPdfData = ConsolidationOutput & {
  echelonName: string;
  productName: string;
  companyName: string;
  date: string;
};

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10 },
  title: { fontSize: 16, marginBottom: 8 },
  meta: { marginBottom: 16, color: '#444' },
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 12, marginBottom: 4, fontWeight: 'bold' },
  paragraph: { marginBottom: 6 },
  listItem: { marginLeft: 12, marginBottom: 2 },
  checklistMet: { color: '#0a0' },
  checklistUnmet: { color: '#a00' },
});

export function ConsolidationReportDocument({ data }: { data: ConsolidationReportPdfData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{data.echelonName}</Text>
        <Text style={styles.meta}>
          {data.productName} · {data.companyName} · {data.date}
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resumen ejecutivo</Text>
          <Text style={styles.paragraph}>{data.executiveSummary}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Decisiones</Text>
          {data.decisions.map((d, i) => (
            <View key={i} style={styles.listItem}>
              <Text>{d.title}</Text>
              <Text>{d.description}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Checklist</Text>
          {data.checklist.map((c, i) => (
            <Text key={i} style={c.met ? styles.checklistMet : styles.checklistUnmet}>
              {c.met ? '✓' : '✗'} {c.label}
              {c.notes ? ` — ${c.notes}` : ''}
            </Text>
          ))}
        </View>

        {data.risksAndMitigations && data.risksAndMitigations.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Riesgos y mitigaciones</Text>
            {data.risksAndMitigations.map((r, i) => (
              <View key={i} style={styles.listItem}>
                <Text>{r.risk}</Text>
                {r.mitigation ? <Text>Mitigación: {r.mitigation}</Text> : null}
              </View>
            ))}
          </View>
        )}
      </Page>
    </Document>
  );
}
