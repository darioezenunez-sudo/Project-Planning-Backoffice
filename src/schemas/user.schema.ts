import { z } from 'zod';

/** Login form — Fase 5 */
export const loginSchema = z.object({
  email: z.string().email('Correo inválido'),
  password: z.string().min(1, 'La contraseña es requerida'),
});

export type LoginInput = z.infer<typeof loginSchema>;

/** Register (invitation) form — Fase 5 */
export const registerSchema = z
  .object({
    email: z.string().email(),
    fullName: z.string().min(1, 'El nombre es requerido').max(200),
    password: z.string().min(8, 'Mínimo 8 caracteres'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  });

export type RegisterInput = z.infer<typeof registerSchema>;
