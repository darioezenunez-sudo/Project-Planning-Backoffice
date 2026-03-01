-- ============================================================
-- RLS Policies — Project-Planning-Backoffice
-- Migration: 20260222000001_rls_policies
-- ============================================================
-- Estrategia:
--   • El cliente service-role (API del backoffice) ignora RLS.
--   • El cliente anon/authenticated (Electron Data Plane y
--     el frontend Next.js con clave anon) debe cumplir estas
--     políticas.
--   • Todas las tablas con organization_id: el usuario debe
--     ser miembro no eliminado de la organización.
--   • Tablas de infraestructura (jobs, idempotency_keys,
--     health_checks): sin políticas → deniegan todo acceso
--     para anon/authenticated; solo service-role puede acceder.
-- ============================================================

-- ─── Extensión pgvector ──────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;

-- ─── Helper: ¿es el usuario actual miembro de la org? ────────
-- SECURITY DEFINER: corre con permisos del dueño de la función,
-- evitando recursión de RLS en organization_members.
CREATE OR REPLACE FUNCTION public.is_org_member(org_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = org_id
      AND om.user_id         = auth.uid()::text
      AND om.deleted_at      IS NULL
  );
$$;

-- ─── organizations ───────────────────────────────────────────
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Los miembros pueden ver su propia organización.
-- Creación/edición/borrado solo vía service-role (backoffice API).
CREATE POLICY "organizations_select_if_member"
  ON public.organizations
  FOR SELECT
  USING (public.is_org_member(id));

-- ─── users ───────────────────────────────────────────────────
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Un usuario ve y edita solo su propio perfil.
CREATE POLICY "users_select_self"
  ON public.users
  FOR SELECT
  USING (id = auth.uid()::text);

CREATE POLICY "users_update_self"
  ON public.users
  FOR UPDATE
  USING (id = auth.uid()::text);

-- ─── organization_members ────────────────────────────────────
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- Los miembros pueden ver el roster completo de su org
-- (necesario para UI de gestión de equipo).
CREATE POLICY "org_members_select"
  ON public.organization_members
  FOR SELECT
  USING (public.is_org_member(organization_id));

-- ─── companies ───────────────────────────────────────────────
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "companies_select_if_member"
  ON public.companies
  FOR SELECT
  USING (public.is_org_member(organization_id));

-- ─── products ────────────────────────────────────────────────
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products_select_if_member"
  ON public.products
  FOR SELECT
  USING (public.is_org_member(organization_id));

-- ─── echelons ────────────────────────────────────────────────
ALTER TABLE public.echelons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "echelons_select_if_member"
  ON public.echelons
  FOR SELECT
  USING (public.is_org_member(organization_id));

-- ─── required_fields ─────────────────────────────────────────
ALTER TABLE public.required_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "required_fields_select_if_member"
  ON public.required_fields
  FOR SELECT
  USING (public.is_org_member(organization_id));

-- ─── decision_links ──────────────────────────────────────────
ALTER TABLE public.decision_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "decision_links_select_if_member"
  ON public.decision_links
  FOR SELECT
  USING (public.is_org_member(organization_id));

-- ─── sessions ────────────────────────────────────────────────
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sessions_select_if_member"
  ON public.sessions
  FOR SELECT
  USING (public.is_org_member(organization_id));

-- ─── executive_summaries ─────────────────────────────────────
ALTER TABLE public.executive_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "executive_summaries_select_if_member"
  ON public.executive_summaries
  FOR SELECT
  USING (public.is_org_member(organization_id));

-- ─── attachments ─────────────────────────────────────────────
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attachments_select_if_member"
  ON public.attachments
  FOR SELECT
  USING (public.is_org_member(organization_id));

-- ─── devices ─────────────────────────────────────────────────
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "devices_select_if_member"
  ON public.devices
  FOR SELECT
  USING (public.is_org_member(organization_id));

-- ─── usage_records ───────────────────────────────────────────
ALTER TABLE public.usage_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usage_records_select_if_member"
  ON public.usage_records
  FOR SELECT
  USING (public.is_org_member(organization_id));

-- ─── audit_logs ──────────────────────────────────────────────
-- organization_id puede ser NULL (eventos de sistema).
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_select_if_member"
  ON public.audit_logs
  FOR SELECT
  USING (
    organization_id IS NULL
    OR public.is_org_member(organization_id)
  );

-- ─── Tablas de infraestructura (solo service-role) ───────────
-- Sin políticas definidas → todo acceso denegado para
-- clientes anon/authenticated. El backoffice (service-role)
-- las accede directamente sin pasar por RLS.

ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;
-- Sin políticas: denegado para anon/authenticated.

ALTER TABLE public.health_checks ENABLE ROW LEVEL SECURITY;
-- Sin políticas: denegado para anon/authenticated.

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
-- Sin políticas: denegado para anon/authenticated.
