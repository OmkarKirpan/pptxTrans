import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function InvalidSharePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4">
      <div className="max-w-md w-full space-y-8 text-center">
        <h1 className="text-4xl font-bold">Invalid Share Link</h1>
        <p className="text-lg text-muted-foreground">
          The share link you tried to access is invalid or has expired.
        </p>
        <div className="pt-4">
          <Button asChild>
            <Link href="/">Return to Home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
} 