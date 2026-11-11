import { RouteObject } from 'react-router-dom';
import { AuthLayout } from '@/layouts/auth/AuthLayout';
import Login from '@/pages/auth/Login';

/**
 * Auth routes — login page, shared for both Central and Tenant.
 * Domain-awareness is handled inside Login.tsx and AuthLayout.tsx.
 */
export const authRoutes: RouteObject[] = [
  {
    path: '/login',
    element: <AuthLayout />,
    children: [
      { index: true, element: <Login /> },
    ],
  },
];
