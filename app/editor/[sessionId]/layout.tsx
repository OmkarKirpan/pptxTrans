import { Metadata } from "next";
import Link from "next/link";
import { History } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "PowerPoint Translator - Editor",
  description: "Translate your PowerPoint slides with precision and ease",
};

export default async function EditorLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { sessionId: string };
}) {
  const { sessionId } = await params;

  return (
    <div className="relative">
      <div className="absolute top-2 right-4 z-10">
        <Link href={`/editor/${sessionId}/audit`} passHref>
          <Button variant="outline" size="sm" className="flex items-center gap-1">
            <History className="h-4 w-4" />
            <span>Audit Log</span>
          </Button>
        </Link>
      </div>
      {children}
    </div>
  );
} 