/**
 * Seed script for local development.
 * Creates: 1 org, 2 companies, 3 products, example echelons, users with different roles.
 *
 * Run: pnpm exec prisma db seed
 *
 * Users are created in both Supabase Auth (admin API) and the Prisma users table
 * so that login works immediately after seeding.
 *
 * Default dev password for all seeded users: Test1234!
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { EchelonState, PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Stable seed IDs (non-user entities) ─────────────────────────────────────
const ORG_ID = '00000000-0000-0000-0000-000000000001';
const COMPANY_A_ID = '00000000-0000-0000-0002-000000000001';
const COMPANY_B_ID = '00000000-0000-0000-0002-000000000002';
const PRODUCT_1_ID = '00000000-0000-0000-0003-000000000001';
const PRODUCT_2_ID = '00000000-0000-0000-0003-000000000002';
const PRODUCT_3_ID = '00000000-0000-0000-0003-000000000003';
const ECHELON_1_ID = '00000000-0000-0000-0004-000000000001';
const ECHELON_2_ID = '00000000-0000-0000-0004-000000000002';

const DEV_PASSWORD = 'Test1234!';

const SEED_USERS = [
  { email: 'super@acme.dev', name: 'Super Admin', role: Role.SUPER_ADMIN },
  { email: 'admin@acme.dev', name: 'Org Admin', role: Role.ADMIN },
  { email: 'manager@acme.dev', name: 'Project Manager', role: Role.MANAGER },
  { email: 'member@acme.dev', name: 'Team Member', role: Role.MEMBER },
  { email: 'viewer@acme.dev', name: 'Stakeholder', role: Role.VIEWER },
];

/**
 * Creates or retrieves a Supabase Auth user.
 * Returns the Supabase user UUID.
 */
