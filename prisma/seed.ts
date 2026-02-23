/**
 * Seed script for local development.
 * Creates: 1 org, 2 companies, 3 products, example echelons, users with different roles.
 *
 * Run: pnpm exec prisma db seed
 *
 * NOTE: User IDs must match Supabase auth.users IDs.
 * For local dev with Supabase local, create users via the Supabase dashboard first,
 * then update the IDs below.
 */
import { EchelonState, PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Stable seed IDs ──────────────────────────────────────────────────────────
// Using fixed UUIDs so seeding is idempotent (upsert).

const ORG_ID = '00000000-0000-0000-0000-000000000001';
const USER_SUPER_ID = '00000000-0000-0000-0001-000000000001';
const USER_ADMIN_ID = '00000000-0000-0000-0001-000000000002';
const USER_MANAGER_ID = '00000000-0000-0000-0001-000000000003';
const USER_MEMBER_ID = '00000000-0000-0000-0001-000000000004';
const USER_VIEWER_ID = '00000000-0000-0000-0001-000000000005';
const COMPANY_A_ID = '00000000-0000-0000-0002-000000000001';
const COMPANY_B_ID = '00000000-0000-0000-0002-000000000002';
const PRODUCT_1_ID = '00000000-0000-0000-0003-000000000001';
const PRODUCT_2_ID = '00000000-0000-0000-0003-000000000002';
const PRODUCT_3_ID = '00000000-0000-0000-0003-000000000003';
const ECHELON_1_ID = '00000000-0000-0000-0004-000000000001';
const ECHELON_2_ID = '00000000-0000-0000-0004-000000000002';

async function main() {
  console.log('🌱 Seeding database...');

  // ── Organization ──────────────────────────────────────────────────────────
  const org = await prisma.organization.upsert({
    where: { id: ORG_ID },
    update: {},
    create: {
      id: ORG_ID,
      name: 'Acme Consulting',
      slug: 'acme-consulting',
    },
  });
  console.log(`  ✓ Organization: ${org.name}`);

  // ── Users (mirrors of Supabase auth.users) ────────────────────────────────
  const users = [
    { id: USER_SUPER_ID, email: 'super@acme.dev', name: 'Super Admin' },
    { id: USER_ADMIN_ID, email: 'admin@acme.dev', name: 'Org Admin' },
    { id: USER_MANAGER_ID, email: 'manager@acme.dev', name: 'Project Manager' },
    { id: USER_MEMBER_ID, email: 'member@acme.dev', name: 'Team Member' },
    { id: USER_VIEWER_ID, email: 'viewer@acme.dev', name: 'Stakeholder' },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: {},
      create: user,
    });
  }
  console.log(`  ✓ ${users.length} users`);

  // ── Memberships ───────────────────────────────────────────────────────────
  const memberships: Array<{ userId: string; role: Role }> = [
    { userId: USER_SUPER_ID, role: Role.SUPER_ADMIN },
    { userId: USER_ADMIN_ID, role: Role.ADMIN },
    { userId: USER_MANAGER_ID, role: Role.MANAGER },
    { userId: USER_MEMBER_ID, role: Role.MEMBER },
    { userId: USER_VIEWER_ID, role: Role.VIEWER },
  ];

  for (const m of memberships) {
    await prisma.organizationMember.upsert({
      where: { organizationId_userId: { organizationId: ORG_ID, userId: m.userId } },
      update: {},
      create: {
        organizationId: ORG_ID,
        userId: m.userId,
        role: m.role,
        joinedAt: new Date(),
      },
    });
  }
  console.log(`  ✓ ${memberships.length} memberships`);

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

  for (const product of products) {
    await prisma.product.upsert({
      where: { id: product.id },
      update: {},
      create: product,
    });
  }
  console.log(`  ✓ ${products.length} products`);

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
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error('Seed failed:', e);
    void prisma.$disconnect();
    process.exit(1);
  });
