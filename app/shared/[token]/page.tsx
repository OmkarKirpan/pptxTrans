'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { validateShareToken } from '@/lib/api/shareApi';
import { useSession } from '@/lib/store'; // Assuming useSession has setShareToken and setUserRole
import { SharePermission, ShareRecord } from '@/types/share';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import type { UserRole } from '@/lib/store/types';

export default function SharedSessionPage() {
  const router = useRouter();
  const params = useParams();
  const { setShareToken, setUserRole, shareToken: currentShareTokenInStore } = useSession();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isValidToken, setIsValidToken] = useState(false);

  useEffect(() => {
    const token = params?.token as string | undefined;

    if (currentShareTokenInStore === token && token) {
        // If this exact token is already validated and in store, redirect immediately
        // This handles cases like browser refresh after successful validation
        // We assume if it's in store, its role is also set.
        // Note: This doesn't re-validate expiry, but simplifies UX for active sessions.
        // A more robust solution might re-validate if a certain time has passed.
        router.replace(`/editor/${localStorage.getItem('sharedSessionIdForToken_'+token)}`); 
        return;
    }

    if (token) {
      const processToken = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const validationResult = await validateShareToken(token);
          if (validationResult.valid && validationResult.payload) {
            const sharedSession: ShareRecord = validationResult.payload;
            
            // Determine UserRole based on permissions
            let role: UserRole = 'viewer'; // Default to viewer
            if (sharedSession.permissions.includes(SharePermission.COMMENT)) {
              // Assuming COMMENT implies ability to review
              role = 'reviewer'; 
            }
            // If EDIT permission exists in future, it could map to 'owner' or a specific 'editor' role

            setShareToken(token); // Store the validated token itself
            setUserRole(role);    // Set the role derived from token permissions
            
            // Store sessionId temporarily for redirect persistence on refresh
            localStorage.setItem(`sharedSessionIdForToken_${token}`, sharedSession.session_id);

            setIsValidToken(true);
            router.replace(`/editor/${sharedSession.session_id}`);
          } else {
            setError(validationResult.message || 'Invalid or expired share link.');
            setIsValidToken(false);
          }
        } catch (err: any) {
          setError(err.message || 'Failed to validate share link. Please try again.');
          setIsValidToken(false);
        }
        setIsLoading(false);
      };
      processToken();
    } else {
      setError('No share token provided.');
      setIsLoading(false);
      setIsValidToken(false);
    }
  }, [params, router, setShareToken, setUserRole, currentShareTokenInStore]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg">Validating share link...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
        <Card className="w-full max-w-md shadow-lg">
            <CardHeader className="items-center">
                <ShieldAlert className="h-12 w-12 text-destructive mb-2" />
                <CardTitle>Access Denied</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
                <p className="text-destructive mb-4">{error}</p>
                <CardDescription className="mb-1">
                    This can happen if the link is incorrect, has expired, or has been revoked.
                </CardDescription>
                <CardDescription>
                    Please check with the person who shared the link with you.
                </CardDescription>
            </CardContent>
            <CardContent className="flex justify-center">
                 <Button asChild>
                    <Link href="/">Go to Homepage</Link>
                </Button>
            </CardContent>
        </Card>
      </div>
    );
  }

  // This state should ideally not be reached if redirect works, but as a fallback:
  if (isValidToken) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-lg">Redirecting to session...</p>
        </div>
      );
  }

  return null; // Should not be reached
} 