async function upsertAuthUser(
  supabase: SupabaseClient,
  email: string,
  name: string,
): Promise<string> {
  const { data: created, error } = await supabase.auth.admin.createUser({
    email,
    password: DEV_PASSWORD,
    email_confirm: true,
    user_metadata: { name },
  });

  if (!error) {
    return created.user.id;
  }

  // User already exists — look it up by email
  if (error.message.toLowerCase().includes('already')) {
    const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const existing = list.users.find((u: { email?: string }) => u.email === email);
    if (existing) return existing.id;
  }

  const msg = error.message;
  throw new Error(`Failed to upsert auth user ${email}: ${msg}`);
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.\n' +
        'Make sure your .env.local is configured correctly.',
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log('🌱 Seeding database...');

  // ── Organization ──────────────────────────────────────────────────────────
  const org = await prisma.organization.upsert({
    where: { id: ORG_ID },
    update: {},
    create: { id: ORG_ID, name: 'Acme Consulting', slug: 'acme-consulting' },
  });
  console.log(`  ✓ Organization: ${org.name}`);

  // ── Supabase Auth users + Prisma users ────────────────────────────────────
  // IDs come from Supabase Auth (not hardcoded) so login works immediately.
  const userIds: Record<string, string> = {};

  for (const u of SEED_USERS) {
    const authId = await upsertAuthUser(supabase, u.email, u.name);
    await prisma.user.upsert({
      where: { email: u.email },
      update: { id: authId, name: u.name },
      create: { id: authId, email: u.email, name: u.name },
    });
    userIds[u.email] = authId;
  }
  console.log(`  ✓ ${String(SEED_USERS.length)} users (Supabase Auth + Prisma)`);

  // ── Memberships ───────────────────────────────────────────────────────────
  for (const u of SEED_USERS) {
    const userId = userIds[u.email];
    if (!userId) continue;
    await prisma.organizationMember.upsert({
      where: { organizationId_userId: { organizationId: ORG_ID, userId } },
      update: {},
      create: { organizationId: ORG_ID, userId, role: u.role, joinedAt: new Date() },
    });
  }
  console.log(`  ✓ ${String(SEED_USERS.length)} memberships`);

  // ── Companies ─────────────────────────────────────────────────────────────
  const companyA = await prisma.company.upsert({
    where: { id: COMPANY_A_ID },
    update: {},
    create: {
      id: COMPANY_A_ID,
      organizationId: ORG_ID,
      name: 'TechCorp SA',
      description: 'Enterprise software company',
      industry: 'Technology',
      website: 'https://techcorp.example.com',
    },
  });

  const companyB = await prisma.company.upsert({
    where: { id: COMPANY_B_ID },
    update: {},
    create: {
      id: COMPANY_B_ID,
      organizationId: ORG_ID,
      name: 'RetailMax SRL',
      description: 'Retail chain optimization',
      industry: 'Retail',
    },
  });
  console.log(`  ✓ Companies: ${companyA.name}, ${companyB.name}`);

  // ── Products ──────────────────────────────────────────────────────────────
  const products = [
    {
      id: PRODUCT_1_ID,
      organizationId: ORG_ID,
      companyId: COMPANY_A_ID,
      name: 'ERP Implementation',
      description: 'Full ERP rollout for TechCorp',
    },
    {
      id: PRODUCT_2_ID,
      organizationId: ORG_ID,
      companyId: COMPANY_A_ID,
      name: 'API Gateway Migration',
      description: 'Migrate legacy APIs to modern gateway',
    },
    {
      id: PRODUCT_3_ID,
      organizationId: ORG_ID,
      companyId: COMPANY_B_ID,
      name: 'Inventory Optimization',
      description: 'AI-driven inventory management system',
    },
  ];

  for (const p of products) {
    await prisma.product.upsert({ where: { id: p.id }, update: {}, create: p });
  }
  console.log(`  ✓ ${String(products.length)} products`);

  // ── Echelons ──────────────────────────────────────────────────────────────
  const echelon1 = await prisma.echelon.upsert({
    where: { id: ECHELON_1_ID },
    update: {},
    create: {
      id: ECHELON_1_ID,
      organizationId: ORG_ID,
      productId: PRODUCT_1_ID,
      name: 'Fase de Levantamiento de Requerimientos',
      state: EchelonState.IN_PROGRESS,
      configBlueprint: { type: 'requirements', sessions: { target: 5 } },
    },
  });

  const echelon2 = await prisma.echelon.upsert({
    where: { id: ECHELON_2_ID },
    update: {},
    create: {
      id: ECHELON_2_ID,
      organizationId: ORG_ID,
      productId: PRODUCT_2_ID,
      name: 'Definición de Arquitectura',
      state: EchelonState.OPEN,
      configBlueprint: { type: 'architecture', sessions: { target: 3 } },
    },
  });
  console.log(`  ✓ Echelons: ${echelon1.name}, ${echelon2.name}`);

  // ── RequiredFields ────────────────────────────────────────────────────────
  await prisma.requiredField.upsert({
    where: { id: '00000000-0000-0000-0005-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0005-000000000001',
      organizationId: ORG_ID,
      echelonId: ECHELON_1_ID,
      label: 'Stakeholder sign-off',
      description: 'All key stakeholders have approved the requirements document',
      isMet: false,
      sortOrder: 1,
    },
  });

  await prisma.requiredField.upsert({
    where: { id: '00000000-0000-0000-0005-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0005-000000000002',
      organizationId: ORG_ID,
      echelonId: ECHELON_1_ID,
      label: 'As-Is process documented',
      description: 'Current state processes are fully documented',
      isMet: true,
      metAt: new Date(),
      sortOrder: 2,
    },
  });
  console.log('  ✓ Required fields');

  // ── Health check ──────────────────────────────────────────────────────────
  await prisma.healthCheck.create({ data: {} });

  console.log('\n✅ Seed complete!');
  console.log('\n📋 Credenciales de acceso:');
  console.log('   Password para todos: Test1234!');
  for (const u of SEED_USERS) {
    console.log(`   ${u.role.padEnd(12)} → ${u.email}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e: unknown) => {
    console.error('Seed failed:', e);
    void prisma.$disconnect();
    process.exit(1);
  });
