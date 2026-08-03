import { NextRequest } from "next/server";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { readData } from "@/lib/data";
import type { ReelScript } from "@/types/reel-script";

export const runtime = "nodejs";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 11, fontFamily: "Helvetica" },
  header: { marginBottom: 16 },
  hook: { fontSize: 16, fontWeight: 700, marginBottom: 4 },
  topic: { fontSize: 10, color: "#555555" },
  beat: { marginBottom: 12, paddingBottom: 8, borderBottom: "1 solid #dddddd" },
  beatHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  beatNumber: { fontSize: 10, color: "#888888" },
  duration: { fontSize: 10, color: "#888888" },
  visual: { fontSize: 12, fontWeight: 700, marginBottom: 4 },
  voiceover: { fontSize: 11, fontStyle: "italic", color: "#333333" },
});

function ShotlistDocument({ script }: { script: ReelScript }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.hook}>{script.hook}</Text>
          <Text style={styles.topic}>{script.topic}</Text>
        </View>
        {script.beats.map((beat, i) => (
          <View key={i} style={styles.beat}>
            <View style={styles.beatHeader}>
              <Text style={styles.beatNumber}>Beat {i + 1}</Text>
              <Text style={styles.duration}>~{beat.estimatedSeconds}s</Text>
            </View>
            <Text style={styles.visual}>{beat.visual}</Text>
            {beat.voiceover && <Text style={styles.voiceover}>&quot;{beat.voiceover}&quot;</Text>}
          </View>
        ))}
      </Page>
    </Document>
  );
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let script: ReelScript;
  try {
    script = await readData<ReelScript>(`reel-scripts/${id}.json`);
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const buffer = await renderToBuffer(<ShotlistDocument script={script} />);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${id}-shotlist.pdf"`,
    },
  });
}
