import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

const SHARE_SERVICE_URL = process.env.SHARE_SERVICE_URL || 'http://localhost:3001';

export default async function SharedPage({ params }: { params: { token: string } }) {
  const { token } = params;
  
  try {
    // Validate the token with the Share Service
    const response = await fetch(`${SHARE_SERVICE_URL}/api/share/validate?token=${token}`, {
      next: { revalidate: 0 } // Don't cache this request
    });
    
    if (!response.ok) {
      // Token is invalid, redirect to error page
      redirect('/shared/invalid');
    }
    
    const { valid, sessionId, permissions } = await response.json();
    
    if (!valid) {
      redirect('/shared/invalid');
    }
    
    // Store permissions in a cookie for use in the editor
    cookies().set('share_permissions', JSON.stringify(permissions), {
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 60 * 60 * 24, // 1 day
    });
    
    // Store the token in a cookie
    cookies().set('share_token', token, {
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 60 * 60 * 24, // 1 day
    });
    
    // Redirect to the editor with shared mode
    redirect(`/editor/${sessionId}?shared=true`);
  } catch (error) {
    console.error('Error validating share token:', error);
    redirect('/shared/invalid');
  }
} 