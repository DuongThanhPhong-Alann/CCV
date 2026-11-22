import ErdEditor from "@/components/erd-editor";

export default async function DiagramPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ErdEditor diagramId={id} />;
}
