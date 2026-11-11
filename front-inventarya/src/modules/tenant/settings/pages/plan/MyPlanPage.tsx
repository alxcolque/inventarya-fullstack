import React, { useEffect, useState } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Progress,
  Chip,
  Button,
  Divider,
  Skeleton,
} from "@nextui-org/react";
import {
  LuSparkles,
  LuUsers,
  LuStore,
  LuPackage,
  LuCreditCard,
  LuCalendar,
  LuClock,
  LuCheck,
  LuX,
  LuAlertTriangle,
  LuShieldCheck,
  LuArrowUpRight,
  LuRefreshCw,
} from "react-icons/lu";
import { useTenantPlanStore } from "../../store/tenant-plan.store";
import { DynamicBreadcrumbs } from "@/components";

export const MyPlanPage: React.FC = () => {
  const { planInfo, availablePlans, getMyPlan, getAvailablePlans, isLoading } =
    useTenantPlanStore();

  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [showPlansModal, setShowPlansModal] = useState(false);

  useEffect(() => {
    getMyPlan();
    getAvailablePlans();
  }, [getMyPlan, getAvailablePlans]);

  const plan = planInfo?.plan;
  const sub = planInfo?.subscription;
  const trial = planInfo?.trial;
  const usage = planInfo?.usage;

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return "danger";
    if (percentage >= 70) return "warning";
    return "primary";
  };

  const formatNumber = (val: number) => {
    return new Intl.NumberFormat("es-BO").format(val);
  };

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return "Indefinido";
    return new Date(isoString).toLocaleDateString("es-BO", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  if (isLoading && !planInfo) {
    return (
      <div className="my-1 px-2 max-w-7xl mx-auto w-full flex flex-col gap-2 pb-6 animate-in fade-in duration-300">
        <DynamicBreadcrumbs title="Mi Plan y Suscripción" />
        <div className="flex flex-col gap-1">
          <Skeleton className="h-6 w-56 rounded-lg" />
          <Skeleton className="h-4 w-80 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl md:col-span-2" />
        </div>
      </div>
    );
  }

  return (
    <div className="my-1 px-2 max-w-7xl mx-auto w-full flex flex-col gap-2 pb-6 animate-in fade-in duration-300">
      {/* Top Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
        <div>
          <DynamicBreadcrumbs title="Mi Plan y Suscripción" />
          <div className="flex items-center gap-2 mt-0.5">
            <h1 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-1.5">
              <LuCreditCard className="text-primary" size={18} />
              Mi Plan y Suscripción
            </h1>
            {sub?.status && (
              <Chip
                size="sm"
                className="h-5 text-[10px] font-semibold capitalize"
                color={
                  sub.status === "active"
                    ? "success"
                    : sub.status === "trialing"
                    ? "primary"
                    : "danger"
                }
                variant="flat"
              >
                {sub.status === "trialing"
                  ? "Período de Prueba"
                  : sub.status === "active"
                  ? "Plan Activo"
                  : sub.status}
              </Chip>
            )}
          </div>
          <p className="text-[11px] text-default-500 mt-0.5">
            Revisa el consumo de tus recursos, límites contratados y vigencia de tu cuenta.
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="flat"
            size="sm"
            className="h-8 text-xs px-2.5"
            startContent={<LuRefreshCw size={14} />}
            onPress={() => {
              getMyPlan();
              getAvailablePlans();
            }}
            isLoading={isLoading}
          >
            Actualizar
          </Button>
          <Button
            color="primary"
            size="sm"
            variant={showPlansModal ? "flat" : "solid"}
            className="h-8 text-xs font-semibold px-3"
            startContent={<LuArrowUpRight size={15} />}
            onPress={() => setShowPlansModal(!showPlansModal)}
          >
            {showPlansModal ? "Ocultar Planes" : "Ver Planes Disponibles"}
          </Button>
        </div>
      </div>
      <Divider className="my-0.5" />

      {/* Trial Countdown Banner */}
      {trial?.is_trial && (
        <Card className="shadow-none rounded-xl bg-primary-50/50 overflow-hidden">
          <CardBody className="p-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-primary text-primary-foreground rounded-lg shrink-0">
                <LuSparkles size={16} />
              </div>
              <div>
                <h2 className="font-bold text-xs text-foreground">
                  ¡Estás disfrutando de la prueba gratuita del Plan {plan?.name}!
                </h2>
                <p className="text-[11px] text-default-600">
                  {trial.days_remaining !== null && trial.days_remaining > 0 ? (
                    <span>
                      Te quedan <strong className="text-primary font-bold">{trial.days_remaining} días</strong> de prueba (finaliza el <strong>{formatDate(trial.ends_at)}</strong>).
                    </span>
                  ) : (
                    <span className="text-danger font-semibold">
                      Tu período de prueba finaliza hoy.
                    </span>
                  )}
                </p>
              </div>
            </div>
            <Button
              color="primary"
              size="sm"
              className="h-7 text-xs font-semibold px-2.5"
              onPress={() => setShowPlansModal(true)}
            >
              Elegir Plan Definitivo
            </Button>
          </CardBody>
        </Card>
      )}

      {/* Overview Grid: Plan Summary Card + Quick Dates */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
        {/* Active Plan Card */}
        <Card className="shadow-none rounded-xl bg-content1 overflow-hidden lg:col-span-1">
          <CardHeader className="p-2 pb-1 flex justify-between items-start">
            <div>
              <span className="text-[10px] font-bold text-default-400 uppercase tracking-wider">
                Plan Actual
              </span>
              <h2 className="text-base sm:text-lg font-bold text-foreground">
                {plan?.name || "Sin Plan Asignado"}
              </h2>
            </div>
            <div className="p-1.5 bg-primary/10 text-primary rounded-lg">
              <LuCreditCard size={16} />
            </div>
          </CardHeader>
          <Divider />
          <CardBody className="p-2 flex flex-col gap-2">
            <div className="flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-black text-foreground">
                ${plan ? (sub?.billing_cycle === "yearly" ? plan.yearly_price : plan.price) : 0}
              </span>
              <span className="text-[11px] text-default-400">
                / {sub?.billing_cycle === "yearly" ? "año" : "mes"}
              </span>
            </div>

            <p className="text-[11px] text-default-500 leading-snug">
              {plan?.description || "Acceso a las funcionalidades del sistema según los límites contratados."}
            </p>

            <div className="flex flex-col gap-1.5 text-xs text-default-600 bg-default-100/70 p-2 rounded-xl">
              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1 text-default-500">
                  <LuCalendar size={13} /> Inicio:
                </span>
                <span className="font-semibold text-foreground">{formatDate(sub?.starts_at)}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1 text-default-500">
                  <LuClock size={13} /> Renovación:
                </span>
                <span className="font-semibold text-foreground">{formatDate(sub?.ends_at)}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-default-500">Ciclo:</span>
                <span className="font-semibold capitalize text-foreground">
                  {sub?.billing_cycle === "yearly" ? "Anual" : "Mensual"}
                </span>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Real-time Resource Usage */}
        <Card className="shadow-none rounded-xl bg-content1 overflow-hidden lg:col-span-2">
          <CardHeader className="p-2 pb-1 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-default-400 uppercase tracking-wider">
                Consumo en Tiempo Real
              </span>
              <h3 className="text-xs sm:text-sm font-bold text-foreground">
                Límites de Capacidad
              </h3>
            </div>
            <Chip size="sm" variant="flat" color="primary" className="h-5 text-[10px] font-semibold">
              Controlado por Backend
            </Chip>
          </CardHeader>
          <Divider />
          <CardBody className="p-2 flex flex-col gap-2">
            {/* Users Usage */}
            <div className="flex flex-col gap-1 p-2 rounded-xl bg-default-100/70">
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="p-1 bg-primary/10 text-primary rounded-md">
                    <LuUsers size={14} />
                  </div>
                  <span className="font-semibold text-foreground">Usuarios Registrados</span>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <span className="font-bold text-foreground">
                    {usage?.users?.current ?? 0}
                  </span>
                  <span className="text-default-400">/</span>
                  <span className="text-default-500 font-semibold">
                    {usage?.users?.unlimited ? (
                      <Chip size="sm" variant="flat" color="success" className="text-[10px] h-4 px-1">
                        Ilimitado
                      </Chip>
                    ) : (
                      usage?.users?.limit ?? "—"
                    )}
                  </span>
                </div>
              </div>

              {!usage?.users?.unlimited && (
                <Progress
                  aria-label="Usuarios"
                  value={usage?.users?.percentage ?? 0}
                  color={getProgressColor(usage?.users?.percentage ?? 0)}
                  className="h-1.5"
                />
              )}

              <div className="flex justify-between items-center text-[10px] text-default-400">
                <span>
                  {usage?.users?.unlimited
                    ? "Puedes crear tantos usuarios como necesites."
                    : `${usage?.users?.remaining ?? 0} disponibles.`}
                </span>
                {!usage?.users?.unlimited && (
                  <span className="font-semibold">{usage?.users?.percentage ?? 0}% en uso</span>
                )}
              </div>

              {!usage?.users?.unlimited && (usage?.users?.percentage ?? 0) >= 90 && (
                <div className="flex items-center gap-1 text-danger text-[11px] font-semibold bg-danger-50/50 p-1.5 rounded-lg mt-0.5">
                  <LuAlertTriangle size={13} />
                  <span>Has alcanzado o estás cerca del límite de usuarios.</span>
                </div>
              )}
            </div>

            {/* Stores Usage */}
            <div className="flex flex-col gap-1 p-2 rounded-xl bg-default-100/70">
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="p-1 bg-primary/10 text-primary rounded-md">
                    <LuStore size={14} />
                  </div>
                  <span className="font-semibold text-foreground">Tiendas / Sucursales</span>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <span className="font-bold text-foreground">
                    {usage?.stores?.current ?? 0}
                  </span>
                  <span className="text-default-400">/</span>
                  <span className="text-default-500 font-semibold">
                    {usage?.stores?.unlimited ? (
                      <Chip size="sm" variant="flat" color="success" className="text-[10px] h-4 px-1">
                        Ilimitado
                      </Chip>
                    ) : (
                      usage?.stores?.limit ?? "—"
                    )}
                  </span>
                </div>
              </div>

              {!usage?.stores?.unlimited && (
                <Progress
                  aria-label="Tiendas"
                  value={usage?.stores?.percentage ?? 0}
                  color={getProgressColor(usage?.stores?.percentage ?? 0)}
                  className="h-1.5"
                />
              )}

              <div className="flex justify-between items-center text-[10px] text-default-400">
                <span>
                  {usage?.stores?.unlimited
                    ? "Puedes abrir múltiples tiendas según tu crecimiento."
                    : `${usage?.stores?.remaining ?? 0} tiendas disponibles.`}
                </span>
                {!usage?.stores?.unlimited && (
                  <span className="font-semibold">{usage?.stores?.percentage ?? 0}% en uso</span>
                )}
              </div>
            </div>

            {/* Products Usage */}
            <div className="flex flex-col gap-1 p-2 rounded-xl bg-default-100/70">
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="p-1 bg-primary/10 text-primary rounded-md">
                    <LuPackage size={14} />
                  </div>
                  <span className="font-semibold text-foreground">Productos en Catálogo</span>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <span className="font-bold text-foreground">
                    {formatNumber(usage?.products?.current ?? 0)}
                  </span>
                  <span className="text-default-400">/</span>
                  <span className="text-default-500 font-semibold">
                    {usage?.products?.unlimited ? (
                      <Chip size="sm" variant="flat" color="success" className="text-[10px] h-4 px-1">
                        Ilimitado
                      </Chip>
                    ) : (
                      formatNumber(usage?.products?.limit ?? 0)
                    )}
                  </span>
                </div>
              </div>

              {!usage?.products?.unlimited && (
                <Progress
                  aria-label="Productos"
                  value={usage?.products?.percentage ?? 0}
                  color={getProgressColor(usage?.products?.percentage ?? 0)}
                  className="h-1.5"
                />
              )}

              <div className="flex justify-between items-center text-[10px] text-default-400">
                <span>
                  {usage?.products?.unlimited
                    ? "Inventario ilimitado sin restricciones de catálogo."
                    : `${formatNumber(usage?.products?.remaining ?? 0)} productos disponibles.`}
                </span>
                {!usage?.products?.unlimited && (
                  <span className="font-semibold">{usage?.products?.percentage ?? 0}% en uso</span>
                )}
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Included Features Grid */}
      <Card className="shadow-none rounded-xl bg-content1 overflow-hidden">
        <CardHeader className="p-2 pb-1">
          <div>
            <span className="text-[10px] font-bold text-default-400 uppercase tracking-wider">
              Beneficios Incluidos
            </span>
            <h3 className="text-xs sm:text-sm font-bold text-foreground">
              Características de tu Plan
            </h3>
          </div>
        </CardHeader>
        <Divider />
        <CardBody className="p-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-1.5">
            <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-default-100/70">
              <div className="p-1 rounded-full bg-success-100 text-success shrink-0">
                <LuCheck size={12} />
              </div>
              <span className="text-[11px] font-medium text-foreground truncate">Gestión Inventario</span>
            </div>

            <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-default-100/70">
              <div className="p-1 rounded-full bg-success-100 text-success shrink-0">
                <LuCheck size={12} />
              </div>
              <span className="text-[11px] font-medium text-foreground truncate">Punto de Venta (POS)</span>
            </div>

            <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-default-100/70">
              <div className={`p-1 rounded-full shrink-0 ${planInfo?.limits?.reports ? "bg-success-100 text-success" : "bg-default-200 text-default-400"}`}>
                {planInfo?.limits?.reports ? <LuCheck size={12} /> : <LuX size={12} />}
              </div>
              <span className="text-[11px] font-medium text-foreground truncate">Módulo Reportes</span>
            </div>

            <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-default-100/70">
              <div className={`p-1 rounded-full shrink-0 ${planInfo?.limits?.multi_store ? "bg-success-100 text-success" : "bg-default-200 text-default-400"}`}>
                {planInfo?.limits?.multi_store ? <LuCheck size={12} /> : <LuX size={12} />}
              </div>
              <span className="text-[11px] font-medium text-foreground truncate">Múltiples Tiendas</span>
            </div>

            <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-default-100/70">
              <div className={`p-1 rounded-full shrink-0 ${planInfo?.limits?.custom_domain ? "bg-success-100 text-success" : "bg-default-200 text-default-400"}`}>
                {planInfo?.limits?.custom_domain ? <LuCheck size={12} /> : <LuX size={12} />}
              </div>
              <span className="text-[11px] font-medium text-foreground truncate">Dominio Propio</span>
            </div>

            <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-default-100/70">
              <div className="p-1 rounded-full bg-success-100 text-success shrink-0">
                <LuShieldCheck size={12} />
              </div>
              <span className="text-[11px] font-medium text-foreground truncate">Respaldos Auto</span>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Available Plans Catalog (Collapsible or toggleable) */}
      {showPlansModal && (
        <div className="flex flex-col gap-2 pt-1 animate-in fade-in duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-foreground">
                Planes Disponibles para tu Negocio
              </h2>
              <p className="text-[11px] text-default-500">
                Elige el plan adecuado para escalar tus operaciones.
              </p>
            </div>

            {/* Monthly / Yearly cycle toggle */}
            <div className="flex items-center gap-1 bg-default-100/70 p-0.5 rounded-lg">
              <Button
                size="sm"
                variant={billingCycle === "monthly" ? "solid" : "light"}
                color={billingCycle === "monthly" ? "primary" : "default"}
                onPress={() => setBillingCycle("monthly")}
                className="h-6 text-[11px] font-semibold px-2"
              >
                Mensual
              </Button>
              <Button
                size="sm"
                variant={billingCycle === "yearly" ? "solid" : "light"}
                color={billingCycle === "yearly" ? "primary" : "default"}
                onPress={() => setBillingCycle("yearly")}
                className="h-6 text-[11px] font-semibold px-2"
              >
                Anual (Descuento)
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {availablePlans.map((p) => {
              const isCurrent = plan?.id === p.id;
              const price = billingCycle === "yearly" ? p.yearly_price : p.price;

              return (
                <Card
                  key={p.id}
                  className={`shadow-none rounded-xl overflow-hidden transition-all ${
                    isCurrent
                      ? "bg-primary-50/25 ring-1 ring-primary/40"
                      : "bg-content1"
                  }`}
                >
                  <CardHeader className="flex justify-between items-start p-2 pb-1">
                    <div>
                      <h3 className="text-sm font-bold text-foreground">{p.name}</h3>
                      <p className="text-[11px] text-default-500 line-clamp-1">
                        {p.description || "Solución para tu inventario."}
                      </p>
                    </div>
                    {isCurrent && (
                      <Chip size="sm" color="primary" variant="flat" className="h-5 font-bold text-[10px]">
                        PLAN ACTUAL
                      </Chip>
                    )}
                  </CardHeader>
                  <Divider />

                  <CardBody className="p-2 flex flex-col gap-2">
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-black text-foreground">${price}</span>
                      <span className="text-[10px] text-default-400">
                        / {billingCycle === "yearly" ? "año" : "mes"}
                      </span>
                    </div>

                    <div className="flex flex-col gap-1.5 text-xs text-default-700 bg-default-100/60 p-2 rounded-xl">
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <LuCheck className="text-success shrink-0" size={14} />
                        <span>
                          <strong>{p.max_users === null ? "Ilimitados" : p.max_users}</strong> usuarios
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <LuCheck className="text-success shrink-0" size={14} />
                        <span>
                          <strong>{p.max_stores === null ? "Ilimitadas" : p.max_stores}</strong> tiendas
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <LuCheck className="text-success shrink-0" size={14} />
                        <span>
                          <strong>{p.max_products === null ? "Ilimitados" : formatNumber(p.max_products)}</strong> productos
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px]">
                        {p.multi_store ? (
                          <LuCheck className="text-success shrink-0" size={14} />
                        ) : (
                          <LuX className="text-default-400 shrink-0" size={14} />
                        )}
                        <span className={p.multi_store ? "" : "text-default-400"}>
                          Soporte Multi-Tienda
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px]">
                        {p.custom_domain ? (
                          <LuCheck className="text-success shrink-0" size={14} />
                        ) : (
                          <LuX className="text-default-400 shrink-0" size={14} />
                        )}
                        <span className={p.custom_domain ? "" : "text-default-400"}>
                          Dominio Personalizado
                        </span>
                      </div>
                    </div>

                    <div className="mt-auto pt-1">
                      {isCurrent ? (
                        <Button fullWidth disabled variant="flat" size="sm" className="h-7 text-xs font-semibold">
                          Plan en Uso
                        </Button>
                      ) : (
                        <Button
                          fullWidth
                          size="sm"
                          color="primary"
                          variant="flat"
                          className="h-7 text-xs font-semibold"
                          onPress={() => {
                            alert(
                              `Para cambiarte al Plan ${p.name}, contacta a soporte o al administrador central.`
                            );
                          }}
                        >
                          Elegir Plan {p.name}
                        </Button>
                      )}
                    </div>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default MyPlanPage;
