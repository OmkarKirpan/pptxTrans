import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const SHARE_SERVICE_URL = process.env.SHARE_SERVICE_URL || 'http://localhost:3001';

// Proxy POST request to create a share link
export async function POST(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  
  // Get session to verify user is authenticated
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    // Get the request body
    const body = await request.json();
    const { sessionId } = body;
    
    // Verify user has access to this session
    const { data: sessionData, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', session.user.id)
      .single();
      
    if (sessionError || !sessionData) {
      return NextResponse.json(
        { error: 'Session not found or you do not have permission' }, 
        { status: 403 }
      );
    }
    
    // Forward the request to the Share Service
    const response = await fetch(`${SHARE_SERVICE_URL}/api/share`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { error: errorData.error || 'Failed to create share link' }, 
        { status: response.status }
      );
    }
    
    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error: any) {
    console.error('Error creating share link:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}

// Proxy GET request to list shares for a session
export async function GET(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  
  // Get session to verify user is authenticated
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // If validating a token, skip ownership check as it's a public endpoint
  const isValidation = searchParams.has('token');
  if (isValidation) {
    const token = searchParams.get('token');
    
    // Forward to the Share Service validation endpoint
    const response = await fetch(`${SHARE_SERVICE_URL}/api/share/validate?token=${token}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { error: errorData.error || 'Invalid token' }, 
        { status: response.status }
      );
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  }
  
  // For listing shares, verify user has access to this session
  if (!sessionId) {
    return NextResponse.json({ error: 'Missing sessionId parameter' }, { status: 400 });
  }
  
  const { data: sessionData, error: sessionError } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('user_id', session.user.id)
    .single();
    
  if (sessionError || !sessionData) {
    return NextResponse.json(
      { error: 'Session not found or you do not have permission' }, 
      { status: 403 }
    );
  }
  
  // Forward to the Share Service list endpoint
  const response = await fetch(`${SHARE_SERVICE_URL}/api/share/list?sessionId=${sessionId}`);
  
  if (!response.ok) {
    const errorData = await response.json();
    return NextResponse.json(
      { error: errorData.error || 'Failed to list shares' }, 
      { status: response.status }
    );
  }
  
  const data = await response.json();
  return NextResponse.json(data);
}

// Proxy DELETE request to revoke a share
export async function DELETE(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  
  // Get session to verify user is authenticated
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    // Get the request body
    const body = await request.json();
    const { shareId } = body;
    
    // Get the share to verify ownership
    const { data: shareData, error: shareError } = await supabase
      .from('session_shares')
      .select('session_shares.*, sessions.user_id')
      .eq('session_shares.id', shareId)
      .join('sessions', 'session_shares.session_id', 'sessions.id')
      .single();
      
    if (shareError || !shareData || shareData.user_id !== session.user.id) {
      return NextResponse.json(
        { error: 'Share not found or you do not have permission' }, 
        { status: 403 }
      );
    }
    
    // Forward the request to the Share Service
    const response = await fetch(`${SHARE_SERVICE_URL}/api/share/revoke`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { error: errorData.error || 'Failed to revoke share' }, 
        { status: response.status }
      );
    }
    
    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error: any) {
    console.error('Error revoking share:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
} 