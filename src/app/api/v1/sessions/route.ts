import { NextResponse } from 'next/server';

// Sessions are created and listed via the nested echelon route:
// POST /api/v1/echelons/:id/sessions
// GET  /api/v1/echelons/:id/sessions
// Individual session access: GET/PATCH/DELETE /api/v1/sessions/:id
export async function GET() {
  return NextResponse.json(
    { error: 'Use GET /api/v1/echelons/:id/sessions to list sessions' },
    { status: 404 },
  );
}

export async function POST() {
  return NextResponse.json(
    { error: 'Use POST /api/v1/echelons/:id/sessions to create a session' },
    { status: 404 },
  );
}
