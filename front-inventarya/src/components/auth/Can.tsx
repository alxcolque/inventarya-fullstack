import React, { ReactNode } from 'react';
import { useTenantAuthStore } from '@/modules/auth/store/tenantAuth.store';
import { useCentralAuthStore } from '@/modules/auth/store/centralAuth.store';
import { isCentral } from '@/utils/tenant';
import { TenantPermission, CentralPermission } from '@/utils/permissions';

interface CanProps {
  do: TenantPermission | CentralPermission;
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Declarative capability checker component.
 * Usage:
 *   <Can do="stores:create" fallback={<span>Sin permisos</span>}>
 *     <Button onClick={openCreateStoreModal}>Nueva Tienda</Button>
 *   </Can>
 */
export const Can: React.FC<CanProps> = ({ do: ability, fallback = null, children }) => {
  const central = isCentral();
  const tenantCan = useTenantAuthStore(state => state.can);
  const centralCan = useCentralAuthStore(state => state.can);

  const allowed = central
    ? centralCan(ability as CentralPermission)
    : tenantCan(ability as TenantPermission);

  if (!allowed) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
