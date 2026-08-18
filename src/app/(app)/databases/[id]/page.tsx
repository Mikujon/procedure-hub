import { DatabaseApp } from "@/components/databases/database-app";

export default function DatabasePage({ params }: { params: { id: string } }) {
  return <DatabaseApp id={params.id} />;
}
