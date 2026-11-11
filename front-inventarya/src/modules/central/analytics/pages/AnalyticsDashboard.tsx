import React, { useEffect } from "react";
import { 
  Card, 
  CardBody, 
  CardHeader, 
  Divider, 
  Progress, 
  Button, 
  Avatar, 
  Chip,
  Skeleton,
  Tooltip
} from "@nextui-org/react";
import { 
  LuUsers, 
  LuBuilding2, 
  LuTrendingUp, 
  LuTrendingDown,
  LuDollarSign,
  LuArrowUpRight,
  LuCalendar,
  LuExternalLink,
  LuRefreshCw,
  LuShieldCheck,
  LuSparkles,
  LuStore
} from "react-icons/lu";
import { Link } from "react-router-dom";
import { DynamicBreadcrumbs, CompactNumber } from "@/components";
import { useAnalyticsStore } from "../store/analytics.store";

export const AnalyticsDashboard: React.FC = () => {
  const { stats, getBusinessStats, isLoading } = useAnalyticsStore();

  useEffect(() => {
    getBusinessStats();
  }, [getBusinessStats]);

  const handleRefresh = () => {
    getBusinessStats();
  };

  const isGrowthPositive = (stats?.growth_rate ?? 0) >= 0;

  // Tarjetas principales para la cuadrícula responsiva (2 columnas en celular, 4 en desktop)
  const summaryCards = [
    {
      title: "Tenants Totales",
      value: stats?.total_tenants ?? 0,
      prefix: "",
      icon: <LuBuilding2 className="text-primary" size={20} />,
      badgeColor: "bg-primary-50 text-primary dark:bg-primary-950/50 dark:text-primary-400",
      accentBorder: "border-primary-100 dark:border-primary-900/30",
      trendText: stats?.tenants_growth !== undefined ? `${stats.tenants_growth >= 0 ? '+' : ''}${stats.tenants_growth}%` : null,
      trendPositive: (stats?.tenants_growth ?? 0) >= 0,
      description: stats?.new_tenants_this_month !== undefined 
        ? `${stats.new_tenants_this_month} nuevos este mes` 
        : "Negocios registrados",
    },
    {
      title: "Suscripciones Activas",
      value: stats?.active_subscriptions ?? 0,
      prefix: "",
      icon: <LuSparkles className="text-secondary" size={20} />,
      badgeColor: "bg-secondary-50 text-secondary dark:bg-secondary-950/50 dark:text-secondary-400",
      accentBorder: "border-secondary-100 dark:border-secondary-900/30",
      trendText: stats?.trialing_subscriptions ? `${stats.trialing_subscriptions} en prueba` : "100% al día",
      trendPositive: true,
      description: `${stats?.active_subscriptions ?? 0} negocios con plan vigente`,
    },
    {
      title: "Ingresos (MRR)",
      value: stats?.monthly_revenue ?? 0,
      prefix: "$",
      icon: <LuDollarSign className="text-success" size={20} />,
      badgeColor: "bg-success-50 text-success dark:bg-success-950/50 dark:text-success-400",
      accentBorder: "border-success-100 dark:border-success-900/30",
      trendText: "Recurrente",
      trendPositive: true,
      description: "Facturación mensual estimada",
    },
    {
      title: "Usuarios Centrales",
      value: stats?.active_users ?? 0,
      prefix: "",
      icon: <LuUsers className="text-warning" size={20} />,
      badgeColor: "bg-warning-50 text-warning dark:bg-warning-950/50 dark:text-warning-400",
      accentBorder: "border-warning-100 dark:border-warning-900/30",
      trendText: "Operativos",
      trendPositive: true,
      description: "Superadmins y soporte activo",
    },
  ];

  return (
    <div className="flex flex-col gap-5 sm:gap-6 animate-in fade-in duration-300 pb-10">
      <DynamicBreadcrumbs title="Analíticas" />
      
      {/* Cabecera Principal */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-background/60 backdrop-blur-md p-4 sm:p-6 rounded-2xl border border-divider/60 shadow-sm">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              Business Hub
            </h1>
            <Chip 
              size="sm" 
              variant="flat" 
              color="success" 
              startContent={<span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse ml-1 mr-0.5" />}
              className="text-[11px] font-semibold h-5"
            >
              Datos en Vivo
            </Chip>
          </div>
          <p className="text-xs sm:text-sm text-default-500">
            Métricas reales del ecosistema multitenant y suscripciones de Inventarya
          </p>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          <Button 
            size="sm" 
            variant="flat" 
            color="default" 
            className="flex-1 sm:flex-initial font-medium text-xs h-9"
            startContent={<LuRefreshCw size={14} className={isLoading ? "animate-spin" : ""} />}
            onClick={handleRefresh}
            isDisabled={isLoading}
          >
            Actualizar
          </Button>
          <Button 
            as={Link}
            to="/tenants"
            size="sm" 
            color="primary" 
            variant="shadow" 
            className="flex-1 sm:flex-initial font-semibold text-xs h-9"
            startContent={<LuStore size={14} />}
          >
            Ver Tenants
          </Button>
        </div>
      </div>

      {/* Tarjetas KPI: 2 Columnas en Celular (grid-cols-2), 4 en Desktop (lg:grid-cols-4) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
        {summaryCards.map((card, i) => (
          <Card 
            key={i} 
            className={`border ${card.accentBorder} shadow-sm hover:shadow-md transition-all duration-200 rounded-2xl bg-content1/80 backdrop-blur-sm`}
          >
            <CardBody className="p-3.5 sm:p-5 flex flex-col justify-between gap-3">
              {/* Icono y Badge de Tendencia */}
              <div className="flex items-center justify-between">
                <div className={`p-2 rounded-xl ${card.badgeColor}`}>
                  {card.icon}
                </div>
                {card.trendText && (
                  <Chip
                    size="sm"
                    variant="flat"
                    color={card.trendPositive ? "success" : "danger"}
                    className="h-5 text-[10px] sm:text-[11px] font-bold px-1.5"
                    startContent={
                      card.trendPositive 
                        ? <LuArrowUpRight size={12} className="ml-0.5" /> 
                        : <LuTrendingDown size={12} className="ml-0.5" />
                    }
                  >
                    {card.trendText}
                  </Chip>
                )}
              </div>

              {/* Título y Valor Compacto en Móvil (k para mil, m para millón) */}
              <div>
                <p className="text-[11px] sm:text-xs text-default-500 font-bold uppercase tracking-wider line-clamp-1">
                  {card.title}
                </p>
                <div className="text-xl sm:text-2xl md:text-3xl font-black mt-1 text-foreground tracking-tight">
                  {isLoading ? (
                    <Skeleton className="h-7 w-20 rounded-lg mt-1" />
                  ) : (
                    <CompactNumber 
                      value={card.value} 
                      prefix={card.prefix}
                      decimals={1}
                      mobileCompactOnly
                    />
                  )}
                </div>
              </div>

              {/* Descripción breve */}
              <p className="text-[10px] sm:text-xs text-default-400 line-clamp-1">
                {card.description}
              </p>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Fila Principal: Lista de Tenants Recientes & Distribución por Plan */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">
        {/* Tabla Responsiva de Tenants Recientes */}
        <Card className="lg:col-span-2 border border-divider/60 shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="flex justify-between items-center px-4 sm:px-6 pt-5 pb-3">
            <div className="flex flex-col gap-0.5">
              <h3 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                <LuBuilding2 className="text-primary" size={18} />
                Tenants Recientes
              </h3>
              <p className="text-xs text-default-500">
                Últimos negocios registrados en la plataforma
              </p>
            </div>
            <Button 
              as={Link} 
              to="/tenants" 
              size="sm" 
              variant="light" 
              color="primary"
              className="text-xs font-semibold"
            >
              Ver todos
            </Button>
          </CardHeader>
          <Divider />
          <CardBody className="p-0">
            {isLoading ? (
              <div className="p-4 flex flex-col gap-3">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-3">
                      <Skeleton className="w-10 h-10 rounded-xl" />
                      <div className="flex flex-col gap-1.5">
                        <Skeleton className="w-32 h-4 rounded-md" />
                        <Skeleton className="w-24 h-3 rounded-md" />
                      </div>
                    </div>
                    <Skeleton className="w-16 h-6 rounded-full" />
                  </div>
                ))}
              </div>
            ) : !stats?.recent_tenants || stats.recent_tenants.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center justify-center gap-2">
                <LuBuilding2 className="text-default-300" size={36} />
                <p className="text-sm font-semibold text-default-600">No hay tenants registrados aún</p>
                <p className="text-xs text-default-400">Crea el primer tenant para visualizar su información aquí.</p>
              </div>
            ) : (
              /* Envoltorio responsivo para la tabla/lista en móviles y tablets */
              <div className="overflow-x-auto w-full">
                <div className="min-w-[500px] divide-y divide-divider/40">
                  {stats.recent_tenants.map((tenant) => {
                    const domainUrl = tenant.domain.startsWith("http") 
                      ? tenant.domain 
                      : import.meta.env.DEV
                        ? `http://${tenant.domain}${tenant.domain.includes("localhost") && !tenant.domain.includes(":") ? ":5173" : ""}`
                        : `https://${tenant.domain}`;

                    return (
                      <div 
                        key={tenant.id} 
                        className="flex items-center justify-between px-4 sm:px-6 py-3.5 hover:bg-default-50/80 dark:hover:bg-default-100/10 transition-colors"
                      >
                        {/* Avatar & Nombre del Tenant */}
                        <div className="flex items-center gap-3.5">
                          <Avatar 
                            name={tenant.name} 
                            radius="lg" 
                            className="bg-primary/15 text-primary font-bold w-10 h-10 text-sm shrink-0"
                          />
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-foreground">
                              {tenant.name}
                            </span>
                            <span className="text-xs text-default-400 font-mono flex items-center gap-1">
                              {tenant.domain}
                            </span>
                          </div>
                        </div>

                        {/* Plan, Fecha, Estado y Enlace */}
                        <div className="flex items-center gap-4 sm:gap-6">
                          {/* Plan Badge */}
                          {tenant.plan_name && (
                            <Chip 
                              size="sm" 
                              variant="bordered" 
                              className="border-default-300 text-default-600 text-[11px] h-6 hidden sm:flex"
                            >
                              {tenant.plan_name}
                            </Chip>
                          )}

                          {/* Fecha de Registro */}
                          <div className="hidden sm:flex flex-col items-end">
                            <span className="text-[10px] text-default-400 uppercase font-semibold tracking-wider">
                              Registrado
                            </span>
                            <span className="text-xs font-medium text-default-600">
                              {new Date(tenant.created_at).toLocaleDateString()}
                            </span>
                          </div>

                          {/* Estado Activo / Inactivo */}
                          <Chip 
                            size="sm" 
                            variant="flat" 
                            color={tenant.status === "active" ? "success" : "danger"}
                            className="capitalize text-[11px] font-bold h-6"
                            startContent={
                              <span className={`w-1.5 h-1.5 rounded-full ml-1 mr-0.5 ${
                                tenant.status === "active" ? "bg-success" : "bg-danger"
                              }`} />
                            }
                          >
                            {tenant.status}
                          </Chip>

                          {/* Enlace al sitio del Tenant */}
                          <Tooltip content="Abrir dominio del tenant" placement="top">
                            <a
                              href={domainUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 rounded-lg text-default-400 hover:text-primary hover:bg-primary-50 dark:hover:bg-primary-950/50 transition-colors"
                              title={`Ir a ${domainUrl}`}
                            >
                              <LuExternalLink size={16} />
                            </a>
                          </Tooltip>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Suscripciones por Plan & Resumen Comercial */}
        <Card className="border border-divider/60 shadow-sm rounded-2xl">
          <CardHeader className="px-5 sm:px-6 pt-5 pb-3">
            <div className="flex flex-col gap-0.5">
              <h3 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                <LuSparkles className="text-secondary" size={18} />
                Suscripciones por Plan
              </h3>
              <p className="text-xs text-default-500">Distribución por tier de servicio activo</p>
            </div>
          </CardHeader>
          <Divider />
          <CardBody className="px-5 sm:px-6 py-4 flex flex-col gap-5">
            {isLoading ? (
              <div className="flex flex-col gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex flex-col gap-2">
                    <div className="flex justify-between">
                      <Skeleton className="w-20 h-4 rounded" />
                      <Skeleton className="w-12 h-4 rounded" />
                    </div>
                    <Skeleton className="w-full h-2 rounded-full" />
                  </div>
                ))}
              </div>
            ) : !stats?.subscriptions_by_plan || stats.subscriptions_by_plan.length === 0 ? (
              <div className="py-6 text-center text-xs text-default-400">
                No hay planes configurados aún.
              </div>
            ) : (
              stats.subscriptions_by_plan.map((plan, i) => (
                <div key={i} className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-end">
                    <div className="flex flex-col">
                      <span className="text-xs sm:text-sm font-bold text-foreground">{plan.name}</span>
                      <span className="text-[11px] text-default-400">
                        {plan.count} {plan.count === 1 ? "cliente" : "clientes"}
                      </span>
                    </div>
                    <span className="text-xs sm:text-sm font-black text-primary">
                      {plan.percentage}%
                    </span>
                  </div>
                  <Progress 
                    aria-label={plan.name}
                    value={plan.percentage} 
                    color={i === 0 ? "primary" : i === 1 ? "secondary" : "success"}
                    className="h-2 rounded-full"
                    size="sm"
                  />
                </div>
              ))
            )}
            
            <Divider className="my-1" />
            
            {/* Tasa de Cancelación / Churn Rate Real */}
            <div className="bg-default-50 dark:bg-default-100/10 p-4 rounded-xl flex items-center justify-between border border-divider/40">
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-bold uppercase text-default-500 tracking-wider">
                  Churn Rate
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-black text-foreground">
                    {stats?.churn_rate ?? 0}%
                  </span>
                  <span className="text-[11px] text-success font-semibold">
                    Excelente retención
                  </span>
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-success-50 text-success dark:bg-success-950/40">
                <LuShieldCheck size={20} />
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
};
