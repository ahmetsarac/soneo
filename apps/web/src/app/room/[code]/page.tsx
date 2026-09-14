import { RoomView } from "@/components/RoomView";

export default async function RoomPage({
  params,
}: PageProps<"/room/[code]">) {
  const { code } = await params;
  return <RoomView code={code} />;
}
