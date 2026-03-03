# Sentry + Vercel — Sourcemaps en producción

> **Fase H — BACKLOG H4.** El SDK de Sentry ya está instalado y configurado. Este documento describe la integración opcional con Vercel para subir source maps en cada deploy y obtener stack traces legibles en producción.

---

## 1. Objetivo

Sin source maps, los errores en Sentry muestran código minificado (archivos `*.js` con líneas ofuscadas). Con la **Sentry Vercel Integration** y `SENTRY_AUTH_TOKEN`, cada deploy a Vercel sube automáticamente los source maps al proyecto Sentry, y los stack traces se resuelven a archivos y líneas originales (p. ej. `echelon-detail-content.tsx:42`).

---

## 2. Pasos (configuración solo en dashboards)

### 2.1 Crear un Auth Token en Sentry

1. En [Sentry](https://sentry.io) → **Settings** → **Auth Tokens** (o [sentry.io/settings/account/api/auth-tokens/](https://sentry.io/settings/account/api/auth-tokens/)).
2. **Create New Token**.
3. Scopes: marcar **project:releases** y **org:read** (o el mínimo que pida la integración).
4. Copiar el token (solo se muestra una vez).

### 2.2 Añadir el token en Vercel

1. **Vercel Dashboard** → tu proyecto → **Settings** → **Environment Variables**.
2. Añadir variable:
   - **Name:** `SENTRY_AUTH_TOKEN`
   - **Value:** el token generado en Sentry.
   - **Environments:** Production (y Preview si quieres source maps en preview).

### 2.3 Instalar la integración Sentry en Vercel

1. **Vercel Dashboard** → **Integrations** (o Marketplace).
2. Buscar **Sentry**.
3. **Add Integration** → seleccionar el proyecto de Vercel y el proyecto/organización de Sentry.
4. La integración usará `SENTRY_AUTH_TOKEN` para subir source maps en cada deploy.

---

## 3. Variable local (opcional)

Para builds locales que quieran subir source maps a Sentry (p. ej. en CI), añadir en `.env.local`:

```bash
SENTRY_AUTH_TOKEN=your_sentry_auth_token
```

No commitear este valor. Está documentado en `.env.example` como opcional.

---

## 4. Verificación

Tras un deploy con la integración activa:

1. En Sentry → **Project** → **Releases**, debería aparecer un release asociado al deploy.
2. Provocar un error en producción y comprobar en el evento de Sentry que el stack trace muestra nombres de archivos y líneas correctos (no minificados).

---

## 5. Referencias

- [Sentry — Vercel Integration](https://docs.sentry.io/product/integrations/deployment/vercel/)
- [Sentry — Source Maps](https://docs.sentry.io/platforms/javascript/sourcemaps/)
