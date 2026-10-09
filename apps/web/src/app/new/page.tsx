import { Suspense } from "react";
import { CreateRoom } from "@/components/create/CreateRoom";

export const metadata = { title: "Open a room · Pitchside" };

export default function NewRoomPage() {
  return (
    <Suspense>
      <CreateRoom />
    </Suspense>
  );
}
