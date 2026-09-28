"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useProfile } from "@/lib/useProfile";
import { FullScreenMessage } from "@/components/ui";

/** Where the installed app opens: sends each person to their own screen. */
export default function StartPage() {
  const router = useRouter();
  const { loading, userId, profile } = useProfile();

  useEffect(() => {
    if (loading) return;
    if (!userId) return router.replace("/");
    router.replace(profile?.role === "admin" ? "/admin" : profile?.role === "driver" ? "/driver" : "/rider");
  }, [loading, userId, profile, router]);

  return (
    <FullScreenMessage>
      <p className="wide text-4xl font-black">Mashi</p>
    </FullScreenMessage>
  );
}
