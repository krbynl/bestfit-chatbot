import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/app/(auth)/auth";
import { Chat } from "@/components/chat";

export default function Page(props: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="flex h-dvh" />}>
      <ChatPage params={props.params} />
    </Suspense>
  );
}

async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  const session = await auth();
  if (!session) {
    redirect("/api/auth/guest");
  }

  // Just render the BFC Chat - it handles its own state via WordPress backend
  return <Chat id={id} className="h-dvh" />;
}
