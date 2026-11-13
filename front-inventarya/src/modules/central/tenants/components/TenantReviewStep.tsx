import React from "react";
import { Card, CardBody, Chip, select } from "@nextui-org/react";
import { useTenantFormStore } from "../store/tenantForm.store";
import { usePlansStore } from "../../plans/store/plans.store";
import { useBusinessTypesStore } from "../../business-types/store/businessTypes.store";
import { LuBuilding, LuGlobe, LuCreditCard, LuUser, LuCheckCircle2, LuAlertTriangle, LuQrCode, LuPhone } from "react-icons/lu";

export const TenantReviewStep = () => {
  const { formData, updateSection } = useTenantFormStore();
  const { plans } = usePlansStore();
  const { options: businessTypeOptions } = useBusinessTypesStore();

  const selectedPlan = plans.find((p) => p.id === formData.subscription.plan_id);
  const selectedBusinessType = businessTypeOptions.find((bt) => bt.id === formData.tenant.business_type_id);
  const isFree = selectedPlan ? Number(selectedPlan.price) === 0 : true;

  const paymentMethod = formData.payment.method;

  const handlePaymentMethodChange = (method: 'qr' | 'card' | 'bank' | 'paypal') => {
    updateSection("payment", { method });
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-bold text-default-800">Resumen y Activación</h3>
        <p className="text-sm text-default-500">
          Revisa que todos los datos sean correctos antes de iniciar el despliegue de tu Tenant.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Side: Summary Cards */}
        <div className="flex flex-col gap-4">
          {/* Company & Domain */}
          <Card className="border border-default-200 shadow-none bg-default-50/20">
            <CardBody className="p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-primary font-bold text-sm">
                <LuBuilding size={16} />
                <span>Empresa & Infraestructura</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex flex-col">
                  <span className="text-default-400">Nombre Comercial</span>
                  <span className="font-bold text-default-700">{formData.tenant.name}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-default-400">Subdominio</span>
                  <span className="font-semibold text-primary">{formData.tenant.slug}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-default-400">Base de Datos</span>
                  <span className="font-semibold text-default-700">{formData.tenant.database}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-default-400">Puerto Local</span>
                  <span className="font-semibold text-default-700">{formData.tenant.data?.local_port || 5174}</span>
                </div>
                <div className="flex flex-col col-span-2">
                  <span className="text-default-400">Tipo de Negocio</span>
                  <span className="font-bold text-default-700">{selectedBusinessType?.name || "No seleccionado"}</span>
                </div>
                <div className="flex flex-col col-span-2 pt-1 border-t border-divider/50">
                  <span className="text-default-400 flex items-center gap-1"><LuGlobe size={12}/> Dominio Oficial</span>
                  <span className="font-bold text-primary">{formData.domains[0]?.domain}</span>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Plan & Subscription */}
          <Card className="border border-default-200 shadow-none bg-default-50/20">
            <CardBody className="p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-secondary font-bold text-sm">
                <LuCreditCard size={16} />
                <span>Plan Seleccionado</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex flex-col">
                  <span className="text-default-400">Plan</span>
                  <span className="font-extrabold text-default-800 text-sm">
                    {selectedPlan?.name || "No seleccionado"}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-default-400">Ciclo de Facturación</span>
                  <span className="font-semibold text-default-700 capitalize">
                    {formData.subscription.billing_cycle === 'yearly' ? 'Anual' : 'Mensual'}
                  </span>
                </div>
                <div className="flex flex-col col-span-2">
                  <span className="text-default-400">Importe</span>
                  <span className="font-black text-default-800 text-lg">
                    {isFree ? "Gratuito" : `$${formData.subscription.price} BOB`}
                  </span>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Owner account */}
          <Card className="border border-default-200 shadow-none bg-default-50/20">
            <CardBody className="p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-success font-bold text-sm">
                <LuUser size={16} />
                <span>Propietario y Administrador</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex flex-col">
                  <span className="text-default-400">Nombre</span>
                  <span className="font-semibold text-default-700">{formData.owner.name || "Juan Perez"}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-default-400">Correo Electrónico</span>
                  <span className="font-semibold text-default-700">{formData.owner.email}</span>
                </div>
                <div className="flex flex-col col-span-2 pt-1 border-t border-divider/50">
                  <span className="text-default-400 flex items-center gap-1">
                    <LuPhone size={12} /> Teléfono / WhatsApp
                  </span>
                  <span className="font-semibold text-default-700">
                    {formData.owner.phone_country_code || "+591"} {formData.owner.phone_number || "No especificado"}
                  </span>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Right Side: Activation & Payments Instructions */}
        <div className="flex flex-col justify-center">
          {isFree ? (
            /* Free Plan immediate activation */
            <div className="p-6 rounded-2xl border border-success/30 bg-success-50/10 dark:bg-success-950/10 flex flex-col gap-4 text-center items-center">
              <LuCheckCircle2 className="text-success animate-bounce" size={48} />
              <div className="flex flex-col gap-1">
                <h4 className="text-base font-bold text-success">¡Listo para Desplegar!</h4>
                <p className="text-xs text-default-500">
                  El plan Starter se activa de forma automática e inmediata. Crearemos la base de datos y tus credenciales ahora mismo.
                </p>
              </div>
              <Chip color="success" variant="flat" className="font-bold">Despliegue Instantáneo</Chip>
            </div>
          ) : (
            /* Paid Plan payment-driven activation */
            <div className="p-6 rounded-2xl border border-warning/30 bg-warning-50/10 dark:bg-warning-950/10 flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <LuAlertTriangle className="text-warning mt-0.5 flex-shrink-0" size={24} />
                <div className="flex flex-col gap-1">
                  <h4 className="text-sm font-bold text-warning-700">Activación Pendiente de Pago</h4>
                  <p className="text-xs text-default-500">
                    La base de datos y la cuenta se aprovisionarán inmediatamente. Podrás abrir el panel y administrar tu negocio una vez confirmado el pago inicial.
                  </p>
                </div>
              </div>

              {/* Payment Methods Toggle */}
              <div className="flex flex-col gap-2 mt-2">
                <span className="text-[11px] font-bold text-default-400 uppercase tracking-wider">
                  Método de Pago Preferido
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handlePaymentMethodChange("qr")}
                    className={`py-2 px-3 border rounded-xl text-xs font-bold transition-all ${
                      paymentMethod === "qr"
                        ? "border-warning bg-warning-50 text-warning"
                        : "border-default-200 hover:border-default-300"
                    }`}
                  >
                    Código QR
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePaymentMethodChange("bank")}
                    className={`py-2 px-3 border rounded-xl text-xs font-bold transition-all ${
                      paymentMethod === "bank"
                        ? "border-warning bg-warning-50 text-warning"
                        : "border-default-200 hover:border-default-300"
                    }`}
                  >
                    Transferencia Bancaria
                  </button>
                </div>
              </div>

              {/* Dynamic QR details */}
              {paymentMethod === "qr" && (
                <div className="mt-3 p-4 bg-background border border-default-200 rounded-xl flex flex-col items-center gap-2 text-center">
                  <LuQrCode className="text-default-700 animate-pulse" size={100} />
                  <span className="text-[10px] font-bold text-default-400">
                    Escanea para transferir ${formData.subscription.price} BOB
                  </span>
                </div>
              )}

              {paymentMethod === "bank" && (
                <div className="mt-3 p-4 bg-background border border-default-200 rounded-xl text-xs flex flex-col gap-1">
                  <span className="font-bold text-default-800">Datos de Transferencia:</span>
                  <div className="flex justify-between text-[11px] text-default-600">
                    <span>Banco:</span>
                    <span className="font-semibold text-default-700">Banco Nacional de Bolivia (BNB)</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-default-600">
                    <span>Cuenta Corriente:</span>
                    <span className="font-mono font-bold text-default-800">100-3849583-02</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-default-600">
                    <span>Titular:</span>
                    <span className="font-semibold text-default-700">Inventarya S.R.L.</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
