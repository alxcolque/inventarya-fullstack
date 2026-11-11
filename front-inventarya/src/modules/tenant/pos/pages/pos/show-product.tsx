import { useParams } from "react-router-dom";

import { Product } from "@/modules/tenant/products/components/product";
import { useNavigate } from "react-router-dom";
import { Button } from "@nextui-org/react";
import { useTenantAuthStore } from "@/modules/auth/store/tenantAuth.store";

export const ShowProduct = () => {
  const { slug } = useParams();
  const token = useTenantAuthStore((state) => state.token);
  const navigate = useNavigate();
  return (
    <div className="my-2 px-4 lg:px-6 max-w-[95rem] mx-auto w-full flex flex-col gap-2">
      {/* Boton para volver */}
      <Button
        variant="bordered"
        color="primary"
        size="sm"
        onPress={() => navigate(-1)}
      >
        ← Volver
      </Button>
      <Product slug={slug || ""} token={token || ""} />
    </div>
  )
}