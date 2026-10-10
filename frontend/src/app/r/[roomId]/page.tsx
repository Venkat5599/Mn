import { notFound } from "next/navigation";
import { RoomBoard } from "@/components/room/RoomBoard";

export default async function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  if (!/^\d{1,9}$/.test(roomId) || roomId === "0") notFound();
  return <RoomBoard roomId={BigInt(roomId)} />;
}
