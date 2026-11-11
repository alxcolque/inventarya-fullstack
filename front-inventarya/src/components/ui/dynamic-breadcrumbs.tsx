import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  BreadcrumbItem as NextBreadcrumbItem,
  Breadcrumbs,
} from '@nextui-org/react';

interface DynamicBreadcrumbsProps {
  /**
   * Título en español de la página actual.
   * Ejemplo: "Tiendas", "Productos", "Nueva venta", "Mini Market"
   */
  title?: string;
}

interface BreadcrumbData {
  name: string;
  path: string;
}

const SEGMENT_TRANSLATIONS: Record<string, string> = {
  shops: "Tiendas",
  stores: "Tiendas",
  products: "Productos",
  categories: "Categorías",
  brands: "Marcas",
  locations: "Ubicaciones",
  inventories: "Inventarios",
  inventory: "Inventario",
  input: "Entrada",
  kardex: "Kardex",
  customers: "Clientes",
  suppliers: "Proveedores",
  users: "Usuarios",
  sales: "Ventas",
  orders: "Pedidos",
  settings: "Configuración",
  plan: "Plan",
  plans: "Planes",
  "my-plan": "Mi Plan",
  notifications: "Notificaciones",
  "notification-management": "Gestión de Notificaciones",
  dashboard: "Panel",
  create: "Nuevo",
  edit: "Editar",
  tienda: "Tienda",
  tenants: "Tenants",
  subscriptions: "Suscripciones",
  payments: "Pagos",
  carousel: "Carrusel",
  analytics: "Analíticas",
  administrators: "Administradores",
};

export const DynamicBreadcrumbs = ({
  title,
}: DynamicBreadcrumbsProps) => {
  const location = useLocation();
  const navigate = useNavigate();

  const pathnames = location.pathname
    .split('/')
    .filter(Boolean);

  const isIdSegment = (val: string) => {
    return /^[0-9a-fA-F-]{8,}$/.test(val) || /^\d+$/.test(val);
  };

  const formatSegment = (value: string, isLastSegment: boolean) => {
    const lower = value.toLowerCase();
    if (SEGMENT_TRANSLATIONS[lower]) {
      return SEGMENT_TRANSLATIONS[lower];
    }
    if (isIdSegment(value)) {
      return isLastSegment ? "Detalle" : "Detalle";
    }
    return decodeURIComponent(value)
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  };

  const breadcrumbs: BreadcrumbData[] = pathnames.map(
    (value, index) => {
      const isLast = index === pathnames.length - 1;
      return {
        name:
          isLast && title
            ? title
            : formatSegment(value, isLast),

        path: `/${pathnames
          .slice(0, index + 1)
          .join('/')}`,
      };
    },
  );

  return (
    <Breadcrumbs
      size="sm"
      classNames={{
        list: "gap-1 text-xs",
      }}
    >
      {pathnames.length > 0 && (
        <NextBreadcrumbItem
          key="/"
          onPress={() => navigate("/")}
        >
          <Link
            to="/"
            onClick={(e) => e.stopPropagation()}
            className="text-default-500 hover:text-foreground hover:underline transition-colors"
          >
            Inicio
          </Link>
        </NextBreadcrumbItem>
      )}

      {breadcrumbs.map((breadcrumb, index) => {
        const isLast = index === breadcrumbs.length - 1;

        return (
          <NextBreadcrumbItem
            key={breadcrumb.path}
            isCurrent={isLast}
            onPress={() => navigate(breadcrumb.path)}
          >
            <Link
              to={breadcrumb.path}
              onClick={(e) => e.stopPropagation()}
              className={
                isLast
                  ? "text-foreground font-semibold hover:underline transition-colors cursor-pointer"
                  : "text-default-500 hover:text-foreground hover:underline transition-colors cursor-pointer"
              }
            >
              {breadcrumb.name}
            </Link>
          </NextBreadcrumbItem>
        );
      })}
    </Breadcrumbs>
  );
};
export default DynamicBreadcrumbs;